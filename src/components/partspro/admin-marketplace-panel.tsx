"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
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
import { Label } from "@/components/ui/label";
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

export function AdminMarketplacePanel() {
  const [overview, setOverview] = React.useState<MarketplaceOverview | null>(null);
  const [draft, setDraft] = React.useState<DraftState>({
    mappings: [],
    settings: emptySettings,
  });
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<string | null>("load");

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
        throw new Error(readApiError(payload.error) ?? "eBay 面板数据读取失败。");
      }

      setOverview(payload.data);
      setDraft({
        mappings: payload.data.categoryMappings,
        settings: payload.data.settings,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "eBay 面板数据读取失败。");
    } finally {
      setPending((current) => (current === "load" ? null : current));
    }
  }, []);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadOverview();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadOverview]);

  const updateSettings = React.useCallback((patch: Partial<MarketplaceSettings>) => {
    setDraft((current) => ({
      ...current,
      settings: {
        ...current.settings,
        ...patch,
      },
    }));
  }, []);

  const updateMapping = React.useCallback(
    (index: number, patch: Partial<CategoryMapping>) => {
      setDraft((current) => ({
        ...current,
        mappings: current.mappings.map((mapping, mappingIndex) =>
          mappingIndex === index ? { ...mapping, ...patch } : mapping
        ),
      }));
    },
    []
  );

  async function saveSettings() {
    setPending("save");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/ebay", {
        body: JSON.stringify({
          ...draft.settings,
          categoryMappings: draft.mappings.map((mapping) => ({
            brand: emptyToNull(mapping.brand),
            conditionId: mapping.conditionId,
            conditionLabel: mapping.conditionLabel,
            ebayCategoryId: mapping.ebayCategoryId,
            ebayCategoryName: emptyToNull(mapping.ebayCategoryName),
            ebayCategoryTreeId: mapping.ebayCategoryTreeId,
            enabled: mapping.enabled,
            localCategory: mapping.localCategory,
            modelSeries: emptyToNull(mapping.modelSeries),
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
        throw new Error(readApiError(payload.error) ?? "eBay 设置保存失败。");
      }

      setOverview(payload.data);
      setDraft({
        mappings: payload.data.categoryMappings,
        settings: payload.data.settings,
      });
      setNotice("设置已保存。");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "eBay 设置保存失败。");
    } finally {
      setPending(null);
    }
  }

  async function queueAction(action: "publish_eligible" | "sync_inventory" | "import_orders") {
    setPending(action);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/ebay", {
        body: JSON.stringify({ action }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as {
        data?: { enqueued: number; evaluated: number; skipped: number };
        error?: unknown;
      };

      if (!response.ok || !payload.data) {
        throw new Error(readApiError(payload.error) ?? "eBay 任务入队失败。");
      }

      setNotice(
        `已入队 ${payload.data.enqueued} 个任务，检查 ${payload.data.evaluated} 条，跳过 ${payload.data.skipped} 条。`
      );
      await loadOverview();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "eBay 任务入队失败。");
    } finally {
      setPending(null);
    }
  }

  async function runJobs() {
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
        data?: { processed: number };
        error?: unknown;
      };

      if (!response.ok || !payload.data) {
        throw new Error(readApiError(payload.error) ?? "eBay 队列执行失败。");
      }

      setNotice(`已执行 ${payload.data.processed} 个队列任务。`);
      await loadOverview();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "eBay 队列执行失败。");
    } finally {
      setPending(null);
    }
  }

  function connectEbay() {
    const environment = draft.settings.environment;
    window.location.assign(`/api/admin/ebay/oauth?environment=${environment}`);
  }

  const isBusy = pending !== null;
  const connection = overview?.connection;

  return (
    <div className="min-w-0 space-y-4">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryTile label="连接" value={connectionStatusLabel(connection)} tone={connection?.connected ? "good" : "warn"} />
        <SummaryTile label="可发布商品" value={overview?.summary.eligible ?? 0} tone="good" />
        <SummaryTile label="已刊登" value={overview?.summary.published ?? 0} tone="neutral" />
        <SummaryTile label="失败/阻断" value={(overview?.summary.failedJobs ?? 0) + (overview?.summary.blocked ?? 0)} tone="bad" />
      </section>

      {(error || notice) && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          )}
          role="status"
        >
          {error ? <AlertTriangle className="mt-0.5 size-4" /> : <CheckCircle2 className="mt-0.5 size-4" />}
          <span className="min-w-0 break-words">{error ?? notice}</span>
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-lg bg-white">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingBag className="size-4 text-primary" />
              eBay 连接
            </CardTitle>
            <CardAction>
              <StatusBadge status={connection?.connectionStatus ?? "disconnected"} />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="站点">
                <Input value="EBAY_IT / EUR" readOnly />
              </Field>
              <Field label="环境">
                <Select
                  value={draft.settings.environment}
                  onValueChange={(value) =>
                    updateSettings({ environment: value as EbayEnvironment })
                  }
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="账号">
                <Input value={connection?.accountLabel ?? "未连接"} readOnly />
              </Field>
              <Field label="Token 到期">
                <Input value={formatDateTime(connection?.tokenExpiresAt)} readOnly />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={connectEbay} disabled={isBusy}>
                <ExternalLink className="size-4" />
                连接 eBay
              </Button>
              <Button type="button" variant="outline" onClick={loadOverview} disabled={isBusy}>
                <RefreshCcw className={cn("size-4", pending === "load" && "animate-spin")} />
                刷新
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg bg-white">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="size-4 text-primary" />
              自动化设置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ToggleField
                checked={draft.settings.enabled}
                label="启用 eBay"
                onCheckedChange={(enabled) => updateSettings({ enabled })}
              />
              <ToggleField
                checked={draft.settings.autoPublishEnabled}
                label="自动发布"
                onCheckedChange={(autoPublishEnabled) => updateSettings({ autoPublishEnabled })}
              />
              <ToggleField
                checked={draft.settings.autoSyncEnabled}
                label="同步价格库存"
                onCheckedChange={(autoSyncEnabled) => updateSettings({ autoSyncEnabled })}
              />
              <ToggleField
                checked={draft.settings.orderImportEnabled}
                label="订单回流"
                onCheckedChange={(orderImportEnabled) => updateSettings({ orderImportEnabled })}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="merchantLocationKey">
                <Input
                  value={draft.settings.merchantLocationKey ?? ""}
                  onChange={(event) =>
                    updateSettings({ merchantLocationKey: event.currentTarget.value })
                  }
                />
              </Field>
              <Field label="Payment policy">
                <Input
                  value={draft.settings.paymentPolicyId ?? ""}
                  onChange={(event) =>
                    updateSettings({ paymentPolicyId: event.currentTarget.value })
                  }
                />
              </Field>
              <Field label="Return policy">
                <Input
                  value={draft.settings.returnPolicyId ?? ""}
                  onChange={(event) =>
                    updateSettings({ returnPolicyId: event.currentTarget.value })
                  }
                />
              </Field>
              <Field label="Fulfillment policy">
                <Input
                  value={draft.settings.fulfillmentPolicyId ?? ""}
                  onChange={(event) =>
                    updateSettings({ fulfillmentPolicyId: event.currentTarget.value })
                  }
                />
              </Field>
              <Field label="加价百分比">
                <NumberInput
                  min={0}
                  value={draft.settings.markupPercent}
                  onValueChange={(markupPercent) => updateSettings({ markupPercent })}
                />
              </Field>
              <Field label="固定加价 EUR">
                <NumberInput
                  min={0}
                  value={draft.settings.markupFixed}
                  onValueChange={(markupFixed) => updateSettings({ markupFixed })}
                />
              </Field>
              <Field label="安全库存">
                <NumberInput
                  integer
                  min={0}
                  value={draft.settings.stockBuffer}
                  onValueChange={(stockBuffer) => updateSettings({ stockBuffer })}
                />
              </Field>
              <Field label="默认成色">
                <Input
                  value={draft.settings.defaultConditionId}
                  onChange={(event) =>
                    updateSettings({ defaultConditionId: event.currentTarget.value })
                  }
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={saveSettings} disabled={isBusy}>
                <Save className="size-4" />
                保存设置
              </Button>
              <ActionButton
                disabled={isBusy}
                icon={Send}
                label="发布完整商品"
                loading={pending === "publish_eligible"}
                onClick={() => void queueAction("publish_eligible")}
              />
              <ActionButton
                disabled={isBusy}
                icon={RefreshCcw}
                label="同步库存价格"
                loading={pending === "sync_inventory"}
                onClick={() => void queueAction("sync_inventory")}
              />
              <ActionButton
                disabled={isBusy}
                icon={Truck}
                label="拉取 eBay 订单"
                loading={pending === "import_orders"}
                onClick={() => void queueAction("import_orders")}
              />
              <ActionButton
                disabled={isBusy}
                icon={Play}
                label="执行队列"
                loading={pending === "run"}
                onClick={() => void runJobs()}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-lg bg-white">
        <CardHeader className="border-b">
          <CardTitle>类目映射</CardTitle>
          <CardAction>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  mappings: [
                    ...current.mappings,
                    {
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
                    },
                  ],
                }))
              }
            >
              <Plus className="size-4" />
              新增映射
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>本地类目</TableHead>
                <TableHead>品牌</TableHead>
                <TableHead>系列</TableHead>
                <TableHead>eBay 类目 ID</TableHead>
                <TableHead>成色</TableHead>
                <TableHead>启用</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.mappings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-20 text-center text-slate-500">
                    暂无类目映射。
                  </TableCell>
                </TableRow>
              ) : (
                draft.mappings.map((mapping, index) => (
                  <TableRow key={mapping.id || index}>
                    <TableCell>
                      <Input
                        className="min-w-36"
                        value={mapping.localCategory}
                        onChange={(event) =>
                          updateMapping(index, { localCategory: event.currentTarget.value })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="min-w-28"
                        value={mapping.brand ?? ""}
                        onChange={(event) =>
                          updateMapping(index, { brand: event.currentTarget.value })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="min-w-28"
                        value={mapping.modelSeries ?? ""}
                        onChange={(event) =>
                          updateMapping(index, { modelSeries: event.currentTarget.value })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="min-w-32"
                        value={mapping.ebayCategoryId}
                        onChange={(event) =>
                          updateMapping(index, { ebayCategoryId: event.currentTarget.value })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="min-w-24"
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
                        aria-label="删除映射"
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
          </Table>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <DataTableCard title="刊登状态">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>商品</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>价格</TableHead>
                <TableHead>库存</TableHead>
                <TableHead>失败原因</TableHead>
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
                      {listing.blockers.length ? listing.blockers.join("；") : listing.lastErrorMessage ?? "-"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <EmptyRow colSpan={6} label="暂无刊登评估记录。" />
              )}
            </TableBody>
          </Table>
        </DataTableCard>

        <DataTableCard title="失败队列">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>任务</TableHead>
                <TableHead>对象</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>错误</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview?.jobs.length ? (
                overview.jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>{jobTypeLabel(job.jobType)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {job.targetSku ?? job.targetOrderId ?? "-"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={job.status} />
                    </TableCell>
                    <TableCell className="max-w-[260px] whitespace-normal break-words text-xs text-slate-600">
                      {job.errorMessage ?? "-"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <EmptyRow colSpan={4} label="暂无队列任务。" />
              )}
            </TableBody>
          </Table>
        </DataTableCard>
      </section>

      <DataTableCard title="订单回流日志">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>eBay 订单</TableHead>
              <TableHead>本地订单</TableHead>
              <TableHead>金额</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>导入时间</TableHead>
              <TableHead>错误</TableHead>
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
                    {link.lastError ?? "-"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <EmptyRow colSpan={6} label="暂无 eBay 订单回流记录。" />
            )}
          </TableBody>
        </Table>
      </DataTableCard>
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
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs font-semibold text-slate-500">{label}</Label>
      {children}
    </div>
  );
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
  integer = false,
  min,
  onValueChange,
  value,
}: {
  integer?: boolean;
  min: number;
  onValueChange: (value: number) => void;
  value: number;
}) {
  return (
    <Input
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

function ActionButton({
  disabled,
  icon: Icon,
  label,
  loading,
  onClick,
}: {
  disabled: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <Button type="button" variant="outline" onClick={onClick} disabled={disabled}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
      {label}
    </Button>
  );
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
  const label = statusLabel(status);
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

  return new Intl.DateTimeFormat("zh-CN", {
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

function readApiError(error: unknown) {
  if (!error || typeof error !== "object" || Array.isArray(error)) {
    return null;
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}
