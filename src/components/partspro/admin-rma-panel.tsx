"use client";

import * as React from "react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { formatEuro, type RmaRequest, type RmaStatus } from "@/lib/partspro-data";
import { cn } from "@/lib/utils";
import { AdminBusyRegion, AdminSkeletonRows } from "./admin-feedback";
import { useI18n } from "./i18n-provider";

type AdminRmaStatus = Exclude<RmaStatus, "requested" | "replaced">;
type StatusFilter = "all" | AdminRmaStatus;
type QueueFilter =
  | "all"
  | "mine"
  | "needs_inventory"
  | "needs_refund"
  | "overdue"
  | "unassigned";
type RmaAction =
  | "assign"
  | "request_wallet_refund"
  | "mark_received"
  | "restock_return"
  | "mark_scrapped"
  | "close";

type AdminRmaListResponse = {
  data?: RmaRequest[];
  error?: { message?: string };
  meta?: { total?: number };
};

type AdminRmaUpdateResponse = {
  data?: RmaRequest;
  error?: { message?: string };
};

type AdminRmaActionResponse = {
  data?: RmaRequest;
  error?: { message?: string };
};

type Notice = {
  message: string;
  tone: "success" | "error";
};

type DraftState = {
  actionReason: string;
  customerVisibleNote: string;
  internalNote: string;
  labResult: string;
  refundAmount: string;
  resolutionNote: string;
  stockQuantity: string;
};

const statuses: AdminRmaStatus[] = [
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "received",
  "replacement_sent",
  "refunded",
  "closed",
];

const queueFilters: Exclude<QueueFilter, "all">[] = [
  "mine",
  "unassigned",
  "needs_refund",
  "needs_inventory",
  "overdue",
];

const rmaCopy = {
  it: {
    actions: {
      approve: "Approva",
      assignMe: "Assegna a me",
      close: "Chiudi",
      markReceived: "Ricevuta",
      refresh: "Aggiorna",
      refund: "Crea richiesta rimborso",
      reject: "Respinta",
      replacement: "Sostituzione spedita",
      review: "In verifica",
      saveNotes: "Salva note",
      search: "Cerca",
      scrap: "Scarta",
      restock: "Rimetti a stock",
    },
    actionReason: "Motivo azione",
    attachments: "Allegati",
    customerNote: "Nota visibile al cliente",
    emptyDetail: "Seleziona una richiesta dalla coda.",
    emptyQueue: "Nessuna richiesta in questa vista.",
    filters: {
      all: "Tutte",
      mine: "Mie",
      needsInventory: "Stock",
      needsRefund: "Rimborsi",
      overdue: "Scadute",
      unassigned: "Non assegnate",
    },
    inventoryDisposition: "Disposizione stock",
    internalNote: "Nota interna",
    labResult: "Risultato laboratorio",
    loading: "Caricamento RMA",
    owner: "Responsabile",
    queueTitle: "Coda RMA",
    refundLinked: "Richiesta rimborso collegata",
    refundAmount: "Importo rimborso",
    resolutionNote: "Nota risoluzione",
    searchPlaceholder: "Ordine, SKU, problema...",
    stockQuantity: "Quantita stock",
    subtitle: "Richieste reso, verifica laboratorio, sostituzioni e rimborsi.",
    title: "RMA e resi",
    actionDone: "Azione RMA completata.",
    updateFailed: "Aggiornamento RMA non riuscito.",
    updated: "RMA aggiornata.",
  },
  zh: {
    actions: {
      approve: "批准",
      assignMe: "分配给我",
      close: "关闭",
      markReceived: "已收货",
      refresh: "刷新",
      refund: "创建退款申请",
      reject: "拒绝",
      replacement: "替换件已发出",
      review: "进入审核",
      saveNotes: "保存备注",
      search: "搜索",
      scrap: "标记报废",
      restock: "回补库存",
    },
    actionReason: "操作原因",
    attachments: "附件证据",
    customerNote: "客户可见备注",
    emptyDetail: "从左侧选择一个售后申请。",
    emptyQueue: "当前筛选下没有售后申请。",
    filters: {
      all: "全部",
      mine: "我的",
      needsInventory: "待库存",
      needsRefund: "待退款",
      overdue: "已超时",
      unassigned: "未分配",
    },
    inventoryDisposition: "库存处置",
    internalNote: "内部备注",
    labResult: "检测结果",
    loading: "正在加载售后",
    owner: "负责人",
    queueTitle: "售后队列",
    refundLinked: "已关联退款申请",
    refundAmount: "退款金额",
    resolutionNote: "处理结果备注",
    searchPlaceholder: "订单、SKU、问题...",
    stockQuantity: "库存数量",
    subtitle: "集中处理退换货、检测、替换件和退款状态。",
    title: "RMA 售后",
    actionDone: "售后操作已完成。",
    updateFailed: "售后更新失败。",
    updated: "售后已更新。",
  },
};

const statusLabels: Record<AdminRmaStatus, { it: string; zh: string }> = {
  submitted: { it: "Richiesta", zh: "已提交" },
  under_review: { it: "In verifica", zh: "审核中" },
  approved: { it: "Approvata", zh: "已批准" },
  rejected: { it: "Respinta", zh: "已拒绝" },
  received: { it: "Ricevuta", zh: "已收货" },
  replacement_sent: { it: "Sostituzione spedita", zh: "替换件已发出" },
  refunded: { it: "Rimborsata", zh: "已退款" },
  closed: { it: "Chiusa", zh: "已关闭" },
};

export function AdminRmaPanel() {
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const copy = isZh ? rmaCopy.zh : rmaCopy.it;
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [queue, setQueue] = React.useState<QueueFilter>("all");
  const [search, setSearch] = React.useState("");
  const [requests, setRequests] = React.useState<RmaRequest[]>([]);
  const [selectedId, setSelectedId] = React.useState("");
  const [draft, setDraft] = React.useState<DraftState>(() => emptyDraft());
  const [isLoading, setIsLoading] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [total, setTotal] = React.useState(0);

  const selectedRequest = React.useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [requests, selectedId]
  );

  const refresh = React.useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        limit: "80",
        offset: "0",
      });

      if (status !== "all") {
        params.set("status", status);
      }

      if (queue !== "all") {
        params.set("queue", queue);
      }

      if (search.trim()) {
        params.set("q", search.trim());
      }

      const response = await fetch(`/api/admin/rma?${params}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
      });
      const payload = (await response.json().catch(() => null)) as AdminRmaListResponse | null;

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? copy.updateFailed);
      }

      const nextRequests = Array.isArray(payload?.data) ? payload.data : [];

      setRequests(nextRequests);
      setTotal(payload?.meta?.total ?? nextRequests.length);
      const nextSelected =
        (selectedId
          ? nextRequests.find((request) => request.id === selectedId)
          : null) ?? nextRequests[0] ?? null;

      setSelectedId(nextSelected?.id ?? "");
      setDraft(draftFromRequest(nextSelected));
      setNotice(null);
    } catch (error) {
      if (!signal?.aborted) {
        setNotice({
          message: error instanceof Error ? error.message : copy.updateFailed,
          tone: "error",
        });
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [copy.updateFailed, queue, search, selectedId, status]);

  React.useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void refresh(controller.signal);
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [refresh]);

  async function updateRequest(nextStatus: AdminRmaStatus) {
    if (!selectedRequest) {
      return;
    }

    setPendingAction(nextStatus);

    try {
      const refundAmount = draft.refundAmount.trim()
        ? Number(draft.refundAmount)
        : undefined;
      const response = await fetch(`/api/admin/rma/${selectedRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerVisibleNote: draft.customerVisibleNote,
          internalNote: draft.internalNote,
          labResult: draft.labResult,
          refundAmount,
          resolutionNote: draft.resolutionNote,
          status: nextStatus,
        }),
      });
      const payload = (await response.json().catch(() => null)) as AdminRmaUpdateResponse | null;

      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error?.message ?? copy.updateFailed);
      }

      setRequests((current) =>
        current.map((request) => (request.id === payload.data?.id ? payload.data : request))
      );
      setSelectedId(payload.data.id);
      setDraft(draftFromRequest(payload.data));
      setNotice({ message: copy.updated, tone: "success" });
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : copy.updateFailed,
        tone: "error",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function performAction(action: RmaAction) {
    if (!selectedRequest) {
      return;
    }

    setPendingAction(action);

    try {
      const refundAmount = draft.refundAmount.trim()
        ? Number(draft.refundAmount)
        : undefined;
      const stockQuantity = draft.stockQuantity.trim()
        ? Number(draft.stockQuantity)
        : selectedRequest.quantity ?? undefined;
      const response = await fetch(`/api/admin/rma/${selectedRequest.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          customerVisibleNote: draft.customerVisibleNote,
          internalNote: draft.internalNote,
          quantity: action === "restock_return" ? stockQuantity : undefined,
          reason: draft.actionReason || draft.resolutionNote || draft.internalNote,
          refundAmount: action === "request_wallet_refund" ? refundAmount : undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as AdminRmaActionResponse | null;

      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error?.message ?? copy.updateFailed);
      }

      setRequests((current) =>
        current.map((request) => (request.id === payload.data?.id ? payload.data : request))
      );
      setSelectedId(payload.data.id);
      setDraft(draftFromRequest(payload.data));
      setNotice({ message: copy.actionDone, tone: "success" });
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : copy.updateFailed,
        tone: "error",
      });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.045)] md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <RotateCcw className="size-5 text-primary" />
            <h2 className="truncate text-xl font-black tracking-normal">{copy.title}</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">{copy.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="border border-slate-200 bg-slate-50 text-slate-700">
            {total}
          </Badge>
          <Button
            type="button"
            variant="outline"
            className="bg-white"
            disabled={isLoading}
            onClick={() => void refresh()}
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {copy.actions.refresh}
          </Button>
        </div>
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
        >
          {notice.message}
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[430px_minmax(0,1fr)]">
        <AdminBusyRegion label={copy.loading} pending={isLoading}>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_150px]">
              <div className="relative min-w-0">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="bg-white pl-9"
                  placeholder={copy.searchPlaceholder}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void refresh();
                    }
                  }}
                />
              </div>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as StatusFilter)}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{copy.filters.all}</SelectItem>
                  {statuses.map((item) => (
                    <SelectItem key={item} value={item}>
                      {statusLabel(item, isZh)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={queue}
                onValueChange={(value) => setQueue(value as QueueFilter)}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{copy.filters.all}</SelectItem>
                  {queueFilters.map((item) => (
                    <SelectItem key={item} value={item}>
                      {queueLabel(item, copy)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-2 w-full bg-white"
              onClick={() => void refresh()}
            >
              <Search className="size-4" />
              {copy.actions.search}
            </Button>

            <div className="mt-3 text-xs font-black uppercase text-slate-400">
              {copy.queueTitle}
            </div>
            <div className="mt-2 space-y-2">
              {isLoading && requests.length === 0 ? (
                <AdminSkeletonRows rows={6} />
              ) : requests.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                  {copy.emptyQueue}
                </div>
              ) : (
                requests.map((request) => (
                  <button
                    key={request.id}
                    type="button"
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition hover:border-primary/30 hover:bg-primary/5",
                      selectedId === request.id
                        ? "border-primary/40 bg-primary/8"
                        : "border-slate-200 bg-white"
                    )}
                    onClick={() => {
                      setSelectedId(request.id);
                      setDraft(draftFromRequest(request));
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-mono text-xs font-black">
                        {request.orderId}
                      </span>
                      <Badge className={cn("border", rmaStatusClass(request.status))}>
                        {statusLabel(normalizeAdminRmaStatus(request.status), isZh)}
                      </Badge>
                    </div>
                    <div className="mt-2 truncate text-sm font-black text-slate-900">
                      {request.productName}
                    </div>
                    <div className="mt-1 truncate text-xs font-semibold text-slate-500">
                      {request.sku} · {request.customerName ?? "-"} · {request.createdAt}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </AdminBusyRegion>

        <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
          {!selectedRequest ? (
            <div className="grid min-h-[420px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-500">
              {copy.emptyDetail}
            </div>
          ) : (
            <div className="min-w-0 space-y-4">
              <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-black">{selectedRequest.id}</span>
                    <Badge className={cn("border", rmaStatusClass(selectedRequest.status))}>
                      {statusLabel(normalizeAdminRmaStatus(selectedRequest.status), isZh)}
                    </Badge>
                  </div>
                  <h3 className="mt-2 break-words text-xl font-black tracking-normal">
                    {selectedRequest.productName}
                  </h3>
                  <div className="mt-1 text-sm font-semibold text-slate-500">
                    {selectedRequest.orderId} · {selectedRequest.sku} · Qty {selectedRequest.quantity ?? 1}
                  </div>
                </div>
                <div className="grid gap-2 text-sm font-semibold text-slate-600 sm:grid-cols-2 lg:min-w-[260px] lg:grid-cols-1">
                  <DetailPill label={isZh ? "客户" : "Cliente"} value={selectedRequest.customerName ?? "-"} />
                  <DetailPill label={copy.owner} value={selectedRequest.assignedTo ? shortId(selectedRequest.assignedTo) : "-"} />
                  <DetailPill label={isZh ? "到期" : "Scadenza"} value={formatDateTimeValue(selectedRequest.dueAt) ?? "-"} />
                  <DetailPill label={isZh ? "更新时间" : "Aggiornato"} value={selectedRequest.updatedAt ?? "-"} />
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <Field label={copy.customerNote}>
                  <Textarea
                    className="min-h-24"
                    value={draft.customerVisibleNote}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, customerVisibleNote: event.target.value }))
                    }
                  />
                </Field>
                <Field label={copy.internalNote}>
                  <Textarea
                    className="min-h-24"
                    value={draft.internalNote}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, internalNote: event.target.value }))
                    }
                  />
                </Field>
                <Field label={copy.labResult}>
                  <Textarea
                    className="min-h-24"
                    value={draft.labResult}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, labResult: event.target.value }))
                    }
                  />
                </Field>
                <Field label={copy.resolutionNote}>
                  <Textarea
                    className="min-h-24"
                    value={draft.resolutionNote}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, resolutionNote: event.target.value }))
                    }
                  />
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-[180px_180px_minmax(0,1fr)]">
                <Field label={copy.refundAmount}>
                  <Input
                    inputMode="decimal"
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.refundAmount}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, refundAmount: event.target.value }))
                    }
                  />
                </Field>
                <Field label={copy.stockQuantity}>
                  <Input
                    inputMode="numeric"
                    type="number"
                    min="1"
                    step="1"
                    value={draft.stockQuantity}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, stockQuantity: event.target.value }))
                    }
                  />
                </Field>
                <Field label={copy.actionReason}>
                  <Input
                    value={draft.actionReason}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, actionReason: event.target.value }))
                    }
                  />
                </Field>
              </div>

              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap gap-2">
                  <Badge className="border border-slate-200 bg-white text-slate-700">
                    {copy.inventoryDisposition}: {inventoryDispositionLabel(selectedRequest.inventoryDisposition, isZh)}
                  </Badge>
                  {selectedRequest.walletRefundRequestId ? (
                    <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
                      {copy.refundLinked}: {shortId(selectedRequest.walletRefundRequestId)}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <StatusAction
                    label={copy.actions.assignMe}
                    pending={pendingAction === "assign"}
                    disabled={Boolean(pendingAction)}
                    onClick={() => void performAction("assign")}
                  />
                  <StatusAction
                    label={copy.actions.saveNotes}
                    pending={pendingAction === selectedRequest.status}
                    disabled={Boolean(pendingAction)}
                    onClick={() => void updateRequest(normalizeAdminRmaStatus(selectedRequest.status))}
                  />
                  <StatusAction
                    icon={RotateCcw}
                    label={copy.actions.review}
                    pending={pendingAction === "under_review"}
                    disabled={Boolean(pendingAction)}
                    onClick={() => void updateRequest("under_review")}
                  />
                  <StatusAction
                    icon={CheckCircle2}
                    label={copy.actions.approve}
                    pending={pendingAction === "approved"}
                    disabled={Boolean(pendingAction)}
                    onClick={() => void updateRequest("approved")}
                  />
                  <StatusAction
                    icon={XCircle}
                    label={copy.actions.reject}
                    pending={pendingAction === "rejected"}
                    disabled={Boolean(pendingAction)}
                    onClick={() => void updateRequest("rejected")}
                  />
                  <StatusAction
                    label={copy.actions.markReceived}
                    pending={pendingAction === "mark_received"}
                    disabled={Boolean(pendingAction)}
                    onClick={() => void performAction("mark_received")}
                  />
                  <StatusAction
                    label={copy.actions.replacement}
                    pending={pendingAction === "replacement_sent"}
                    disabled={Boolean(pendingAction)}
                    onClick={() => void updateRequest("replacement_sent")}
                  />
                  <StatusAction
                    label={copy.actions.refund}
                    pending={pendingAction === "request_wallet_refund"}
                    disabled={Boolean(pendingAction)}
                    onClick={() => void performAction("request_wallet_refund")}
                  />
                  <StatusAction
                    label={copy.actions.restock}
                    pending={pendingAction === "restock_return"}
                    disabled={Boolean(pendingAction)}
                    onClick={() => void performAction("restock_return")}
                  />
                  <StatusAction
                    label={copy.actions.scrap}
                    pending={pendingAction === "mark_scrapped"}
                    disabled={Boolean(pendingAction)}
                    onClick={() => void performAction("mark_scrapped")}
                  />
                  <StatusAction
                    label={copy.actions.close}
                    pending={pendingAction === "close"}
                    disabled={Boolean(pendingAction)}
                    onClick={() => void performAction("close")}
                  />
                </div>
              </div>

              {selectedRequest.refundAmount && selectedRequest.refundAmount > 0 ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-800">
                  {copy.refundAmount}: {formatEuro(selectedRequest.refundAmount)}
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <DetailBlock title={copy.attachments}>
                  {(selectedRequest.attachments ?? []).length === 0 ? (
                    <div className="text-sm font-semibold text-slate-500">-</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {(selectedRequest.attachments ?? []).map((attachment) =>
                        attachment.signedUrl ? (
                          <a
                            key={attachment.path}
                            href={attachment.signedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-black text-slate-700 hover:border-primary/30 hover:text-primary"
                          >
                            <ExternalLink className="size-3.5" />
                            {attachment.name}
                          </a>
                        ) : (
                          <span
                            key={attachment.path}
                            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-black text-slate-700"
                          >
                            {attachment.name}
                          </span>
                        )
                      )}
                    </div>
                  )}
                </DetailBlock>
                <DetailBlock title={isZh ? "处理时间线" : "Timeline"}>
                  {(selectedRequest.events ?? []).length === 0 ? (
                    <div className="text-sm font-semibold text-slate-500">-</div>
                  ) : (
                    <div className="space-y-2">
                      {(selectedRequest.events ?? []).map((event) => (
                        <div
                          key={event.id}
                          className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600"
                        >
                          <div className="font-black text-slate-800">{event.createdAt}</div>
                          <div className="mt-1">
                            {event.toStatus ? statusLabel(normalizeAdminRmaStatus(event.toStatus), isZh) : event.eventType}
                            {event.note ? ` · ${event.note}` : null}
                          </div>
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
  );
}

function emptyDraft(): DraftState {
  return {
    actionReason: "",
    customerVisibleNote: "",
    internalNote: "",
    labResult: "",
    refundAmount: "",
    resolutionNote: "",
    stockQuantity: "",
  };
}

function draftFromRequest(request: RmaRequest | null): DraftState {
  if (!request) {
    return emptyDraft();
  }

  return {
    actionReason: "",
    customerVisibleNote: request.customerVisibleNote ?? "",
    internalNote: request.internalNote ?? "",
    labResult: request.labResult ?? "",
    refundAmount: request.refundAmount ? String(request.refundAmount) : "",
    resolutionNote: request.resolutionNote ?? "",
    stockQuantity: request.quantity ? String(request.quantity) : "",
  };
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs font-black uppercase text-slate-500">{label}</Label>
      {children}
    </div>
  );
}

function DetailPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-black uppercase text-slate-400">{label}</div>
      <div className="mt-0.5 truncate text-sm font-black text-slate-800">{value}</div>
    </div>
  );
}

function DetailBlock({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 p-3">
      <div className="mb-2 text-xs font-black uppercase text-slate-400">{title}</div>
      {children}
    </div>
  );
}

function StatusAction({
  disabled,
  icon: Icon,
  label,
  onClick,
  pending,
}: {
  disabled: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  pending: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="bg-white"
      disabled={disabled}
      onClick={onClick}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : Icon ? (
        <Icon className="size-4" />
      ) : null}
      {label}
    </Button>
  );
}

function queueLabel(
  queue: Exclude<QueueFilter, "all">,
  copy: (typeof rmaCopy)["it"] | (typeof rmaCopy)["zh"]
) {
  switch (queue) {
    case "mine":
      return copy.filters.mine;
    case "needs_inventory":
      return copy.filters.needsInventory;
    case "needs_refund":
      return copy.filters.needsRefund;
    case "overdue":
      return copy.filters.overdue;
    case "unassigned":
      return copy.filters.unassigned;
  }
}

function inventoryDispositionLabel(
  disposition: RmaRequest["inventoryDisposition"],
  isZh: boolean
) {
  switch (disposition) {
    case "quarantine":
      return isZh ? "待检测" : "Quarantena";
    case "restock":
      return isZh ? "已回补" : "Rimesso a stock";
    case "scrap":
      return isZh ? "已报废" : "Scartato";
    case "supplier_return":
      return isZh ? "退供应商" : "Reso fornitore";
    default:
      return isZh ? "待处理" : "In attesa";
  }
}

function shortId(value: string) {
  return value.length > 8 ? value.slice(0, 8) : value;
}

function formatDateTimeValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function statusLabel(status: AdminRmaStatus, isZh: boolean) {
  return isZh ? statusLabels[status].zh : statusLabels[status].it;
}

function normalizeAdminRmaStatus(status: RmaStatus): AdminRmaStatus {
  if (status === "requested") {
    return "submitted";
  }

  if (status === "replaced") {
    return "replacement_sent";
  }

  return status;
}

function rmaStatusClass(status: RmaStatus) {
  const normalized = normalizeAdminRmaStatus(status);

  if (normalized === "replacement_sent" || normalized === "refunded") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalized === "rejected") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (normalized === "closed") {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }

  if (normalized === "under_review" || normalized === "approved" || normalized === "received") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-primary/20 bg-primary/8 text-primary";
}
