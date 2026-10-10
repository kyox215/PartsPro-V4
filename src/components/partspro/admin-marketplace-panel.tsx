"use client";

import * as React from "react";
import { AdminFieldGroup } from "./admin-field-group";
import { useI18n } from "./i18n-provider";
import { marketplaceActionBlocker } from "@/lib/admin-marketplace-readiness.mjs";
import { Dialog, DialogContent, DialogBody, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { marketplaceText } from "@/lib/admin-marketplace-copy";
import {
  CheckCircle2,
  ExternalLink,
  Play,
  Plus,
  RefreshCcw,
  Save,
  Send,
  Settings2,
  ShoppingBag,
  Trash2,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { AdminSkeletonRows, AdminNotice, AdminActionButton } from "./admin-feedback";

type EbayEnvironment = "sandbox" | "production";

type MarketplaceOverview = {
  categoryMappings: CategoryMapping[];
  connection: MarketplaceConnection | null;
  jobs: MarketplaceJob[];
  listings: MarketplaceListing[];
  orderLinks: MarketplaceOrderLink[];
  settings: MarketplaceSettings;
  summary: {
    blocked: number;
    connected: boolean;
    eligible: number;
    failedJobs: number;
    importedOrders: number;
    published: number;
    queuedJobs: number;
  };
};

type MarketplaceSettings = {
  autoPublishEnabled: boolean;
  autoSyncEnabled: boolean;
  defaultConditionId: string;
  defaultConditionLabel: string;
  enabled: boolean;
  environment: EbayEnvironment;
  fulfillmentPolicyId: string | null;
  listingDuration: string;
  markupFixed: number;
  markupPercent: number;
  merchantLocationKey: string | null;
  offerFormat: string;
  orderImportEnabled: boolean;
  paymentPolicyId: string | null;
  productionEnabled: boolean;
  returnPolicyId: string | null;
  stockBuffer: number;
};

type MarketplaceConnection = {
  accountLabel: string | null;
  connected: boolean;
  connectionStatus: string;
  environment: EbayEnvironment;
  lastConnectedAt: string | null;
  lastError: string | null;
  tokenExpiresAt: string | null;
};

type CategoryMapping = {
  aspects: Record<string, string[]>;
  brand: string | null;
  conditionId: string;
  conditionLabel: string;
  ebayCategoryId: string;
  ebayCategoryName: string | null;
  ebayCategoryTreeId: string;
  enabled: boolean;
  id: string;
  localCategory: string;
  modelSeries: string | null;
  requiredAspects: unknown[];
};

type MarketplaceListing = {
  blockers: string[];
  computedPrice: number;
  computedQuantity: number;
  ebayItemWebUrl: string | null;
  ebayListingId: string | null;
  ebayOfferId: string | null;
  eligibilityStatus: string;
  id: string;
  lastErrorMessage: string | null;
  lastPublishedAt: string | null;
  lastSyncedAt: string | null;
  listingStatus: string;
  productName: string;
  sku: string;
  title: string | null;
};

type MarketplaceJob = {
  attempts: number;
  createdAt: string;
  errorMessage: string | null;
  id: string;
  jobType: string;
  status: string;
  targetOrderId: string | null;
  targetSku: string | null;
  updatedAt: string;
};

type MarketplaceOrderLink = {
  currency: string;
  externalOrderId: string;
  importStatus: string;
  importedAt: string | null;
  lastError: string | null;
  localOrderNo: string | null;
  total: number;
};

type DraftState = {
  mappings: CategoryMapping[];
  settings: MarketplaceSettings;
};

type AdminMarketplacePanelProps = {
  permissions?: readonly string[];
};

type EbayQueueAction = "plan_listings" | "publish_eligible" | "sync_inventory" | "import_orders";

const queueActionPermissionLabels: Record<EbayQueueAction, string> = {
  import_orders: "管理 eBay 订单",
  plan_listings: "发布 eBay 商品",
  publish_eligible: "发布 eBay 商品",
  sync_inventory: "同步 eBay 价格库存",
};

const queueActionPermissions: Record<EbayQueueAction, string> = {
  import_orders: "ebay.orders",
  plan_listings: "ebay.publish",
  publish_eligible: "ebay.publish",
  sync_inventory: "ebay.sync_inventory",
};

const emptySettings: MarketplaceSettings = {
  autoPublishEnabled: false,
  autoSyncEnabled: true,
  defaultConditionId: "1000",
  defaultConditionLabel: "Nuovo",
  enabled: false,
  environment: "sandbox",
  fulfillmentPolicyId: "",
  listingDuration: "GTC",
  markupFixed: 0,
  markupPercent: 0,
  merchantLocationKey: "",
  offerFormat: "FIXED_PRICE",
  orderImportEnabled: true,
  paymentPolicyId: "",
  productionEnabled: false,
  returnPolicyId: "",
  stockBuffer: 1,
};

export function AdminMarketplacePanel({ permissions = [] }: AdminMarketplacePanelProps) {
  const { locale } = useI18n();
  const t = React.useCallback((value: string) => marketplaceText(value, locale), [locale]);
  const [overview, setOverview] = React.useState<MarketplaceOverview | null>(null);
  const [draft, setDraft] = React.useState<DraftState>({
    mappings: [],
    settings: emptySettings,
  });
  const [policyOptions, setPolicyOptions] = React.useState<Record<string, Array<{ id: string; name: string | null }>> | null>(null);
  const [policyError, setPolicyError] = React.useState<string | null>(null);
  const [savedDraft, setSavedDraft] = React.useState<string | null>(null);
  const queueAttempts = React.useRef<Record<string,string>>({});
  const [unconfirmedScope, setUnconfirmedScope] = React.useState<{ action: EbayQueueAction; skus: string[]; requestId: string } | null>(null);
  const [queueUnknown, setQueueUnknown] = React.useState(false);
  const [queueReviewed, setQueueReviewed] = React.useState(false);
  const [previewAction, setPreviewAction] = React.useState<"publish_eligible" | "sync_inventory" | null>(null);
  const [previewSkus, setPreviewSkus] = React.useState<string[]>([]);
  const [queueProgress, setQueueProgress] = React.useState<{ processed: number; succeeded: number; failed: number } | null>(null);
  const dirty = savedDraft !== null && JSON.stringify(draft) !== savedDraft;
  const dirtyRef = React.useRef(false);
  React.useEffect(() => { dirtyRef.current = dirty; }, [dirty, queueUnknown]);
  React.useEffect(() => { const protect = (event: BeforeUnloadEvent) => { if (dirty || queueUnknown) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", protect); return () => window.removeEventListener("beforeunload", protect); }, [dirty, queueUnknown]);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [noticeTone, setNoticeTone] = React.useState<"info" | "success" | "warning">("info");
  const [pending, setPending] = React.useState<string | null>("load");
  const permissionSet = React.useMemo(() => new Set(permissions), [permissions]);
  const canConnectEbay = permissionSet.has("ebay.connect");
  const canManageSettings = permissionSet.has("ebay.settings");
  const canPublishListings = permissionSet.has("ebay.publish");
  const canPlanListings = canPublishListings;
  const canSyncInventory = permissionSet.has("ebay.sync_inventory");
  const canImportOrders = permissionSet.has("ebay.orders");
  const canRunJobs = permissionSet.has("ebay.jobs");

  const loadOverview = React.useCallback(async () => {
    setPending((current) => current ?? "load");
    setError(null);

    try {
      const response = await fetch("/api/admin/ebay", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as { data?: MarketplaceOverview; error?: unknown };

      if (!response.ok || !payload.data) {
        throw new Error(t(readApiError(payload.error) ?? "") || t("eBay 面板数据读取失败。"));
      }

      setOverview(payload.data);
      setQueueReviewed(true);
      if (!dirtyRef.current) {
        const next = { mappings: payload.data.categoryMappings, settings: payload.data.settings };
        setDraft(next); setSavedDraft(JSON.stringify(next));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("eBay 面板数据读取失败。"));
    } finally {
      setPending((current) => (current === "load" ? null : current));
    }
  }, [t]);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadOverview();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadOverview]);

  const updateSettings = React.useCallback((patch: Partial<MarketplaceSettings>) => {
    if (unconfirmedScope) return;
    setDraft((current) => ({
      ...current,
      settings: {
        ...current.settings,
        ...patch,
      },
    }));
  }, [unconfirmedScope]);

  const updateMapping = React.useCallback(
    (index: number, patch: Partial<CategoryMapping>) => {
      if (unconfirmedScope) return;
      setDraft((current) => ({
        ...current,
        mappings: current.mappings.map((mapping, mappingIndex) =>
          mappingIndex === index ? { ...mapping, ...patch } : mapping
        ),
      }));
    },
    [unconfirmedScope]
  );

  async function loadPolicies() {
    if (pending || dirty || unconfirmedScope || !canManageSettings) return;
    setPending("policies"); setPolicyError(null);
    try {
      const response = await fetch("/api/admin/ebay/policies", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.data?.policies || payload.data.environment !== draft.settings.environment) throw new Error(locale.startsWith("zh") ? "政策读取失败。请核对已保存环境、连接和账号权限。" : "Lettura condizioni non riuscita. Verifica ambiente salvato, collegamento e autorizzazioni.");
      setPolicyOptions(payload.data.policies);
    } catch (error) { setPolicyError(error instanceof Error ? error.message : "Error"); } finally { setPending(null); }
  }

  async function saveSettings() {
    if (unconfirmedScope) return;
    if (!canManageSettings) {
      setError(missingPermissionMessage(t("管理 eBay 设置"), locale));
      setNotice(null);
      return;
    }

    setPending("save");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/ebay", {
        body: JSON.stringify({
          ...draft.settings,
          categoryMappings: draft.mappings.map((mapping) => ({
            brand: emptyToNull(mapping.brand),
            aspects: mapping.aspects,
            conditionId: mapping.conditionId,
            conditionLabel: mapping.conditionLabel,
            ebayCategoryId: mapping.ebayCategoryId,
            ebayCategoryName: emptyToNull(mapping.ebayCategoryName),
            ebayCategoryTreeId: mapping.ebayCategoryTreeId,
            enabled: mapping.enabled,
            localCategory: mapping.localCategory,
            modelSeries: emptyToNull(mapping.modelSeries),
            requiredAspects: mapping.requiredAspects,
          })),
        }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const payload = (await response.json()) as { data?: MarketplaceOverview; error?: unknown };

      if (!response.ok || !payload.data) {
        throw new Error(t(readApiError(payload.error) ?? "") || t("eBay 设置保存失败。"));
      }

      setOverview(payload.data);
      setDraft({
        mappings: payload.data.categoryMappings,
        settings: payload.data.settings,
      });
      setSavedDraft(JSON.stringify({ mappings: payload.data.categoryMappings, settings: payload.data.settings }));
      setNoticeTone("success");
      setNotice(t("设置已保存。"));
    } catch (saveError) {
      setError(saveError instanceof Error ? t(saveError.message) : t("eBay 设置保存失败。"));
    } finally {
      setPending(null);
    }
  }

  async function queueAction(action: EbayQueueAction, skus?: string[]) {
    if (queueUnknown) return;
    if (dirty || pending) { setError(locale.startsWith("zh") ? "请先保存设置和映射，再使用已保存设置生成或执行任务。" : "Salva impostazioni e categorie prima di creare attività."); return; }
    if (!permissionSet.has(queueActionPermissions[action])) {
      setError(missingPermissionMessage(t(queueActionPermissionLabels[action]), locale));
      setNotice(null);
      return;
    }

    const blocker = marketplaceActionBlocker(draft.settings, overview?.connection, action);
    if (blocker) { setError(readinessMessage(blocker, locale)); return; }
    const attemptKey = JSON.stringify([action, [...(skus ?? [])].sort()]);
    if (unconfirmedScope && JSON.stringify([unconfirmedScope.action, [...unconfirmedScope.skus].sort()]) !== attemptKey) { setError(locale.startsWith("zh") ? "请先完成原任务核对；未确认的任务范围已冻结。" : "Verifica il tentativo originale: il suo ambito è bloccato."); return; }
    const requestId = unconfirmedScope?.requestId ?? queueAttempts.current[attemptKey] ?? crypto.randomUUID();
    queueAttempts.current[attemptKey] = requestId;
    setUnconfirmedScope({ action, skus: [...(skus ?? [])], requestId });
    let knownRefusal = false;
    setQueueReviewed(false);
    setPending(action);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/ebay", {
        body: JSON.stringify({ action, requestId, ...(skus ? { skus } : {}) }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      if (response.status === 400 || response.status === 403) { knownRefusal = true; setUnconfirmedScope(null); }
      if (response.status >= 500 || response.status === 409) { setQueueUnknown(true); }
      const payload = (await response.json()) as {
        data?: {
          blocked: number;
          eligible: number;
          enqueued: number;
          evaluated: number;
          skipped: number;
        };
        error?: unknown;
      };

      if (!response.ok || !payload.data) {
        if (response.ok) setQueueUnknown(true);
        throw new Error(t(readApiError(payload.error) ?? "") || t("eBay 任务入队失败。"));
      }

      delete queueAttempts.current[attemptKey];
      setUnconfirmedScope(null);
      setPreviewAction(null);
      setNoticeTone(action === "plan_listings" ? "info" : "success");
      setNotice(queueActionNotice(action, payload.data, locale));
      await loadOverview();
    } catch (actionError) {
      if (!knownRefusal) setQueueUnknown(true);
      setError(actionError instanceof Error ? t(actionError.message) : t("eBay 任务入队失败。"));
    } finally {
      setPending(null);
    }
  }

  async function runJobs() {
    if (!canRunJobs) {
      setError(missingPermissionMessage(t("执行 eBay 队列"), locale));
      setNotice(null);
      return;
    }

    setPending("run");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/ebay/jobs/run", {
        body: JSON.stringify({ limit: 5 }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as {
        data?: { processed: number; results?: Array<{ ok: boolean }> };
        error?: unknown;
      };

      if (!response.ok || !payload.data) {
        throw new Error(t(readApiError(payload.error) ?? "") || t("eBay 队列执行失败。"));
      }

      const results = payload.data.results ?? [];
      const failed = results.filter(result => !result.ok).length;
      setQueueProgress({ processed: payload.data.processed, succeeded: results.filter(result => result.ok).length, failed });
      setNoticeTone(failed ? "warning" : payload.data.processed ? "success" : "info");
      setNotice(locale.startsWith("zh") ? `本轮处理 ${payload.data.processed} 条，成功 ${results.filter(result => result.ok).length} 条，失败 ${failed} 条。` : `Elaborate ${payload.data.processed}: ${results.filter(result => result.ok).length} riuscite, ${failed} non riuscite.`);
      await loadOverview();
    } catch (runError) {
      setError(runError instanceof Error ? t(runError.message) : t("eBay 队列执行失败。"));
    } finally {
      setPending(null);
    }
  }

  function connectEbay() {
    if (unconfirmedScope) return;
    if (dirty) { setError(locale.startsWith("zh") ? "请保存设置后连接；连接页面会离开当前草稿。" : "Salva le impostazioni prima di collegare eBay."); return; }
    if (!canConnectEbay) {
      setError(missingPermissionMessage(t("连接 eBay"), locale));
      setNotice(null);
      return;
    }

    const environment = draft.settings.environment;
    window.location.assign(`/api/admin/ebay/oauth?environment=${environment}`);
  }

  function reviewQueueAction(action: "publish_eligible" | "sync_inventory" | "import_orders") {
    if (dirty || pending || queueUnknown) return;
    const blocker = marketplaceActionBlocker(draft.settings, overview?.connection, action);
    if (blocker) { setError(readinessMessage(blocker, locale)); return; }
    if (action === "import_orders") {
      if (window.confirm(locale.startsWith("zh") ? "确认将当前已保存环境的 eBay 订单拉取任务加入队列？导入将在执行队列时发生。" : "Accodare l’importazione ordini dell’ambiente salvato? L’importazione avverrà eseguendo la coda.")) void queueAction(action);
      return;
    }
    if (unconfirmedScope && unconfirmedScope.action !== action) { setError(locale.startsWith("zh") ? "请先核对并完成原任务。" : "Verifica e completa prima il tentativo originale."); return; }
    const candidates = (overview?.listings ?? []).filter(item => action === "publish_eligible" ? item.eligibilityStatus === "eligible" : item.listingStatus === "published");
    if (!candidates.length) { setError(locale.startsWith("zh") ? "当前预览没有可处理商品，请先生成计划或核对已刊登商品。" : "Nessun prodotto elaborabile nell’anteprima. Prepara il piano o verifica le inserzioni pubblicate."); return; }
    setPreviewSkus(unconfirmedScope?.skus ?? candidates.map(item => item.sku)); setPreviewAction(action);
  }
  const previewRows = (overview?.listings ?? []).filter(item => previewAction === "publish_eligible" ? item.eligibilityStatus === "eligible" : item.listingStatus === "published");
  function resumeOriginalAttempt() {
    setQueueUnknown(false); setError(null);
    if (unconfirmedScope?.action === "publish_eligible" || unconfirmedScope?.action === "sync_inventory") {
      setPreviewSkus(unconfirmedScope.skus); setPreviewAction(unconfirmedScope.action);
    }
  }
  const isBusy = pending !== null;
  const connection = overview?.connection;
  const isConfigLocked = isBusy || Boolean(unconfirmedScope);

  if (pending === "load" && !overview) {
    return <MarketplacePanelSkeleton />;
  }

  return (
    <div data-admin-mutating={pending && pending !== "load" ? "true" : "false"} data-admin-dirty={dirty || queueUnknown ? "true" : "false"} className="min-w-0 space-y-4">
      {unconfirmedScope && <AdminNotice tone="warning" message={locale.startsWith("zh") ? "原任务范围已冻结；核对后重试仍处理同一组 SKU。请先完成原任务再开始新的范围。" : "Ambito originale bloccato: il retry conserva gli stessi SKU. Completa il tentativo prima di scegliere un altro ambito."} />}
      {unconfirmedScope && !queueUnknown && !previewAction && <Button variant="outline" disabled={isBusy} onClick={() => { if (unconfirmedScope.action === "publish_eligible" || unconfirmedScope.action === "sync_inventory") resumeOriginalAttempt(); else void queueAction(unconfirmedScope.action,unconfirmedScope.skus.length ? unconfirmedScope.skus : undefined); }}>{locale.startsWith("zh") ? "继续原任务" : "Continua il tentativo originale"}</Button>}
      {queueUnknown && <AdminNotice tone="warning"><p>{locale.startsWith("zh") ? "任务提交结果尚未确认。请刷新核对队列；重复请求会沿用原任务标识，不重新创建已确认任务。" : "Esito dell’invio non confermato. Aggiorna e controlla la coda; il tentativo conserva l’identificativo originale per evitare duplicati."}</p><Button variant="outline" disabled={isBusy} onClick={() => void loadOverview()}>{locale.startsWith("zh") ? "重读队列核对" : "Rileggi la coda"}</Button><Button variant="outline" disabled={isBusy || !queueReviewed} onClick={resumeOriginalAttempt}>{locale.startsWith("zh") ? "已核对，继续原任务" : "Verificato, continua il tentativo"}</Button></AdminNotice>}
      <Dialog open={previewAction !== null} onOpenChange={open => { if (!open && !isBusy) setPreviewAction(null); }}>
        <DialogContent scrollLayout="body" className="sm:max-w-2xl"><DialogHeader><DialogTitle>{locale.startsWith("zh") ? "核对 eBay 任务范围" : "Verifica prodotti e attività eBay"}</DialogTitle><DialogDescription>{locale.startsWith("zh") ? `环境：${draft.settings.environment}；只处理下面勾选的 SKU，最多100个。价格和库存为当前预览，执行时服务会重新校验。` : `Ambiente: ${draft.settings.environment}. Solo gli SKU selezionati, massimo 100. Prezzi e stock sono un’anteprima; il servizio li verificherà all’esecuzione.`}</DialogDescription></DialogHeader>
        <DialogBody className="space-y-2">{queueUnknown && <AdminNotice tone="warning"><p>{locale.startsWith("zh") ? "提交结果未知，请先重读队列核对。原任务标识已保留。" : "Esito non confermato. Rileggi la coda; identificativo originale conservato."}</p><Button variant="outline" disabled={isBusy} onClick={() => void loadOverview()}>{locale.startsWith("zh") ? "重读队列核对" : "Rileggi la coda"}</Button><Button variant="outline" disabled={isBusy || !queueReviewed} onClick={resumeOriginalAttempt}>{locale.startsWith("zh") ? "已核对，继续原任务" : "Verificato, continua il tentativo"}</Button></AdminNotice>}<p className="text-sm">{locale.startsWith("zh") ? `已选择 ${previewSkus.length}/${previewRows.length}` : `Selezionati ${previewSkus.length}/${previewRows.length}`}</p>{previewRows.map(item => <label key={item.sku} className="flex items-start gap-3 rounded border p-3 text-sm"><input type="checkbox" disabled={isBusy || Boolean(unconfirmedScope)} checked={previewSkus.includes(item.sku)} onChange={event => setPreviewSkus(current => event.target.checked ? [...current,item.sku] : current.filter(sku => sku !== item.sku))}/><span className="min-w-0 break-words"><strong>{item.productName}</strong><br/>{item.sku} · EUR {item.computedPrice.toFixed(2)} · {locale.startsWith("zh") ? "可发布数量" : "Quantità"} {item.computedQuantity}</span></label>)}</DialogBody><DialogFooter><Button variant="outline" disabled={isBusy} onClick={() => setPreviewAction(null)}>{unconfirmedScope ? (locale.startsWith("zh") ? "关闭并保留未确认任务" : "Chiudi e conserva il tentativo") : (locale.startsWith("zh") ? "取消" : "Annulla")}</Button><AdminActionButton pending={pending === previewAction && previewAction !== null} disabled={isBusy || queueUnknown || dirty || !previewSkus.length || !previewAction || Boolean(marketplaceActionBlocker(draft.settings, connection, previewAction))} onClick={() => { if (previewAction) void queueAction(previewAction,previewSkus); }}>{locale.startsWith("zh") ? "确认范围并加入队列" : "Conferma e accoda"}</AdminActionButton></DialogFooter></DialogContent>
      </Dialog>
      <section className="space-y-2 rounded-lg border bg-white p-3">
        <h2 className="font-bold">{locale.startsWith("zh") ? "eBay 就绪步骤" : "Preparazione eBay"}</h2>
        <ol className="grid gap-2 text-sm sm:grid-cols-4">{[
          [Boolean(connection?.connected), locale.startsWith("zh") ? "1 · 连接账号" : "1 · Collega account"],
          [Boolean(draft.settings.merchantLocationKey && draft.settings.paymentPolicyId && draft.settings.returnPolicyId && draft.settings.fulfillmentPolicyId), locale.startsWith("zh") ? "2 · 选择仓库与销售政策" : "2 · Sede e condizioni"],
          [draft.mappings.some(mapping => mapping.enabled && mapping.ebayCategoryId), locale.startsWith("zh") ? "3 · 设置类目映射" : "3 · Associa categorie"],
          [!dirty && Boolean(savedDraft), locale.startsWith("zh") ? "4 · 保存后生成计划" : "4 · Salva e prepara il piano"],
        ].map(([ready, label]) => <li key={String(label)} className={cn("rounded border p-2", ready ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50")}>{ready ? "✓ " : "○ "}{label}</li>)}</ol>
        <p className="text-xs text-slate-500">{locale.startsWith("zh") ? "生成计划可离线检查；发布、同步和拉单必须满足已保存环境、连接与对应开关。" : "Il piano permette verifiche offline. Pubblicazione, sincronizzazione e importazione richiedono ambiente, connessione e opzioni salvati."}</p>
        {dirty && <AdminNotice tone="warning" message={locale.startsWith("zh") ? "有未保存修改。已锁住刊登计划等操作；刷新会保留草稿。" : "Modifiche non salvate: le azioni dipendenti dalle impostazioni sono sospese. La bozza resta al refresh."} />}
        {queueProgress && <div className="flex flex-wrap items-center gap-2 text-sm"><span>{locale.startsWith("zh") ? `本轮 ${queueProgress.processed} 条；失败 ${queueProgress.failed} 条；仍排队 ${overview?.summary.queuedJobs ?? "…"} 条。` : `Ultimo gruppo: ${queueProgress.processed}, errori: ${queueProgress.failed}, ancora in coda: ${overview?.summary.queuedJobs ?? "…"}.`}</span><Button variant="outline" disabled={isBusy || !canRunJobs || overview?.summary.queuedJobs === 0} onClick={() => void runJobs()}>{locale.startsWith("zh") ? "继续处理下一组（最多5条）" : "Elabora i prossimi 5"}</Button></div>}
      </section>
      <section className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <SummaryTile label={t("连接")} value={t(connectionStatusLabel(connection))} tone={connection?.connected ? "good" : "warn"} />
        <SummaryTile label={t("可发布商品")} value={overview?.summary.eligible ?? 0} tone="good" />
        <SummaryTile label={t("已刊登")} value={overview?.summary.published ?? 0} tone="neutral" />
        <SummaryTile label={t("失败/阻断")} value={(overview?.summary.failedJobs ?? 0) + (overview?.summary.blocked ?? 0)} tone="bad" />
      </section>

      {(error || notice) && (
        <AdminNotice tone={error ? queueUnknown ? "warning" : "error" : noticeTone} message={error ?? notice} />
      )}

      <section className="space-y-2 rounded-lg border bg-white p-3"><h3 className="font-bold">{locale.startsWith("zh") ? "从 eBay 账号选择销售政策" : "Scegli le condizioni del tuo account eBay"}</h3><Button variant="outline" disabled={isBusy || queueUnknown || dirty || !canManageSettings || !connection?.connected} onClick={() => void loadPolicies()}>{locale.startsWith("zh") ? "读取已保存环境的政策" : "Leggi condizioni dell'ambiente salvato"}</Button>{policyError && <AdminNotice tone="error" message={policyError} />}{policyOptions && <div className="grid gap-2 sm:grid-cols-3">{([['payment','paymentPolicyId',locale.startsWith("zh") ? '付款政策' : 'Pagamento'],['return','returnPolicyId',locale.startsWith("zh") ? '退货政策' : 'Resi'],['fulfillment','fulfillmentPolicyId',locale.startsWith("zh") ? '配送政策' : 'Spedizione']] as const).map(([kind,key,label]) => <label key={kind} className="space-y-1 text-sm">{label}<select className="h-10 w-full rounded border bg-white px-2" value={draft.settings[key] ?? ""} disabled={isConfigLocked || !canManageSettings} onChange={event => updateSettings({ [key]: event.target.value })}><option value="">{locale.startsWith("zh") ? "请选择" : "Seleziona"}</option>{draft.settings[key] && !(policyOptions[kind] ?? []).some(option => option.id === draft.settings[key]) && <option value={draft.settings[key]!}>{draft.settings[key]} · {locale.startsWith("zh") ? "当前值（未读取到）" : "Valore attuale non trovato"}</option>}{(policyOptions[kind] ?? []).map(option => <option key={option.id} value={option.id}>{option.name ?? option.id}</option>)}</select></label>)}</div>}</section>
      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-lg bg-white">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingBag className="size-4 text-primary" />
              {t("eBay 连接")}</CardTitle>
            <CardAction>
              <StatusBadge status={connection?.connectionStatus ?? "disconnected"} />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4"><fieldset disabled={isConfigLocked} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("站点")}>
                <Input value="EBAY_IT / EUR" readOnly />
              </Field>
              <Field label={t("环境")}>
                <Select
                  disabled={isConfigLocked || !canManageSettings}
                  value={draft.settings.environment}
                  onValueChange={(value) =>
                    updateSettings({ environment: value as EbayEnvironment })
                  }
                >
                  <SelectTrigger aria-label={t("环境")} className="w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("账号")}>
                <Input value={connection?.accountLabel ?? t("未连接")} readOnly />
              </Field>
              <Field label={t("Token 到期")}>
                <Input value={formatDateTime(connection?.tokenExpiresAt)} readOnly />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={connectEbay}
                disabled={isConfigLocked || !canConnectEbay}
                title={!canConnectEbay ? missingPermissionMessage(t("连接 eBay"), locale) : undefined}
              >
                <ExternalLink className="size-4" />
                {t("连接 eBay")}</Button>
              <Button type="button" variant="outline" onClick={() => { if (!dirty || window.confirm(locale.startsWith("zh") ? "刷新会保留未保存草稿，继续？" : "Aggiornare mantenendo la bozza?")) void loadOverview(); }} disabled={isBusy}>
                <RefreshCcw className={cn("size-4", pending === "load" && "animate-spin")} />
                {t("刷新")}</Button>
            </div>
          </fieldset></CardContent>
        </Card>

        <Card className="rounded-lg bg-white">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="size-4 text-primary" />
              {t("自动化设置")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4"><fieldset disabled={isConfigLocked} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ToggleField
                checked={draft.settings.enabled}
                label={t("启用 eBay")}
                onCheckedChange={(enabled) => updateSettings({ enabled })}
              />
              <ToggleField
                checked={draft.settings.autoPublishEnabled}
                label={t("自动发布")}
                onCheckedChange={(autoPublishEnabled) => updateSettings({ autoPublishEnabled })}
              />
              <ToggleField
                checked={draft.settings.autoSyncEnabled}
                label={t("同步价格库存")}
                onCheckedChange={(autoSyncEnabled) => updateSettings({ autoSyncEnabled })}
              />
              <ToggleField
                checked={draft.settings.orderImportEnabled}
                label={t("订单回流")}
                onCheckedChange={(orderImportEnabled) => updateSettings({ orderImportEnabled })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
              <Field label={locale.startsWith("zh") ? "eBay 仓库标识" : "Sede magazzino eBay"}>
                <Input
                  value={draft.settings.merchantLocationKey ?? ""}
                  onChange={(event) =>
                    updateSettings({ merchantLocationKey: event.currentTarget.value })
                  }
                />
              </Field>
              <Field label={locale.startsWith("zh") ? "付款政策" : "Condizioni pagamento"}>
                <Input
                  value={draft.settings.paymentPolicyId ?? ""}
                  onChange={(event) =>
                    updateSettings({ paymentPolicyId: event.currentTarget.value })
                  }
                />
              </Field>
              <Field label={locale.startsWith("zh") ? "退货政策" : "Condizioni reso"}>
                <Input
                  value={draft.settings.returnPolicyId ?? ""}
                  onChange={(event) =>
                    updateSettings({ returnPolicyId: event.currentTarget.value })
                  }
                />
              </Field>
              <Field label={locale.startsWith("zh") ? "配送政策" : "Condizioni spedizione"}>
                <Input
                  value={draft.settings.fulfillmentPolicyId ?? ""}
                  onChange={(event) =>
                    updateSettings({ fulfillmentPolicyId: event.currentTarget.value })
                  }
                />
              </Field>
              <Field label={t("加价百分比")}>
                <NumberInput
                  min={0}
                  value={draft.settings.markupPercent}
                  onValueChange={(markupPercent) => updateSettings({ markupPercent })}
                />
              </Field>
              <Field label={t("固定加价 EUR")}>
                <NumberInput
                  min={0}
                  value={draft.settings.markupFixed}
                  onValueChange={(markupFixed) => updateSettings({ markupFixed })}
                />
              </Field>
              <Field label={t("安全库存")}>
                <NumberInput
                  integer
                  min={0}
                  value={draft.settings.stockBuffer}
                  onValueChange={(stockBuffer) => updateSettings({ stockBuffer })}
                />
              </Field>
              <Field label={t("默认成色")}>
                <Input
                  value={draft.settings.defaultConditionId}
                  onChange={(event) =>
                    updateSettings({ defaultConditionId: event.currentTarget.value })
                  }
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-2">
              <AdminActionButton
                pending={pending === "save"}
                type="button"
                onClick={saveSettings}
                disabled={isConfigLocked || !canManageSettings}
                title={!canManageSettings ? missingPermissionMessage(t("管理 eBay 设置"), locale) : undefined}
              >
                {pending !== "save" && <Save className="size-4" />}
                {t("保存设置")}</AdminActionButton>
              <ActionButton
                disabled={isBusy || queueUnknown || dirty || !canPlanListings}
                icon={CheckCircle2}
                label={t("生成刊登计划")}
                loading={pending === "plan_listings"}
                onClick={() => void queueAction("plan_listings")}
                title={!canPlanListings ? missingPermissionMessage(t("发布 eBay 商品"), locale) : undefined}
              />
              <ActionButton
                disabled={isBusy || queueUnknown || dirty || !canPublishListings || Boolean(marketplaceActionBlocker(draft.settings, connection, "publish_eligible"))}
                icon={Send}
                label={t("发布完整商品")}
                loading={pending === "publish_eligible"}
                onClick={() => reviewQueueAction("publish_eligible")}
                title={!canPublishListings ? missingPermissionMessage(t("发布 eBay 商品"), locale) : undefined}
              />
              <ActionButton
                disabled={isBusy || queueUnknown || dirty || !canSyncInventory || Boolean(marketplaceActionBlocker(draft.settings, connection, "sync_inventory"))}
                icon={RefreshCcw}
                label={t("同步库存价格")}
                loading={pending === "sync_inventory"}
                onClick={() => reviewQueueAction("sync_inventory")}
                title={!canSyncInventory ? missingPermissionMessage(t("同步 eBay 价格库存"), locale) : undefined}
              />
              <ActionButton
                disabled={isBusy || queueUnknown || dirty || !canImportOrders || Boolean(marketplaceActionBlocker(draft.settings, connection, "import_orders"))}
                icon={Truck}
                label={t("拉取 eBay 订单")}
                loading={pending === "import_orders"}
                onClick={() => reviewQueueAction("import_orders")}
                title={!canImportOrders ? missingPermissionMessage(t("管理 eBay 订单"), locale) : undefined}
              />
              <ActionButton
                disabled={isBusy || !canRunJobs}
                icon={Play}
                label={t("执行队列")}
                loading={pending === "run"}
                onClick={() => void runJobs()}
                title={!canRunJobs ? missingPermissionMessage(t("执行 eBay 队列"), locale) : undefined}
              />
            </div>
          </fieldset></CardContent>
        </Card>
      </section>

      <Card className="rounded-lg bg-white">
        <CardHeader className="border-b">
          <CardTitle>{t("类目映射")}</CardTitle>
          <CardAction>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isConfigLocked || !canManageSettings}
              title={!canManageSettings ? missingPermissionMessage(t("管理 eBay 设置"), locale) : undefined}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  mappings: [
                    ...current.mappings,
                    {
                      aspects: {},
                      brand: "",
                      conditionId: current.settings.defaultConditionId,
                      conditionLabel: current.settings.defaultConditionLabel,
                      ebayCategoryId: "",
                      ebayCategoryName: "",
                      ebayCategoryTreeId: "101",
                      enabled: true,
                      id: `new-${Date.now()}`,
                      localCategory: "",
                      modelSeries: "",
                      requiredAspects: [],
                    },
                  ],
                }))
              }
            >
              <Plus className="size-4" />
              {t("新增映射")}</Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">{draft.mappings.map((mapping, index) => <div key={mapping.id || index} className="space-y-2 rounded border p-3">{([['localCategory','本地类目'],['brand','品牌'],['modelSeries','系列'],['ebayCategoryId','eBay 类目 ID'],['conditionId','成色']] as const).map(([key,label]) => <label key={key} className="block space-y-1 text-xs font-semibold">{t(label)}<Input value={mapping[key] ?? ""} disabled={isConfigLocked || !canManageSettings} onChange={event => updateMapping(index, { [key]: event.target.value })} /></label>)}<ToggleField checked={mapping.enabled} label={t("启用")} onCheckedChange={enabled => updateMapping(index, { enabled })} /><Button disabled={isConfigLocked || !canManageSettings} variant="outline" onClick={() => setDraft(current => ({ ...current, mappings: current.mappings.filter((_, i) => i !== index) }))}>{t("删除映射")}</Button></div>)}</div>
          <div className="hidden md:block"><Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("本地类目")}</TableHead>
                <TableHead>{t("品牌")}</TableHead>
                <TableHead>{t("系列")}</TableHead>
                <TableHead>{t("eBay 类目 ID")}</TableHead>
                <TableHead>{t("成色")}</TableHead>
                <TableHead>{t("启用")}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.mappings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-20 text-center text-slate-500">
                    {t("暂无类目映射。")}</TableCell>
                </TableRow>
              ) : (
                draft.mappings.map((mapping, index) => (
                  <TableRow key={mapping.id || index}>
                    <TableCell>
                      <Input
                        className="min-w-36"
                        aria-label={t("本地类目")}
                        value={mapping.localCategory}
                        onChange={(event) =>
                          updateMapping(index, { localCategory: event.currentTarget.value })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="min-w-28"
                        aria-label={t("品牌")}
                        value={mapping.brand ?? ""}
                        onChange={(event) =>
                          updateMapping(index, { brand: event.currentTarget.value })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="min-w-28"
                        aria-label={t("系列")}
                        value={mapping.modelSeries ?? ""}
                        onChange={(event) =>
                          updateMapping(index, { modelSeries: event.currentTarget.value })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="min-w-32"
                        aria-label={t("eBay 类目 ID")}
                        value={mapping.ebayCategoryId}
                        onChange={(event) =>
                          updateMapping(index, { ebayCategoryId: event.currentTarget.value })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="min-w-24"
                        aria-label={t("成色")}
                        value={mapping.conditionId}
                        onChange={(event) =>
                          updateMapping(index, { conditionId: event.currentTarget.value })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={mapping.enabled}
                        onCheckedChange={(enabled) => updateMapping(index, { enabled })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t("删除映射")}
                        disabled={isConfigLocked || !canManageSettings}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            mappings: current.mappings.filter((_, mappingIndex) => mappingIndex !== index),
                          }))
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table></div>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <DataTableCard title={t("刊登状态")}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>{t("商品")}</TableHead>
                <TableHead>{t("状态")}</TableHead>
                <TableHead>{t("价格")}</TableHead>
                <TableHead>{t("库存")}</TableHead>
                <TableHead>{t("失败原因")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview?.listings.length ? (
                overview.listings.map((listing) => (
                  <TableRow key={listing.id || listing.sku}>
                    <TableCell className="font-mono text-xs">{listing.sku}</TableCell>
                    <TableCell className="max-w-[260px] whitespace-normal break-words">
                      {listing.productName}
                      {listing.ebayItemWebUrl && (
                        <a
                          className="ml-2 inline-flex text-primary"
                          href={listing.ebayItemWebUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={listing.listingStatus} />
                    </TableCell>
                    <TableCell>€{listing.computedPrice.toFixed(2)}</TableCell>
                    <TableCell>{listing.computedQuantity}</TableCell>
                    <TableCell className="max-w-[360px] whitespace-normal break-words text-xs text-slate-600">
                      {listing.blockers.length ? listing.blockers.map(t).join("；") : t(listing.lastErrorMessage ?? "-")}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <EmptyRow colSpan={6} label={t("暂无刊登评估记录。")} />
              )}
            </TableBody>
          </Table>
        </DataTableCard>

        <DataTableCard title={t("失败队列")}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("任务")}</TableHead>
                <TableHead>{t("对象")}</TableHead>
                <TableHead>{t("状态")}</TableHead>
                <TableHead>{t("错误")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview?.jobs.length ? (
                overview.jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>{t(jobTypeLabel(job.jobType))}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {job.targetSku ?? job.targetOrderId ?? "-"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={job.status} />
                    </TableCell>
                    <TableCell className="max-w-[260px] whitespace-normal break-words text-xs text-slate-600">
                      {t(job.errorMessage ?? "-")}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <EmptyRow colSpan={4} label={t("暂无队列任务。")} />
              )}
            </TableBody>
          </Table>
        </DataTableCard>
      </section>

      <DataTableCard title={t("订单回流日志")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("eBay 订单")}</TableHead>
              <TableHead>{t("本地订单")}</TableHead>
              <TableHead>{t("金额")}</TableHead>
              <TableHead>{t("状态")}</TableHead>
              <TableHead>{t("导入时间")}</TableHead>
              <TableHead>{t("错误")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overview?.orderLinks.length ? (
              overview.orderLinks.map((link) => (
                <TableRow key={link.externalOrderId}>
                  <TableCell className="font-mono text-xs">{link.externalOrderId}</TableCell>
                  <TableCell>{link.localOrderNo ?? "-"}</TableCell>
                  <TableCell>
                    {link.currency} {link.total.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={link.importStatus} />
                  </TableCell>
                  <TableCell>{formatDateTime(link.importedAt)}</TableCell>
                  <TableCell className="max-w-[320px] whitespace-normal break-words text-xs text-slate-600">
                    {t(link.lastError ?? "-")}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <EmptyRow colSpan={6} label={t("暂无 eBay 订单回流记录。")} />
            )}
          </TableBody>
        </Table>
      </DataTableCard>
    </div>
  );
}

function MarketplacePanelSkeleton() {
  return (
    <div className="min-w-0 space-y-4" aria-busy="true" aria-live="polite">
      <section className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
            <div className="mt-4 h-7 w-24 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-lg bg-white">
          <CardHeader className="border-b">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-10 animate-pulse rounded-md bg-slate-100" />
              ))}
            </div>
            <div className="h-9 w-32 animate-pulse rounded-md bg-primary/15" />
          </CardContent>
        </Card>
        <Card className="rounded-lg bg-white">
          <CardHeader className="border-b">
            <div className="h-4 w-36 animate-pulse rounded bg-slate-100" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-10 animate-pulse rounded-md bg-slate-100" />
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
      <Card className="rounded-lg bg-white">
        <CardHeader className="border-b">
          <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
        </CardHeader>
        <CardContent>
          <AdminSkeletonRows rows={4} />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "bad" | "good" | "neutral" | "warn";
  value: number | string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div
        className={cn(
          "mt-2 truncate text-2xl font-black",
          tone === "good" && "text-emerald-700",
          tone === "warn" && "text-amber-700",
          tone === "bad" && "text-red-700",
          tone === "neutral" && "text-slate-900"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <AdminFieldGroup label={label}>{children}</AdminFieldGroup>;
}

function ToggleField({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex h-11 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
      <span className="truncate">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

function NumberInput({
  id,
  integer = false,
  min,
  onValueChange,
  value,
}: {
  id?: string;
  integer?: boolean;
  min: number;
  onValueChange: (value: number) => void;
  value: number;
}) {
  return (
    <Input
      id={id}
      min={min}
      step={integer ? 1 : 0.01}
      type="number"
      value={Number.isFinite(value) ? value : 0}
      onChange={(event) => {
        const nextValue = Number(event.currentTarget.value);
        onValueChange(Number.isFinite(nextValue) ? nextValue : min);
      }}
    />
  );
}

function ActionButton({ disabled, icon: Icon, label, loading, onClick, title }: { disabled: boolean; icon: React.ComponentType<{ className?: string }>; label: string; loading: boolean; onClick: () => void; title?: string }) { return <AdminActionButton pending={loading} type="button" variant="outline" onClick={onClick} disabled={disabled} title={title}>{!loading && <Icon className="size-4" />}{label}</AdminActionButton>; }

function queueActionNotice(
  action: EbayQueueAction,
  result: {
    blocked: number;
    eligible: number;
    enqueued: number;
    evaluated: number;
    skipped: number;
  },
  locale: string
) {
  if (action === "plan_listings") {
    if (!locale.startsWith("zh")) return `Piano preparato: ${result.evaluated} valutati, ${result.eligible} idonei, ${result.blocked} bloccati.`;
    return `已生成刊登计划：检查 ${result.evaluated} 条，可发布 ${result.eligible} 条，阻断 ${result.blocked} 条。`;
  }

  if (!locale.startsWith("zh")) return `In coda ${result.enqueued}: ${result.evaluated} valutati, ${result.eligible} idonei, ${result.skipped} saltati.`;
  return `已入队 ${result.enqueued} 个任务，检查 ${result.evaluated} 条，可执行 ${result.eligible} 条，跳过 ${result.skipped} 条。`;
}

function DataTableCard({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <Card className="rounded-lg bg-white">
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-20 text-center text-slate-500">
        {label}
      </TableCell>
    </TableRow>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { locale } = useI18n();
  const label = marketplaceText(statusLabel(status), locale);
  const variant = statusVariant(status);

  return (
    <Badge
      variant={variant}
      className={cn(
        "max-w-32 truncate",
        status === "failed" || status === "blocked" ? "border-red-200" : null
      )}
    >
      {label}
    </Badge>
  );
}

function statusVariant(status: string) {
  if (["connected", "eligible", "published", "ready", "succeeded", "imported"].includes(status)) {
    return "default" as const;
  }

  if (["failed", "blocked", "error", "expired"].includes(status)) {
    return "destructive" as const;
  }

  return "outline" as const;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    blocked: "已阻断",
    connected: "已连接",
    disconnected: "未连接",
    draft: "草稿",
    eligible: "可发布",
    ended: "已结束",
    error: "错误",
    expired: "已过期",
    failed: "失败",
    imported: "已导入",
    incomplete: "不完整",
    pending: "待处理",
    published: "已刊登",
    queued: "排队中",
    ready: "就绪",
    running: "执行中",
    skipped: "已跳过",
    succeeded: "成功",
  };

  return labels[status] ?? status;
}

function jobTypeLabel(jobType: string) {
  const labels: Record<string, string> = {
    import_order: "导入单个订单",
    import_orders: "拉取订单",
    publish_listing: "发布商品",
    pull_metadata: "拉取元数据",
    pull_policies: "拉取政策",
    sync_inventory: "同步库存",
    sync_price: "同步价格",
    update_fulfillment: "回写物流",
  };

  return labels[jobType] ?? jobType;
}

function connectionStatusLabel(connection: MarketplaceConnection | null | undefined) {
  if (!connection) {
    return "未连接";
  }

  return statusLabel(connection.connectionStatus);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function emptyToNull(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function missingPermissionMessage(label: string, locale = "zh-CN") {
  if (!locale.startsWith("zh")) return `Permesso richiesto: ${label}.`;
  return `缺少权限：${label}。`;
}

function readApiError(error: unknown) {
  if (!error || typeof error !== "object" || Array.isArray(error)) {
    return null;
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

function readinessMessage(code: string, locale: string) {
 const copy: Record<string,[string,string]> = {disabled:["请先启用并保存 eBay 设置。","Abilita e salva eBay."],connection:["请先连接 eBay 账号。","Collega prima l’account eBay."],environment:["连接环境与已保存设置不一致，请重新连接对应环境。","Collega l’account nell’ambiente delle impostazioni salvate."],production:["生产环境尚未启用。","Ambiente produzione non abilitato."],publish:["请先生成计划并启用自动发布。","Prepara il piano e abilita la pubblicazione."],policies:["请保存仓库和三项销售政策。","Salva la sede e le tre condizioni di vendita."],sync:["请启用并保存价格库存同步。","Abilita e salva la sincronizzazione."],orders:["请启用并保存订单回流。","Abilita e salva l’importazione ordini."]};
 return copy[code]?.[locale.startsWith("zh") ? 0 : 1] ?? code;
}
