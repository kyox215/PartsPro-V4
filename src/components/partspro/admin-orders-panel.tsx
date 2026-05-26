"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Info,
  Loader2,
  PackageCheck,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Truck,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatEuro,
  type CompanyStatus,
  type CustomerLevel,
  type PartProduct,
} from "@/lib/partspro-data";
import { cn } from "@/lib/utils";
import {
  formatAdminMessage,
  getAdminDictionary,
  type AdminText,
} from "@/i18n/dictionaries/admin";
import { sanitizeSupplierText, toPublicSku } from "@/lib/partspro-sku";
import { useI18n } from "./i18n-provider";

type OrderDbStatus =
  | "submitted"
  | "accepted"
  | "picking"
  | "packed"
  | "shipped"
  | "completed"
  | "cancelled";
type PaymentStatus = "unpaid" | "authorized" | "paid" | "refunded";
type FulfillmentStatus =
  | "queued"
  | "allocated"
  | "picking"
  | "packed"
  | "shipped"
  | "delivered"
  | "blocked";
type StockRisk = "clear" | "low" | "blocked" | "unknown";
type Priority = "standard" | "high" | "urgent";
type ViewMode = "orders" | "payments" | "shipping";
type StatusFilterValue = "all" | OrderDbStatus;
type PaymentFilterValue = "all" | "open" | "paid";
type StockRiskFilterValue = "all" | "risk" | StockRisk;
type WarehouseName = PartProduct["warehouse"];
type OrdersSource = "admin_api" | "supabase" | "empty";
type ApiOrdersSource = OrdersSource;
type NoticeTone = "success" | "info" | "warning" | "error";
type WorkflowKey =
  | "all"
  | "submitted"
  | "accepted"
  | "picking"
  | "packed"
  | "shipped"
  | "openPayments"
  | "stockRisk";

const unassignedCarrier = "unassigned" as const;
const carrierOptions = ["DHL Express", "BRT", "GLS", "UPS", "Ritiro in sede"] as const;
type Carrier = (typeof carrierOptions)[number] | typeof unassignedCarrier;

type CustomerSnapshot = {
  id?: string;
  name: string;
  partitaIva: string;
  pec: string;
  status: CompanyStatus;
  priceList: CustomerLevel;
  city: string;
  province: string;
};

type OrderLine = {
  sku: string;
  name: string;
  category: string;
  quantity: number;
  picked: number;
  unitPrice: number;
  warehouse: WarehouseName;
  stockStatus: string;
  reservedQty: number;
  fulfilledQty: number;
  batchCode: string;
};

type OrderActivityActor = {
  id: string | null;
  email: string | null;
  label: string;
  name: string | null;
  role: string | null;
};

type OrderActivityEvent = {
  id: string;
  action: string;
  eventType: string;
  fromStatus: OrderDbStatus | null;
  toStatus: OrderDbStatus | null;
  note: string;
  metadata: unknown;
  actor: OrderActivityActor;
  createdAt: string;
};

type AdminOrder = {
  id: string;
  remoteId?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  status: OrderDbStatus;
  stockRisk: StockRisk;
  company: string;
  total: number;
  items: number;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  priority: Priority;
  customer: CustomerSnapshot;
  paymentMethod: string;
  paymentDue: string;
  warehouse: WarehouseName;
  carrier: Carrier;
  service: string;
  tracking: string;
  eta: string;
  shippingAddress: string;
  owner: string;
  notes: string;
  lines: OrderLine[];
  activity: string[];
  operationHistory: OrderActivityEvent[];
};

type OrdersDataSource = {
  source: OrdersSource;
  label: string;
  syncedAt: string | null;
  total: number;
  returned: number;
  error?: string;
};

type PanelNotice = {
  tone: NoticeTone;
  message: string;
};

type OrdersApiResult = {
  orders: AdminOrder[];
  source: ApiOrdersSource;
  total: number;
  returned: number;
};

type OrderPatchInput = {
  carrier?: string;
  paymentStatus?: PaymentStatus;
  rollback?: boolean;
  status?: OrderDbStatus;
  tracking?: string;
  note?: string;
};

type OrderLabels = {
  fulfillment: Record<FulfillmentStatus, string>;
  payment: Record<PaymentStatus, string>;
  priority: Record<Priority, string>;
  status: Record<OrderDbStatus, string>;
  stockRisk: Record<StockRisk, string>;
};

type OrderWorkflowCounts = Record<WorkflowKey, number>;

const pageSize = 20;
const orderStatuses: OrderDbStatus[] = [
  "submitted",
  "accepted",
  "picking",
  "packed",
  "shipped",
  "completed",
  "cancelled",
];
const statusFlow: OrderDbStatus[] = [
  "submitted",
  "accepted",
  "picking",
  "packed",
  "shipped",
  "completed",
];
const cancellableStatuses = new Set<OrderDbStatus>([
  "submitted",
  "accepted",
  "picking",
  "packed",
]);

function useAdminText() {
  const { locale } = useI18n();

  return getAdminDictionary(locale).admin;
}

export function AdminOrdersPanel() {
  const text = useAdminText();
  const labels = React.useMemo(() => buildOrderLabels(text), [text]);
  const [orders, setOrders] = React.useState<AdminOrder[]>([]);
  const [detailsById, setDetailsById] = React.useState<Record<string, AdminOrder>>({});
  const [dataSource, setDataSource] = React.useState<OrdersDataSource>(() => ({
    source: "empty",
    label: sourceLabel("empty", text),
    syncedAt: null,
    total: 0,
    returned: 0,
  }));
  const [isLoadingOrders, setIsLoadingOrders] = React.useState(false);
  const [loadingDetailId, setLoadingDetailId] = React.useState<string | null>(null);
  const [pendingOrderAction, setPendingOrderAction] = React.useState<string | null>(
    null
  );
  const [statusFilter, setStatusFilter] =
    React.useState<StatusFilterValue>("all");
  const [paymentFilter, setPaymentFilter] =
    React.useState<PaymentFilterValue>("all");
  const [stockRiskFilter, setStockRiskFilter] =
    React.useState<StockRiskFilterValue>("all");
  const [viewMode, setViewMode] = React.useState<ViewMode>("orders");
  const [selectedOrderId, setSelectedOrderId] = React.useState("");
  const [mobileDetailsOpen, setMobileDetailsOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<PanelNotice | null>(null);
  const [page, setPage] = React.useState(1);

  const upsertOrder = React.useCallback((order: AdminOrder) => {
    setOrders((currentOrders) => {
      const exists = currentOrders.some((item) => item.id === order.id);
      const nextOrders = exists
        ? currentOrders.map((item) =>
            item.id === order.id ? mergeOrderSummary(item, order) : item
          )
        : [order, ...currentOrders];

      return nextOrders;
    });
    setDetailsById((currentDetails) => ({
      ...currentDetails,
      [order.id]: order,
    }));
  }, []);

  const loadOrderDetails = React.useCallback(
    async (orderId: string, signal?: AbortSignal) => {
      setLoadingDetailId(orderId);

      try {
        const order = await fetchOrderDetailFromApi(orderId, signal);

        if (signal?.aborted) {
          return null;
        }

        upsertOrder(order);
        return order;
      } catch (error) {
        if (!signal?.aborted) {
          setNotice({
            tone: "error",
            message:
              error instanceof Error ? error.message : text.orders.detailError,
          });
        }

        return null;
      } finally {
        if (!signal?.aborted) {
          setLoadingDetailId((current) => (current === orderId ? null : current));
        }
      }
    },
    [text.orders.detailError, upsertOrder]
  );

  const refreshOrders = React.useCallback(
    async (signal?: AbortSignal) => {
      setIsLoadingOrders(true);

      try {
        const result = await fetchOrdersFromApi({
          signal,
          status: statusFilter === "all" ? undefined : statusFilter,
        });

        if (signal?.aborted) {
          return;
        }

        setOrders(result.orders);
        setDataSource({
          source: result.source,
          label: sourceLabel(result.source, text),
          syncedAt: formatSyncTime(),
          total: result.total,
          returned: result.returned,
        });
        setSelectedOrderId((currentId) =>
          currentId && result.orders.some((order) => order.id === currentId)
            ? currentId
            : result.orders[0]?.id ?? ""
        );
        setNotice(null);
      } catch (error) {
        if (signal?.aborted) {
          return;
        }

        setOrders([]);
        setDetailsById({});
        setSelectedOrderId("");
        setDataSource({
          source: "empty",
          label: sourceLabel("empty", text),
          syncedAt: formatSyncTime(),
          total: 0,
          returned: 0,
          error: error instanceof Error ? error.message : text.orders.apiError,
        });
        setNotice({
          tone: "error",
          message: text.orders.apiError,
        });
      } finally {
        if (!signal?.aborted) {
          setIsLoadingOrders(false);
        }
      }
    },
    [statusFilter, text]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void refreshOrders(controller.signal);
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [refreshOrders]);

  React.useEffect(() => {
    if (!selectedOrderId) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadOrderDetails(selectedOrderId, controller.signal);
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [loadOrderDetails, selectedOrderId]);

  const filteredOrders = React.useMemo(
    () =>
      orders.filter((order) => {
        const matchesStatus =
          statusFilter === "all" || order.status === statusFilter;
        const matchesPayment =
          paymentFilter === "all" ||
          (paymentFilter === "paid" && order.paymentStatus === "paid") ||
          (paymentFilter === "open" && order.paymentStatus !== "paid");
        const matchesStockRisk =
          stockRiskFilter === "all" ||
          (stockRiskFilter === "risk" &&
            (order.stockRisk === "low" || order.stockRisk === "blocked")) ||
          order.stockRisk === stockRiskFilter;
        const matchesView = orderMatchesView(order, viewMode);

        return (
          matchesStatus &&
          matchesPayment &&
          matchesStockRisk &&
          matchesView
        );
      }),
    [orders, paymentFilter, statusFilter, stockRiskFilter, viewMode]
  );
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleOrders = filteredOrders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const selectedOrderIsVisible =
    selectedOrderId.length > 0 &&
    filteredOrders.some((order) => order.id === selectedOrderId);
  const selectedOrder =
    selectedOrderIsVisible && selectedOrderId
      ? detailsById[selectedOrderId] ??
        filteredOrders.find((order) => order.id === selectedOrderId) ??
        null
      : visibleOrders[0] ?? null;

  const metrics = React.useMemo(() => {
    const pendingPayments = orders.filter(
      (order) => order.paymentStatus !== "paid" && order.status !== "cancelled"
    ).length;
    const shippingQueue = orders.filter((order) =>
      ["accepted", "picking", "packed", "shipped"].includes(order.status)
    ).length;
    const urgentOrders = orders.filter((order) => order.priority === "urgent").length;
    const revenue = orders
      .filter((order) => order.paymentStatus === "paid")
      .reduce((total, order) => total + order.total, 0);

    return {
      totalOrders: orders.length,
      pendingPayments,
      shippingQueue,
      urgentOrders,
      revenue,
    };
  }, [orders]);
  const workflowCounts = React.useMemo<OrderWorkflowCounts>(
    () => ({
      all: orders.length,
      submitted: orders.filter((order) => order.status === "submitted").length,
      accepted: orders.filter((order) => order.status === "accepted").length,
      picking: orders.filter((order) => order.status === "picking").length,
      packed: orders.filter((order) => order.status === "packed").length,
      shipped: orders.filter((order) => order.status === "shipped").length,
      openPayments: orders.filter(
        (order) => order.paymentStatus !== "paid" && order.status !== "cancelled"
      ).length,
      stockRisk: orders.filter(
        (order) => order.stockRisk === "low" || order.stockRisk === "blocked"
      ).length,
    }),
    [orders]
  );
  const activeWorkflowKey = React.useMemo<WorkflowKey>(() => {
    if (paymentFilter === "open" && viewMode === "payments") {
      return "openPayments";
    }

    if (stockRiskFilter === "risk") {
      return "stockRisk";
    }

    if (
      statusFilter === "submitted" ||
      statusFilter === "accepted" ||
      statusFilter === "picking" ||
      statusFilter === "packed" ||
      statusFilter === "shipped"
    ) {
      return statusFilter;
    }

    return "all";
  }, [paymentFilter, statusFilter, stockRiskFilter, viewMode]);
  const handleWorkflowSelect = React.useCallback((key: WorkflowKey) => {
    setPage(1);

    if (key === "all") {
      setStatusFilter("all");
      setPaymentFilter("all");
      setStockRiskFilter("all");
      setViewMode("orders");
      return;
    }

    if (key === "openPayments") {
      setStatusFilter("all");
      setPaymentFilter("open");
      setStockRiskFilter("all");
      setViewMode("payments");
      return;
    }

    if (key === "stockRisk") {
      setStatusFilter("all");
      setPaymentFilter("all");
      setStockRiskFilter("risk");
      setViewMode("orders");
      return;
    }

    setStatusFilter(key);
    setPaymentFilter("all");
    setStockRiskFilter("all");
    setViewMode(key === "shipped" ? "shipping" : "orders");
  }, []);

  const patchOrder = React.useCallback(
    async (order: AdminOrder, patch: OrderPatchInput, successMessage: string) => {
      const actionKey = `${order.id}:${
        patch.rollback ? "rollback" : patch.status ?? Object.keys(patch).sort().join(",")
      }`;

      setPendingOrderAction(actionKey);

      try {
        const result = await patchOrderInApi(order.id, patch);

        if (result.order) {
          upsertOrder(result.order);
        }

        const refreshedOrder = await fetchOrderDetailFromApi(order.id);

        upsertOrder(refreshedOrder);
        setNotice({
          tone: "success",
          message: `${successMessage} ${formatAdminMessage(text.orders.notices.persisted, {
            id: order.id,
          })}`,
        });
      } catch (error) {
        setNotice({
          tone: "error",
          message:
            error instanceof Error ? error.message : text.orders.notices.rejected,
        });
      } finally {
        setPendingOrderAction(null);
      }
    },
    [text.orders.notices.persisted, text.orders.notices.rejected, upsertOrder]
  );

  const handleTransition = React.useCallback(
    (order: AdminOrder, status: OrderDbStatus, successMessage: string) => {
      void patchOrder(
        order,
        {
          note: `${labels.status[order.status]} -> ${labels.status[status]}`,
          status,
        },
        successMessage
      );
    },
    [labels.status, patchOrder]
  );

  const handleCancelOrder = React.useCallback(
    (order: AdminOrder) => {
      void patchOrder(
        order,
        {
          note: text.orders.cancelOrder,
          status: "cancelled",
        },
        formatAdminMessage(text.orders.cancelledNotice, { id: order.id })
      );
    },
    [patchOrder, text.orders.cancelOrder, text.orders.cancelledNotice]
  );

  const handleRollbackOrder = React.useCallback(
    (order: AdminOrder) => {
      const rollback = getOrderRollback(order, text, labels);

      if (!rollback) {
        return;
      }

      void patchOrder(
        order,
        {
          note: `${text.orders.rollbackStatus}: ${labels.status[order.status]} -> ${labels.status[rollback.status]}`,
          rollback: true,
        },
        rollback.notice
      );
    },
    [labels, patchOrder, text]
  );

  const handleAssignCarrier = React.useCallback(
    (order: AdminOrder, carrier: Carrier) => {
      if (carrier === unassignedCarrier) {
        return;
      }

      void patchOrder(
        order,
        { carrier, note: `${text.common.carrier}: ${carrier}` },
        text.orders.shipmentSaved
      );
    },
    [patchOrder, text.common.carrier, text.orders.shipmentSaved]
  );

  const handleUpdateTracking = React.useCallback(
    (order: AdminOrder, tracking: string) => {
      void patchOrder(
        order,
        { note: `Tracking: ${tracking.trim() || "-"}`, tracking: tracking.trim() },
        text.orders.shipmentSaved
      );
    },
    [patchOrder, text.orders.shipmentSaved]
  );

  const handlePrintOrder = React.useCallback(
    (order: AdminOrder) => {
      printOrderPackingSlip(order, labels, text);
    },
    [labels, text]
  );

  const handleOpenOrder = React.useCallback((orderId: string) => {
    setSelectedOrderId(orderId);
    setMobileDetailsOpen(true);
  }, []);

  const handleOpenMobileDetails = React.useCallback((orderId: string) => {
    setSelectedOrderId(orderId);
    setMobileDetailsOpen(true);
  }, []);
  const handleQuickTransition = React.useCallback(
    (order: AdminOrder) => {
      const transition = getOrderTransition(order, text);

      if (!transition) {
        handleOpenOrder(order.id);
        return;
      }

      if (transition.status === "shipped" && !canShipOrder(order)) {
        handleOpenOrder(order.id);
        return;
      }

      handleTransition(order, transition.status, transition.notice);
    },
    [handleOpenOrder, handleTransition, text]
  );

  return (
    <section className="w-full min-w-0 space-y-3 text-slate-950">
      <div className="hidden gap-2 md:grid md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={text.orders.metrics.totalOrders}
          value={`${metrics.totalOrders}`}
          detail={formatAdminMessage(text.orders.metrics.inView, {
            count: filteredOrders.length,
          })}
          icon={ClipboardList}
        />
        <MetricCard
          label={text.orders.metrics.pendingPayments}
          value={`${metrics.pendingPayments}`}
          detail={text.orders.metrics.pendingPaymentsDetail}
          icon={CreditCard}
        />
        <MetricCard
          label={text.orders.metrics.shippingQueue}
          value={`${metrics.shippingQueue}`}
          detail={formatAdminMessage(text.orders.metrics.urgentDetail, {
            count: metrics.urgentOrders,
          })}
          icon={Truck}
        />
        <MetricCard
          label={text.orders.metrics.revenue}
          value={formatEuro(metrics.revenue)}
          detail={text.orders.metrics.revenueDetail}
          icon={BadgeCheck}
        />
      </div>

      <Card className="gap-0 rounded-md border-slate-200 bg-white py-0 shadow-[0_10px_26px_rgba(15,23,42,0.045)]">
        <CardHeader className="gap-2 border-b border-slate-200/80 px-3 py-2.5">
          <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base leading-tight">{text.orders.title}</CardTitle>
                <CardDescription className="text-xs leading-tight">
                  {text.orders.description}
                </CardDescription>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                <Badge className={cn("h-5 px-2 text-[11px]", sourceBadgeClass(dataSource.source))}>
                  {text.catalog.sourceBadge.replace("{source}", dataSource.label)}
                </Badge>
                <span className="min-w-0 break-words">
                  {dataSource.syncedAt
                    ? formatAdminMessage(text.orders.sourceStats, {
                        returned: dataSource.returned,
                        total: dataSource.total,
                        time: dataSource.syncedAt,
                      })
                    : text.orders.sourcePending}
                </span>
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center xl:justify-end">
              <Tabs
                value={viewMode}
                onValueChange={(value) => setViewMode(value as ViewMode)}
                className="w-full sm:w-auto"
              >
                <TabsList className="grid h-8 w-full grid-cols-3 bg-slate-100 sm:w-auto">
                  <TabsTrigger value="orders" className="text-xs">
                    {text.orders.tabs.orders}
                  </TabsTrigger>
                  <TabsTrigger value="payments" className="text-xs">
                    {text.orders.tabs.payments}
                  </TabsTrigger>
                  <TabsTrigger value="shipping" className="text-xs">
                    {text.orders.tabs.shipping}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Button
                variant="outline"
                size="sm"
                className="h-8 bg-white"
                onClick={() => void refreshOrders()}
                disabled={isLoadingOrders}
              >
                <RefreshCw
                  className={cn("size-3.5", isLoadingOrders && "animate-spin")}
                />
                {text.orders.syncOrders}
              </Button>
            </div>
          </div>
          <OrderWorkflowStrip
            activeKey={activeWorkflowKey}
            counts={workflowCounts}
            labels={labels}
            text={text}
            onSelect={handleWorkflowSelect}
          />
        </CardHeader>
        <CardContent className="min-w-0 space-y-2 px-3 py-2.5">
          {notice && (
            <div className={cn("flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium", noticeToneClass(notice.tone))}>
              <NoticeIcon tone={notice.tone} />
              <span className="min-w-0 flex-1 break-words">{notice.message}</span>
              <Button
                variant="ghost"
                size="xs"
                className="text-current hover:bg-white/60"
                onClick={() => setNotice(null)}
              >
                {text.common.ok}
              </Button>
            </div>
          )}
          {dataSource.error && (
            <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold leading-6 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 break-words">{dataSource.error}</div>
              <Button
                variant="outline"
                size="xs"
                className="w-fit bg-white"
                onClick={() => void refreshOrders()}
                disabled={isLoadingOrders}
              >
                <RefreshCw className="size-3" />
                {text.orders.syncOrders}
              </Button>
            </div>
          )}

          <div className="min-w-0">
            <OrdersList
              labels={labels}
              orders={visibleOrders}
              page={currentPage}
              pendingActionKey={pendingOrderAction}
              selectedOrderId={selectedOrder?.id ?? ""}
              text={text}
              totalFiltered={filteredOrders.length}
              totalPages={totalPages}
              viewMode={viewMode}
              onNextPage={() => setPage((current) => Math.min(totalPages, current + 1))}
              onOpenMobileDetails={handleOpenMobileDetails}
              onPreviousPage={() => setPage((current) => Math.max(1, current - 1))}
              onQuickTransition={handleQuickTransition}
              onSelectOrder={handleOpenOrder}
            />
          </div>
          <Dialog
            open={mobileDetailsOpen && selectedOrder !== null}
            onOpenChange={setMobileDetailsOpen}
          >
            {selectedOrder && (
              <DialogContent className="grid max-h-[calc(100dvh-0.5rem)] w-[calc(100vw-0.5rem)] max-w-[calc(100vw-0.5rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-lg bg-white p-0 pt-7 sm:max-h-[calc(100dvh-1rem)] sm:w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-1rem)] sm:pt-10 xl:max-w-[1180px]">
                <DialogHeader className="border-b border-slate-200 px-2.5 pb-1.5 pr-12 sm:px-4 sm:pb-2.5">
                  <DialogTitle className="break-words text-sm font-black leading-tight text-slate-950 sm:text-base">
                    {formatAdminMessage(text.orders.detailDialogTitle, {
                      id: shortOrderId(selectedOrder.id),
                    })}
                  </DialogTitle>
                  <DialogDescription className="hidden text-xs leading-snug text-slate-500 sm:block sm:text-sm">
                    {text.orders.detailDialogDescription}
                  </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 overflow-y-auto overscroll-contain">
                  <OrderDetailsPanel
                    labels={labels}
                    loading={loadingDetailId === selectedOrder.id}
                    order={selectedOrder}
                    pendingActionKey={pendingOrderAction}
                  text={text}
                  onAssignCarrier={handleAssignCarrier}
                  onCancelOrder={handleCancelOrder}
                  onPrintOrder={handlePrintOrder}
                  onRollback={handleRollbackOrder}
                  onTransition={handleTransition}
                  onUpdateTracking={handleUpdateTracking}
                  />
                </div>
              </DialogContent>
            )}
          </Dialog>
        </CardContent>
      </Card>
    </section>
  );
}

function OrderWorkflowStrip({
  activeKey,
  counts,
  labels,
  text,
  onSelect,
}: {
  activeKey: WorkflowKey;
  counts: OrderWorkflowCounts;
  labels: OrderLabels;
  text: AdminText;
  onSelect: (key: WorkflowKey) => void;
}) {
  const items: Array<{ key: WorkflowKey; label: string }> = [
    { key: "all", label: text.orders.workflow.all },
    { key: "submitted", label: labels.status.submitted },
    { key: "accepted", label: labels.status.accepted },
    { key: "picking", label: labels.status.picking },
    { key: "packed", label: labels.status.packed },
    { key: "shipped", label: labels.status.shipped },
    { key: "openPayments", label: text.orders.workflow.openPayments },
    { key: "stockRisk", label: text.orders.workflow.stockRisk },
  ];

  return (
    <div className="min-w-0">
      <div
        role="toolbar"
        aria-label={text.orders.workflow.title}
        className="flex min-w-0 gap-1.5 overflow-x-auto pb-0.5"
      >
        {items.map((item) => {
          const isActive = item.key === activeKey;

          return (
            <Button
              key={item.key}
              type="button"
              variant={isActive ? "default" : "outline"}
              size="xs"
              className={cn(
                "h-8 gap-1.5 rounded-md px-2.5",
                !isActive && "bg-white text-slate-600"
              )}
              onClick={() => onSelect(item.key)}
            >
              <span>{item.label}</span>
              <span
                className={cn(
                  "rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-black leading-none text-slate-600",
                  isActive && "bg-white/20 text-white"
                )}
              >
                {counts[item.key]}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="h-[68px] gap-0 rounded-md border-slate-200 bg-white py-0 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
      <CardContent className="h-full px-3 py-2">
        <div className="flex h-full min-w-0 items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold leading-tight text-slate-500">{label}</p>
            <div className="mt-1 truncate text-xl font-black leading-none tracking-normal">
              {value}
            </div>
            <p className="mt-1 truncate text-[11px] font-semibold leading-tight text-slate-500">
              {detail}
            </p>
          </div>
          <div className="hidden size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary sm:grid">
            <Icon className="size-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OrdersList({
  labels,
  orders,
  page,
  pendingActionKey,
  selectedOrderId,
  text,
  totalFiltered,
  totalPages,
  viewMode,
  onNextPage,
  onOpenMobileDetails,
  onPreviousPage,
  onQuickTransition,
  onSelectOrder,
}: {
  labels: OrderLabels;
  orders: AdminOrder[];
  page: number;
  pendingActionKey: string | null;
  selectedOrderId: string;
  text: AdminText;
  totalFiltered: number;
  totalPages: number;
  viewMode: ViewMode;
  onNextPage: () => void;
  onOpenMobileDetails: (orderId: string) => void;
  onPreviousPage: () => void;
  onQuickTransition: (order: AdminOrder) => void;
  onSelectOrder: (orderId: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-slate-900">
            {text.orders.listTitle}
          </h3>
          <p className="truncate text-xs text-slate-500">
            {text.orders.listDescription}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="bg-white">
            {formatAdminMessage(text.orders.orderCount, { count: totalFiltered })}
          </Badge>
        </div>
      </div>

      <div className="space-y-2 md:hidden">
        {orders.length > 0 ? (
          orders.map((order) => {
            const summaryFacts = getMobileSummaryFacts(order, viewMode, labels, text);

            return (
              <button
                key={order.id}
                type="button"
                aria-label={formatAdminMessage(text.orders.mobileOpenAria, {
                  id: order.id,
                })}
                className={cn(
                  "w-full min-w-0 rounded-lg border bg-white p-2.5 text-left transition hover:border-primary/40 hover:bg-primary/4",
                  selectedOrderId === order.id
                    ? "border-primary/50 ring-2 ring-primary/12"
                    : "border-slate-200"
                )}
                onClick={() => onOpenMobileDetails(order.id)}
              >
                <OrderListHeader labels={labels} order={order} />
                <div className="mt-2 min-w-0 break-words text-xs font-semibold leading-5 text-slate-500">
                  {summaryFacts.map((fact) => `${fact.label}: ${fact.value}`).join(" · ")}
                </div>
              </button>
            );
          })
        ) : (
          <EmptyState text={text} />
        )}
      </div>

      <div className="hidden overflow-hidden rounded-md border border-slate-200 md:block">
        <Table className="min-w-[980px] text-xs">
          <TableHeader className="bg-slate-50 [&_th]:h-8 [&_th]:px-2 [&_th]:text-xs">
            <TableRow>
              <TableHead>{text.orders.table.order}</TableHead>
              <TableHead>{text.orders.table.customer}</TableHead>
              <TableHead>{text.orders.table.status}</TableHead>
              {viewMode === "shipping" ? (
                <>
                  <TableHead>{text.common.service}</TableHead>
                  <TableHead>{text.orders.table.carrier}</TableHead>
                </>
              ) : viewMode === "payments" ? (
                <>
                  <TableHead>{text.orders.table.payment}</TableHead>
                  <TableHead>{text.orders.table.due}</TableHead>
                </>
              ) : (
                <>
                  <TableHead>{text.orders.table.payment}</TableHead>
                  <TableHead>{text.orders.table.total}</TableHead>
                </>
              )}
              <TableHead className="text-right">{text.orders.table.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_td]:px-2 [&_td]:py-1.5">
            {orders.length > 0 ? (
              orders.map((order) => {
                const transition = getOrderTransition(order, text);
                const isMutating =
                  pendingActionKey?.startsWith(`${order.id}:`) ?? false;
                const needsLogistics =
                  transition?.status === "shipped" && !canShipOrder(order);

                return (
                <TableRow
                  key={order.id}
                  data-state={selectedOrderId === order.id ? "selected" : undefined}
                  className="h-[44px]"
                >
                  <TableCell>
                    <div
                      className="font-mono text-xs font-semibold text-slate-600"
                      title={order.id}
                    >
                      {shortOrderId(order.id)}
                    </div>
                    <div className="text-[11px] text-slate-500">{order.date}</div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[260px] truncate text-xs font-bold text-slate-900">
                      {order.company}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {order.customer.city} ({order.customer.province})
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge className={orderStatusBadgeClass(order.status)}>
                        {labels.status[order.status]}
                      </Badge>
                      <Badge className={stockRiskBadgeClass(order.stockRisk)}>
                        {labels.stockRisk[order.stockRisk]}
                      </Badge>
                    </div>
                    <OrderProgressInline labels={labels} status={order.status} />
                  </TableCell>
                  {viewMode === "shipping" ? (
                    <>
                      <TableCell>
                        <div className="text-xs font-semibold">{order.service}</div>
                        <div className="text-[11px] text-slate-500">{order.eta}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold">
                          {carrierLabel(order.carrier, text)}
                        </div>
                        <div className="text-[11px] text-slate-500">{order.tracking || order.eta}</div>
                      </TableCell>
                    </>
                  ) : viewMode === "payments" ? (
                    <>
                      <TableCell>
                        <Badge className={paymentBadgeClass(order.paymentStatus)}>
                          {labels.payment[order.paymentStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold">{order.paymentDue}</div>
                        <div className="text-[11px] text-slate-500">
                          {order.paymentMethod}
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>
                        <Badge className={paymentBadgeClass(order.paymentStatus)}>
                          {labels.payment[order.paymentStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatEuro(order.total)}
                      </TableCell>
                    </>
                  )}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {transition && (
                        <Button
                          size="xs"
                          className="h-7 px-2"
                          onClick={() =>
                            needsLogistics
                              ? onSelectOrder(order.id)
                              : onQuickTransition(order)
                          }
                          disabled={isMutating}
                        >
                          {isMutating ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <ArrowRight className="size-3" />
                          )}
                          {needsLogistics ? text.orders.details.logistics : transition.label}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="xs"
                        className="h-7 bg-white px-2"
                        onClick={() => onSelectOrder(order.id)}
                      >
                        {text.common.details}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center text-slate-500">
                  {text.orders.empty}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          className="bg-white"
          onClick={onPreviousPage}
          disabled={page <= 1}
        >
          {text.orders.previousPage}
        </Button>
        <div className="text-xs font-semibold text-slate-500">
          {formatAdminMessage(text.orders.pageStatus, {
            page,
            pages: totalPages,
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="bg-white"
          onClick={onNextPage}
          disabled={page >= totalPages}
        >
          {text.orders.nextPage}
        </Button>
      </div>
    </div>
  );
}

function OrderListHeader({
  labels,
  order,
}: {
  labels: OrderLabels;
  order: AdminOrder;
}) {
  return (
    <>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div
            className="break-words font-mono text-[13px] font-black leading-tight text-slate-900"
            title={order.id}
          >
            {shortOrderId(order.id)}
          </div>
          <div className="mt-0.5 break-words text-xs leading-snug text-slate-600">
            {order.company}
          </div>
        </div>
        <div className="shrink-0 whitespace-nowrap text-right text-sm font-black leading-tight text-slate-950">
          {formatEuro(order.total)}
        </div>
      </div>
      <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
        <Badge
          className={cn(
            orderStatusBadgeClass(order.status),
            "h-auto min-h-5 whitespace-normal text-[11px] leading-tight"
          )}
        >
          {labels.status[order.status]}
        </Badge>
        <Badge
          className={cn(
            priorityBadgeClass(order.priority),
            "h-auto min-h-5 whitespace-normal text-[11px] leading-tight"
          )}
        >
          {labels.priority[order.priority]}
        </Badge>
      </div>
    </>
  );
}

function getMobileSummaryFacts(
  order: AdminOrder,
  viewMode: ViewMode,
  labels: OrderLabels,
  text: AdminText
) {
  if (viewMode === "shipping") {
    return [
      { label: text.common.service, value: order.service },
      {
        label: text.orders.summary.carrier,
        value: `${carrierLabel(order.carrier, text)} / ${order.tracking || order.eta}`,
      },
    ];
  }

  if (viewMode === "payments") {
    return [
      { label: text.orders.summary.payment, value: labels.payment[order.paymentStatus] },
      { label: text.orders.summary.due, value: order.paymentDue },
    ];
  }

  return [
    { label: text.orders.summary.payment, value: labels.payment[order.paymentStatus] },
    {
      label: text.orders.summary.logistics,
      value: labels.fulfillment[order.fulfillmentStatus],
    },
  ];
}

function OrderProgressInline({
  labels,
  status,
}: {
  labels: OrderLabels;
  status: OrderDbStatus;
}) {
  const steps = statusFlow.slice(1);
  const currentIndex = statusFlow.indexOf(status);
  const cancelled = status === "cancelled";

  return (
    <div
      className="mt-1.5 w-[220px] min-w-0"
      aria-label={`${labels.status[status]} ${cancelled ? "0" : Math.max(0, currentIndex)}/5`}
    >
      <div className="grid grid-cols-5 items-start gap-1">
        {steps.map((step, index) => {
          const stepIndex = index + 1;
          const done = !cancelled && currentIndex >= stepIndex;
          const current = !cancelled && currentIndex === stepIndex;

          return (
            <div key={step} className="relative min-w-0 text-center">
              {index > 0 && (
                <span
                  className={cn(
                    "absolute left-[-50%] top-2 h-0.5 w-full rounded-full bg-slate-200",
                    done && "bg-primary"
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 mx-auto grid size-4 place-items-center rounded-full border text-[9px] font-black leading-none",
                  done
                    ? "border-primary bg-primary text-white"
                    : "border-slate-200 bg-white text-slate-400",
                  current && "ring-2 ring-primary/15",
                  cancelled && "border-red-100 bg-red-50 text-red-300"
                )}
              >
                {stepIndex}
              </span>
              <span
                className={cn(
                  "mt-0.5 block truncate text-[9px] font-semibold leading-tight text-slate-400",
                  done && "text-primary",
                  current && "text-slate-900",
                  cancelled && "text-red-300"
                )}
              >
                {labels.status[step]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderDetailsPanel({
  labels,
  loading,
  order,
  pendingActionKey,
  text,
  onAssignCarrier,
  onCancelOrder,
  onPrintOrder,
  onRollback,
  onTransition,
  onUpdateTracking,
}: {
  labels: OrderLabels;
  loading: boolean;
  order: AdminOrder | null;
  pendingActionKey: string | null;
  text: AdminText;
  onAssignCarrier: (order: AdminOrder, carrier: Carrier) => void;
  onCancelOrder: (order: AdminOrder) => void;
  onPrintOrder: (order: AdminOrder) => void;
  onRollback: (order: AdminOrder) => void;
  onTransition: (order: AdminOrder, status: OrderDbStatus, successMessage: string) => void;
  onUpdateTracking: (order: AdminOrder, tracking: string) => void;
}) {
  if (!order) {
    return (
      <div className="grid min-h-[360px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
        <div>
          <AlertTriangle className="mx-auto size-8 text-slate-400" />
          <h3 className="mt-3 text-sm font-bold text-slate-900">
            {text.orders.noOrderTitle}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {text.orders.noOrderDescription}
          </p>
        </div>
      </div>
    );
  }

  const pickedItems = order.lines.reduce((total, line) => total + line.picked, 0);
  const isMutating = pendingActionKey?.startsWith(`${order.id}:`) ?? false;
  const isReadOnly = order.status === "completed" || order.status === "cancelled";

  return (
    <div className="min-w-0 space-y-1.5 bg-slate-50/40 p-1.5 sm:space-y-3 sm:p-3">
      <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <h3
              className="hidden break-words text-base font-black leading-tight text-slate-950 sm:block"
              title={order.id}
            >
              {shortOrderId(order.id)}
            </h3>
            <Badge className={orderStatusBadgeClass(order.status)}>
              {labels.status[order.status]}
            </Badge>
            <Badge className={stockRiskBadgeClass(order.stockRisk)}>
              {labels.stockRisk[order.stockRisk]}
            </Badge>
            {loading && (
              <Badge className="border-cyan-200 bg-cyan-50 text-cyan-700">
                <Loader2 className="size-3 animate-spin" />
                {text.orders.detailLoading}
              </Badge>
            )}
            {isMutating && (
              <Badge className="border-cyan-200 bg-cyan-50 text-cyan-700">
                <Loader2 className="size-3 animate-spin" />
                {text.catalog.savingProduct}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs leading-snug text-slate-500 sm:mt-1 sm:break-words sm:text-sm">
            {order.company} - {order.customer.city} ({order.customer.province})
          </p>
        </div>
        <OrderActionBar
          labels={labels}
          order={order}
          text={text}
          isMutating={isMutating}
          onCancelOrder={onCancelOrder}
          onPrintOrder={onPrintOrder}
          onRollback={onRollback}
          onTransition={onTransition}
        />
      </div>

      {isReadOnly && (
        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 sm:px-3 sm:py-2 sm:text-sm">
          <CheckCircle2 className="size-4 text-slate-400" />
          {text.orders.readOnly}
        </div>
      )}

      <div className="grid grid-cols-2 gap-1 rounded-md border border-slate-200 bg-white p-1 text-[11px] font-medium text-slate-600 sm:p-2.5 sm:text-xs md:hidden">
        <div className="min-w-0 rounded bg-slate-50 px-1.5 py-1">
          <div className="text-[10px] font-bold leading-none text-slate-400">
            {text.common.payment}
          </div>
          <div className="mt-0.5 truncate font-bold leading-tight text-slate-900">
            {labels.payment[order.paymentStatus]} · {order.paymentDue}
          </div>
        </div>
        <div className="min-w-0 rounded bg-slate-50 px-1.5 py-1">
          <div className="text-[10px] font-bold leading-none text-slate-400">
            {text.common.fulfillment}
          </div>
          <div className="mt-0.5 truncate font-bold leading-tight text-slate-900">
            {labels.fulfillment[order.fulfillmentStatus]} · {pickedItems}/{order.items}
          </div>
        </div>
      </div>

      <div className="hidden gap-2 md:grid md:grid-cols-2 xl:grid-cols-4">
        <DetailFact
          label={text.orders.details.orderTotal}
          value={formatEuro(order.total)}
          helper={formatAdminMessage(text.orders.details.piecesOrdered, {
            count: order.items,
          })}
        />
        <DetailFact
          label={text.common.payment}
          value={labels.payment[order.paymentStatus]}
          helper={`${order.paymentMethod} - ${order.paymentDue}`}
        />
        <DetailFact
          label={text.orders.details.fulfillment}
          value={labels.fulfillment[order.fulfillmentStatus]}
          helper={formatAdminMessage(text.orders.details.piecesPicked, {
            picked: pickedItems,
            items: order.items,
          })}
        />
        <DetailFact
          label={text.orders.details.customer}
          value={order.customer.priceList}
          helper={order.customer.partitaIva}
        />
      </div>

      <div className="grid gap-1 sm:gap-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Field label={text.common.carrier}>
          <Select
            value={order.carrier}
            onValueChange={(value) => onAssignCarrier(order, value as Carrier)}
            disabled={isMutating || isReadOnly}
          >
            <SelectTrigger className="h-8 w-full rounded-md bg-white text-sm sm:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={unassignedCarrier}>{text.common.none}</SelectItem>
              {carrierOptions.map((carrier) => (
                <SelectItem key={carrier} value={carrier}>
                  {carrier}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Tracking">
          <TrackingEditor
            key={`${order.id}:${order.tracking}`}
            isMutating={isMutating || isReadOnly}
            order={order}
            tracking={order.tracking}
            text={text}
            onUpdateTracking={onUpdateTracking}
          />
        </Field>
      </div>

      <div className="hidden md:block">
        <StatusStepper labels={labels} status={order.status} />
      </div>

      <div className="grid gap-1 sm:gap-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="min-w-0 rounded-md border border-slate-200 bg-white p-1.5 sm:p-2.5">
          <div className="mb-1 flex items-center gap-2 sm:mb-2">
            <PackageCheck className="size-4 text-primary" />
            <div className="text-sm font-bold text-slate-900">
              {text.orders.details.orderLines}
            </div>
          </div>
          <OrderLines lines={order.lines} text={text} />
        </div>
        <div className="min-w-0 space-y-1 sm:space-y-2">
          <div className="rounded-md border border-slate-200 bg-white p-1.5 sm:p-2.5">
            <div className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-900 sm:mb-2">
              <Truck className="size-4 text-primary" />
              {text.orders.details.logistics}
            </div>
            <div className="space-y-1 text-xs text-slate-600 sm:space-y-2 sm:text-sm">
              <InfoRow label={text.common.service} value={order.service} />
              <InfoRow label={text.common.eta} value={order.eta} />
              <InfoRow label={text.orders.details.deliveryAddress} value={order.shippingAddress} />
              <InfoRow label={text.common.owner} value={order.owner} />
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-1.5 sm:p-2.5">
            <div className="mb-1 text-sm font-bold text-slate-900 sm:mb-2">
              {text.orders.details.notesAudit}
            </div>
            <div className="rounded-md bg-slate-50 px-1.5 py-1 text-xs font-medium leading-5 text-slate-600 sm:px-2.5 sm:py-2">
              <span className="font-bold text-slate-400">{text.orders.details.orderNote}</span>
              <span className="ml-2">{order.notes || text.common.none}</span>
            </div>
            <OrderOperationHistory
              events={order.operationHistory}
              fallbackActivity={order.activity}
              labels={labels}
              text={text}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function canShipOrder(order: AdminOrder) {
  return (
    order.status === "packed" &&
    order.carrier !== unassignedCarrier &&
    order.tracking.trim().length > 0
  );
}

function getOrderTransition(order: AdminOrder, text: AdminText) {
  if (order.status === "submitted") {
    return {
      label: text.orders.confirmAndAccept,
      status: "accepted" as const,
      notice: formatAdminMessage(text.orders.notices.paid, { id: order.id }),
    };
  }

  if (order.status === "accepted") {
    return {
      label: text.orders.startPicking,
      status: "picking" as const,
      notice: formatAdminMessage(text.orders.startPickingNotice, { id: order.id }),
    };
  }

  if (order.status === "picking") {
    return {
      label: text.orders.markPacked,
      status: "packed" as const,
      notice: formatAdminMessage(text.orders.markPackedNotice, { id: order.id }),
    };
  }

  if (order.status === "packed") {
    return {
      label: text.orders.markShipped,
      status: "shipped" as const,
      notice: formatAdminMessage(text.orders.markShippedNotice, { id: order.id }),
    };
  }

  if (order.status === "shipped") {
    return {
      label: text.orders.completeOrder,
      status: "completed" as const,
      notice: formatAdminMessage(text.orders.completedNotice, { id: order.id }),
    };
  }

  return null;
}

function getOrderRollback(
  order: AdminOrder,
  text: AdminText,
  labels: OrderLabels
) {
  const previousStatus: OrderDbStatus | null =
    order.status === "accepted"
      ? "submitted"
      : order.status === "picking"
        ? "accepted"
        : order.status === "packed"
          ? "picking"
          : null;

  if (!previousStatus) {
    return null;
  }

  return {
    label: text.orders.rollbackStatus,
    status: previousStatus,
    notice: formatAdminMessage(text.orders.rollbackNotice, {
      from: labels.status[order.status],
      id: order.id,
      to: labels.status[previousStatus],
    }),
  };
}

function OrderActionBar({
  labels,
  order,
  text,
  isMutating,
  onCancelOrder,
  onPrintOrder,
  onRollback,
  onTransition,
}: {
  labels: OrderLabels;
  order: AdminOrder;
  text: AdminText;
  isMutating: boolean;
  onCancelOrder: (order: AdminOrder) => void;
  onPrintOrder: (order: AdminOrder) => void;
  onRollback: (order: AdminOrder) => void;
  onTransition: (order: AdminOrder, status: OrderDbStatus, successMessage: string) => void;
}) {
  const canShip = canShipOrder(order);
  const transition = getOrderTransition(order, text);
  const rollback = getOrderRollback(order, text, labels);
  const actionCount = [
    true,
    cancellableStatuses.has(order.status),
    Boolean(rollback),
    Boolean(transition),
  ].filter(Boolean).length;

  return (
    <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto sm:items-end sm:gap-2">
      <div
        className={cn(
          "grid w-full min-w-0 gap-1 sm:flex sm:w-auto sm:flex-wrap sm:justify-end sm:gap-2",
          actionCount === 1
            ? "grid-cols-1"
            : actionCount === 2
              ? "grid-cols-2"
              : actionCount === 3
                ? "grid-cols-3"
                : "grid-cols-4"
        )}
      >
        <Button
          variant="outline"
          size="sm"
          className="h-7 min-w-0 rounded-md bg-white px-1.5 text-[11px] text-slate-700 hover:text-slate-900 sm:h-10 sm:px-3 sm:text-sm"
          onClick={() => onPrintOrder(order)}
        >
          <Printer className="size-4" />
          <span className="min-w-0 truncate">{text.orders.print.action}</span>
        </Button>
        {cancellableStatuses.has(order.status) && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 min-w-0 rounded-md bg-white px-1.5 text-[11px] text-red-600 hover:text-red-600 sm:h-10 sm:px-3 sm:text-sm"
            onClick={() => onCancelOrder(order)}
            disabled={isMutating}
          >
            <XCircle className="size-4" />
            <span className="min-w-0 truncate">{text.orders.cancelOrder}</span>
          </Button>
        )}
        {rollback && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 min-w-0 rounded-md bg-white px-1.5 text-[11px] text-slate-700 hover:text-slate-900 sm:h-10 sm:px-3 sm:text-sm"
            onClick={() => onRollback(order)}
            disabled={isMutating}
          >
            <RotateCcw className="size-4" />
            <span className="min-w-0 truncate">{rollback.label}</span>
          </Button>
        )}
        {transition && (
          <Button
            size="sm"
            className="h-7 min-w-0 rounded-md px-1.5 text-[11px] sm:h-10 sm:px-3 sm:text-sm"
            onClick={() => onTransition(order, transition.status, transition.notice)}
            disabled={isMutating || (transition.status === "shipped" && !canShip)}
          >
            <ArrowRight className="size-4" />
            <span className="min-w-0 truncate">{transition.label}</span>
          </Button>
        )}
      </div>
      {order.status === "packed" && !canShip && (
        <div className="max-w-none text-[11px] font-semibold leading-4 text-amber-700 sm:max-w-[280px] sm:text-xs sm:leading-5">
          {text.orders.logisticsRequired}
        </div>
      )}
    </div>
  );
}

function TrackingEditor({
  isMutating,
  order,
  tracking,
  text,
  onUpdateTracking,
}: {
  isMutating: boolean;
  order: AdminOrder;
  tracking: string;
  text: AdminText;
  onUpdateTracking: (order: AdminOrder, tracking: string) => void;
}) {
  const [trackingDraft, setTrackingDraft] = React.useState(tracking);
  const trackingChanged = trackingDraft !== tracking;

  return (
    <div className="flex min-w-0 gap-1 sm:gap-2">
      <Input
        value={trackingDraft}
        onChange={(event) => setTrackingDraft(event.target.value)}
        className="h-8 min-w-0 rounded-md bg-white px-2 text-sm sm:h-9 sm:px-3"
        placeholder="Tracking"
        disabled={isMutating}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-8 shrink-0 rounded-md bg-white px-0 text-xs sm:h-9 sm:w-auto sm:px-3"
        onClick={() => onUpdateTracking(order, trackingDraft)}
        disabled={!trackingChanged || isMutating}
      >
        <Save className="size-3.5" />
        <span className="sr-only sm:not-sr-only sm:inline">{text.common.saveChanges}</span>
      </Button>
    </div>
  );
}

function OrderLines({
  lines,
  text,
}: {
  lines: OrderLine[];
  text: AdminText;
}) {
  if (lines.length === 0) {
    return <EmptyState text={text} />;
  }

  return (
    <div className="min-w-0">
      <div className="space-y-1 md:hidden">
        {lines.map((line) => (
          <div key={line.sku} className="rounded-md border border-slate-200 p-1.5">
            <div className="min-w-0">
              <div className="break-words text-[13px] font-bold leading-tight text-slate-900 sm:text-sm">
                {line.name}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-slate-500 sm:text-xs">
                {line.sku}
              </div>
            </div>
            <div className="mt-1.5 grid grid-cols-4 gap-1 text-xs max-[360px]:grid-cols-2">
              <MobileFact label={text.orders.lines.quantity} value={`${line.quantity}`} />
              <MobileFact label={text.orders.lines.reserved} value={`${line.reservedQty}`} />
              <MobileFact label={text.orders.lines.fulfilled} value={`${line.fulfilledQty}`} />
              <MobileFact label={text.common.price} value={formatEuro(line.unitPrice)} />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-md border border-slate-200 md:block">
        <Table className="min-w-[720px] text-xs">
          <TableHeader className="bg-slate-50 [&_th]:h-8 [&_th]:px-2 [&_th]:text-xs">
            <TableRow>
              <TableHead>{text.common.sku}</TableHead>
              <TableHead>{text.common.product}</TableHead>
              <TableHead>{text.orders.lines.quantity}</TableHead>
              <TableHead>{text.orders.lines.reserved}</TableHead>
              <TableHead>{text.orders.lines.fulfilled}</TableHead>
              <TableHead>{text.common.price}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_td]:px-2 [&_td]:py-1.5">
            {lines.map((line) => (
              <TableRow key={line.sku}>
                <TableCell className="font-mono text-xs font-semibold text-slate-600">
                  {line.sku}
                </TableCell>
                <TableCell>
                  <div className="max-w-[260px] truncate text-xs font-bold text-slate-900">
                    {line.name}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {line.category} · {line.batchCode || text.common.none}
                  </div>
                </TableCell>
                <TableCell>{line.quantity}</TableCell>
                <TableCell>
                  <Badge className={reservationBadgeClass(line)}>
                    {line.reservedQty}/{line.quantity}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={fulfilledBadgeClass(line)}>
                    {line.fulfilledQty}/{line.quantity}
                  </Badge>
                </TableCell>
                <TableCell>{formatEuro(line.unitPrice)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function printOrderPackingSlip(
  order: AdminOrder,
  labels: OrderLabels,
  text: AdminText
) {
  if (typeof window === "undefined") {
    return;
  }

  const printWindow = window.open("", "_blank", "width=900,height=1200");

  if (!printWindow) {
    return;
  }

  printWindow.opener = null;
  printWindow.document.open();
  printWindow.document.write(buildOrderPackingSlipHtml(order, labels, text));
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 250);
}

function buildOrderPackingSlipHtml(
  order: AdminOrder,
  labels: OrderLabels,
  text: AdminText
) {
  const printText = text.orders.print;
  const title = `${printText.title} ${shortOrderId(order.id)}`;
  const carrier = carrierLabel(order.carrier, text);
  const tracking = order.tracking.trim() || text.common.none;
  const totalQuantity = order.lines.reduce(
    (total, line) => total + line.quantity,
    0
  );
  const rows = order.lines
    .map(
      (line, index) => `
        <tr>
          <td class="check"><span></span></td>
          <td class="index">${index + 1}</td>
          <td class="sku">${escapeHtml(line.sku)}</td>
          <td>
            <div class="product">${escapeHtml(line.name)}</div>
            <div class="sub">${escapeHtml(line.category)}${
              line.batchCode ? ` · ${escapeHtml(line.batchCode)}` : ""
            }</div>
          </td>
          <td class="qty">${line.quantity}</td>
        </tr>
      `
    )
    .join("");
  const metaRows = [
    [text.orders.table.order, shortOrderId(order.id)],
    [printText.orderDate, order.date],
    [printText.date, formatPrintDate(new Date())],
    [text.common.customer, order.company],
    [printText.shipTo, order.shippingAddress],
    [printText.carrier, carrier],
    [printText.tracking, tracking],
    [text.common.fulfillment, labels.fulfillment[order.fulfillmentStatus]],
  ];

  return `<!doctype html>
<html lang="${escapeHtml(document.documentElement.lang || "zh")}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      line-height: 1.35;
    }
    .sheet { width: 100%; }
    .top {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 16px;
      align-items: start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 10px;
    }
    h1 {
      margin: 0;
      font-size: 24px;
      line-height: 1.1;
      letter-spacing: 0;
    }
    .order-id {
      margin-top: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 15px;
      font-weight: 800;
    }
    .status {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 6px;
    }
    .pill {
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 11px;
      font-weight: 800;
      white-space: nowrap;
    }
    .meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
      margin-bottom: 12px;
    }
    .meta-item {
      min-height: 38px;
      border: 1px solid #dbe3ef;
      border-radius: 6px;
      padding: 5px 7px;
    }
    .meta-label {
      color: #64748b;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .meta-value {
      margin-top: 2px;
      overflow-wrap: anywhere;
      font-weight: 700;
    }
    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 12px 0 6px;
      font-size: 14px;
      font-weight: 900;
    }
    .section-title span {
      color: #64748b;
      font-size: 11px;
      font-weight: 800;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      border: 1px solid #cbd5e1;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-size: 10px;
      font-weight: 900;
      text-align: left;
      text-transform: uppercase;
    }
    th, td {
      border-bottom: 1px solid #dbe3ef;
      padding: 6px;
      vertical-align: top;
    }
    tr:last-child td { border-bottom: 0; }
    .check { width: 32px; text-align: center; }
    .check span {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid #0f172a;
      border-radius: 3px;
    }
    .index { width: 32px; color: #64748b; font-weight: 800; text-align: center; }
    .sku { width: 120px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
    .qty { width: 58px; text-align: center; font-size: 15px; font-weight: 900; }
    .product { font-size: 12px; font-weight: 800; }
    .sub { margin-top: 2px; color: #64748b; font-size: 10px; }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 16px;
    }
    .signature {
      border-top: 1px solid #0f172a;
      padding-top: 5px;
      color: #475569;
      font-size: 11px;
      font-weight: 800;
    }
    .customer-note {
      margin-top: 14px;
      border: 1px dashed #94a3b8;
      border-radius: 8px;
      padding: 8px;
      font-size: 11px;
    }
    .customer-note strong { display: block; margin-bottom: 3px; font-size: 12px; }
    .footer {
      margin-top: 8px;
      color: #64748b;
      font-size: 10px;
      text-align: center;
    }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <header class="top">
      <div>
        <h1>${escapeHtml(printText.title)}</h1>
        <div class="order-id">${escapeHtml(shortOrderId(order.id))}</div>
      </div>
      <div class="status">
        <span class="pill">${escapeHtml(labels.status[order.status])}</span>
        <span class="pill">${escapeHtml(labels.payment[order.paymentStatus])}</span>
        <span class="pill">${escapeHtml(`${totalQuantity} ${printText.quantity}`)}</span>
      </div>
    </header>
    <section class="meta">
      ${metaRows
        .map(
          ([label, value]) => `
            <div class="meta-item">
              <div class="meta-label">${escapeHtml(label)}</div>
              <div class="meta-value">${escapeHtml(value)}</div>
            </div>
          `
        )
        .join("")}
    </section>
    <div class="section-title">
      ${escapeHtml(printText.checklist)}
      <span>${escapeHtml(printText.customerCopy)}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th class="check"></th>
          <th class="index">#</th>
          <th class="sku">${escapeHtml(printText.sku)}</th>
          <th>${escapeHtml(printText.product)}</th>
          <th class="qty">${escapeHtml(printText.quantity)}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <section class="signatures">
      <div class="signature">${escapeHtml(printText.checkedBy)}</div>
      <div class="signature">${escapeHtml(printText.packedBy)}</div>
    </section>
    <section class="customer-note">
      <strong>${escapeHtml(printText.customerCopy)}</strong>
      ${escapeHtml(printText.customerNote)}
    </section>
    <div class="footer">${escapeHtml(printText.footer)}</div>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatPrintDate(value: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function OrderOperationHistory({
  events,
  fallbackActivity,
  labels,
  text,
}: {
  events: OrderActivityEvent[];
  fallbackActivity: string[];
  labels: OrderLabels;
  text: AdminText;
}) {
  return (
    <div className="mt-3 min-w-0">
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <div className="text-xs font-black uppercase text-slate-400">
          {text.orders.details.operationHistory}
        </div>
        <Badge variant="outline" className="h-5 bg-white px-1.5 text-[10px]">
          {events.length || fallbackActivity.length}
        </Badge>
      </div>
      {events.length > 0 ? (
        <div className="max-h-[190px] space-y-1.5 overflow-y-auto pr-1 sm:max-h-[260px] sm:space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="relative min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 sm:px-2.5 sm:py-2"
            >
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge className={activityBadgeClass(event.eventType)}>
                      {activityEventLabel(event.eventType, text)}
                    </Badge>
                    {event.fromStatus && event.toStatus && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-600">
                        {labels.status[event.fromStatus]} {"->"}{" "}
                        {labels.status[event.toStatus]}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 break-words text-xs font-semibold text-slate-700">
                    {event.note || text.common.none}
                  </div>
                </div>
                <time className="shrink-0 text-right text-[10px] font-semibold text-slate-400">
                  {formatDisplayDate(event.createdAt)}
                </time>
              </div>
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                <span className="text-slate-400">{text.activity.actor}</span>
                <span className="min-w-0 break-words text-slate-800">
                  {event.actor.label || text.orders.activity.systemActor}
                </span>
                {event.actor.role && (
                  <span className="rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
                    {event.actor.role}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : fallbackActivity.length > 0 ? (
        <div className="space-y-2">
          {fallbackActivity.map((activity) => (
            <div
              key={activity}
              className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600"
            >
              {activity}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
          {text.activity.noEvents}
        </div>
      )}
    </div>
  );
}

function StatusStepper({
  labels,
  status,
}: {
  labels: OrderLabels;
  status: OrderDbStatus;
}) {
  const steps = statusFlow.slice(1);
  const currentIndex = statusFlow.indexOf(status);
  const cancelled = status === "cancelled";
  const progressValue = cancelled ? 0 : Math.max(0, Math.min(currentIndex, steps.length));

  return (
    <div
      className={cn(
        "rounded-md border bg-white px-3 py-2",
        cancelled ? "border-red-100 bg-red-50/40" : "border-slate-200"
      )}
      aria-label={`${labels.status[status]} ${progressValue}/5`}
    >
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <Badge
          className={cn(
            orderStatusBadgeClass(status),
            "h-5 rounded px-1.5 text-[11px] leading-none"
          )}
        >
          {labels.status[status]}
        </Badge>
        <span
          className={cn(
            "shrink-0 font-mono text-[11px] font-black text-slate-400",
            !cancelled && "text-primary"
          )}
        >
          {progressValue}/5
        </span>
      </div>
      <div className="grid grid-cols-5 items-start gap-1">
        {steps.map((step, index) => {
          const stepIndex = index + 1;
          const done = !cancelled && currentIndex >= stepIndex;
          const current = !cancelled && currentIndex === stepIndex;

          return (
            <div key={step} className="relative min-w-0 text-center">
              {index > 0 && (
                <span
                  className={cn(
                    "absolute left-[-50%] top-2.5 h-0.5 w-full rounded-full bg-slate-200",
                    done && "bg-primary",
                    cancelled && "bg-red-100"
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 mx-auto grid size-5 place-items-center rounded-full border text-[10px] font-black leading-none",
                  done
                    ? "border-primary bg-primary text-white"
                    : "border-slate-200 bg-white text-slate-400",
                  current && "ring-2 ring-primary/15",
                  cancelled && "border-red-100 bg-white text-red-300"
                )}
              >
                {stepIndex}
              </span>
              <span
                className={cn(
                  "mt-1 block truncate text-[10px] font-semibold leading-tight text-slate-400",
                  done && "text-primary",
                  current && "text-slate-900",
                  cancelled && "text-red-300"
                )}
              >
                {labels.status[step]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetailFact({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-white p-2.5">
      <div className="truncate text-xs font-semibold uppercase text-slate-500">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-black text-slate-900">
        {value}
      </div>
      <div className="mt-0.5 break-words text-[11px] text-slate-500">{helper}</div>
    </div>
  );
}

function MobileFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded bg-slate-50 px-1.5 py-0.5">
      <div className="truncate text-[9px] font-semibold uppercase leading-tight text-slate-400 sm:text-[10px]">
        {label}
      </div>
      <div className="mt-0.5 break-words text-[11px] font-bold leading-tight text-slate-700 sm:text-xs">
        {value}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 grid-cols-[70px_minmax(0,1fr)] gap-1 sm:grid-cols-[92px_minmax(0,1fr)] sm:gap-2">
      <span className="text-[11px] font-semibold uppercase text-slate-400 sm:text-xs">{label}</span>
      <span className="min-w-0 break-words font-medium text-slate-700">{value}</span>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[58px_minmax(0,1fr)] items-center gap-1 sm:block sm:space-y-1.5">
      <Label className="text-[11px] font-bold leading-none text-slate-600 sm:text-xs">{label}</Label>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: AdminText }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
      {text.orders.empty}
    </div>
  );
}

async function fetchOrdersFromApi({
  signal,
  status,
}: {
  signal?: AbortSignal;
  status?: OrderDbStatus;
}): Promise<OrdersApiResult> {
  const params = new URLSearchParams({
    limit: "100",
    offset: "0",
    sort: "date_desc",
  });

  if (status) {
    params.set("status", status);
  }

  const response = await fetch(`/api/admin/orders?${params.toString()}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`GET /api/admin/orders returned ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  return parseOrdersApiPayload(payload);
}

async function fetchOrderDetailFromApi(
  orderId: string,
  signal?: AbortSignal
): Promise<AdminOrder> {
  const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`GET /api/admin/orders/${orderId} returned ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  const meta = isRecord(payload) && isRecord(payload.meta) ? payload.meta : {};
  const source = readSource(meta.source ?? (isRecord(payload) ? payload.source : null));
  const row = extractOrderPayload(payload);
  const order = row ? normalizeAdminOrder(row, 0, source) : null;

  if (!order) {
    throw new Error(`GET /api/admin/orders/${orderId} returned an incomplete order`);
  }

  return order;
}

function parseOrdersApiPayload(payload: unknown): OrdersApiResult {
  if (!isRecord(payload)) {
    throw new Error("Incomplete /api/admin/orders response");
  }

  const meta = isRecord(payload.meta) ? payload.meta : {};
  const source = readSource(meta.source ?? payload.source);
  const rows = readArrayPayload(payload, ["data", "orders"]);

  if (!rows) {
    throw new Error("Incomplete /api/admin/orders response");
  }

  const orders = rows
    .map((row, index) => normalizeAdminOrder(row, index, source))
    .filter((order): order is AdminOrder => order !== null);

  return {
    orders,
    source,
    total: readNumber(meta.total) ?? orders.length,
    returned: readNumber(meta.returned) ?? orders.length,
  };
}

async function patchOrderInApi(orderId: string, patch: OrderPatchInput) {
  const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
    body: JSON.stringify(serializeOrderPatch(patch)),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error(
      `PATCH /api/admin/orders/${orderId} returned ${response.status}. Local order state was not changed.`
    );
  }

  const payload = await readJsonSafely(response);
  const meta = isRecord(payload) && isRecord(payload.meta) ? payload.meta : {};
  const source = readSource(meta.source ?? (isRecord(payload) ? payload.source : null));
  const row = extractOrderPayload(payload);

  return {
    order: row ? normalizeAdminOrder(row, 0, source) : null,
    source,
  };
}

function normalizeAdminOrder(
  row: unknown,
  index: number,
  source: ApiOrdersSource
): AdminOrder | null {
  if (!isRecord(row)) {
    return null;
  }

  const companyRecord = isRecord(row.company) ? row.company : null;
  const customerRecord = isRecord(row.customer)
    ? row.customer
    : isRecord(row.companySnapshot)
      ? row.companySnapshot
      : companyRecord;
  const shippingRecord = isRecord(row.shipping) ? row.shipping : null;
  const totalsRecord = isRecord(row.totals) ? row.totals : null;
  const id = readString(
    readRecordValue(row, ["id", "number", "orderNo", "order_no"])
  );
  const remoteId = readString(readRecordValue(row, ["orderId", "remoteId", "remote_id"]));
  const createdAt =
    readString(
      readRecordValue(row, ["createdAt", "created_at", "orderedAt", "date"])
    ) ?? "";
  const date = formatDisplayDate(createdAt);
  const company =
    readString(row.company) ??
    readString(readRecordValue(customerRecord, ["name", "companyName", "company_name"])) ??
    "Cliente";

  if (!id) {
    return null;
  }

  const status = normalizeOrderDbStatusValue(
    readRecordValue(row, ["status", "orderStatus", "order_status", "dbStatus"])
  );
  const paymentStatus = normalizePaymentStatusValue(
    readRecordValue(row, ["paymentStatus", "payment_status"]),
    status
  );
  const fulfillmentStatus = normalizeFulfillmentStatusValue(
    readRecordValue(row, ["fulfillmentStatus", "fulfillment_status"]),
    status
  );
  const rawLines = readArrayPayload(row, ["lines", "orderLines", "items"]) ?? [];
  const lines = rawLines
    .map((line) => normalizeOrderLine(line, fulfillmentStatus))
    .filter((line): line is OrderLine => line !== null);
  const itemCount =
    readNumber(readRecordValue(row, ["items", "itemCount", "items_count"])) ??
    lines.reduce((total, line) => total + line.quantity, 0);
  const total = readMoney(
    readRecordValue(row, ["total", "totalAmount", "total_amount", "grandTotal"]) ??
      readRecordValue(totalsRecord, ["total", "gross", "grandTotal", "grand_total"])
  );
  const warehouse = normalizeWarehouseValue(
    readRecordValue(row, ["warehouse"]) ??
      readRecordValue(shippingRecord, ["warehouse"])
  );
  const customer = normalizeCustomerSnapshot(customerRecord, company);
  const operationHistory = normalizeOperationHistory(
    readArrayPayload(row, ["operationHistory", "operation_history", "events"])
  );

  return {
    id,
    ...(remoteId ? { remoteId } : {}),
    date,
    createdAt,
    updatedAt: readString(readRecordValue(row, ["updatedAt", "updated_at"])) ?? "",
    company,
    status,
    stockRisk: normalizeStockRiskValue(readRecordValue(row, ["stockRisk", "stock_risk"])),
    total,
    items: itemCount,
    paymentStatus,
    fulfillmentStatus,
    priority: normalizePriorityValue(row.priority, status, index),
    customer,
    paymentMethod:
      readString(readRecordValue(row, ["paymentMethod", "payment_method"])) ??
      "Da /api/admin/orders",
    paymentDue:
      readString(readRecordValue(row, ["paymentDue", "payment_due", "dueDate"])) ??
      (paymentStatus === "paid" ? "Pagato" : "Da verificare"),
    warehouse,
    carrier: normalizeCarrierValue(
      readRecordValue(row, ["carrier"]) ?? readRecordValue(shippingRecord, ["carrier"])
    ),
    service:
      readString(readRecordValue(row, ["service", "shippingMethod", "shipping_method"])) ??
      readString(readRecordValue(shippingRecord, ["service", "shippingMethod", "shipping_method"])) ??
      "Da pianificare",
    tracking:
      readString(readRecordValue(row, ["tracking", "trackingCode", "tracking_code"])) ??
      readString(readRecordValue(shippingRecord, ["tracking", "trackingCode", "tracking_code"])) ??
      "",
    eta:
      readString(readRecordValue(row, ["eta", "estimatedDelivery", "estimated_delivery"])) ??
      readString(readRecordValue(shippingRecord, ["eta", "estimatedDelivery", "estimated_delivery"])) ??
      "Da pianificare",
    shippingAddress:
      readString(readRecordValue(row, ["shippingAddress", "deliveryAddress", "delivery_address"])) ??
      readString(readRecordValue(shippingRecord, ["address", "shippingAddress", "deliveryAddress", "delivery_address"])) ??
      (customer.city ? `${customer.city}, Italia` : "Non disponibile"),
    owner: readString(readRecordValue(row, ["owner", "accountOwner"])) ?? "Operations",
    notes:
      readString(row.notes) ??
      `Ordine importato da /api/admin/orders (${sourceLabel(source)})`,
    lines,
    activity: normalizeActivity(row.activity, date, source, operationHistory),
    operationHistory,
  };
}

function normalizeOrderLine(
  row: unknown,
  fulfillmentStatus: FulfillmentStatus
): OrderLine | null {
  if (!isRecord(row)) {
    return null;
  }

  const product = isRecord(row.product) ? row.product : null;
  const rawSku =
    readString(readRecordValue(row, ["sku", "productSku", "product_sku"])) ??
    readString(readRecordValue(product, ["sku"]));
  const sku = rawSku ? toPublicSku(rawSku) : null;
  const quantity =
    readNumber(readRecordValue(row, ["quantity", "qty"])) ??
    readNumber(readRecordValue(row, ["items"])) ??
    0;

  if (!sku || quantity <= 0) {
    return null;
  }

  const lineTotal = readMoney(
    readRecordValue(row, ["lineTotal", "line_total", "total"])
  );
  const unitPrice =
    readMoney(readRecordValue(row, ["unitPrice", "unit_price", "price"])) ||
    (lineTotal > 0 ? roundMoney(lineTotal / quantity) : 0);
  const fulfilledQty =
    readNumber(readRecordValue(row, ["fulfilledQty", "fulfilled_qty"])) ??
    (fulfillmentStatus === "shipped" || fulfillmentStatus === "delivered"
      ? quantity
      : 0);
  const reservedQty =
    readNumber(readRecordValue(row, ["reservedQty", "reserved_qty"])) ??
    (fulfilledQty > 0
      ? 0
      : fulfillmentStatus === "allocated" ||
          fulfillmentStatus === "picking" ||
          fulfillmentStatus === "packed"
        ? quantity
        : 0);
  const picked =
    readNumber(readRecordValue(row, ["picked", "pickedQuantity", "picked_quantity"])) ??
    fulfilledQty ??
    reservedQty;

  return {
    sku,
    name:
      readString(readRecordValue(row, ["name", "productName", "product_name"])) ??
      readString(readRecordValue(product, ["name"])) ??
      "Prodotto ordine",
    category:
      sanitizeSupplierText(
        readString(row.category) ??
          readString(readRecordValue(product, ["category"])) ??
          ""
      ) ||
      "Ricambio",
    quantity,
    picked,
    reservedQty,
    fulfilledQty,
    stockStatus: readString(readRecordValue(row, ["stockStatus", "stock_status"])) ?? "",
    batchCode: sanitizeSupplierText(
      readString(readRecordValue(row, ["batchCode", "batch_code"]))
    ),
    unitPrice,
    warehouse: normalizeWarehouseValue(
      readRecordValue(row, ["warehouse", "location"])
    ),
  };
}

function normalizeCustomerSnapshot(
  row: Record<string, unknown> | null,
  fallbackName: string
): CustomerSnapshot {
  const address = isRecord(row?.address) ? row?.address : null;

  return {
    id: readString(readRecordValue(row, ["id"])) ?? undefined,
    name:
      readString(readRecordValue(row, ["name", "companyName", "company_name"])) ??
      fallbackName,
    partitaIva:
      readString(readRecordValue(row, ["partitaIva", "vatNumber", "vat_number"])) ??
      "Non disponibile",
    pec: readString(readRecordValue(row, ["pec"])) ?? "Non disponibile",
    status: normalizeCompanyStatusValue(readRecordValue(row, ["status"])),
    priceList: normalizePriceListValue(
      readRecordValue(row, ["priceList", "price_list", "tier"])
    ),
    city:
      readString(readRecordValue(row, ["city"])) ??
      readString(readRecordValue(address, ["city"])) ??
      "Non disponibile",
    province:
      readString(readRecordValue(row, ["province"])) ??
      readString(readRecordValue(address, ["province"])) ??
      "--",
  };
}

function normalizeActivity(
  value: unknown,
  fallbackDate: string,
  source: ApiOrdersSource,
  operationHistory: OrderActivityEvent[] = []
) {
  if (Array.isArray(value)) {
    const activity = value
      .map((item) => readString(item))
      .map((item) => sanitizeSupplierText(item))
      .filter(Boolean);

    if (activity.length > 0) {
      return activity.slice(0, 8);
    }
  }

  if (operationHistory.length > 0) {
    return operationHistory.map(formatActivityFallback);
  }

  return [
    `${fallbackDate} - Ordine importato da /api/admin/orders (${sourceLabel(source)})`,
  ];
}

function normalizeOperationHistory(value: unknown): OrderActivityEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeOrderActivityEvent)
    .filter((event): event is OrderActivityEvent => event !== null)
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt);
      const rightTime = Date.parse(right.createdAt);
      return (Number.isFinite(leftTime) ? leftTime : 0) - (Number.isFinite(rightTime) ? rightTime : 0);
    });
}

function normalizeOrderActivityEvent(row: unknown): OrderActivityEvent | null {
  if (!isRecord(row)) {
    return null;
  }

  const actorRecord = isRecord(row.actor) ? row.actor : null;
  const id =
    readString(readRecordValue(row, ["id"])) ??
    `${readString(readRecordValue(row, ["eventType", "event_type", "action"])) ?? "event"}:${
      readString(readRecordValue(row, ["createdAt", "created_at"])) ?? "unknown"
    }`;
  const actorId =
    readString(readRecordValue(actorRecord, ["id", "actorId", "actor_id"])) ??
    readString(readRecordValue(row, ["actorId", "actor_id"]));
  const actorEmail =
    readString(readRecordValue(actorRecord, ["email"])) ??
    readString(readRecordValue(row, ["actorEmail", "actor_email"]));
  const actorName =
    readString(readRecordValue(actorRecord, ["name", "displayName", "display_name"])) ??
    readString(readRecordValue(row, ["actorName", "actor_name"]));
  const actorRole =
    readString(readRecordValue(actorRecord, ["role"])) ??
    readString(readRecordValue(row, ["actorRole", "actor_role"]));
  const actorLabel =
    readString(readRecordValue(actorRecord, ["label"])) ??
    actorName ??
    actorEmail ??
    actorRole ??
    actorId ??
    "System";
  const eventType =
    readString(readRecordValue(row, ["eventType", "event_type", "action"])) ?? "event";

  return {
    id,
    action: readString(readRecordValue(row, ["action"])) ?? eventType,
    eventType,
    fromStatus: normalizeNullableOrderDbStatusValue(
      readRecordValue(row, ["fromStatus", "from_status"])
    ),
    toStatus: normalizeNullableOrderDbStatusValue(
      readRecordValue(row, ["toStatus", "to_status"])
    ),
    note: sanitizeSupplierText(readString(readRecordValue(row, ["note"]))),
    metadata: readRecordValue(row, ["metadata"]) ?? {},
    actor: {
      id: actorId,
      email: actorEmail,
      label: sanitizeSupplierText(actorLabel) || actorLabel,
      name: actorName,
      role: actorRole,
    },
    createdAt:
      readString(readRecordValue(row, ["createdAt", "created_at"])) ??
      new Date(0).toISOString(),
  };
}

function formatActivityFallback(event: OrderActivityEvent) {
  return [
    event.createdAt,
    event.eventType,
    event.fromStatus && event.toStatus
      ? `${event.fromStatus} -> ${event.toStatus}`
      : null,
    event.actor.label,
    event.note,
  ]
    .filter(Boolean)
    .join(" - ");
}

function mergeOrderSummary(current: AdminOrder, incoming: AdminOrder) {
  return {
    ...current,
    ...incoming,
    lines: incoming.lines.length > 0 ? incoming.lines : current.lines,
    activity: incoming.activity.length > 0 ? incoming.activity : current.activity,
    operationHistory:
      incoming.operationHistory.length > 0
        ? incoming.operationHistory
        : current.operationHistory,
  };
}

function orderMatchesView(order: AdminOrder, viewMode: ViewMode) {
  if (viewMode === "payments") {
    return order.paymentStatus !== "paid" && order.status !== "cancelled";
  }

  if (viewMode === "shipping") {
    return ["accepted", "picking", "packed", "shipped"].includes(order.status);
  }

  return true;
}

function shortOrderId(id: string) {
  const parts = id.split("-").filter(Boolean);
  const sequence = parts.at(-1);
  const timestamp = parts.at(-2);

  if (sequence && timestamp && /^\d{10,}$/.test(timestamp)) {
    const year = timestamp.slice(2, 4);
    const month = timestamp.slice(4, 6);
    const day = timestamp.slice(6, 8);
    return `#${day}${month}${year}-${sequence}`;
  }

  if (sequence && parts.length > 1) {
    return `#${sequence}`;
  }

  return id.length > 12 ? `#${id.slice(-10)}` : id;
}

function normalizePaymentStatusValue(
  value: unknown,
  status: OrderDbStatus
): PaymentStatus {
  if (value === "paid") {
    return "paid";
  }

  if (value === "authorized") {
    return "authorized";
  }

  if (value === "refunded" || value === "failed") {
    return "refunded";
  }

  if (["accepted", "picking", "packed", "shipped", "completed"].includes(status)) {
    return "paid";
  }

  return "unpaid";
}

function normalizeFulfillmentStatusValue(
  value: unknown,
  status: OrderDbStatus
): FulfillmentStatus {
  if (
    value === "queued" ||
    value === "allocated" ||
    value === "picking" ||
    value === "packed" ||
    value === "shipped" ||
    value === "delivered" ||
    value === "blocked"
  ) {
    return value;
  }

  return fulfillmentStatusFromOrderStatus(status);
}

function normalizePriorityValue(
  value: unknown,
  status: OrderDbStatus,
  index: number
): Priority {
  return ["standard", "high", "urgent"].includes(value as Priority)
    ? (value as Priority)
    : priorityForOrder(status, index);
}

function normalizeCompanyStatusValue(value: unknown): CompanyStatus {
  return ["approved", "pending", "suspended", "rejected"].includes(
    value as CompanyStatus
  )
    ? (value as CompanyStatus)
    : "approved";
}

function normalizePriceListValue(value: unknown): CustomerSnapshot["priceList"] {
  const normalized = readString(value)?.toLowerCase();

  if (
    normalized === "bronze" ||
    normalized === "silver" ||
    normalized === "gold" ||
    normalized === "emerald" ||
    normalized === "diamond" ||
    normalized === "master" ||
    normalized === "king"
  ) {
    return normalized;
  }

  if (normalized === "pro") {
    return "silver";
  }

  if (normalized === "partner") {
    return "gold";
  }

  return "bronze";
}

function normalizeWarehouseValue(value: unknown): WarehouseName {
  void value;
  return "Milano";
}

function normalizeCarrierValue(value: unknown): Carrier {
  const carrier = readString(value);
  const match = carrierOptions.find(
    (item) => item.toLowerCase() === carrier?.toLowerCase()
  );

  return match ?? unassignedCarrier;
}

function normalizeOrderDbStatusValue(value: unknown): OrderDbStatus {
  if (orderStatuses.includes(value as OrderDbStatus)) {
    return value as OrderDbStatus;
  }

  if (value === "paid") {
    return "accepted";
  }

  if (value === "pending_payment" || value === "draft") {
    return "submitted";
  }

  if (value === "delivered") {
    return "completed";
  }

  return "submitted";
}

function normalizeNullableOrderDbStatusValue(value: unknown): OrderDbStatus | null {
  if (orderStatuses.includes(value as OrderDbStatus)) {
    return value as OrderDbStatus;
  }

  return null;
}

function normalizeStockRiskValue(value: unknown): StockRisk {
  if (value === "clear" || value === "low" || value === "blocked") {
    return value;
  }

  return "unknown";
}

function priorityForOrder(status: OrderDbStatus, index: number): Priority {
  if (status === "submitted") {
    return "high";
  }

  if (index === 0 && status !== "completed" && status !== "cancelled") {
    return "urgent";
  }

  return "standard";
}

function fulfillmentStatusFromOrderStatus(status: OrderDbStatus): FulfillmentStatus {
  switch (status) {
    case "accepted":
      return "allocated";
    case "picking":
      return "picking";
    case "packed":
      return "packed";
    case "shipped":
      return "shipped";
    case "completed":
      return "delivered";
    case "cancelled":
      return "blocked";
    case "submitted":
    default:
      return "queued";
  }
}

function buildOrderLabels(text: AdminText): OrderLabels {
  return {
    status: {
      submitted: text.enums.adminOrderStatus.submitted,
      accepted: text.enums.adminOrderStatus.accepted,
      picking: text.enums.adminOrderStatus.picking,
      packed: text.enums.adminOrderStatus.packed,
      shipped: text.enums.adminOrderStatus.shipped,
      completed: text.enums.adminOrderStatus.completed,
      cancelled: text.enums.adminOrderStatus.cancelled,
    },
    payment: {
      unpaid: text.enums.paymentStatus.unpaid,
      authorized: text.enums.paymentStatus.authorized,
      paid: text.enums.paymentStatus.paid,
      refunded: text.enums.paymentStatus.refunded,
    },
    fulfillment: {
      queued: text.enums.fulfillmentStatus.queued,
      allocated: text.enums.fulfillmentStatus.allocated,
      picking: text.enums.fulfillmentStatus.picking,
      packed: text.enums.fulfillmentStatus.packed,
      shipped: text.enums.fulfillmentStatus.shipped,
      delivered: text.enums.fulfillmentStatus.delivered,
      blocked: text.enums.fulfillmentStatus.blocked,
    },
    priority: {
      standard: text.enums.priority.standard,
      high: text.enums.priority.high,
      urgent: text.enums.priority.urgent,
    },
    stockRisk: {
      clear: text.enums.stockRisk.clear,
      low: text.enums.stockRisk.low,
      blocked: text.enums.stockRisk.blocked,
      unknown: text.enums.stockRisk.unknown,
    },
  };
}

function carrierLabel(carrier: Carrier, text: AdminText) {
  return carrier === unassignedCarrier ? text.common.none : carrier;
}

function sourceLabel(source: OrdersSource, text?: AdminText) {
  if (source === "admin_api") {
    return "Admin API";
  }

  if (source === "supabase") {
    return "Supabase";
  }

  return text?.catalog.apiSourceEmpty ?? "Nessun dato locale";
}

function readSource(value: unknown): ApiOrdersSource {
  if (value === "supabase" || value === "admin_api") {
    return value;
  }

  return "empty";
}

function readArrayPayload(
  record: Record<string, unknown>,
  keys: string[]
): unknown[] | null {
  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return null;
}

function readRecordValue(
  record: Record<string, unknown> | null | undefined,
  keys: string[]
) {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }

  return undefined;
}

function readString(value: unknown) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

async function readJsonSafely(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function extractOrderPayload(payload: unknown) {
  if (!isRecord(payload)) {
    return null;
  }

  if (isRecord(payload.data)) {
    return payload.data;
  }

  if (Array.isArray(payload.data) && isRecord(payload.data[0])) {
    return payload.data[0];
  }

  if (isRecord(payload.order)) {
    return payload.order;
  }

  return readString(payload.id) ? payload : null;
}

function serializeOrderPatch(patch: OrderPatchInput) {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  );
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readMoney(value: unknown) {
  const direct = readNumber(value);

  if (direct !== null) {
    return direct;
  }

  if (!isRecord(value)) {
    return 0;
  }

  const amount = readNumber(value.amount);

  if (amount !== null) {
    return amount;
  }

  const cents = readNumber(value.cents);

  return cents === null ? 0 : roundMoney(cents / 100);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatDisplayDate(value: string) {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return value || "Data non disponibile";
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatSyncTime() {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function NoticeIcon({ tone }: { tone: NoticeTone }) {
  if (tone === "warning" || tone === "error") {
    return <AlertTriangle className="size-4 shrink-0" />;
  }

  if (tone === "info") {
    return <Info className="size-4 shrink-0" />;
  }

  return <BadgeCheck className="size-4 shrink-0" />;
}

function noticeToneClass(tone: NoticeTone) {
  if (tone === "error") {
    return "border-red-200 bg-red-50 text-red-800";
  }

  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  if (tone === "info") {
    return "border-cyan-200 bg-cyan-50 text-cyan-800";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function activityEventLabel(eventType: string, text: AdminText) {
  if (eventType === "status_rolled_back") {
    return text.orders.activity.statusRolledBack;
  }

  if (eventType === "status_changed") {
    return text.orders.activity.statusChanged;
  }

  if (eventType === "operations_updated") {
    return text.orders.activity.operationsUpdated;
  }

  if (eventType === "created") {
    return text.orders.activity.created;
  }

  return eventType.replaceAll("_", " ");
}

function activityBadgeClass(eventType: string) {
  if (eventType === "status_rolled_back") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (eventType === "operations_updated") {
    return "border-cyan-200 bg-cyan-50 text-cyan-700";
  }

  if (eventType === "created") {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function sourceBadgeClass(source: OrdersSource) {
  if (source === "admin_api" || source === "supabase") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function orderStatusBadgeClass(status: OrderDbStatus) {
  if (status === "completed" || status === "accepted") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "shipped" || status === "picking" || status === "packed") {
    return "border-cyan-200 bg-cyan-50 text-cyan-700";
  }

  if (status === "submitted") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-red-200 bg-red-50 text-red-700";
}

function paymentBadgeClass(status: PaymentStatus) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "authorized") {
    return "border-cyan-200 bg-cyan-50 text-cyan-700";
  }

  if (status === "refunded") {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function priorityBadgeClass(priority: Priority) {
  if (priority === "urgent") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (priority === "high") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function stockRiskBadgeClass(risk: StockRisk) {
  if (risk === "low") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (risk === "blocked") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (risk === "clear") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function reservationBadgeClass(line: OrderLine) {
  if (line.reservedQty >= line.quantity) {
    return "border-cyan-200 bg-cyan-50 text-cyan-700";
  }

  if (line.reservedQty > 0) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function fulfilledBadgeClass(line: OrderLine) {
  if (line.fulfilledQty >= line.quantity) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (line.fulfilledQty > 0) {
    return "border-cyan-200 bg-cyan-50 text-cyan-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}
