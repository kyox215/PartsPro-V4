"use client";

import * as React from "react";
import Image from "next/image";
import {
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileImage,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AdminRmaDto } from "@/lib/partspro-rma-admin-dto";
import type {
  RmaWorkflowAction,
  RmaWorkflowQueue,
  RmaWorkflowRecommendation,
} from "@/lib/partspro-rma-workflow-rules";
import { cn } from "@/lib/utils";
import { AdminBusyRegion, AdminSkeletonRows } from "./admin-feedback";
import { useI18n } from "./i18n-provider";

type QueueTab = RmaWorkflowQueue;
type ActionCode = RmaWorkflowAction;
type Recommendation = RmaWorkflowRecommendation;
type QcStatus = "passed" | "failed" | "not_required";
type InventoryAction = "restock_return" | "mark_scrapped" | "supplier_return";
type ActionDialog = "reject" | "qc" | "refund" | "replacement" | "inventory" | null;

type RefundPreview = {
  available: boolean;
  blockedReason?:
    | "missing_unit_price_snapshot"
    | "wallet_balance_exhausted"
    | "invalid_snapshot";
  currency: string;
  maxRefundAmount: number;
  quantity: number;
  taxAndShippingIncluded: false;
};

type ReplacementCandidate = {
  id: string;
  orderNumber: string;
  quantity: number;
  shippedAt: string | null;
};

type AdminRmaDetailDto = AdminRmaDto & {
  refundPreview: RefundPreview | null;
  replacementCandidates: ReplacementCandidate[];
};

type AdminRmaListResponse = {
  data?: AdminRmaDto[];
  error?: { message?: string };
  meta?: {
    countsComplete?: boolean;
    queueCounts?: Partial<Record<QueueTab, number>>;
    total?: number;
  };
};

type AdminRmaDetailResponse = {
  data?: AdminRmaDetailDto;
  error?: { message?: string };
};

type AdminRmaActionResponse = {
  data?: AdminRmaDto;
  error?: { message?: string };
};

type Notice = {
  message: string;
  tone: "success" | "error";
};

type ActionFields = {
  batchCode?: string;
  customerVisibleNote?: string;
  location?: string;
  qcNote?: string;
  qcStatus?: QcStatus;
  reason?: string;
  refundAmount?: number;
  replacementOrderId?: string;
  supplier?: string;
  warehouse?: "Milano";
};

const ACTIVE_QUEUE_TABS: readonly QueueTab[] = [
  "review",
  "awaiting_return",
  "receiving",
  "qc",
  "resolution",
  "inventory_close",
];

const INVENTORY_ACTIONS: readonly InventoryAction[] = [
  "restock_return",
  "mark_scrapped",
  "supplier_return",
];

const rmaCopy = {
  it: {
    action: {
      approve: "Approva",
      assign: "Assegna a me",
      close: "Chiudi pratica",
      markReceived: "Ricevuto",
      markReceivedFallback: "Ricevuto direttamente in negozio",
      recordQc: "Registra controllo",
      reject: "Rifiuta",
      requestRefund: "Richiedi rimborso wallet",
      replacementSent: "Segna sostituzione spedita",
      restock: "Rimetti a stock",
      scrap: "Segna come scartato",
      supplierReturn: "Restituisci al fornitore",
      startReview: "Avvia verifica",
    },
    actionAvailable: "Azioni consentite dal server",
    actionDone: "Azione RMA completata.",
    archive: "Archivio",
    attachments: "Foto e allegati",
    batchCode: "Lotto",
    blocked: "Bloccato",
    cancel: "Annulla",
    countsIncomplete: "Conteggi parziali: almeno il numero di richieste caricate.",
    customer: "Cliente",
    customerVisibleReason: "Motivo visibile al cliente",
    detailLoading: "Caricamento dettaglio...",
    emptyDetail: "Seleziona una richiesta per caricare il dettaglio esatto.",
    emptyQueue: "Nessuna richiesta in questa coda.",
    events: "Cronologia",
    inventory: "Disposizione stock",
    inventoryImpact: "Questa conferma aggiorna la disposizione e la quantità completa della merce.",
    inventorySelect: "Scegli una disposizione",
    labResult: "Risultato controllo",
    location: "Posizione",
    loading: "Caricamento coda RMA",
    noCandidate: "Nessun ordine sostitutivo idoneo è disponibile.",
    noPreview: "Anteprima rimborso non disponibile: l'azione resta bloccata.",
    noteSummary: "Note registrate",
    order: "Ordine",
    photoPreview: "Anteprima foto",
    previewBlocked: "Anteprima non disponibile",
    quantity: "Quantità completa",
    qc: "Controllo qualità",
    qcDescription: "Scegli un risultato esplicito. La quantità viene sempre presa dalla richiesta completa.",
    qcNote: "Nota controllo (opzionale)",
    refund: "Rimborso",
    refundApproval: "Rimborso wallet: resta soggetto ad approvazione.",
    refundDescription: "Il massimo deriva dal prezzo unitario immutabile, dai rimborsi esistenti e dal saldo wallet.",
    refundAmount: "Importo da richiedere",
    refundNoTax: "Tasse e spedizione non sono incluse automaticamente.",
    replacement: "Ordine sostitutivo",
    replacementDescription: "Scegli l'ordine spedito dal numero ordine; l'UUID non viene mostrato.",
    replacementOrder: "Ordine sostitutivo",
    rejectDescription: "Inserisci il motivo che il cliente potrà leggere.",
    rejectReason: "Motivo rifiuto",
    resolution: "Risoluzione",
    rma: "RMA",
    search: "Cerca ordine, SKU o problema",
    searchPlaceholder: "Ordine, SKU, problema...",
    selectedCount: "richieste",
    status: "Stato",
    supplier: "Fornitore (opzionale)",
    timelineEmpty: "Nessun evento visibile.",
    title: "RMA e resi",
    unassigned: "Azioni avanzate",
    updated: "La coda e il dettaglio sono stati aggiornati.",
    workflow: "Prossimo passo consigliato",
  },
  zh: {
    action: {
      approve: "批准",
      assign: "分配给我",
      close: "关闭售后",
      markReceived: "标记收货",
      markReceivedFallback: "门店已直接收到",
      recordQc: "记录质检",
      reject: "拒绝",
      requestRefund: "申请钱包退款",
      replacementSent: "标记替换件已发出",
      restock: "回补库存",
      scrap: "标记报废",
      supplierReturn: "退回供应商",
      startReview: "开始审核",
    },
    actionAvailable: "服务端允许的动作",
    actionDone: "售后操作已完成。",
    archive: "历史归档",
    attachments: "照片与附件",
    batchCode: "批次",
    blocked: "已阻塞",
    cancel: "取消",
    countsIncomplete: "计数不完整：显示的是已加载记录的至少数量。",
    customer: "客户",
    customerVisibleReason: "客户可见原因",
    detailLoading: "正在加载精确详情...",
    emptyDetail: "选择一条申请以加载精确详情。",
    emptyQueue: "当前队列没有售后申请。",
    events: "时间线",
    inventory: "库存处置",
    inventoryImpact: "确认后会更新库存处置，并按申请的完整数量处理。",
    inventorySelect: "选择库存处置",
    labResult: "质检结果",
    location: "库位",
    loading: "正在加载售后队列",
    noCandidate: "没有符合条件的替换订单。",
    noPreview: "退款预览不可用，当前动作已阻塞。",
    noteSummary: "已记录备注",
    order: "订单",
    photoPreview: "照片预览",
    previewBlocked: "预览不可用",
    quantity: "完整数量",
    qc: "质量检查",
    qcDescription: "请选择明确的质检结果。数量始终使用申请的完整数量。",
    qcNote: "质检备注（可选）",
    refund: "退款",
    refundApproval: "钱包退款仍需审批。",
    refundDescription: "上限来自不可变单价、已有退款和订单钱包可退余额。",
    refundAmount: "申请退款金额",
    refundNoTax: "税费和运费不会自动包含。",
    replacement: "替换订单",
    replacementDescription: "按订单号选择已发货替换订单，不展示 UUID。",
    replacementOrder: "替换订单",
    rejectDescription: "填写客户可以看到的拒绝原因。",
    rejectReason: "拒绝原因",
    resolution: "处理结果",
    rma: "售后",
    search: "搜索订单、SKU 或问题",
    searchPlaceholder: "订单、SKU、问题...",
    selectedCount: "条申请",
    status: "状态",
    supplier: "供应商（可选）",
    timelineEmpty: "暂无可见事件。",
    title: "RMA 售后",
    unassigned: "高级操作",
    updated: "队列和详情已刷新。",
    workflow: "服务端建议下一步",
  },
};

export function AdminRmaPanel() {
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const copy = isZh ? rmaCopy.zh : rmaCopy.it;
  const [queue, setQueue] = React.useState<QueueTab>("review");
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [requests, setRequests] = React.useState<AdminRmaDto[]>([]);
  const [selectedId, setSelectedId] = React.useState("");
  const [selectedDetail, setSelectedDetail] = React.useState<AdminRmaDetailDto | null>(null);
  const [queueCounts, setQueueCounts] = React.useState<QueueCounts>(emptyQueueCounts);
  const [countsComplete, setCountsComplete] = React.useState(false);
  const [total, setTotal] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDetailLoading, setIsDetailLoading] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<ActionCode | null>(null);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [actionDialog, setActionDialog] = React.useState<ActionDialog>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [qcStatus, setQcStatus] = React.useState<QcStatus>("passed");
  const [qcNote, setQcNote] = React.useState("");
  const [refundAmount, setRefundAmount] = React.useState("");
  const [replacementId, setReplacementId] = React.useState("");
  const [inventoryAction, setInventoryAction] = React.useState<InventoryAction>("restock_return");
  const [batchCode, setBatchCode] = React.useState("");
  const [location, setLocation] = React.useState("Milano");
  const [supplier, setSupplier] = React.useState("");
  const [photoAttachment, setPhotoAttachment] = React.useState<AdminRmaDto["attachments"][number] | null>(null);
  const pendingActionRef = React.useRef<ActionCode | null>(null);

  const selectedRequest = React.useMemo(
    () =>
      (selectedDetail?.id === selectedId ? selectedDetail : null) ??
      requests.find((request) => request.id === selectedId) ??
      null,
    [requests, selectedDetail, selectedId]
  );

  const refresh = React.useCallback(
    async (signal?: AbortSignal): Promise<boolean> => {
      setIsLoading(true);

      try {
        const params = new URLSearchParams({ limit: "80", offset: "0", queue });
        if (search) {
          params.set("q", search);
        }
        const response = await fetch(`/api/admin/rma?${params.toString()}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal,
        });
        const payload = (await response.json().catch(() => null)) as AdminRmaListResponse | null;

        if (!response.ok) {
          throw new Error(readApiMessage(payload) ?? copy.updated);
        }

        const nextRequests = Array.isArray(payload?.data) ? payload.data : [];
        setRequests(nextRequests);
        setTotal(typeof payload?.meta?.total === "number" ? payload.meta.total : nextRequests.length);
        setQueueCounts((current) => ({ ...current, ...payload?.meta?.queueCounts }));
        setCountsComplete(payload?.meta?.countsComplete === true);
        setSelectedId((current) =>
          current && nextRequests.some((request) => request.id === current)
            ? current
            : nextRequests[0]?.id ?? ""
        );
        setNotice(null);
        return true;
      } catch (error) {
        if (!signal?.aborted) {
          setNotice({
            message: error instanceof Error ? error.message : copy.updated,
            tone: "error",
          });
        }
        return false;
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [copy.updated, queue, search]
  );

  const loadDetail = React.useCallback(
    async (requestId: string, signal?: AbortSignal): Promise<boolean> => {
      setIsDetailLoading(true);
      try {
        const response = await fetch(`/api/admin/rma/${encodeURIComponent(requestId)}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal,
        });
        const payload = (await response.json().catch(() => null)) as AdminRmaDetailResponse | null;
        if (!response.ok || !payload?.data) {
          throw new Error(readApiMessage(payload) ?? copy.emptyDetail);
        }
        setSelectedDetail(payload.data);
        return true;
      } catch (error) {
        if (!signal?.aborted) {
          setNotice({
            message: error instanceof Error ? error.message : copy.emptyDetail,
            tone: "error",
          });
        }
        return false;
      } finally {
        if (!signal?.aborted) {
          setIsDetailLoading(false);
        }
      }
    },
    [copy.emptyDetail]
  );

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearch(searchInput.trim()), 260);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  React.useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => void refresh(controller.signal), 0);
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [refresh]);

  React.useEffect(() => {
    if (!selectedId) {
      return;
    }
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => void loadDetail(selectedId, controller.signal), 0);
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [loadDetail, selectedId]);

  function openActionDialog(nextDialog: Exclude<ActionDialog, null>) {
    if (!selectedRequest) {
      return;
    }
    const detailForSelection = selectedDetail?.id === selectedId ? selectedDetail : null;
    setActionDialog(nextDialog);
    if (nextDialog === "reject") {
      setRejectReason("");
    }
    if (nextDialog === "qc") {
      setQcStatus("passed");
      setQcNote("");
    }
    if (nextDialog === "refund") {
      setRefundAmount(
        detailForSelection?.refundPreview?.available
          ? String(detailForSelection.refundPreview.maxRefundAmount)
          : ""
      );
    }
    if (nextDialog === "replacement") {
      setReplacementId(detailForSelection?.replacementCandidates[0]?.id ?? "");
    }
    if (nextDialog === "inventory") {
      const allowed = inventoryActionsFor(selectedRequest);
      setInventoryAction(allowed[0] ?? "restock_return");
      setBatchCode(selectedRequest.rmaNo || selectedRequest.id);
      setLocation("Milano");
      setSupplier("");
    }
  }

  function triggerAction(action: ActionCode) {
    if (action === "reject") {
      openActionDialog("reject");
    } else if (action === "record_qc") {
      openActionDialog("qc");
    } else if (action === "request_wallet_refund") {
      openActionDialog("refund");
    } else if (action === "mark_replacement_sent") {
      openActionDialog("replacement");
    } else if (isInventoryAction(action)) {
      openActionDialog("inventory");
    } else {
      void runAction(action);
    }
  }

  async function runAction(action: ActionCode, fields: ActionFields = {}) {
    const request = selectedDetail?.id === selectedId ? selectedDetail : selectedRequest;
    if (!request || pendingActionRef.current || !request.availableActions.includes(action)) {
      return;
    }

    pendingActionRef.current = action;
    setPendingAction(action);
    try {
      const body: Record<string, unknown> = {
        action,
        idempotencyKey: createClientId("rma-action"),
        ...fields,
      };
      if (requiresCompleteQuantity(action)) {
        body.quantity = completeQuantity(request);
      }

      const response = await fetch(`/api/admin/rma/${encodeURIComponent(request.id)}/actions`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as AdminRmaActionResponse | null;
      if (!response.ok || !payload?.data) {
        throw new Error(readApiMessage(payload) ?? copy.updated);
      }
      const actionResult = payload.data;
      setRequests((current) => current.map((item) => (item.id === actionResult.id ? actionResult : item)));
      setSelectedDetail((current) =>
        current
          ? {
              ...current,
              ...actionResult,
              refundPreview: current.refundPreview,
              replacementCandidates: current.replacementCandidates,
            }
          : null
      );
      await refresh();
      const detailLoaded = await loadDetail(request.id);
      if (detailLoaded) {
        setActionDialog(null);
        setNotice({ message: copy.actionDone, tone: "success" });
      }
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : copy.updated,
        tone: "error",
      });
    } finally {
      pendingActionRef.current = null;
      setPendingAction(null);
    }
  }

  const availableSecondaryActions = selectedRequest
    ? selectedRequest.availableActions.filter(
        (action) => action !== selectedRequest.recommendedAction && action !== "assign"
      )
    : [];
  const allowedInventoryActions = selectedRequest ? inventoryActionsFor(selectedRequest) : [];
  const fullQuantity = selectedRequest ? completeQuantity(selectedRequest) : 0;
  const refundPreview = selectedDetail?.id === selectedId ? selectedDetail.refundPreview : null;
  const replacementCandidates =
    selectedDetail?.id === selectedId ? selectedDetail.replacementCandidates : [];

  return (
    <>
      <section className="min-w-0 space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.045)] sm:p-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <RotateCcw className="size-5 text-primary" />
              <h2 className="truncate text-xl font-black tracking-normal">{copy.title}</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {countsComplete ? total : `≥${total}`} {copy.selectedCount}
            </p>
          </div>
          <Button type="button" variant="outline" className="bg-white" disabled={isLoading} onClick={() => void refresh()}>
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {isZh ? "刷新" : "Aggiorna"}
          </Button>
        </div>

        {notice ? (
          <div
            className={cn(
              "rounded-lg border p-3 text-sm font-semibold",
              notice.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            )}
            role={notice.tone === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {notice.message}
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
          <div className="relative min-w-0">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Label htmlFor="admin-rma-search" className="sr-only">{copy.search}</Label>
            <Input
              id="admin-rma-search"
              className="bg-white pl-9"
              placeholder={copy.searchPlaceholder}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={copy.title}>
            {ACTIVE_QUEUE_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={queue === tab}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-black transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
                  queue === tab
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:bg-primary/5"
                )}
                onClick={() => setQueue(tab)}
              >
                <span>{queueLabel(tab, isZh)}</span>
                <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px]">
                  {countsComplete ? queueCounts[tab] : `≥${queueCounts[tab]}`}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              {countsComplete ? `${total} ${copy.selectedCount}` : copy.countsIncomplete}
            </p>
            <Button
              type="button"
              size="sm"
              variant={queue === "archive" ? "default" : "outline"}
              aria-pressed={queue === "archive"}
              onClick={() => setQueue("archive")}
            >
              {copy.archive} <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid min-w-0 gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
          <AdminBusyRegion label={copy.loading} pending={isLoading}>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-3 flex items-center justify-between gap-2 text-xs font-black uppercase text-slate-400">
                <span>{queueLabel(queue, isZh)}</span>
                <span>{countsComplete ? queueCounts[queue] : `≥${queueCounts[queue]}`}</span>
              </div>
              <div className="space-y-2" role="list">
                {isLoading && requests.length === 0 ? (
                  <AdminSkeletonRows rows={6} />
                ) : requests.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                    {copy.emptyQueue}
                  </div>
                ) : (
                  requests.map((request) => (
                    <div key={request.id} role="listitem">
                      <button
                        type="button"
                        aria-current={selectedId === request.id ? "true" : undefined}
                        className={cn(
                          "w-full rounded-lg border p-3 text-left transition hover:border-primary/30 hover:bg-primary/5 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
                          selectedId === request.id
                            ? "border-primary/40 bg-primary/8"
                            : "border-slate-200 bg-white"
                        )}
                        onClick={() => setSelectedId(request.id)}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="min-w-0 flex-1 truncate font-mono text-xs font-black">
                            {request.rmaNo ?? copy.rma}
                          </span>
                          <Badge className="border border-primary/20 bg-primary/5 text-primary">
                            {queueLabel(request.workflowQueue, isZh)}
                          </Badge>
                        </div>
                        <div className="mt-2 truncate text-sm font-black text-slate-900">{request.productName}</div>
                        <div className="mt-1 truncate text-xs font-semibold text-slate-500">
                          {request.sku} · {request.orderNumber ?? "—"} · {completeQuantity(request)}
                        </div>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </AdminBusyRegion>

          <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            {!selectedRequest ? (
              <div className="grid min-h-[420px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
                {copy.emptyDetail}
              </div>
            ) : (
              <div className="min-w-0 space-y-4">
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-black">{selectedRequest.rmaNo ?? copy.rma}</span>
                      <Badge className="border border-slate-200 bg-slate-50 text-slate-700">{selectedRequest.status}</Badge>
                      {isDetailLoading ? <Loader2 className="size-4 animate-spin text-primary" /> : null}
                    </div>
                    <h3 className="mt-2 break-words text-xl font-black tracking-normal">{selectedRequest.productName}</h3>
                    <div className="mt-1 text-sm font-semibold text-slate-500">
                      {selectedRequest.orderNumber ?? "—"} · {selectedRequest.sku} · {copy.quantity}: {fullQuantity}
                    </div>
                  </div>
                  <div className="grid gap-2 text-sm font-semibold text-slate-600 sm:grid-cols-2 lg:min-w-[250px] lg:grid-cols-1">
                    <DetailPill label={copy.customer} value={selectedRequest.customerName ?? "—"} />
                    <DetailPill
                      label={isZh ? "负责人" : "Responsabile"}
                      value={selectedRequest.assignedTo ? (isZh ? "已分配" : "Assegnata") : copy.unassigned}
                    />
                    <DetailPill label={copy.status} value={selectedRequest.status} />
                  </div>
                </div>

                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="mt-0.5 size-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black uppercase text-primary">{copy.workflow}</div>
                      {selectedRequest.recommendedAction ? (
                        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="font-black text-slate-900">
                              {recommendationLabel(selectedRequest.recommendedAction, copy)}
                            </div>
                            <div className="mt-1 text-xs text-slate-600">
                              {queueLabel(selectedRequest.workflowQueue, isZh)}
                            </div>
                          </div>
                          <Button
                            type="button"
                            className="w-full sm:w-auto"
                            disabled={Boolean(pendingAction)}
                            onClick={() =>
                              selectedRequest.recommendedAction === "choose_inventory_disposition"
                                ? openActionDialog("inventory")
                                : triggerAction(selectedRequest.recommendedAction as ActionCode)
                            }
                          >
                            {pendingAction === selectedRequest.recommendedAction ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-4" />
                            )}
                            {recommendationLabel(selectedRequest.recommendedAction, copy)}
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-2 text-sm font-semibold text-amber-800">
                          <span className="font-black">{copy.blocked}:</span>{" "}
                          {selectedRequest.blockedReason ?? copy.noPreview}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailBlock title={copy.noteSummary}>
                    <ReadOnlySummary label={copy.customerVisibleReason} value={selectedRequest.customerVisibleNote} />
                    <ReadOnlySummary label={isZh ? "内部摘要" : "Sintesi interna"} value={selectedRequest.internalNote} />
                    <ReadOnlySummary label={copy.labResult} value={selectedRequest.labResult} />
                    <ReadOnlySummary label={isZh ? "处理结果摘要" : "Sintesi risoluzione"} value={selectedRequest.resolutionNote} />
                  </DetailBlock>
                  <DetailBlock title={copy.resolution}>
                    <ReadOnlySummary label={copy.resolution} value={selectedRequest.requestedResolution ?? selectedRequest.resolution} />
                    <ReadOnlySummary label={copy.quantity} value={String(fullQuantity)} />
                    <ReadOnlySummary label={isZh ? "库存状态" : "Stato stock"} value={selectedRequest.inventoryDisposition} />
                  </DetailBlock>
                </div>

                {availableSecondaryActions.length > 0 ? (
                  <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                    <div className="text-xs font-black uppercase text-slate-400">{copy.actionAvailable}</div>
                    <div className="flex flex-wrap gap-2">
                      {availableSecondaryActions.map((action) => (
                        <ActionButton
                          key={action}
                          action={action}
                          label={actionLabel(action, copy, selectedRequest.workflowQueue)}
                          disabled={Boolean(pendingAction)}
                          pending={pendingAction === action}
                          onClick={() => triggerAction(action)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedRequest.availableActions.includes("assign") ? (
                  <details className="rounded-lg border border-slate-200 p-3">
                    <summary className="cursor-pointer text-xs font-black uppercase text-slate-500">{copy.unassigned}</summary>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">
                        {isZh ? "分配仅是手动辅助动作，不会成为服务端推荐。" : "L'assegnazione resta un aiuto manuale, mai una raccomandazione."}
                      </p>
                      <ActionButton
                        action="assign"
                        label={copy.action.assign}
                        disabled={Boolean(pendingAction)}
                        pending={pendingAction === "assign"}
                        onClick={() => void runAction("assign")}
                      />
                    </div>
                  </details>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-2">
                  <DetailBlock title={copy.attachments}>
                    {(selectedRequest.attachments ?? []).length === 0 ? (
                      <div className="text-sm font-semibold text-slate-500">—</div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {(selectedRequest.attachments ?? []).map((attachment) =>
                          attachment.signedUrl ? (
                            <button
                              key={attachment.attachmentId ?? attachment.name}
                              type="button"
                              className="group overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-left focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                              onClick={() => setPhotoAttachment(attachment)}
                            >
                              <Image
                                src={attachment.signedUrl}
                                alt={attachment.name}
                                width={120}
                                height={96}
                                unoptimized
                                className="aspect-[4/3] w-full object-cover transition group-hover:scale-105"
                              />
                              <span className="block truncate px-2 py-1.5 text-[11px] font-semibold text-slate-600">{attachment.name}</span>
                            </button>
                          ) : (
                            <div
                              key={attachment.attachmentId ?? attachment.name}
                              className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs font-semibold text-slate-600"
                            >
                              <FileImage className="mb-1 size-4 text-slate-400" />
                              {attachment.name}
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </DetailBlock>
                  <DetailBlock title={copy.events}>
                    {(selectedRequest.events ?? []).length === 0 ? (
                      <div className="text-sm font-semibold text-slate-500">{copy.timelineEmpty}</div>
                    ) : (
                      <div className="space-y-2">
                        {(selectedRequest.events ?? []).map((event) => (
                          <div key={event.id} className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                            <div className="font-black text-slate-800">{formatDateTime(event.createdAt)}</div>
                            <div className="mt-1">{event.toStatus ?? event.eventType}{event.note ? ` · ${event.note}` : null}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </DetailBlock>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <Dialog open={actionDialog === "reject"} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.action.reject}</DialogTitle>
            <DialogDescription>{copy.rejectDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rma-reject-reason">{copy.rejectReason}</Label>
            <Textarea
              id="rma-reject-reason"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder={copy.customerVisibleReason}
              aria-required="true"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setActionDialog(null)}>{copy.cancel}</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!rejectReason.trim() || Boolean(pendingAction)}
              onClick={() => void runAction("reject", { customerVisibleNote: rejectReason.trim(), reason: rejectReason.trim() })}
            >
              {pendingAction === "reject" ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
              {copy.action.reject}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionDialog === "qc"} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.qc}</DialogTitle>
            <DialogDescription>{copy.qcDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="rma-qc-status">{copy.qc}</Label>
              <Select value={qcStatus} onValueChange={(value) => setQcStatus(value as QcStatus)}>
                <SelectTrigger id="rma-qc-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="passed">{isZh ? "通过" : "Superato"}</SelectItem>
                  <SelectItem value="failed">{isZh ? "未通过" : "Non superato"}</SelectItem>
                  <SelectItem value="not_required">{isZh ? "无需质检" : "Non richiesto"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rma-qc-note">{copy.qcNote}</Label>
              <Textarea id="rma-qc-note" value={qcNote} onChange={(event) => setQcNote(event.target.value)} />
            </div>
            <div className="rounded-md bg-slate-50 p-2 text-xs font-semibold text-slate-600">{copy.quantity}: {fullQuantity}</div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setActionDialog(null)}>{copy.cancel}</Button>
            <Button
              type="button"
              disabled={Boolean(pendingAction)}
              onClick={() => void runAction("record_qc", { qcStatus, qcNote: qcNote.trim() || undefined })}
            >
              {pendingAction === "record_qc" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {copy.action.recordQc}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionDialog === "refund"} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.refund}</DialogTitle>
            <DialogDescription>{copy.refundDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {refundPreview?.available ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <div className="font-black">{isZh ? "最多" : "Massimo"}: {formatMoney(refundPreview.maxRefundAmount, refundPreview.currency)}</div>
                <div className="mt-1 text-xs">{copy.refundNoTax}</div>
                <div className="text-xs">{copy.refundApproval}</div>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900" role="alert">
                <div>{copy.noPreview}</div>
                <div className="mt-1 text-xs">{refundPreview?.blockedReason ?? copy.previewBlocked}</div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="rma-refund-amount">{copy.refundAmount}</Label>
              <Input
                id="rma-refund-amount"
                type="number"
                min="0.01"
                max={refundPreview?.maxRefundAmount}
                step="0.01"
                value={refundAmount}
                onChange={(event) => setRefundAmount(event.target.value)}
                disabled={!refundPreview?.available}
              />
            </div>
            <div className="text-xs font-semibold text-slate-600">{copy.quantity}: {refundPreview?.quantity || fullQuantity}</div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setActionDialog(null)}>{copy.cancel}</Button>
            <Button
              type="button"
              disabled={!refundPreview?.available || !validRefundAmount(refundAmount, refundPreview?.maxRefundAmount) || Boolean(pendingAction)}
              onClick={() => void runAction("request_wallet_refund", { refundAmount: Number(refundAmount) })}
            >
              {pendingAction === "request_wallet_refund" ? <Loader2 className="size-4 animate-spin" /> : null}
              {copy.action.requestRefund}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionDialog === "replacement"} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.replacement}</DialogTitle>
            <DialogDescription>{copy.replacementDescription}</DialogDescription>
          </DialogHeader>
          {replacementCandidates.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900" role="alert">{copy.noCandidate}</div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="rma-replacement-order">{copy.replacementOrder}</Label>
              <Select value={replacementId} onValueChange={setReplacementId}>
                <SelectTrigger id="rma-replacement-order"><SelectValue placeholder={copy.replacementOrder} /></SelectTrigger>
                <SelectContent>
                  {replacementCandidates.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {candidate.orderNumber} · {candidate.quantity} · {formatDateTime(candidate.shippedAt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setActionDialog(null)}>{copy.cancel}</Button>
            <Button
              type="button"
              disabled={!replacementId || replacementCandidates.length === 0 || Boolean(pendingAction)}
              onClick={() => void runAction("mark_replacement_sent", { replacementOrderId: replacementId })}
            >
              {pendingAction === "mark_replacement_sent" ? <Loader2 className="size-4 animate-spin" /> : null}
              {copy.action.replacementSent}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionDialog === "inventory"} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.inventory}</DialogTitle>
            <DialogDescription>{copy.inventoryImpact}</DialogDescription>
          </DialogHeader>
          {allowedInventoryActions.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900" role="alert">
              {selectedRequest?.blockedReason ?? copy.blocked}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="rma-inventory-action">{copy.inventorySelect}</Label>
                <Select value={inventoryAction} onValueChange={(value) => setInventoryAction(value as InventoryAction)}>
                  <SelectTrigger id="rma-inventory-action"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allowedInventoryActions.map((action) => (
                      <SelectItem key={action} value={action}>{actionLabel(action, copy, selectedRequest?.workflowQueue)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rma-batch-code">{copy.batchCode}</Label>
                  <Input id="rma-batch-code" value={batchCode} onChange={(event) => setBatchCode(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rma-location">{copy.location}</Label>
                  <Input id="rma-location" value={location} onChange={(event) => setLocation(event.target.value)} />
                </div>
              </div>
              {inventoryAction === "supplier_return" ? (
                <div className="space-y-2">
                  <Label htmlFor="rma-supplier">{copy.supplier}</Label>
                  <Input id="rma-supplier" value={supplier} onChange={(event) => setSupplier(event.target.value)} />
                </div>
              ) : null}
              <div className="rounded-md bg-slate-50 p-2 text-xs font-semibold text-slate-700">{copy.quantity}: {fullQuantity}</div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setActionDialog(null)}>{copy.cancel}</Button>
            <Button
              type="button"
              disabled={allowedInventoryActions.length === 0 || !batchCode.trim() || !location.trim() || Boolean(pendingAction)}
              onClick={() =>
                void runAction(inventoryAction, {
                  batchCode: batchCode.trim(),
                  location: location.trim(),
                  supplier: supplier.trim() || undefined,
                  warehouse: "Milano",
                })
              }
            >
              {pendingAction === inventoryAction ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {isZh ? "确认库存处置" : "Conferma disposizione"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(photoAttachment)} onOpenChange={(open) => !open && setPhotoAttachment(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{copy.photoPreview}</DialogTitle>
            <DialogDescription>{photoAttachment?.name}</DialogDescription>
          </DialogHeader>
          {photoAttachment?.signedUrl ? (
            <Image
              src={photoAttachment.signedUrl}
              alt={photoAttachment.name}
              width={900}
              height={700}
              unoptimized
              className="max-h-[70vh] w-full rounded-lg object-contain"
            />
          ) : null}
          <DialogFooter>
            {photoAttachment?.signedUrl ? (
              <Button type="button" asChild variant="outline">
                <a href={photoAttachment.signedUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  {isZh ? "打开原图" : "Apri originale"}
                </a>
              </Button>
            ) : null}
            <Button type="button" onClick={() => setPhotoAttachment(null)}>{copy.cancel}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type Copy = (typeof rmaCopy)["it"] | (typeof rmaCopy)["zh"];
type QueueCounts = Record<QueueTab, number>;

function emptyQueueCounts(): QueueCounts {
  return {
    review: 0,
    awaiting_return: 0,
    receiving: 0,
    qc: 0,
    resolution: 0,
    inventory_close: 0,
    archive: 0,
  };
}

function queueLabel(queue: QueueTab, isZh: boolean) {
  const labels: Record<QueueTab, { it: string; zh: string }> = {
    review: { it: "Verifica", zh: "审核" },
    awaiting_return: { it: "In attesa del reso", zh: "待寄回" },
    receiving: { it: "In ricezione", zh: "收货中" },
    qc: { it: "Controllo qualità", zh: "质检" },
    resolution: { it: "Risoluzione", zh: "结算" },
    inventory_close: { it: "Chiusura stock", zh: "库存关闭" },
    archive: { it: "Archivio", zh: "历史归档" },
  };
  return isZh ? labels[queue].zh : labels[queue].it;
}

function actionLabel(action: ActionCode, copy: Copy, queue?: QueueTab) {
  if (action === "mark_received" && queue === "awaiting_return") {
    return copy.action.markReceivedFallback;
  }
  switch (action) {
    case "start_review":
      return copy.action.startReview;
    case "approve":
      return copy.action.approve;
    case "reject":
      return copy.action.reject;
    case "assign":
      return copy.action.assign;
    case "mark_received":
      return copy.action.markReceived;
    case "record_qc":
      return copy.action.recordQc;
    case "request_wallet_refund":
      return copy.action.requestRefund;
    case "mark_replacement_sent":
      return copy.action.replacementSent;
    case "restock_return":
      return copy.action.restock;
    case "mark_scrapped":
      return copy.action.scrap;
    case "supplier_return":
      return copy.action.supplierReturn;
    case "close":
      return copy.action.close;
  }
}

function recommendationLabel(recommendation: Recommendation, copy: Copy) {
  if (recommendation === "choose_inventory_disposition") {
    return copy.inventory;
  }
  return actionLabel(recommendation, copy);
}

function inventoryActionsFor(request: AdminRmaDto): InventoryAction[] {
  return request.availableActions.filter(isInventoryAction);
}

function isInventoryAction(action: ActionCode): action is InventoryAction {
  return (INVENTORY_ACTIONS as readonly string[]).includes(action);
}

function requiresCompleteQuantity(action: ActionCode) {
  return !["start_review", "approve", "reject", "assign", "close"].includes(action);
}

function completeQuantity(request: Pick<AdminRmaDto, "quantity">) {
  const quantity = typeof request.quantity === "number" ? request.quantity : 0;
  return Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
}

function validRefundAmount(value: string, max: number | undefined) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 && (max === undefined || amount <= max);
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("it-IT", { currency, style: "currency" }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(timestamp));
}

function createClientId(prefix: string) {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${randomUuid ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function readApiMessage(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.error) || typeof payload.error.message !== "string") {
    return null;
  }
  return payload.error.message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function DetailPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-black uppercase text-slate-400">{label}</div>
      <div className="mt-0.5 truncate text-sm font-black text-slate-800">{value}</div>
    </div>
  );
}

function DetailBlock({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 p-3">
      <div className="mb-2 text-xs font-black uppercase text-slate-400">{title}</div>
      {children}
    </div>
  );
}

function ReadOnlySummary({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="border-b border-slate-100 py-2 last:border-b-0">
      <div className="text-[10px] font-black uppercase text-slate-400">{label}</div>
      <div className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-700">{value?.trim() || "—"}</div>
    </div>
  );
}

function ActionButton({
  action,
  disabled,
  label,
  onClick,
  pending,
}: {
  action: ActionCode;
  disabled: boolean;
  label: string;
  onClick: () => void;
  pending: boolean;
}) {
  return (
    <Button type="button" variant="outline" size="sm" className="bg-white" data-rma-action={action} disabled={disabled} onClick={onClick}>
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
      {label}
    </Button>
  );
}
