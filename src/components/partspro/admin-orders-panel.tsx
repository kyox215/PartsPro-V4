"use client";

import * as React from "react";
import Image from "next/image";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  Copy,
  CreditCard,
  Clock3,
  ExternalLink,
  Info,
  Loader2,
  PackageCheck,
  Pencil,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import {
  formatEuro,
  type CompanyStatus,
  type CustomerLevel,
  type PartProduct,
} from "@/lib/partspro-data";
import { calculateShippingCents } from "@/lib/partspro-shipping";
import { cn } from "@/lib/utils";
import {
  adminRoleTemplateLabel,
  adminSourceLabel,
  adminValueLabel,
  formatAdminMessage,
  getAdminDictionary,
  type AdminText,
} from "@/i18n/dictionaries/admin";
import { sanitizeSupplierText, toPublicSku } from "@/lib/partspro-sku";
import { AdminBusyRegion, AdminSkeletonRows } from "./admin-feedback";
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
type PaymentMethod = "bank_transfer" | "cash";
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
type MobileOrderDetailsSection =
  | "overview"
  | "payment"
  | "logistics"
  | "lines"
  | "history";
type StatusFilterValue = "all" | OrderDbStatus;
type PaymentFilterValue = "all" | "open" | "paid";
type StockRiskFilterValue = "all" | "risk" | StockRisk;
type ReservationFilterValue = "all" | "overdue";
type WarehouseName = PartProduct["warehouse"];
type OrdersSource = "admin_api" | "supabase" | "empty";
type ApiOrdersSource = OrdersSource;
type NoticeTone = "success" | "info" | "warning" | "error";
type WalletRefundStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "credited"
  | "cancelled";
type WorkflowKey =
  | "all"
  | "submitted"
  | "accepted"
  | "picking"
  | "packed"
  | "shipped"
  | "completed"
  | "cancelled"
  | "openPayments"
  | "stockRisk"
  | "agedReservations";

const unassignedCarrier = "unassigned" as const;
const carrierOptions = [
  "BRT 24-48h",
  "GLS 24-48h",
  "DHL Express",
  "UPS",
  "Ritiro in sede",
] as const;
type Carrier = (typeof carrierOptions)[number] | typeof unassignedCarrier;
const paymentMethodOptions: PaymentMethod[] = ["bank_transfer", "cash"];

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
  id: string;
  sku: string;
  name: string;
  imageUrl?: string;
  imageAlt?: string;
  category: string;
  quantity: number;
  picked: number;
  pickedQty: number;
  cancelledQty: number;
  shortageQty: number;
  lineStatus: string;
  billableQty: number;
  unitPrice: number;
  lineTotal: number;
  warehouse: WarehouseName;
  stockStatus: string;
  reservedQty: number;
  fulfilledQty: number;
  batchCode: string;
};

type WalletRefundRequest = {
  amount: number;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  creditedAt: string | null;
  currency: "EUR";
  customerId: string | null;
  customerName: string | null;
  id: string;
  metadata: unknown;
  orderId: string | null;
  orderLineId: string | null;
  orderNo: string | null;
  reason: string;
  requestType: string;
  requestedAt: string;
  requestedBy: string | null;
  status: WalletRefundStatus;
  updatedAt: string;
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

type PaymentReconciliation = {
  receivedAt: string | null;
  receivedAmount: number | null;
  receivedBy: OrderActivityActor | null;
  reference: string;
  note: string;
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
  totalNet: number;
  vat: number;
  shipping: number;
  items: number;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  priority: Priority;
  customer: CustomerSnapshot;
  paymentMethod: PaymentMethod;
  paymentDue: string;
  paymentDueAmount: number;
  paymentOverpaidAmount: number;
  walletAppliedAmount: number;
  softDeletedAt: string | null;
  softDeletedBy: string | null;
  dangerActionType: string;
  dangerActionReason: string;
  dangerActionMetadata: unknown;
  paymentReconciliation: PaymentReconciliation;
  warehouse: WarehouseName;
  carrier: Carrier;
  service: string;
  tracking: string;
  eta: string;
  shippingAddress: string;
  owner: string;
  customerNote: string;
  staffNote: string;
  notes: string;
  reservedQty: number;
  fulfilledQty: number;
  lockedSince: string | null;
  reservationAgeHours: number | null;
  reservationOverdue: boolean;
  reservationWarning: boolean;
  lines: OrderLine[];
  walletRefunds: WalletRefundRequest[];
  activity: string[];
  operationHistory: OrderActivityEvent[];
};

type TrackingTimelineTone = "done" | "current" | "info";

type TrackingTimelineEvent = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  source: string;
  tone: TrackingTimelineTone;
};

type OrderTrackingDetail = {
  carrier: string;
  tracking: string;
  status: string;
  refreshedAt: string;
  trackingUrl: string | null;
  events: TrackingTimelineEvent[];
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

type AdminSessionState = {
  allowed: boolean;
  permissions: string[];
  role: string | null;
};

type OrdersApiResult = {
  orders: AdminOrder[];
  source: ApiOrdersSource;
  total: number;
  returned: number;
};

type OrderPatchInput = {
  carrier?: string;
  forceCancel?: boolean;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  rollback?: boolean;
  staffNote?: string;
  status?: OrderDbStatus;
  tracking?: string;
  note?: string;
};

type OrderDangerActionInput = {
  confirmOrderNo: string;
  reason: string;
};

type OrderPaymentPatchInput = {
  paymentMethod?: PaymentMethod;
  paymentStatus: PaymentStatus;
  receivedAmount?: number;
  receivedAt?: string;
  reference?: string;
  note?: string;
};

type OrderShippingPatchInput = {
  shippingAmount: number;
  reason: string;
  note?: string;
};

type OrderLineFulfillmentInput = {
  actualQuantity: number;
  reason?: string;
};

type OrderLabels = {
  fulfillment: Record<FulfillmentStatus, string>;
  paymentMethod: Record<PaymentMethod, string>;
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
  const [reservationFilter, setReservationFilter] =
    React.useState<ReservationFilterValue>("all");
  const [viewMode, setViewMode] = React.useState<ViewMode>("orders");
  const [selectedOrderId, setSelectedOrderId] = React.useState("");
  const [mobileDetailsOpen, setMobileDetailsOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<PanelNotice | null>(null);
  const [adminSession, setAdminSession] = React.useState<AdminSessionState>({
    allowed: false,
    permissions: [],
    role: null,
  });
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    let cancelled = false;

    void fetch("/api/me", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (cancelled || !isRecord(payload)) {
          return;
        }

        const admin = isRecord(payload.admin) ? payload.admin : null;

        setAdminSession({
          allowed: Boolean(admin?.allowed),
          permissions: Array.isArray(payload.permissions)
            ? payload.permissions.filter(
                (permission): permission is string => typeof permission === "string"
              )
            : [],
          role: readString(admin?.role),
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const upsertOrder = React.useCallback((order: AdminOrder) => {
    setOrders((currentOrders) => {
      const exists = currentOrders.some((item) => item.id === order.id);
      const nextOrders = exists
        ? currentOrders.map((item) =>
            item.id === order.id ? mergeOrderSummary(item, order) : item
          )
        : [order, ...currentOrders];

      return sortOrdersForOperationsQueue(nextOrders);
    });
    setDetailsById((currentDetails) => ({
      ...currentDetails,
      [order.id]: order,
    }));
  }, []);

  const removeOrder = React.useCallback((orderId: string) => {
    setOrders((currentOrders) => currentOrders.filter((order) => order.id !== orderId));
    setDetailsById((currentDetails) => {
      const nextDetails = { ...currentDetails };
      delete nextDetails[orderId];
      return nextDetails;
    });
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

        if (!canReadWalletRefunds(adminSession)) {
          return order;
        }

        let orderWithRefunds = order;

        try {
          orderWithRefunds = {
            ...order,
            walletRefunds: await fetchWalletRefundsForOrderFromApi(order.id, text, signal),
          };
        } catch {
          return order;
        }

        if (signal?.aborted) {
          return null;
        }

        upsertOrder(orderWithRefunds);
        return orderWithRefunds;
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
    [adminSession, text, upsertOrder]
  );

  const refreshOrders = React.useCallback(
    async (signal?: AbortSignal) => {
      setIsLoadingOrders(true);

      try {
        const result = await fetchOrdersFromApi({
          signal,
        });
        const sortedOrders = sortOrdersForOperationsQueue(result.orders);

        if (signal?.aborted) {
          return;
        }

        setOrders(sortedOrders);
        setDataSource({
          source: result.source,
          label: sourceLabel(result.source, text),
          syncedAt: formatSyncTime(),
          total: result.total,
          returned: result.returned,
        });
        setSelectedOrderId((currentId) =>
          currentId && sortedOrders.some((order) => order.id === currentId)
            ? currentId
            : sortedOrders[0]?.id ?? ""
        );
        setNotice(null);
      } catch (error) {
        if (signal?.aborted) {
          return;
        }

        const message =
          error instanceof Error ? error.message : text.orders.apiError;

        setDataSource((current) => ({
          ...current,
          error: message,
          syncedAt: formatSyncTime(),
        }));
        setNotice({
          tone: "error",
          message,
        });
      } finally {
        if (!signal?.aborted) {
          setIsLoadingOrders(false);
        }
      }
    },
    [text]
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
        const matchesReservation =
          reservationFilter === "all" ||
          (reservationFilter === "overdue" && order.reservationOverdue);
        const matchesView = orderMatchesView(order, viewMode);

        return (
          matchesStatus &&
          matchesPayment &&
          matchesStockRisk &&
          matchesReservation &&
          matchesView
        );
      }),
    [orders, paymentFilter, reservationFilter, statusFilter, stockRiskFilter, viewMode]
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
      completed: orders.filter((order) => order.status === "completed").length,
      cancelled: orders.filter((order) => order.status === "cancelled").length,
      openPayments: orders.filter(
        (order) => order.paymentStatus !== "paid" && order.status !== "cancelled"
      ).length,
      stockRisk: orders.filter(
        (order) => order.stockRisk === "low" || order.stockRisk === "blocked"
      ).length,
      agedReservations: orders.filter((order) => order.reservationOverdue).length,
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

    if (reservationFilter === "overdue") {
      return "agedReservations";
    }

    if (statusFilter !== "all") {
      return statusFilter;
    }

    return "all";
  }, [paymentFilter, reservationFilter, statusFilter, stockRiskFilter, viewMode]);
  const handleWorkflowSelect = React.useCallback((key: WorkflowKey) => {
    setPage(1);

    if (key === "all") {
      setStatusFilter("all");
      setPaymentFilter("all");
      setStockRiskFilter("all");
      setReservationFilter("all");
      setViewMode("orders");
      return;
    }

    if (key === "openPayments") {
      setStatusFilter("all");
      setPaymentFilter("open");
      setStockRiskFilter("all");
      setReservationFilter("all");
      setViewMode("payments");
      return;
    }

    if (key === "stockRisk") {
      setStatusFilter("all");
      setPaymentFilter("all");
      setStockRiskFilter("risk");
      setReservationFilter("all");
      setViewMode("orders");
      return;
    }

    if (key === "agedReservations") {
      setStatusFilter("all");
      setPaymentFilter("all");
      setStockRiskFilter("all");
      setReservationFilter("overdue");
      setViewMode("orders");
      return;
    }

    setStatusFilter(key as StatusFilterValue);
    setPaymentFilter("all");
    setStockRiskFilter("all");
    setReservationFilter("all");
    setViewMode(key === "shipped" ? "shipping" : "orders");
  }, []);

  const patchOrder = React.useCallback(
    async (order: AdminOrder, patch: OrderPatchInput, successMessage: string) => {
      const actionKey = `${order.id}:${
        patch.rollback ? "rollback" : patch.status ?? Object.keys(patch).sort().join(",")
      }`;

      setPendingOrderAction(actionKey);

      try {
        const result = await patchOrderInApi(order.id, patch, text);

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
    [text, upsertOrder]
  );

  const patchOrderPayment = React.useCallback(
    async (order: AdminOrder, patch: OrderPaymentPatchInput, successMessage: string) => {
      const actionKey = `${order.id}:payment`;

      setPendingOrderAction(actionKey);

      try {
        const result = await patchOrderPaymentInApi(order.id, patch, text);

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
    [text, upsertOrder]
  );

  const patchOrderShipping = React.useCallback(
    async (order: AdminOrder, patch: OrderShippingPatchInput, successMessage: string) => {
      const actionKey = `${order.id}:shipping`;

      setPendingOrderAction(actionKey);

      try {
        const result = await patchOrderShippingInApi(order.id, patch, text);

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
    [text, upsertOrder]
  );

  const patchOrderLineFulfillment = React.useCallback(
    async (
      order: AdminOrder,
      line: OrderLine,
      patch: OrderLineFulfillmentInput
    ) => {
      const actionKey = `${order.id}:line:${line.id}`;

      setPendingOrderAction(actionKey);

      try {
        const result = await patchOrderLineFulfillmentInApi(order.id, line.id, patch, text);

        if (result.order) {
          upsertOrder(result.order);
        }

        const refreshedOrder = await fetchOrderDetailFromApi(order.id);
        const walletRefunds = canReadWalletRefunds(adminSession)
          ? await fetchWalletRefundsForOrderFromApi(order.id, text)
          : refreshedOrder.walletRefunds;

        upsertOrder({ ...refreshedOrder, walletRefunds });
        setNotice({
          tone: "success",
          message:
            patch.actualQuantity < line.quantity
              ? `${line.name} 实给数量已保存；生成申请，审批通过后入账。`
              : `${line.name} 实给数量已保存。`,
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
    [adminSession, text, upsertOrder]
  );

  const handleTransition = React.useCallback(
    (order: AdminOrder, status: OrderDbStatus, successMessage: string) => {
      if (
        status === "packed" &&
        order.lines.some((line) => line.pickedQty <= 0 && line.cancelledQty <= 0)
      ) {
        setNotice({
          tone: "warning",
          message: "请先在“商品”分组确认每个商品的实给数量，再打包完成。",
        });
        return;
      }

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

  const handleForceCancelOrder = React.useCallback(
    (order: AdminOrder) => {
      const reason = window.prompt(text.orders.forceCancelPrompt)?.trim();

      if (!reason) {
        setNotice({
          tone: "warning",
          message: text.orders.forceCancelReasonRequired,
        });
        return;
      }

      void patchOrder(
        order,
        {
          forceCancel: true,
          note: reason,
          status: "cancelled",
        },
        formatAdminMessage(text.orders.forceCancelledNotice, { id: order.id })
      );
    },
    [
      patchOrder,
      text.orders.forceCancelPrompt,
      text.orders.forceCancelReasonRequired,
      text.orders.forceCancelledNotice,
    ]
  );

  const handleDangerVoidOrder = React.useCallback(
    async (order: AdminOrder, input: OrderDangerActionInput) => {
      const actionKey = `${order.id}:danger`;

      setPendingOrderAction(actionKey);

      try {
        const result = await voidOrderWithDangerAction(order.id, input, text);
        const restoredQty = result.restoredQty;
        const walletRefundAmount = result.walletRefundAmount;
        const walletRefundRequestId = result.walletRefundRequestId;

        removeOrder(order.id);
        setSelectedOrderId((currentId) => (currentId === order.id ? "" : currentId));
        setNotice({
          tone: "success",
          message: formatAdminMessage(text.orders.dangerActionSuccess, {
            id: order.id,
            restored: restoredQty,
            wallet: formatEuro(walletRefundAmount),
            request:
              walletRefundRequestId ??
              (walletRefundAmount > 0 ? text.orders.walletRefundRequestPending : text.common.none),
          }),
        });
      } catch (error) {
        setNotice({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : text.orders.dangerActionFailed,
        });
      } finally {
        setPendingOrderAction((currentAction) =>
          currentAction === actionKey ? null : currentAction
        );
      }
    },
    [
      removeOrder,
      text,
    ]
  );

  const approveWalletRefund = React.useCallback(
    async (order: AdminOrder, refund: WalletRefundRequest) => {
      const actionKey = `${order.id}:wallet-refund:${refund.id}`;

      setPendingOrderAction(actionKey);

      try {
        const reviewed = await patchWalletRefundApprovalInApi(refund.id, "approve", text);
        const walletRefunds = replaceWalletRefund(order.walletRefunds, reviewed);

        upsertOrder({ ...order, walletRefunds });
        setNotice({
          tone: "success",
          message: formatAdminMessage(text.orders.walletRefundApprovedNotice, {
            amount: formatEuro(reviewed.amount),
            id: reviewed.id,
          }),
        });
      } catch (error) {
        setNotice({
          tone: "error",
          message:
            error instanceof Error ? error.message : text.orders.walletRefundApproveFailed,
        });
      } finally {
        setPendingOrderAction((currentAction) =>
          currentAction === actionKey ? null : currentAction
        );
      }
    },
    [text, upsertOrder]
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

  const handleUpdateStaffNote = React.useCallback(
    (order: AdminOrder, staffNote: string) => {
      void patchOrder(
        order,
        {
          note: text.orders.activity.staffNoteUpdated,
          staffNote: staffNote.trim(),
        },
        text.orders.notices.staffNote
      );
    },
    [patchOrder, text.orders.activity.staffNoteUpdated, text.orders.notices.staffNote]
  );

  const handleUpdateLogistics = React.useCallback(
    (order: AdminOrder, carrier: string, tracking: string) => {
      void patchOrder(
        order,
        {
          carrier,
          note: text.orders.shipmentSaved,
          tracking,
        },
        text.orders.shipmentSaved
      );
    },
    [patchOrder, text.orders.shipmentSaved]
  );

  const handleUpdatePaymentMethod = React.useCallback(
    (order: AdminOrder, paymentMethod: PaymentMethod) => {
      void patchOrder(
        order,
        {
          note: `${text.orders.details.paymentMethod}: ${labels.paymentMethod[order.paymentMethod]} -> ${labels.paymentMethod[paymentMethod]}`,
          paymentMethod,
        },
        text.orders.paymentMethodSaved
      );
    },
    [labels.paymentMethod, patchOrder, text.orders.details.paymentMethod, text.orders.paymentMethodSaved]
  );

  const handleUpdatePayment = React.useCallback(
    (order: AdminOrder, patch: OrderPaymentPatchInput) => {
      void patchOrderPayment(order, patch, text.orders.paymentReconciliationSaved);
    },
    [patchOrderPayment, text.orders.paymentReconciliationSaved]
  );

  const handleUpdateLineFulfillment = React.useCallback(
    (order: AdminOrder, line: OrderLine, patch: OrderLineFulfillmentInput) => {
      void patchOrderLineFulfillment(order, line, patch);
    },
    [patchOrderLineFulfillment]
  );

  const handleAdjustShipping = React.useCallback(
    (order: AdminOrder, patch: OrderShippingPatchInput) => {
      void patchOrderShipping(order, patch, text.orders.shippingAdjustmentSaved);
    },
    [patchOrderShipping, text.orders.shippingAdjustmentSaved]
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
            {isLoadingOrders && !dataSource.syncedAt && orders.length === 0 ? (
              <OrdersListSkeleton text={text} />
            ) : (
              <AdminBusyRegion
                label={text.common.refreshing}
                pending={isLoadingOrders}
                rows={5}
              >
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
              </AdminBusyRegion>
            )}
          </div>
          <Dialog
            open={mobileDetailsOpen && selectedOrder !== null}
            onOpenChange={setMobileDetailsOpen}
          >
            {selectedOrder && (
              <DialogContent className="grid h-[min(760px,calc(100dvh-0.5rem))] max-h-[calc(100dvh-0.5rem)] w-[calc(100vw-0.5rem)] max-w-[calc(100vw-0.5rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-lg bg-white p-0 pt-7 sm:h-[min(820px,calc(100dvh-1rem))] sm:max-h-[calc(100dvh-1rem)] sm:w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-1rem)] sm:pt-10 xl:max-w-[1280px] 2xl:max-w-[1360px]">
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
                <div className="min-h-0 overflow-y-auto overscroll-contain bg-slate-50/40">
                  <OrderDetailsPanel
                    adminSession={adminSession}
                    labels={labels}
                    loading={loadingDetailId === selectedOrder.id}
                    order={selectedOrder}
                    pendingActionKey={pendingOrderAction}
                    text={text}
                    onCancelOrder={handleCancelOrder}
                    onApproveWalletRefund={approveWalletRefund}
                    onDangerVoidOrder={handleDangerVoidOrder}
                    onForceCancelOrder={handleForceCancelOrder}
                    onPrintOrder={handlePrintOrder}
                    onRollback={handleRollbackOrder}
                    onTransition={handleTransition}
                    onUpdateLogistics={handleUpdateLogistics}
                    onUpdateLineFulfillment={handleUpdateLineFulfillment}
                    onAdjustShipping={handleAdjustShipping}
                    onUpdatePayment={handleUpdatePayment}
                    onUpdatePaymentMethod={handleUpdatePaymentMethod}
                    onUpdateStaffNote={handleUpdateStaffNote}
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
  const groups: Array<{
    key: string;
    title: string;
    items: Array<{ key: WorkflowKey; label: string; tone?: "archive" | "attention" }>;
  }> = [
    {
      key: "stages",
      title: text.orders.workflow.stages,
      items: [
        { key: "all", label: text.orders.workflow.all },
        { key: "submitted", label: labels.status.submitted },
        { key: "accepted", label: labels.status.accepted },
        { key: "picking", label: labels.status.picking },
        { key: "packed", label: labels.status.packed },
        { key: "shipped", label: labels.status.shipped },
      ],
    },
    {
      key: "archive",
      title: text.orders.workflow.archive,
      items: [
        { key: "completed", label: labels.status.completed, tone: "archive" },
        { key: "cancelled", label: labels.status.cancelled, tone: "archive" },
      ],
    },
    {
      key: "followUps",
      title: text.orders.workflow.followUps,
      items: [
        { key: "openPayments", label: text.orders.workflow.openPayments, tone: "attention" },
        { key: "stockRisk", label: text.orders.workflow.stockRisk, tone: "attention" },
        {
          key: "agedReservations",
          label: text.orders.workflow.agedReservations,
          tone: "attention",
        },
      ],
    },
  ];

  return (
    <div
      role="toolbar"
      aria-label={text.orders.workflow.title}
      className="grid min-w-0 gap-2 xl:grid-cols-[minmax(0,1fr)_auto]"
    >
      {groups.map((group) => (
        <div
          key={group.key}
          className={cn(
            "min-w-0 rounded-md border border-slate-200/80 bg-slate-50/60 px-2 py-1.5",
            group.key === "followUps" && "xl:col-span-2"
          )}
        >
          <div className="mb-1 truncate text-[10px] font-black leading-tight text-slate-500">
            {group.title}
          </div>
          <div
            role="group"
            aria-label={group.title}
            className="flex min-w-0 gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {group.items.map((item) => {
              const isActive = item.key === activeKey;

              return (
                <Button
                  key={item.key}
                  type="button"
                  variant={isActive ? "default" : "outline"}
                  size="xs"
                  className={cn(
                    "h-8 min-w-fit gap-1.5 rounded-md px-2.5",
                    !isActive && "bg-white text-slate-600",
                    !isActive &&
                      item.tone === "archive" &&
                      "border-slate-200 bg-white text-slate-500",
                    !isActive &&
                      item.tone === "attention" &&
                      "border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-100"
                  )}
                  onClick={() => onSelect(item.key)}
                >
                  <span>{item.label}</span>
                  <span
                    className={cn(
                      "rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-black leading-none text-slate-600",
                      item.tone === "attention" &&
                        !isActive &&
                        "bg-amber-100 text-amber-900",
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
      ))}
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
                <MobileOrderCard labels={labels} order={order} text={text} viewMode={viewMode} />
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
                      <ReservationBadge order={order} text={text} />
                    </div>
                    <OrderProgressInline labels={labels} status={order.status} />
                  </TableCell>
                  {viewMode === "shipping" ? (
                    <>
                      <TableCell>
                        <div className="text-xs font-semibold">{orderValueLabel(text, order.service)}</div>
                        <div className="text-[11px] text-slate-500">{orderValueLabel(text, order.eta)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold">
                          {carrierLabel(order.carrier, text)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {order.tracking || orderValueLabel(text, order.eta)}
                        </div>
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
                        <div className="text-xs font-semibold">{paymentDueLabel(order, text)}</div>
                        <div className="text-[11px] text-slate-500">
                          {labels.paymentMethod[order.paymentMethod]}
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

function OrdersListSkeleton({ text }: { text: AdminText }) {
  return (
    <div className="min-w-0 space-y-2" aria-busy="true" aria-live="polite">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-44 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
      </div>
      <div className="md:hidden">
        <AdminSkeletonRows rows={4} />
      </div>
      <div className="hidden overflow-hidden rounded-md border border-slate-200 bg-white md:block">
        <div className="grid grid-cols-[1fr_1.5fr_1.4fr_1fr_1fr_0.9fr] gap-3 border-b border-slate-200 bg-slate-50 p-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-3 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
        <div className="p-2">
          <AdminSkeletonRows rows={5} />
        </div>
      </div>
      <span className="sr-only">{text.common.loadingPanel}</span>
    </div>
  );
}

function MobileOrderCard({
  labels,
  order,
  text,
  viewMode,
}: {
  labels: OrderLabels;
  order: AdminOrder;
  text: AdminText;
  viewMode: ViewMode;
}) {
  const summaryFacts = getMobileSummaryFacts(order, viewMode, labels, text);

  return (
    <div className="min-w-0">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
        <div className="min-w-0">
          <div
            className="truncate text-[13px] font-black leading-4 text-slate-900"
            title={order.company}
          >
            {order.company}
          </div>
          <div
            className="mt-0.5 truncate font-mono text-[11px] font-semibold leading-3 text-slate-500"
            title={order.id}
          >
            {shortOrderId(order.id)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-black leading-4 text-slate-950">{formatEuro(order.total)}</div>
          <div className="mt-0.5 text-[10px] font-semibold leading-3 text-slate-400">
            {order.items} {text.common.product}
          </div>
        </div>
      </div>

      <div className="mt-1.5 flex min-w-0 items-center gap-1 overflow-hidden">
        <Badge
          className={cn(
            orderStatusBadgeClass(order.status),
            "h-5 shrink-0 rounded px-1.5 text-[11px] leading-none"
          )}
        >
          {labels.status[order.status]}
        </Badge>
        <Badge
          className={cn(
            priorityBadgeClass(order.priority),
            "h-5 shrink-0 rounded px-1.5 text-[11px] leading-none"
          )}
        >
          {labels.priority[order.priority]}
        </Badge>
        <span className="min-w-0 truncate rounded bg-slate-50 px-1.5 py-1 text-[11px] font-semibold leading-3 text-slate-500">
          {labels.payment[order.paymentStatus]} · {labels.fulfillment[order.fulfillmentStatus]}
        </span>
        <ReservationBadge compact order={order} text={text} />
      </div>

      <div className="mt-1.5 grid min-w-0 grid-cols-2 gap-1">
        {summaryFacts.map((fact) => (
          <div key={fact.label} className="min-w-0 rounded bg-slate-50 px-1.5 py-1">
            <div className="truncate text-[10px] font-semibold leading-3 text-slate-400">
              {fact.label}
            </div>
            <div className="mt-0.5 truncate text-[11px] font-bold leading-3 text-slate-700">
              {fact.value}
            </div>
          </div>
        ))}
      </div>

      <MobileOrderProgress labels={labels} status={order.status} />
    </div>
  );
}

function MobileOrderProgress({
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
    <div className="mt-1.5 min-w-0" aria-label={`${labels.status[status]} ${progressValue}/5`}>
      <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-[10px] font-semibold leading-3 text-slate-400">
          {labels.status[status]}
        </span>
        <span
          className={cn(
            "shrink-0 font-mono text-[10px] font-black leading-3 text-slate-400",
            !cancelled && "text-primary"
          )}
        >
          {progressValue}/5
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {steps.map((step, index) => {
          const stepIndex = index + 1;
          const done = !cancelled && currentIndex >= stepIndex;
          const current = !cancelled && currentIndex === stepIndex;

          return (
            <span
              key={step}
              className={cn(
                "h-1.5 rounded-full bg-slate-100",
                done && "bg-primary",
                current && "ring-2 ring-primary/15",
                cancelled && "bg-red-100"
              )}
              title={labels.status[step]}
            />
          );
        })}
      </div>
    </div>
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
      { label: text.common.service, value: orderValueLabel(text, order.service) },
      {
        label: text.orders.summary.carrier,
        value: `${carrierLabel(order.carrier, text)} / ${
          order.tracking || orderValueLabel(text, order.eta)
        }`,
      },
    ];
  }

  if (viewMode === "payments") {
    return [
      { label: text.orders.summary.payment, value: labels.payment[order.paymentStatus] },
      { label: text.orders.summary.due, value: paymentDueLabel(order, text) },
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
  adminSession,
  labels,
  loading,
  order,
  pendingActionKey,
  text,
  onCancelOrder,
  onApproveWalletRefund,
  onDangerVoidOrder,
  onForceCancelOrder,
  onPrintOrder,
  onRollback,
  onTransition,
  onAdjustShipping,
  onUpdateLogistics,
  onUpdateLineFulfillment,
  onUpdatePayment,
  onUpdatePaymentMethod,
  onUpdateStaffNote,
}: {
  adminSession: AdminSessionState;
  labels: OrderLabels;
  loading: boolean;
  order: AdminOrder | null;
  pendingActionKey: string | null;
  text: AdminText;
  onCancelOrder: (order: AdminOrder) => void;
  onApproveWalletRefund: (order: AdminOrder, refund: WalletRefundRequest) => void;
  onDangerVoidOrder: (order: AdminOrder, input: OrderDangerActionInput) => void;
  onForceCancelOrder: (order: AdminOrder) => void;
  onPrintOrder: (order: AdminOrder) => void;
  onRollback: (order: AdminOrder) => void;
  onTransition: (order: AdminOrder, status: OrderDbStatus, successMessage: string) => void;
  onAdjustShipping: (order: AdminOrder, patch: OrderShippingPatchInput) => void;
  onUpdateLogistics: (order: AdminOrder, carrier: string, tracking: string) => void;
  onUpdateLineFulfillment: (
    order: AdminOrder,
    line: OrderLine,
    patch: OrderLineFulfillmentInput
  ) => void;
  onUpdatePayment: (order: AdminOrder, patch: OrderPaymentPatchInput) => void;
  onUpdatePaymentMethod: (order: AdminOrder, paymentMethod: PaymentMethod) => void;
  onUpdateStaffNote: (order: AdminOrder, staffNote: string) => void;
}) {
  const [trackingDetailsState, setTrackingDetailsState] = React.useState(() => ({
    open: false,
    refreshedAt: new Date().toISOString(),
    resetKey: "",
  }));
  const trackingResetKey = order
    ? `${order.id}:${order.carrier}:${order.tracking}`
    : "";
  const trackingDetailsOpen =
    trackingDetailsState.open && trackingDetailsState.resetKey === trackingResetKey;
  const trackingDetail = React.useMemo(
    () =>
      order
        ? buildOrderTrackingDetail(order, text, trackingDetailsState.refreshedAt)
        : null,
    [order, text, trackingDetailsState.refreshedAt]
  );
  const orderId = order?.id ?? "";
  const [mobileSectionState, setMobileSectionState] = React.useState<{
    orderId: string;
    section: MobileOrderDetailsSection;
  }>({ orderId: "", section: "overview" });
  const mobileSection =
    mobileSectionState.orderId === orderId ? mobileSectionState.section : "overview";
  const handleMobileSectionChange = React.useCallback(
    (section: MobileOrderDetailsSection) => {
      setMobileSectionState({ orderId, section });
    },
    [orderId]
  );

  const handleToggleTrackingDetails = React.useCallback(() => {
    setTrackingDetailsState((current) => {
      if (!trackingResetKey) {
        return current;
      }

      const isOpen = current.open && current.resetKey === trackingResetKey;

      return {
        open: !isOpen,
        refreshedAt: new Date().toISOString(),
        resetKey: trackingResetKey,
      };
    });
  }, [trackingResetKey]);

  const handleRefreshTrackingDetails = React.useCallback(() => {
    if (!trackingResetKey) {
      return;
    }

    setTrackingDetailsState({
      open: true,
      refreshedAt: new Date().toISOString(),
      resetKey: trackingResetKey,
    });
  }, [trackingResetKey]);

  if (!order || !trackingDetail) {
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
  const canManageOrders = hasAdminSessionPermission(adminSession, "orders.manage");
  const canRequestWalletRefunds = hasAdminSessionPermission(
    adminSession,
    "wallet_refunds.request"
  );
  const canApproveWalletRefunds = hasAdminSessionPermission(
    adminSession,
    "wallet_refunds.approve"
  );
  const canDangerVoidOrder =
    isReadOnly &&
    hasAdminSessionPermission(adminSession, "orders.danger") &&
    (order.walletAppliedAmount <= 0 || canRequestWalletRefunds) &&
    !order.softDeletedAt;
  const canEditStaffNote = canManageOrders;
  const canEditLogistics = canManageOrders && !isReadOnly;
  const canEditLines =
    canManageOrders &&
    !isReadOnly &&
    order.status !== "shipped";
  const canAdjustShipping = canManageOrders && order.status !== "cancelled";
  const canReconcilePayment = canManageOrders && order.status !== "cancelled";

  return (
    <AdminBusyRegion
      className="min-h-full min-w-0"
      contentClassName="min-h-full"
      label={text.orders.detailLoading}
      overlayClassName="rounded-lg"
      pending={loading}
      rows={3}
    >
      <div className="min-h-full min-w-0 space-y-1.5 bg-slate-50/40 p-1.5 sm:space-y-2 sm:p-2">
      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <h3
              className="hidden break-words text-[15px] font-black leading-tight text-slate-950 sm:block"
              title={order.id}
            >
              {shortOrderId(order.id)}
            </h3>
            <CopyValueButton
              className="hidden sm:inline-flex"
              label={text.orders.table.order}
              text={text}
              value={order.id}
            />
            <Badge className={orderStatusBadgeClass(order.status)}>
              {labels.status[order.status]}
            </Badge>
            <Badge className={stockRiskBadgeClass(order.stockRisk)}>
              {labels.stockRisk[order.stockRisk]}
            </Badge>
            <ReservationBadge order={order} text={text} />
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
          <p className="mt-0.5 truncate text-xs leading-snug text-slate-500 sm:break-words sm:text-[13px]">
            {order.company} - {order.customer.city} ({order.customer.province})
          </p>
        </div>
        <OrderActionBar
          labels={labels}
          order={order}
          text={text}
          isMutating={isMutating}
          canDangerVoidOrder={canDangerVoidOrder}
          canForceCancel={canManageOrders && adminSession.role === "admin" && order.status === "shipped"}
          canManageOrders={canManageOrders}
          onCancelOrder={onCancelOrder}
          onDangerVoidOrder={onDangerVoidOrder}
          onForceCancelOrder={onForceCancelOrder}
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

      <OrderMobileSectionTabs
        activeSection={mobileSection}
        historyCount={order.operationHistory.length || order.activity.length}
        lineCount={order.lines.length}
        text={text}
        onChange={handleMobileSectionChange}
      />

      <div className="md:hidden">
        <OrderMobileDetailsSection
          activeSection={mobileSection}
          canAdjustShipping={canAdjustShipping}
          canEditLogistics={canEditLogistics}
          canEditLines={canEditLines}
          canEditPayment={canManageOrders && !isReadOnly}
          canEditStaffNote={canEditStaffNote}
          canApproveWalletRefunds={canApproveWalletRefunds}
          canReconcilePayment={canReconcilePayment}
          isMutating={isMutating}
          labels={labels}
          order={order}
          pickedItems={pickedItems}
          text={text}
          trackingDetail={trackingDetail}
          trackingDetailsOpen={trackingDetailsOpen}
          onAdjustShipping={onAdjustShipping}
          onApproveWalletRefund={onApproveWalletRefund}
          onRefreshTrackingDetails={handleRefreshTrackingDetails}
          onToggleTrackingDetails={handleToggleTrackingDetails}
          onUpdateLogistics={onUpdateLogistics}
          onUpdateLineFulfillment={onUpdateLineFulfillment}
          onUpdatePayment={onUpdatePayment}
          onUpdatePaymentMethod={onUpdatePaymentMethod}
          onUpdateStaffNote={onUpdateStaffNote}
        />
      </div>

      <div className="hidden min-w-0 gap-1 sm:gap-1.5 md:grid xl:grid-cols-[minmax(0,1fr)_minmax(330px,360px)] 2xl:grid-cols-[minmax(0,1fr)_minmax(350px,380px)]">
        <div className="min-w-0 space-y-1.5">
          <div className="hidden gap-1.5 md:grid md:grid-cols-2 xl:grid-cols-5">
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
              helper={`${labels.paymentMethod[order.paymentMethod]} - ${paymentDueLabel(order, text)}`}
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
              label={text.orders.details.reservation}
              value={reservationValue(order, text)}
              helper={reservationHelper(order, text)}
            />
            <DetailFact
              label={text.orders.details.customer}
              value={order.customer.priceList}
              helper={order.customer.partitaIva}
            />
          </div>

          <div className="hidden md:block">
            <StatusStepper labels={labels} status={order.status} />
          </div>

          <OrderPaymentMethodCard
            key={`${order.id}:${order.paymentMethod}:${order.paymentStatus}:${order.paymentReconciliation.receivedAt ?? ""}`}
            canApproveWalletRefunds={canApproveWalletRefunds}
            canEditPayment={canManageOrders && !isReadOnly}
            canReconcilePayment={canReconcilePayment}
            isMutating={isMutating}
            labels={labels}
            order={order}
            text={text}
            onApproveWalletRefund={onApproveWalletRefund}
            onUpdatePaymentMethod={onUpdatePaymentMethod}
            onUpdatePayment={onUpdatePayment}
          />

          <OrderLogisticsCard
            key={`${order.id}:${order.carrier}:${order.tracking}`}
            canAdjustShipping={canAdjustShipping}
            canEditLogistics={canEditLogistics}
            isMutating={isMutating}
            order={order}
            text={text}
            trackingDetail={trackingDetail}
            trackingDetailsOpen={trackingDetailsOpen}
            onRefreshTrackingDetails={handleRefreshTrackingDetails}
            onToggleTrackingDetails={handleToggleTrackingDetails}
            onAdjustShipping={onAdjustShipping}
            onUpdateLogistics={onUpdateLogistics}
          />

          <OrderNotesBanner
            canEditStaffNote={canEditStaffNote}
            isMutating={isMutating}
            order={order}
            text={text}
            onUpdateStaffNote={onUpdateStaffNote}
          />

          <div className="min-w-0 rounded-md border border-slate-200 bg-white p-1.5">
            <div className="mb-1 flex items-center gap-2 sm:mb-2">
              <PackageCheck className="size-4 text-primary" />
              <div className="text-sm font-bold text-slate-900">
                {text.orders.details.orderLines}
              </div>
            </div>
            <OrderLines
              canEditLines={canEditLines}
              isMutating={isMutating}
              lines={order.lines}
              order={order}
              text={text}
              onUpdateLineFulfillment={onUpdateLineFulfillment}
            />
          </div>
        </div>

        <div className="grid min-w-0 gap-1 sm:gap-1.5 xl:self-start">
          <div className="min-w-0 rounded-md border border-slate-200 bg-white p-1.5 sm:p-2">
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
    </AdminBusyRegion>
  );
}

function OrderMobileSectionTabs({
  activeSection,
  historyCount,
  lineCount,
  text,
  onChange,
}: {
  activeSection: MobileOrderDetailsSection;
  historyCount: number;
  lineCount: number;
  text: AdminText;
  onChange: (section: MobileOrderDetailsSection) => void;
}) {
  const sections: Array<{
    key: MobileOrderDetailsSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    {
      key: "overview",
      label: text.orders.mobileSections.overview,
      icon: ClipboardList,
    },
    {
      key: "payment",
      label: text.orders.mobileSections.payment,
      icon: CreditCard,
    },
    {
      key: "logistics",
      label: text.orders.mobileSections.logistics,
      icon: Truck,
    },
    {
      key: "lines",
      label: text.orders.mobileSections.lines,
      icon: PackageCheck,
      count: lineCount,
    },
    {
      key: "history",
      label: text.orders.mobileSections.history,
      icon: Clock3,
      count: historyCount,
    },
  ];

  return (
    <div className="sticky top-0 z-20 -mx-1.5 bg-slate-50/95 px-1.5 py-1 backdrop-blur md:hidden">
      <div className="grid grid-cols-5 gap-1 rounded-md border border-slate-200 bg-white p-1 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        {sections.map((section) => {
          const Icon = section.icon;
          const selected = activeSection === section.key;

          return (
            <button
              key={section.key}
              type="button"
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded px-1 py-1 text-[10px] font-black leading-tight transition",
                selected
                  ? "bg-primary text-white shadow-sm"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              )}
              aria-pressed={selected}
              onClick={() => onChange(section.key)}
            >
              <span className="relative grid size-4 place-items-center">
                <Icon className="size-3.5" />
                {section.count !== undefined && section.count > 0 ? (
                  <span
                    className={cn(
                      "absolute -right-2 -top-1 rounded-full px-1 text-[9px] leading-3",
                      selected ? "bg-white/20 text-white" : "bg-white text-slate-500"
                    )}
                  >
                    {section.count}
                  </span>
                ) : null}
              </span>
              <span className="w-full truncate">{section.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OrderMobileDetailsSection({
  activeSection,
  canAdjustShipping,
  canEditLogistics,
  canEditLines,
  canEditPayment,
  canEditStaffNote,
  canApproveWalletRefunds,
  canReconcilePayment,
  isMutating,
  labels,
  order,
  pickedItems,
  text,
  trackingDetail,
  trackingDetailsOpen,
  onAdjustShipping,
  onApproveWalletRefund,
  onRefreshTrackingDetails,
  onToggleTrackingDetails,
  onUpdateLogistics,
  onUpdateLineFulfillment,
  onUpdatePayment,
  onUpdatePaymentMethod,
  onUpdateStaffNote,
}: {
  activeSection: MobileOrderDetailsSection;
  canAdjustShipping: boolean;
  canEditLogistics: boolean;
  canEditLines: boolean;
  canEditPayment: boolean;
  canEditStaffNote: boolean;
  canApproveWalletRefunds: boolean;
  canReconcilePayment: boolean;
  isMutating: boolean;
  labels: OrderLabels;
  order: AdminOrder;
  pickedItems: number;
  text: AdminText;
  trackingDetail: OrderTrackingDetail;
  trackingDetailsOpen: boolean;
  onAdjustShipping: (order: AdminOrder, patch: OrderShippingPatchInput) => void;
  onApproveWalletRefund: (order: AdminOrder, refund: WalletRefundRequest) => void;
  onRefreshTrackingDetails: () => void;
  onToggleTrackingDetails: () => void;
  onUpdateLogistics: (order: AdminOrder, carrier: string, tracking: string) => void;
  onUpdateLineFulfillment: (
    order: AdminOrder,
    line: OrderLine,
    patch: OrderLineFulfillmentInput
  ) => void;
  onUpdatePayment: (order: AdminOrder, patch: OrderPaymentPatchInput) => void;
  onUpdatePaymentMethod: (order: AdminOrder, paymentMethod: PaymentMethod) => void;
  onUpdateStaffNote: (order: AdminOrder, staffNote: string) => void;
}) {
  if (activeSection === "payment") {
    return (
      <OrderPaymentMethodCard
        compact
        canApproveWalletRefunds={canApproveWalletRefunds}
        canEditPayment={canEditPayment}
        canReconcilePayment={canReconcilePayment}
        isMutating={isMutating}
        labels={labels}
        order={order}
        text={text}
        onUpdatePayment={onUpdatePayment}
        onUpdatePaymentMethod={onUpdatePaymentMethod}
        onApproveWalletRefund={onApproveWalletRefund}
      />
    );
  }

  if (activeSection === "logistics") {
    return (
      <OrderLogisticsCard
        compact
        canAdjustShipping={canAdjustShipping}
        canEditLogistics={canEditLogistics}
        isMutating={isMutating}
        order={order}
        text={text}
        trackingDetail={trackingDetail}
        trackingDetailsOpen={trackingDetailsOpen}
        onAdjustShipping={onAdjustShipping}
        onRefreshTrackingDetails={onRefreshTrackingDetails}
        onToggleTrackingDetails={onToggleTrackingDetails}
        onUpdateLogistics={onUpdateLogistics}
      />
    );
  }

  if (activeSection === "lines") {
    return (
      <div className="min-w-0 rounded-md border border-slate-200 bg-white p-1.5">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-sm font-black text-slate-900">
            <PackageCheck className="size-4 shrink-0 text-primary" />
            <span className="truncate">{text.orders.details.orderLines}</span>
          </div>
          <Badge variant="outline" className="h-5 bg-white px-1.5 text-[10px]">
            {order.lines.length}
          </Badge>
        </div>
        <OrderLines
          canEditLines={canEditLines}
          isMutating={isMutating}
          lines={order.lines}
          order={order}
          text={text}
          onUpdateLineFulfillment={onUpdateLineFulfillment}
        />
      </div>
    );
  }

  if (activeSection === "history") {
    return (
      <div className="min-w-0 rounded-md border border-slate-200 bg-white p-1.5">
        <OrderOperationHistory
          events={order.operationHistory}
          fallbackActivity={order.activity}
          labels={labels}
          text={text}
        />
      </div>
    );
  }

  return (
    <OrderMobileOverview
      canEditStaffNote={canEditStaffNote}
      isMutating={isMutating}
      labels={labels}
      order={order}
      pickedItems={pickedItems}
      text={text}
      onUpdateStaffNote={onUpdateStaffNote}
    />
  );
}

function OrderMobileOverview({
  canEditStaffNote,
  isMutating,
  labels,
  order,
  pickedItems,
  text,
  onUpdateStaffNote,
}: {
  canEditStaffNote: boolean;
  isMutating: boolean;
  labels: OrderLabels;
  order: AdminOrder;
  pickedItems: number;
  text: AdminText;
  onUpdateStaffNote: (order: AdminOrder, staffNote: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <section className="min-w-0 rounded-md border border-slate-200 bg-white p-1.5">
        <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-sm font-black text-slate-900">
            <ClipboardList className="size-4 shrink-0 text-primary" />
            <span className="truncate">{text.orders.mobileSections.overview}</span>
          </div>
          <Badge className={orderStatusBadgeClass(order.status)}>
            {labels.status[order.status]}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <MobileFact label={text.orders.details.orderTotal} value={formatEuro(order.total)} />
          <MobileFact
            label={text.common.payment}
            value={`${labels.payment[order.paymentStatus]} · ${labels.paymentMethod[order.paymentMethod]}`}
          />
          <MobileFact
            label={text.common.fulfillment}
            value={`${labels.fulfillment[order.fulfillmentStatus]} · ${pickedItems}/${order.items}`}
          />
          <MobileFact
            label={text.orders.details.reservation}
            value={reservationValue(order, text)}
          />
          <MobileFact label={text.common.customer} value={order.company} />
          <MobileFact
            label={text.orders.details.shipping}
            value={isPickupCarrier(order.carrier) ? text.orders.details.pickupFree : formatEuro(order.shipping)}
          />
        </div>
        <MobileOrderProgress labels={labels} status={order.status} />
      </section>
      <OrderNotesBanner
        canEditStaffNote={canEditStaffNote}
        isMutating={isMutating}
        order={order}
        text={text}
        onUpdateStaffNote={onUpdateStaffNote}
      />
    </div>
  );
}

function canShipOrder(order: AdminOrder) {
  return (
    order.status === "packed" &&
    order.carrier !== unassignedCarrier &&
    (isPickupCarrier(order.carrier) || order.tracking.trim().length > 0)
  );
}

function hasCarrier(order: AdminOrder) {
  return order.carrier !== unassignedCarrier;
}

function hasRequiredOrderTracking(order: AdminOrder) {
  return isPickupCarrier(order.carrier) || order.tracking.trim().length > 0;
}

function isPickupCarrier(carrier: string) {
  return carrier.trim().toLowerCase().includes("ritiro");
}

function buildOrderTrackingDetail(
  order: AdminOrder,
  text: AdminText,
  refreshedAt: string
): OrderTrackingDetail {
  const tracking = order.tracking.trim();
  const trackingUrl = buildCarrierTrackingUrl(order.carrier, tracking);

  return {
    carrier: carrierLabel(order.carrier, text),
    tracking: tracking || text.common.none,
    status: trackingUrl
      ? text.orders.tracking.carrierRealtime
      : text.orders.tracking.noCarrierPortal,
    refreshedAt,
    trackingUrl,
    events: [],
  };
}

function buildCarrierTrackingUrl(carrier: Carrier, tracking: string) {
  const normalizedCarrier = carrier.toLowerCase();
  const encodedTracking = encodeURIComponent(tracking.trim());

  if (!encodedTracking || carrier === unassignedCarrier || normalizedCarrier.includes("ritiro")) {
    return null;
  }

  if (normalizedCarrier.includes("brt")) {
    return `https://vas.brt.it/vas/sped_numspe_par.htm?lang=it&sped_numsped=${encodedTracking}`;
  }

  if (normalizedCarrier.includes("gls")) {
    return `https://gls-group.com/IT/it/servizi-online/ricerca-spedizioni/?match=${encodedTracking}`;
  }

  if (normalizedCarrier.includes("ups")) {
    return `https://www.ups.com/track?loc=it_IT&tracknum=${encodedTracking}`;
  }

  if (normalizedCarrier.includes("dhl")) {
    return `https://www.dhl.com/it-it/home/tracking/tracking-parcel.html?tracking-id=${encodedTracking}`;
  }

  return `https://t.17track.net/it#nums=${encodedTracking}`;
}

function CopyValueButton({
  className,
  label,
  text,
  value,
}: {
  className?: string;
  label: string;
  text: AdminText;
  value: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(async () => {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }, [value]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className={cn("size-6 rounded-md text-slate-500 hover:text-slate-900", className)}
      aria-label={`${text.common.copy} ${label}`}
      title={copied ? text.common.copied : `${text.common.copy} ${label}`}
      onClick={handleCopy}
    >
      {copied ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

function ShipmentReadiness({
  onToggleTrackingDetails,
  order,
  text,
  trackingDetailsOpen,
}: {
  onToggleTrackingDetails?: () => void;
  order: AdminOrder;
  text: AdminText;
  trackingDetailsOpen?: boolean;
}) {
  const checks = [
    {
      label: text.common.carrier,
      ok: hasCarrier(order),
      value: carrierLabel(order.carrier, text),
    },
    {
      label: text.orders.print.tracking,
      ok: hasRequiredOrderTracking(order),
      value: order.tracking.trim() || text.common.none,
      action:
        !isPickupCarrier(order.carrier) && order.tracking.trim()
          ? onToggleTrackingDetails
          : undefined,
    },
    {
      label: text.orders.details.orderLines,
      ok: order.lines.length > 0,
      value: String(order.lines.length),
    },
  ];

  return (
    <div className="mt-1.5 rounded-md border border-slate-100 bg-slate-50 px-1.5 py-1">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase leading-none text-slate-400">
          {text.orders.details.shipmentCheck}
        </span>
        <span className="font-mono text-[10px] font-black text-slate-500">
          {checks.filter((check) => check.ok).length}/{checks.length}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {checks.map((check) => {
          const content = (
            <>
              <div className="flex min-w-0 items-center gap-1">
                {check.ok ? (
                  <CheckCircle2 className="size-3 shrink-0" />
                ) : (
                  <XCircle className="size-3 shrink-0" />
                )}
                <span className="truncate text-[10px] font-black leading-none">
                  {check.label}
                </span>
              </div>
              <div className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">
                {check.value}
              </div>
            </>
          );
          const className = cn(
            "min-w-0 rounded border bg-white px-1.5 py-1",
            check.ok
              ? "border-emerald-100 text-emerald-700"
              : "border-amber-100 text-amber-700",
            check.action &&
              "text-left transition hover:border-primary/30 hover:bg-primary/5",
            check.action && trackingDetailsOpen && "border-primary/30 bg-primary/5"
          );

          return check.action ? (
            <button
              key={check.label}
              type="button"
              className={className}
              onClick={check.action}
            >
              {content}
            </button>
          ) : (
            <div key={check.label} className={className}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getOrderTransition(order: AdminOrder, text: AdminText) {
  if (order.status === "submitted") {
    return {
      label: text.orders.confirmAndAccept,
      status: "accepted" as const,
      notice: formatAdminMessage(text.orders.notices.accepted, { id: order.id }),
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
  canDangerVoidOrder,
  canForceCancel,
  canManageOrders,
  onCancelOrder,
  onDangerVoidOrder,
  onForceCancelOrder,
  onPrintOrder,
  onRollback,
  onTransition,
}: {
  labels: OrderLabels;
  order: AdminOrder;
  text: AdminText;
  isMutating: boolean;
  canDangerVoidOrder: boolean;
  canForceCancel: boolean;
  canManageOrders: boolean;
  onCancelOrder: (order: AdminOrder) => void;
  onDangerVoidOrder: (order: AdminOrder, input: OrderDangerActionInput) => void;
  onForceCancelOrder: (order: AdminOrder) => void;
  onPrintOrder: (order: AdminOrder) => void;
  onRollback: (order: AdminOrder) => void;
  onTransition: (order: AdminOrder, status: OrderDbStatus, successMessage: string) => void;
}) {
  const [dangerReason, setDangerReason] = React.useState("");
  const [dangerConfirmation, setDangerConfirmation] = React.useState("");
  const canShip = canShipOrder(order);
  const transition = getOrderTransition(order, text);
  const rollback = getOrderRollback(order, text, labels);
  const actionCount = [
    true,
    canManageOrders && cancellableStatuses.has(order.status),
    canDangerVoidOrder,
    canForceCancel,
    canManageOrders && Boolean(rollback),
    canManageOrders && Boolean(transition),
  ].filter(Boolean).length;
  const dangerActionReady =
    dangerReason.trim().length > 0 && dangerConfirmation.trim() === order.id;

  return (
    <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto sm:items-end">
      <div
        className={cn(
          "grid w-full min-w-0 gap-1 sm:flex sm:w-auto sm:flex-wrap sm:justify-end",
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
          className="h-7 min-w-0 rounded-md bg-white px-1.5 text-[11px] text-slate-700 hover:text-slate-900 sm:h-8 sm:px-2 sm:text-xs"
          onClick={() => onPrintOrder(order)}
        >
          <Printer className="size-4" />
          <span className="min-w-0 truncate">{text.orders.print.action}</span>
        </Button>
        {canManageOrders && cancellableStatuses.has(order.status) && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 min-w-0 rounded-md bg-white px-1.5 text-[11px] text-red-600 hover:text-red-600 sm:h-8 sm:px-2 sm:text-xs"
                disabled={isMutating}
              >
                <XCircle className="size-4" />
                <span className="min-w-0 truncate">{text.orders.cancelOrder}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-sm">
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-red-50 text-red-600">
                  <AlertTriangle className="size-5" />
                </AlertDialogMedia>
                <AlertDialogTitle className="font-black text-slate-950">
                  {text.orders.cancelConfirmTitle}
                </AlertDialogTitle>
                <AlertDialogDescription className="leading-6 text-slate-600">
                  {formatAdminMessage(text.orders.cancelConfirmDescription, {
                    id: order.id,
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="grid gap-2 rounded-lg border border-red-100 bg-red-50/50 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-slate-500">{text.orders.table.order}</span>
                  <span className="min-w-0 truncate font-mono font-black text-slate-950">
                    {order.id}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-slate-500">{text.orders.table.status}</span>
                  <span className="font-black text-slate-950">
                    {labels.status[order.status]}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-slate-500">{text.orders.table.customer}</span>
                  <span className="min-w-0 truncate font-black text-slate-950">
                    {order.company}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-slate-500">{text.orders.table.total}</span>
                  <span className="font-black text-slate-950">
                    {formatEuro(order.total)}
                  </span>
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel className="h-10">
                  {text.orders.cancelConfirmBack}
                </AlertDialogCancel>
                <AlertDialogAction
                  className="h-10 bg-red-600 text-white hover:bg-red-700"
                  disabled={isMutating}
                  onClick={() => onCancelOrder(order)}
                >
                  {text.orders.cancelConfirmAction}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {canForceCancel && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 min-w-0 rounded-md bg-white px-1.5 text-[11px] text-red-700 hover:text-red-700 sm:h-8 sm:px-2 sm:text-xs"
            onClick={() => onForceCancelOrder(order)}
            disabled={isMutating}
          >
            <XCircle className="size-4" />
            <span className="min-w-0 truncate">{text.orders.forceCancelOrder}</span>
          </Button>
        )}
        {canDangerVoidOrder && (
          <AlertDialog
            onOpenChange={(open) => {
              if (!open) {
                setDangerReason("");
                setDangerConfirmation("");
              }
            }}
          >
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 min-w-0 rounded-md bg-white px-1.5 text-[11px] text-red-700 hover:text-red-700 sm:h-8 sm:px-2 sm:text-xs"
                disabled={isMutating}
              >
                <AlertTriangle className="size-4" />
                <span className="min-w-0 truncate">{text.orders.dangerAction}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-md">
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-red-50 text-red-600">
                  <AlertTriangle className="size-5" />
                </AlertDialogMedia>
                <AlertDialogTitle className="font-black text-slate-950">
                  {text.orders.dangerActionTitle}
                </AlertDialogTitle>
                <AlertDialogDescription className="leading-6 text-slate-600">
                  {formatAdminMessage(text.orders.dangerActionDescription, {
                    id: order.id,
                    wallet: formatEuro(order.walletAppliedAmount),
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <label className="text-xs font-black text-slate-500">
                    {text.orders.dangerActionReason}
                  </label>
                  <Textarea
                    className="min-h-20 resize-none text-sm"
                    value={dangerReason}
                    onChange={(event) => setDangerReason(event.target.value)}
                    maxLength={1000}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-black text-slate-500">
                    {formatAdminMessage(text.orders.dangerActionConfirmLabel, {
                      id: order.id,
                    })}
                  </label>
                  <Input
                    value={dangerConfirmation}
                    onChange={(event) => setDangerConfirmation(event.target.value)}
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel className="h-10">
                  {text.orders.cancelConfirmBack}
                </AlertDialogCancel>
                <AlertDialogAction
                  className="h-10 bg-red-600 text-white hover:bg-red-700"
                  disabled={isMutating || !dangerActionReady}
                  onClick={() =>
                    onDangerVoidOrder(order, {
                      confirmOrderNo: dangerConfirmation,
                      reason: dangerReason,
                    })
                  }
                >
                  {text.orders.dangerActionConfirm}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {canManageOrders && rollback && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 min-w-0 rounded-md bg-white px-1.5 text-[11px] text-slate-700 hover:text-slate-900 sm:h-8 sm:px-2 sm:text-xs"
            onClick={() => onRollback(order)}
            disabled={isMutating}
          >
            <RotateCcw className="size-4" />
            <span className="min-w-0 truncate">{rollback.label}</span>
          </Button>
        )}
        {canManageOrders && transition && (
          <Button
            size="sm"
            className="h-7 min-w-0 rounded-md px-1.5 text-[11px] sm:h-8 sm:px-2 sm:text-xs"
            onClick={() => onTransition(order, transition.status, transition.notice)}
            disabled={isMutating || (transition.status === "shipped" && !canShip)}
          >
            <ArrowRight className="size-4" />
            <span className="min-w-0 truncate">{transition.label}</span>
          </Button>
        )}
      </div>
      {order.status === "packed" && !canShip && (
        <div className="max-w-none text-[11px] font-semibold leading-4 text-amber-700 sm:max-w-[280px]">
          {text.orders.logisticsRequired}
        </div>
      )}
    </div>
  );
}

function TrackingDetailsPanel({
  detail,
  text,
  onRefresh,
}: {
  detail: OrderTrackingDetail;
  text: AdminText;
  onRefresh: () => void;
}) {
  return (
    <section className="min-w-0 rounded-md border border-cyan-200 bg-cyan-50/40 p-1.5 shadow-[0_1px_0_rgba(15,23,42,0.04)] sm:p-2">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Truck className="size-4 shrink-0 text-cyan-700" />
            <h4 className="truncate text-sm font-black leading-tight text-slate-950">
              {text.orders.tracking.title}
            </h4>
            <Badge className="h-5 border-cyan-200 bg-white text-[10px] text-cyan-700">
              {detail.status}
            </Badge>
          </div>
          <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug text-slate-500">
            {text.orders.tracking.description}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="h-7 shrink-0 bg-white px-2"
          onClick={onRefresh}
        >
          <RefreshCw className="size-3" />
          {text.orders.tracking.refresh}
        </Button>
      </div>

      <div className="mt-1.5 grid min-w-0 grid-cols-2 gap-1 md:grid-cols-4">
        <TrackingFact label={text.common.carrier} value={detail.carrier} />
        <TrackingFact
          label={text.orders.tracking.number}
          value={detail.tracking}
          mono
        />
        <TrackingFact label={text.orders.tracking.liveSource} value={detail.status} />
        <TrackingFact
          label={text.orders.tracking.refreshedAt}
          value={formatDisplayDate(detail.refreshedAt)}
        />
      </div>

      <div className="mt-1.5 flex min-w-0 flex-col gap-1.5 rounded-md border border-cyan-100 bg-white/75 p-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-[11px] font-semibold leading-snug text-slate-500">
          {detail.trackingUrl
            ? text.orders.tracking.externalHint
            : text.orders.tracking.noCarrierPortal}
        </div>
        {detail.trackingUrl && (
          <Button
            asChild
            variant="outline"
            size="xs"
            className="h-7 w-full bg-white px-2 sm:w-auto"
          >
            <a href={detail.trackingUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3" />
              {text.orders.tracking.carrierPortal}
            </a>
          </Button>
        )}
      </div>

      <div className="mt-1.5 rounded-md border border-cyan-100 bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-2 py-1.5">
          <div className="text-[11px] font-black uppercase leading-none text-slate-400">
            {text.orders.tracking.timeline}
          </div>
          <Badge variant="outline" className="h-5 bg-white px-1.5 text-[10px]">
            {detail.events.length}
          </Badge>
        </div>
        {detail.events.length > 0 ? (
          <div className="max-h-52 space-y-1 overflow-y-auto p-1.5">
            {detail.events.map((event) => (
              <TrackingTimelineItem key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="p-2 text-xs font-medium text-slate-500">
            {text.orders.tracking.noEvents}
          </div>
        )}
      </div>
    </section>
  );
}

function TrackingFact({
  label,
  mono,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded border border-cyan-100 bg-white px-1.5 py-1">
      <div className="truncate text-[10px] font-black leading-none text-slate-400">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 truncate text-[12px] font-black leading-snug text-slate-950",
          mono && "font-mono"
        )}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function TrackingTimelineItem({ event }: { event: TrackingTimelineEvent }) {
  return (
    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-md border border-slate-100 bg-white px-2 py-1.5">
      <span
        className={cn(
          "mt-0.5 size-2 rounded-full",
          event.tone === "current"
            ? "bg-primary ring-4 ring-primary/10"
            : event.tone === "info"
              ? "bg-cyan-500 ring-4 ring-cyan-100"
              : "bg-emerald-500 ring-4 ring-emerald-100"
        )}
      />
      <div className="min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-xs font-black leading-tight text-slate-900">
              {event.title}
            </div>
            <div className="mt-0.5 break-words text-[11px] font-medium leading-snug text-slate-500">
              {event.description}
            </div>
          </div>
          <time className="shrink-0 text-right text-[10px] font-semibold leading-tight text-slate-400">
            {formatDisplayDate(event.createdAt)}
          </time>
        </div>
        <div className="mt-1 inline-flex items-center gap-1 rounded bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
          <Clock3 className="size-3" />
          {event.source}
        </div>
      </div>
    </div>
  );
}

function OrderPaymentMethodCard({
  canApproveWalletRefunds,
  canEditPayment,
  canReconcilePayment,
  compact = false,
  isMutating,
  labels,
  order,
  text,
  onApproveWalletRefund,
  onUpdatePayment,
  onUpdatePaymentMethod,
}: {
  canApproveWalletRefunds: boolean;
  canEditPayment: boolean;
  canReconcilePayment: boolean;
  compact?: boolean;
  isMutating: boolean;
  labels: OrderLabels;
  order: AdminOrder;
  text: AdminText;
  onApproveWalletRefund: (order: AdminOrder, refund: WalletRefundRequest) => void;
  onUpdatePayment: (order: AdminOrder, patch: OrderPaymentPatchInput) => void;
  onUpdatePaymentMethod: (order: AdminOrder, paymentMethod: PaymentMethod) => void;
}) {
  const [paymentMethodDraft, setPaymentMethodDraft] = React.useState<PaymentMethod>(
    order.paymentMethod
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [statusDraft, setStatusDraft] = React.useState<PaymentStatus>("paid");
  const [reconciliationMethodDraft, setReconciliationMethodDraft] =
    React.useState<PaymentMethod>(order.paymentMethod);
  const [amountDraft, setAmountDraft] = React.useState(() =>
    formatPaymentAmountInput(defaultPaymentReconciliationAmount(order, "paid"))
  );
  const [receivedAtDraft, setReceivedAtDraft] = React.useState(() =>
    toDateTimeLocalInput(order.paymentReconciliation.receivedAt ?? new Date().toISOString())
  );
  const [referenceDraft, setReferenceDraft] = React.useState(
    order.paymentReconciliation.reference
  );
  const [noteDraft, setNoteDraft] = React.useState(order.paymentReconciliation.note);
  const amountValue = parsePaymentAmountInput(amountDraft);
  const requiresReversalNote = order.paymentStatus === "paid" && statusDraft !== "paid";
  const receivedAtIsValid =
    statusDraft !== "paid" || Number.isFinite(Date.parse(receivedAtDraft));
  const canSaveReconciliation =
    canReconcilePayment &&
    !isMutating &&
    (statusDraft !== "paid" || amountValue !== null) &&
    receivedAtIsValid &&
    (!requiresReversalNote || noteDraft.trim().length > 0);
  const canSave =
    canEditPayment &&
    !isMutating &&
    paymentMethodDraft !== order.paymentMethod;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSave) {
      return;
    }

    onUpdatePaymentMethod(order, paymentMethodDraft);
  }

  function openReconciliationDialog(nextStatus: PaymentStatus) {
    setStatusDraft(nextStatus);
    setReconciliationMethodDraft(order.paymentMethod);
    setAmountDraft(
      formatPaymentAmountInput(defaultPaymentReconciliationAmount(order, nextStatus))
    );
    setReceivedAtDraft(
      toDateTimeLocalInput(order.paymentReconciliation.receivedAt ?? new Date().toISOString())
    );
    setReferenceDraft(order.paymentReconciliation.reference);
    setNoteDraft(order.paymentReconciliation.note);
    setDialogOpen(true);
  }

  function handleReconciliationSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSaveReconciliation) {
      return;
    }

    onUpdatePayment(order, {
      paymentMethod: reconciliationMethodDraft,
      paymentStatus: statusDraft,
      receivedAmount: statusDraft === "paid" ? amountValue ?? undefined : undefined,
      receivedAt:
        statusDraft === "paid" && receivedAtDraft
          ? new Date(receivedAtDraft).toISOString()
          : undefined,
      reference: referenceDraft.trim() || undefined,
      note: noteDraft.trim() || undefined,
    });
    setDialogOpen(false);
  }

  const collectorLabel =
    order.paymentReconciliation.receivedBy?.label ??
    order.paymentReconciliation.receivedBy?.email ??
    text.common.none;
  const receivedAmountLabel =
    order.paymentReconciliation.receivedAmount !== null
      ? formatEuro(order.paymentReconciliation.receivedAmount)
      : text.common.none;
  const receivedAtLabel = order.paymentReconciliation.receivedAt
    ? formatDisplayDate(order.paymentReconciliation.receivedAt)
    : text.common.none;
  const walletRefundSummary = summarizeWalletRefunds(order.walletRefunds);
  const paymentInfoRows = [
    {
      label: text.orders.details.paymentMethod,
      value: labels.paymentMethod[order.paymentMethod],
      show: true,
    },
    {
      label: text.orders.paymentAmountDue,
      value: order.paymentDueAmount > 0 ? formatEuro(order.paymentDueAmount) : text.common.none,
      show: true,
    },
    {
      label: text.orders.paymentReceivedAmount,
      value: receivedAmountLabel,
      show: !compact || order.paymentReconciliation.receivedAmount !== null,
    },
    {
      label: text.orders.paymentReceivedBy,
      value: collectorLabel,
      show: !compact || collectorLabel !== text.common.none,
    },
    {
      label: text.orders.paymentReceivedAt,
      value: receivedAtLabel,
      show: !compact || Boolean(order.paymentReconciliation.receivedAt),
    },
    {
      label: text.orders.paymentReference,
      value: order.paymentReconciliation.reference || text.common.none,
      show: !compact || Boolean(order.paymentReconciliation.reference),
    },
    {
      label: text.orders.paymentNote,
      value: order.paymentReconciliation.note || text.common.none,
      show: !compact || Boolean(order.paymentReconciliation.note),
    },
    {
      label: text.orders.walletRefundPending,
      value: formatEuro(walletRefundSummary.pendingAmount),
      show: walletRefundSummary.pendingAmount > 0,
    },
    {
      label: text.orders.walletRefundCredited,
      value: formatEuro(walletRefundSummary.creditedAmount),
      show: walletRefundSummary.creditedAmount > 0,
    },
  ].filter((row) => row.show);

  function renderPaymentDialog() {
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[520px] rounded-lg bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-950">
              {text.orders.paymentReconciliation}
            </DialogTitle>
            <DialogDescription>
              {formatAdminMessage(text.orders.paymentDialogDescription, {
                amount: formatEuro(order.total),
                id: order.id,
              })}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={handleReconciliationSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="min-w-0">
                <span className="mb-1 block text-[10px] font-black uppercase leading-none text-slate-400">
                  {text.orders.paymentStatus}
                </span>
                <Select
                  value={statusDraft}
                  onValueChange={(value) => setStatusDraft(normalizePaymentStatusValue(value))}
                  disabled={!canReconcilePayment || isMutating}
                >
                  <SelectTrigger className="h-9 rounded-md border-slate-200 bg-white text-xs font-bold text-slate-900 sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["unpaid", "authorized", "paid", "refunded"] as PaymentStatus[]).map((status) => (
                      <SelectItem key={status} value={status}>
                        {labels.payment[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="min-w-0">
                <span className="mb-1 block text-[10px] font-black uppercase leading-none text-slate-400">
                  {text.orders.details.paymentMethod}
                </span>
                <Select
                  value={reconciliationMethodDraft}
                  onValueChange={(value) => setReconciliationMethodDraft(normalizePaymentMethodValue(value))}
                  disabled={!canReconcilePayment || isMutating}
                >
                  <SelectTrigger className="h-9 rounded-md border-slate-200 bg-white text-xs font-bold text-slate-900 sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethodOptions.map((paymentMethod) => (
                      <SelectItem key={paymentMethod} value={paymentMethod}>
                        {labels.paymentMethod[paymentMethod]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="min-w-0">
                <span className="mb-1 block text-[10px] font-black uppercase leading-none text-slate-400">
                  {text.orders.paymentReceivedAmount}
                </span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountDraft}
                  onChange={(event) => setAmountDraft(event.target.value)}
                  disabled={statusDraft !== "paid" || !canReconcilePayment || isMutating}
                  className="h-9 rounded-md text-xs font-bold sm:text-sm"
                />
              </label>
              <label className="min-w-0">
                <span className="mb-1 block text-[10px] font-black uppercase leading-none text-slate-400">
                  {text.orders.paymentReceivedAt}
                </span>
                <Input
                  type="datetime-local"
                  value={receivedAtDraft}
                  onChange={(event) => setReceivedAtDraft(event.target.value)}
                  disabled={statusDraft !== "paid" || !canReconcilePayment || isMutating}
                  className="h-9 rounded-md text-xs font-bold sm:text-sm"
                />
              </label>
            </div>
            <label className="block min-w-0">
              <span className="mb-1 block text-[10px] font-black uppercase leading-none text-slate-400">
                {text.orders.paymentReference}
              </span>
              <Input
                value={referenceDraft}
                onChange={(event) => setReferenceDraft(event.target.value)}
                disabled={!canReconcilePayment || isMutating}
                className="h-9 rounded-md text-xs font-bold sm:text-sm"
              />
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-[10px] font-black uppercase leading-none text-slate-400">
                {text.orders.paymentNote}
              </span>
              <Textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                disabled={!canReconcilePayment || isMutating}
                className="min-h-20 rounded-md text-xs font-bold sm:text-sm"
              />
            </label>
            {requiresReversalNote && noteDraft.trim().length === 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-700">
                {text.orders.paymentReversalNoteRequired}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="rounded-md"
                onClick={() => setDialogOpen(false)}
              >
                {text.common.cancel}
              </Button>
              <Button type="submit" className="rounded-md" disabled={!canSaveReconciliation}>
                {isMutating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                <span className="truncate">{text.common.saveChanges}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  if (compact) {
    const primaryAmountLabel =
      order.paymentStatus === "paid"
        ? receivedAmountLabel
        : order.paymentDueAmount > 0
          ? formatEuro(order.paymentDueAmount)
          : text.common.none;
    const primaryAmountTitle =
      order.paymentStatus === "paid"
        ? text.orders.paymentReceivedAmount
        : text.orders.paymentAmountDue;
    const compactRows = [
      {
        label: text.orders.details.paymentMethod,
        value: labels.paymentMethod[order.paymentMethod],
        show: true,
      },
      {
        label: text.orders.paymentReceivedBy,
        value: collectorLabel,
        show: collectorLabel !== text.common.none,
      },
      {
        label: text.orders.paymentReceivedAt,
        value: receivedAtLabel,
        show: Boolean(order.paymentReconciliation.receivedAt),
      },
      {
        label: text.orders.paymentReference,
        value: order.paymentReconciliation.reference || text.common.none,
        show: Boolean(order.paymentReconciliation.reference),
      },
      {
        label: text.orders.paymentNote,
        value: order.paymentReconciliation.note || text.common.none,
        show: Boolean(order.paymentReconciliation.note),
      },
      {
        label: text.orders.walletRefundPending,
        value: formatEuro(walletRefundSummary.pendingAmount),
        show: walletRefundSummary.pendingAmount > 0,
      },
      {
        label: text.orders.walletRefundCredited,
        value: formatEuro(walletRefundSummary.creditedAmount),
        show: walletRefundSummary.creditedAmount > 0,
      },
    ].filter((row) => row.show);

    return (
      <section className="rounded-md border border-slate-200 bg-white p-1.5">
        <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-xs font-black text-slate-900">
            <CreditCard className="size-3.5 shrink-0 text-primary" />
            <span className="truncate">{text.orders.paymentReconciliation}</span>
          </div>
          <Badge className={paymentBadgeClass(order.paymentStatus)} variant="outline">
            {labels.payment[order.paymentStatus]}
          </Badge>
        </div>
        <div className="mb-1.5 rounded-md border border-primary/10 bg-primary/5 px-2 py-2">
          <div className="text-[10px] font-black uppercase leading-none text-primary/70">
            {primaryAmountTitle}
          </div>
          <div className="mt-1 text-lg font-black leading-none text-slate-950">
            {primaryAmountLabel}
          </div>
        </div>
        <div className="grid gap-1 rounded-md border border-slate-100 bg-slate-50/60 p-1.5">
          {compactRows.map((row) => (
            <InfoRow key={row.label} label={row.label} value={row.value} />
          ))}
        </div>
        <OrderWalletRefundsCard
          compact
          canApproveWalletRefunds={canApproveWalletRefunds}
          isMutating={isMutating}
          order={order}
          text={text}
          onApproveWalletRefund={onApproveWalletRefund}
        />
        <div className="mt-2 grid gap-1.5">
          <Button
            type="button"
            size="sm"
            className="w-full rounded-md"
            disabled={!canReconcilePayment || isMutating}
            onClick={() => openReconciliationDialog("paid")}
          >
            {order.paymentStatus === "paid" ? (
              <Pencil className="size-3.5" />
            ) : (
              <BadgeCheck className="size-3.5" />
            )}
            <span className="truncate">
              {order.paymentStatus === "paid"
                ? text.orders.modifyPaymentReconciliation
                : hasSupplementalPaymentDue(order)
                  ? text.orders.markSupplementPaymentReceived
                  : text.orders.markPaymentReceived}
            </span>
          </Button>
          {order.paymentStatus === "paid" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full rounded-md text-amber-700 hover:text-amber-700"
              disabled={!canReconcilePayment || isMutating}
              onClick={() => openReconciliationDialog("unpaid")}
            >
              <RotateCcw className="size-3.5" />
              <span className="truncate">{text.orders.undoPaymentReceived}</span>
            </Button>
          )}
        </div>
        {renderPaymentDialog()}
      </section>
    );
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-2 sm:p-2.5">
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-black text-slate-900 sm:text-sm">
          <CreditCard className="size-3.5 shrink-0 text-primary" />
          <span className="truncate">{text.orders.paymentReconciliation}</span>
        </div>
        <Badge className={paymentBadgeClass(order.paymentStatus)} variant="outline">
          {labels.payment[order.paymentStatus]}
        </Badge>
      </div>
      <div
        className="mb-2 grid gap-1 rounded-md border border-slate-100 bg-slate-50/60 p-1.5 text-xs sm:grid-cols-2"
      >
        {paymentInfoRows.map((row) =>
          <InfoRow key={row.label} label={row.label} value={row.value} />
        )}
      </div>
      <form
        className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
        onSubmit={handleSubmit}
      >
        <label className="min-w-0">
          <span className="mb-1 block text-[10px] font-black uppercase leading-none text-slate-400">
            {text.orders.details.paymentMethod}
          </span>
          <Select
            value={paymentMethodDraft}
            onValueChange={(value) => setPaymentMethodDraft(normalizePaymentMethodValue(value))}
            disabled={!canEditPayment || isMutating}
          >
            <SelectTrigger className="h-9 w-full rounded-md border-slate-200 bg-white text-xs font-bold text-slate-900 sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paymentMethodOptions.map((paymentMethod) => (
                <SelectItem key={paymentMethod} value={paymentMethod}>
                  {labels.paymentMethod[paymentMethod]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <Button
          type="submit"
          size="sm"
          className="self-end rounded-md"
          disabled={!canSave}
        >
          {isMutating ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          <span className="truncate">{text.common.saveChanges}</span>
        </Button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">
        {order.paymentStatus !== "paid" && (
          <Button
            type="button"
            size="sm"
            className="rounded-md"
            disabled={!canReconcilePayment || isMutating}
            onClick={() => openReconciliationDialog("paid")}
          >
            <BadgeCheck className="size-3.5" />
            <span className="truncate">
              {hasSupplementalPaymentDue(order)
                ? text.orders.markSupplementPaymentReceived
                : text.orders.markPaymentReceived}
            </span>
          </Button>
        )}
        {order.paymentStatus === "paid" && (
          <>
            <Button
              type="button"
              size="sm"
              className="rounded-md"
              disabled={!canReconcilePayment || isMutating}
              onClick={() => openReconciliationDialog("paid")}
            >
              <Pencil className="size-3.5" />
              <span className="truncate">{text.orders.modifyPaymentReconciliation}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-md text-amber-700 hover:text-amber-700"
              disabled={!canReconcilePayment || isMutating}
              onClick={() => openReconciliationDialog("unpaid")}
            >
              <RotateCcw className="size-3.5" />
              <span className="truncate">{text.orders.undoPaymentReceived}</span>
            </Button>
          </>
        )}
      </div>
      <OrderWalletRefundsCard
        canApproveWalletRefunds={canApproveWalletRefunds}
        isMutating={isMutating}
        order={order}
        text={text}
        onApproveWalletRefund={onApproveWalletRefund}
      />
      {renderPaymentDialog()}
    </section>
  );
}

function OrderWalletRefundsCard({
  canApproveWalletRefunds,
  compact = false,
  isMutating,
  order,
  text,
  onApproveWalletRefund,
}: {
  canApproveWalletRefunds: boolean;
  compact?: boolean;
  isMutating: boolean;
  order: AdminOrder;
  text: AdminText;
  onApproveWalletRefund: (order: AdminOrder, refund: WalletRefundRequest) => void;
}) {
  if (order.walletRefunds.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "mt-2 rounded-md border border-slate-100 bg-slate-50/70",
        compact ? "p-1.5" : "p-2"
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="min-w-0 text-[11px] font-black uppercase leading-none text-slate-400">
          {text.orders.walletRefundRequests}
        </div>
        <Badge variant="outline" className="h-5 bg-white px-1.5 text-[10px]">
          {order.walletRefunds.length}
        </Badge>
      </div>
      <div className="grid gap-1">
        {order.walletRefunds.map((refund) => {
          const canApprove =
            canApproveWalletRefunds &&
            refund.status === "requested" &&
            !isMutating;

          return (
            <div
              key={refund.id}
              className="grid min-w-0 gap-1 rounded-md border border-slate-100 bg-white px-2 py-1.5"
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-black text-slate-950">
                    {formatEuro(refund.amount)}
                  </div>
                  <div className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">
                    {refund.reason || text.common.none}
                  </div>
                </div>
                <Badge className={walletRefundBadgeClass(refund.status)}>
                  {walletRefundStatusLabel(refund.status, text)}
                </Badge>
              </div>
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="truncate text-[10px] font-semibold text-slate-400">
                  {refund.requestedAt ? formatDisplayDate(refund.requestedAt) : refund.id}
                </span>
                {canApprove ? (
                  <Button
                    type="button"
                    size="xs"
                    className="h-7 shrink-0 rounded-md px-2"
                    onClick={() => onApproveWalletRefund(order, refund)}
                  >
                    <BadgeCheck className="size-3" />
                    {text.orders.walletRefundApprove}
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderLogisticsCard({
  canAdjustShipping,
  canEditLogistics,
  compact = false,
  isMutating,
  order,
  text,
  trackingDetail,
  trackingDetailsOpen,
  onRefreshTrackingDetails,
  onToggleTrackingDetails,
  onAdjustShipping,
  onUpdateLogistics,
}: {
  canAdjustShipping: boolean;
  canEditLogistics: boolean;
  compact?: boolean;
  isMutating: boolean;
  order: AdminOrder;
  text: AdminText;
  trackingDetail: OrderTrackingDetail;
  trackingDetailsOpen: boolean;
  onRefreshTrackingDetails: () => void;
  onToggleTrackingDetails: () => void;
  onAdjustShipping: (order: AdminOrder, patch: OrderShippingPatchInput) => void;
  onUpdateLogistics: (order: AdminOrder, carrier: string, tracking: string) => void;
}) {
  const [carrierDraft, setCarrierDraft] = React.useState<Carrier>(order.carrier);
  const [trackingDraft, setTrackingDraft] = React.useState(order.tracking);
  const [shippingDialogOpen, setShippingDialogOpen] = React.useState(false);
  const [shippingAmountDraft, setShippingAmountDraft] = React.useState(() =>
    formatPaymentAmountInput(suggestedShippingAmount(order))
  );
  const [shippingReasonDraft, setShippingReasonDraft] = React.useState("");
  const [shippingNoteDraft, setShippingNoteDraft] = React.useState("");

  const pickup = isPickupCarrier(carrierDraft);
  const orderPickup = isPickupCarrier(order.carrier);
  const normalizedTrackingDraft = pickup ? "" : trackingDraft.trim();
  const trackingUrl = buildCarrierTrackingUrl(carrierDraft, normalizedTrackingDraft);
  const shippingAmountValue = parsePaymentAmountInput(shippingAmountDraft);
  const shippingAdjustmentSuggestedAmount = suggestedShippingAmount(order);
  const needsShippingAdjustment =
    !pickup &&
    !orderPickup &&
    order.shipping <= 0 &&
    shippingAdjustmentSuggestedAmount > 0;
  const hasLogisticsChanges =
    carrierDraft !== order.carrier ||
    normalizedTrackingDraft !== (isPickupCarrier(order.carrier) ? "" : order.tracking.trim());
  const canSave = canEditLogistics && hasLogisticsChanges && !isMutating;
  const canSaveShippingAdjustment =
    canAdjustShipping &&
    !isMutating &&
    shippingAmountValue !== null &&
    shippingAmountValue !== order.shipping &&
    shippingReasonDraft.trim().length > 0;

  const handleCarrierChange = React.useCallback((value: string) => {
    const nextCarrier = normalizeCarrierValue(value);
    setCarrierDraft(nextCarrier);

    if (nextCarrier === unassignedCarrier || isPickupCarrier(nextCarrier)) {
      setTrackingDraft("");
    }
  }, []);

  const handleSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!canSave) {
        return;
      }

      onUpdateLogistics(
        order,
        carrierDraft === unassignedCarrier ? "" : carrierDraft,
        normalizedTrackingDraft
      );
    },
    [canSave, carrierDraft, normalizedTrackingDraft, onUpdateLogistics, order]
  );

  const openShippingDialog = React.useCallback(() => {
    setShippingAmountDraft(formatPaymentAmountInput(shippingAdjustmentSuggestedAmount));
    setShippingReasonDraft(
      needsShippingAdjustment ? text.orders.shippingAdjustmentDefaultReason : ""
    );
    setShippingNoteDraft("");
    setShippingDialogOpen(true);
  }, [needsShippingAdjustment, shippingAdjustmentSuggestedAmount, text.orders.shippingAdjustmentDefaultReason]);

  const handleShippingAdjustmentSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!canSaveShippingAdjustment || shippingAmountValue === null) {
        return;
      }

      onAdjustShipping(order, {
        shippingAmount: shippingAmountValue,
        reason: shippingReasonDraft.trim(),
        note: shippingNoteDraft.trim() || undefined,
      });
      setShippingDialogOpen(false);
    },
    [
      canSaveShippingAdjustment,
      onAdjustShipping,
      order,
      shippingAmountValue,
      shippingNoteDraft,
      shippingReasonDraft,
    ]
  );

  return (
    <div
      className={cn(
        "min-w-0 rounded-md border border-slate-200 bg-white",
        compact ? "p-1.5" : "p-1.5 sm:p-2"
      )}
    >
      <div className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-900 sm:mb-2">
        <Truck className="size-4 text-primary" />
        {text.orders.details.logistics}
      </div>
      <div
        className={cn(
          "grid gap-1 text-xs text-slate-600",
          compact ? "grid-cols-2" : "sm:grid-cols-2 sm:text-sm xl:grid-cols-5"
        )}
      >
        <InfoRow label={text.common.service} value={orderValueLabel(text, order.service)} />
        <InfoRow label={text.common.eta} value={orderValueLabel(text, order.eta)} />
        <InfoRow label={text.common.owner} value={orderValueLabel(text, order.owner)} />
        <InfoRow
          label={text.orders.details.shipping}
          value={pickup ? text.orders.details.pickupFree : formatEuro(order.shipping)}
        />
        <InfoRow
          label={text.orders.details.deliveryAddress}
          value={order.shippingAddress}
        />
      </div>
      <form
        className="mt-1.5 grid gap-1.5 rounded-md border border-slate-100 bg-slate-50 p-1.5 sm:grid-cols-[minmax(160px,0.9fr)_minmax(180px,1.1fr)_auto] sm:items-end"
        onSubmit={handleSubmit}
      >
        <label className="min-w-0">
          <span className="mb-1 block text-[10px] font-black uppercase leading-none text-slate-400">
            {text.common.carrier}
          </span>
          <Select
            value={carrierDraft}
            onValueChange={handleCarrierChange}
            disabled={!canEditLogistics || isMutating}
          >
            <SelectTrigger className="h-9 w-full rounded-md border-slate-200 bg-white text-xs font-bold text-slate-900 sm:text-sm">
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
        </label>

        <label className="min-w-0">
          <span className="mb-1 block text-[10px] font-black uppercase leading-none text-slate-400">
            {text.orders.print.tracking}
          </span>
          <div className="flex min-w-0 items-center gap-1">
            <Input
              className="h-9 rounded-md border-slate-200 bg-white text-xs font-semibold sm:text-sm"
              disabled={
                !canEditLogistics ||
                isMutating ||
                carrierDraft === unassignedCarrier ||
                pickup
              }
              value={pickup ? "" : trackingDraft}
              placeholder={pickup ? text.common.none : text.orders.print.tracking}
              onChange={(event) => setTrackingDraft(event.target.value)}
            />
            {normalizedTrackingDraft && (
              <CopyValueButton
                className="shrink-0 bg-white"
                label={text.orders.print.tracking}
                text={text}
                value={normalizedTrackingDraft}
              />
            )}
          </div>
        </label>

        <div className="grid min-w-0 grid-cols-2 gap-1 sm:flex sm:w-fit sm:grid-cols-none">
          <Button
            type="submit"
            size="sm"
            className="min-w-0 rounded-md"
            disabled={!canSave}
          >
            {isMutating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            <span className="truncate">{text.common.saveChanges}</span>
          </Button>
          {trackingUrl ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="min-w-0 rounded-md bg-white"
            >
              <a href={trackingUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" />
                <span className="truncate">{text.orders.tracking.carrierPortal}</span>
              </a>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-w-0 rounded-md bg-white"
              disabled
            >
              <ExternalLink className="size-3.5" />
              <span className="truncate">{text.orders.tracking.carrierPortal}</span>
            </Button>
          )}
        </div>
      </form>
      {needsShippingAdjustment && (
        <div className="mt-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-800">
          {formatAdminMessage(text.orders.shippingAdjustmentPrompt, {
            amount: formatEuro(shippingAdjustmentSuggestedAmount),
          })}
        </div>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={needsShippingAdjustment ? "default" : "outline"}
          className="rounded-md"
          disabled={!canAdjustShipping || isMutating}
          onClick={openShippingDialog}
        >
          <Pencil className="size-3.5" />
          <span className="truncate">{text.orders.adjustShipping}</span>
        </Button>
        {order.paymentDueAmount > 0 && hasSupplementalPaymentDue(order) && (
          <span className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs font-bold text-amber-700">
            {formatAdminMessage(text.orders.paymentSupplementDue, {
              amount: formatEuro(order.paymentDueAmount),
            })}
          </span>
        )}
      </div>
      <ShipmentReadiness
        order={order}
        text={text}
        trackingDetailsOpen={trackingDetailsOpen}
        onToggleTrackingDetails={onToggleTrackingDetails}
      />
      {trackingDetailsOpen && (
        <div className="mt-1.5">
          <TrackingDetailsPanel
            detail={trackingDetail}
            text={text}
            onRefresh={onRefreshTrackingDetails}
          />
        </div>
      )}
      <Dialog open={shippingDialogOpen} onOpenChange={setShippingDialogOpen}>
        <DialogContent className="max-w-[520px] rounded-lg bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-950">
              {text.orders.adjustShipping}
            </DialogTitle>
            <DialogDescription>
              {formatAdminMessage(text.orders.shippingAdjustmentDialogDescription, {
                current: formatEuro(order.shipping),
                total: formatEuro(order.total),
              })}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={handleShippingAdjustmentSubmit}>
            <div className="grid gap-2 rounded-md border border-slate-100 bg-slate-50/70 p-2 text-xs sm:grid-cols-3">
              <InfoRow label={text.orders.currentShipping} value={formatEuro(order.shipping)} />
              <InfoRow
                label={text.orders.suggestedShipping}
                value={formatEuro(shippingAdjustmentSuggestedAmount)}
              />
              <InfoRow
                label={text.orders.newOrderTotal}
                value={
                  shippingAmountValue !== null
                    ? formatEuro(roundMoney(order.total - order.shipping + shippingAmountValue))
                    : text.common.none
                }
              />
            </div>
            <label className="block min-w-0">
              <span className="mb-1 block text-[10px] font-black uppercase leading-none text-slate-400">
                {text.orders.shippingAmount}
              </span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={shippingAmountDraft}
                onChange={(event) => setShippingAmountDraft(event.target.value)}
                disabled={!canAdjustShipping || isMutating}
                className="h-9 rounded-md text-xs font-bold sm:text-sm"
              />
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-[10px] font-black uppercase leading-none text-slate-400">
                {text.orders.shippingAdjustmentReason}
              </span>
              <Input
                value={shippingReasonDraft}
                onChange={(event) => setShippingReasonDraft(event.target.value)}
                disabled={!canAdjustShipping || isMutating}
                className="h-9 rounded-md text-xs font-bold sm:text-sm"
              />
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-[10px] font-black uppercase leading-none text-slate-400">
                {text.orders.paymentNote}
              </span>
              <Textarea
                value={shippingNoteDraft}
                onChange={(event) => setShippingNoteDraft(event.target.value)}
                disabled={!canAdjustShipping || isMutating}
                className="min-h-20 rounded-md text-xs font-bold sm:text-sm"
              />
            </label>
            {shippingReasonDraft.trim().length === 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-700">
                {text.orders.shippingAdjustmentReasonRequired}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="rounded-md"
                onClick={() => setShippingDialogOpen(false)}
              >
                {text.common.cancel}
              </Button>
              <Button type="submit" className="rounded-md" disabled={!canSaveShippingAdjustment}>
                {isMutating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                <span className="truncate">{text.common.saveChanges}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderLines({
  canEditLines = false,
  isMutating = false,
  lines,
  order,
  text,
  onUpdateLineFulfillment,
}: {
  canEditLines?: boolean;
  isMutating?: boolean;
  lines: OrderLine[];
  order?: AdminOrder;
  text: AdminText;
  onUpdateLineFulfillment?: (
    order: AdminOrder,
    line: OrderLine,
    patch: OrderLineFulfillmentInput
  ) => void;
}) {
  const [editingLine, setEditingLine] = React.useState<OrderLine | null>(null);
  const [actualQuantity, setActualQuantity] = React.useState("0");
  const [reason, setReason] = React.useState("");

  if (lines.length === 0) {
    return <EmptyState text={text} />;
  }

  const openEditor = (line: OrderLine) => {
    setEditingLine(line);
    setActualQuantity(String(line.pickedQty || line.billableQty || line.quantity));
    setReason("");
  };
  const refundSummary = order ? summarizeWalletRefunds(order.walletRefunds) : null;

  const submitEditor = () => {
    if (!editingLine || !order || !onUpdateLineFulfillment) {
      return;
    }

    const parsedQuantity = Number.parseInt(actualQuantity, 10);
    const safeQuantity = Number.isFinite(parsedQuantity)
      ? Math.max(0, Math.min(editingLine.quantity, parsedQuantity))
      : editingLine.quantity;

    if (safeQuantity < editingLine.quantity && reason.trim().length === 0) {
      return;
    }

    onUpdateLineFulfillment(order, editingLine, {
      actualQuantity: safeQuantity,
      reason: reason.trim() || undefined,
    });
    setEditingLine(null);
  };

  return (
    <div className="min-w-0">
      <div className="space-y-1 md:hidden">
        {lines.map((line) => (
          <div key={line.id} className="rounded-md border border-slate-200 bg-white p-1.5">
            <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-2">
              <OrderLineImage line={line} />
              <div className="min-w-0">
                <div className="break-words text-[13px] font-bold leading-tight text-slate-900 sm:text-sm">
                  {line.name}
                </div>
                <div className="mt-0.5 truncate font-mono text-[11px] text-slate-500 sm:text-xs">
                  {line.sku}
                </div>
                <div className="mt-1 truncate text-[11px] font-semibold text-slate-500">
                  {orderValueLabel(text, line.category)} · {line.batchCode || text.common.none}
                </div>
                <div className="mt-1.5 grid grid-cols-4 gap-1 text-xs max-[360px]:grid-cols-2">
                  <MobileFact label={text.orders.lines.quantity} value={`${line.quantity}`} />
                  <MobileFact label="实给" value={`${line.pickedQty || 0}`} />
                  <MobileFact label={text.orders.lines.reserved} value={`${line.reservedQty}`} />
                  <MobileFact label="缺货" value={`${line.cancelledQty}`} />
                </div>
                {refundSummary && lineShortageRefundAmount(line) > 0 ? (
                  <div className="mt-1 grid grid-cols-2 gap-1 text-xs">
                    <MobileFact
                      label={text.orders.walletRefundPending}
                      value={
                        refundSummary.pendingAmount > 0
                          ? formatEuro(lineShortageRefundAmount(line))
                          : text.common.none
                      }
                    />
                    <MobileFact
                      label={text.orders.walletRefundCredited}
                      value={
                        refundSummary.creditedAmount > 0
                          ? formatEuro(lineShortageRefundAmount(line))
                          : text.common.none
                      }
                    />
                  </div>
                ) : null}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <Badge className={orderLineOperationalBadgeClass(line)}>
                    {orderLineOperationalLabel(line)}
                  </Badge>
                  {canEditLines && order && onUpdateLineFulfillment ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="h-7 bg-white px-2"
                      disabled={isMutating}
                      onClick={() => openEditor(line)}
                    >
                      登记实给
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden min-w-0 overflow-hidden rounded-md border border-slate-200 md:block">
        <Table className="w-full table-fixed text-xs">
          <TableHeader className="bg-slate-50 [&_th]:h-8 [&_th]:px-1.5 [&_th]:text-xs">
            <TableRow>
              <TableHead className="w-[188px]">{text.common.sku}</TableHead>
              <TableHead className="min-w-0">{text.common.product}</TableHead>
              <TableHead className="w-[48px] text-center">{text.orders.lines.quantity}</TableHead>
              <TableHead className="w-[56px] text-center">实给</TableHead>
              <TableHead className="w-[64px] text-center">{text.orders.lines.reserved}</TableHead>
              <TableHead className="w-[64px] text-center">{text.orders.lines.fulfilled}</TableHead>
              <TableHead className="w-[82px] text-right">{text.common.price}</TableHead>
              <TableHead className="w-[84px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_td]:px-1.5 [&_td]:py-1.5">
            {lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="align-top font-mono text-xs font-semibold text-slate-600">
                  <div className="flex min-w-0 items-center gap-2">
                    <OrderLineImage line={line} className="size-14" />
                    <span className="min-w-0 break-all leading-tight">{line.sku}</span>
                  </div>
                </TableCell>
                <TableCell className="max-w-0 overflow-hidden align-top">
                  <div
                    className="min-w-0 truncate text-xs font-bold leading-tight text-slate-900"
                    title={line.name}
                  >
                    {line.name}
                  </div>
                  <div
                    className="mt-0.5 min-w-0 truncate text-[11px] leading-tight text-slate-500"
                    title={`${orderValueLabel(text, line.category)} · ${line.batchCode || text.common.none}`}
                  >
                    {orderValueLabel(text, line.category)} · {line.batchCode || text.common.none}
                  </div>
                </TableCell>
                <TableCell className="align-top text-center font-semibold">{line.quantity}</TableCell>
                <TableCell className="align-top text-center">
                  <Badge className={orderLineOperationalBadgeClass(line)}>
                    {line.pickedQty || 0}/{line.quantity}
                  </Badge>
                </TableCell>
                <TableCell className="align-top text-center">
                  <Badge className={reservationBadgeClass(line)}>
                    {line.reservedQty}/{line.quantity}
                  </Badge>
                </TableCell>
                <TableCell className="align-top text-center">
                  <Badge className={fulfilledBadgeClass(line)}>
                    {line.fulfilledQty}/{line.quantity}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap align-top text-right font-semibold">
                  {formatEuro(line.unitPrice)}
                </TableCell>
                <TableCell className="align-top text-right">
                  {canEditLines && order && onUpdateLineFulfillment ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="h-7 bg-white px-2"
                      disabled={isMutating}
                      onClick={() => openEditor(line)}
                    >
                      登记
                    </Button>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-400">
                      {orderLineOperationalLabel(line)}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={editingLine !== null} onOpenChange={(open) => !open && setEditingLine(null)}>
        <DialogContent className="max-w-[calc(100vw-1.5rem)] rounded-lg bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-black">登记实给数量</DialogTitle>
            <DialogDescription>
              少给数量会核销锁货库存，不会释放回可售库存；已付款银行转账订单会生成申请，审批通过后入账。
            </DialogDescription>
          </DialogHeader>
          {editingLine ? (
            <div className="space-y-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="line-clamp-2 text-sm font-black text-slate-900">
                  {editingLine.name}
                </div>
                <div className="mt-1 font-mono text-xs font-semibold text-slate-500">
                  {editingLine.sku}
                </div>
              </div>
              <div className="grid gap-1.5">
                <div className="text-xs font-black text-slate-500">实际给货数量</div>
                <Input
                  type="number"
                  min={0}
                  max={editingLine.quantity}
                  value={actualQuantity}
                  onChange={(event) => setActualQuantity(event.target.value)}
                />
                <div className="text-[11px] font-semibold text-slate-500">
                  订购 {editingLine.quantity} 件，少给需要填写原因。
                </div>
              </div>
              <div className="grid gap-1.5">
                <div className="text-xs font-black text-slate-500">缺货原因</div>
                <Textarea
                  value={reason}
                  placeholder="例如：仓库实盘为 0，锁货商品不存在。"
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingLine(null)}>
              {text.common.cancel}
            </Button>
            <Button type="button" onClick={submitEditor}>
              保存实给
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderLineImage({
  className,
  line,
}: {
  className?: string;
  line: OrderLine;
}) {
  const imageAlt = line.imageAlt || line.name;
  const fallbackImageUrl = React.useMemo(
    () => getExternalOrderLineImageFallbackUrl(line.imageUrl),
    [line.imageUrl]
  );
  const [failedImageUrls, setFailedImageUrls] = React.useState<string[]>([]);
  const primaryImageUrl = line.imageUrl ?? "";
  const imageUrl =
    primaryImageUrl && !failedImageUrls.includes(primaryImageUrl)
      ? primaryImageUrl
      : fallbackImageUrl && !failedImageUrls.includes(fallbackImageUrl)
        ? fallbackImageUrl
        : "";

  const handleImageError = React.useCallback(() => {
    setFailedImageUrls((currentUrls) => {
      if (!imageUrl || currentUrls.includes(imageUrl)) {
        return currentUrls;
      }

      return [...currentUrls, imageUrl];
    });
  }, [imageUrl]);

  return (
    <div
      className={cn(
        "relative grid size-[72px] shrink-0 place-items-center overflow-hidden rounded-md border border-slate-200 bg-white",
        className
      )}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={imageAlt}
          fill
          sizes="(min-width: 768px) 64px, 72px"
          quality={55}
          loading="lazy"
          decoding="async"
          className="object-contain p-0.5"
          onError={handleImageError}
        />
      ) : (
        <PackageCheck className="size-6 text-slate-300" />
      )}
    </div>
  );
}

function getExternalOrderLineImageFallbackUrl(imageUrl: string | undefined) {
  if (!imageUrl) {
    return "";
  }

  const imageId = imageUrl.match(/-(\d+)\.(?:png|jpe?g|webp|gif)(?:$|\?)/i)?.[1];

  return imageId
    ? `https://apiv2.mobilax.fr/v1.0/assets/images/products/id-image/${imageId}?size=bg`
    : "";
}

function getOrderLinePrintImageUrl(line: OrderLine) {
  return getExternalOrderLineImageFallbackUrl(line.imageUrl) || line.imageUrl || "";
}

function OrderNotesBanner({
  canEditStaffNote,
  isMutating,
  order,
  text,
  onUpdateStaffNote,
}: {
  canEditStaffNote: boolean;
  isMutating: boolean;
  order: AdminOrder;
  text: AdminText;
  onUpdateStaffNote: (order: AdminOrder, staffNote: string) => void;
}) {
  const customerNote =
    order.customerNote.trim() ||
    (!order.staffNote.trim() && !isGeneratedOperationNote(order.notes, order, text)
      ? order.notes.trim()
      : "");
  const staffNote = getDisplayStaffNote(order, text);
  const hasAnyNote = Boolean(customerNote || staffNote);

  return (
    <div
      className={cn(
        "min-w-0 rounded-md border px-2 py-1.5 shadow-[0_1px_0_rgba(15,23,42,0.04)] sm:px-2.5",
        hasAnyNote
          ? "border-amber-200 bg-amber-50 text-amber-950"
          : "border-slate-200 bg-white text-slate-500"
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Info
          className={cn(
            "mt-0.5 size-4 shrink-0",
            hasAnyNote ? "text-amber-600" : "text-slate-400"
          )}
        />
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "text-[11px] font-black leading-none",
              hasAnyNote ? "text-amber-700" : "text-slate-400"
            )}
          >
            {text.orders.details.orderNote}
          </div>
          <div className="mt-1 grid min-w-0 gap-1 sm:grid-cols-2">
            <NoteValue
              label={text.orders.details.customerNote}
              value={customerNote || text.common.none}
            />
            {canEditStaffNote ? (
              <StaffNoteEditor
                key={`${order.id}:${staffNote}`}
                isMutating={isMutating}
                order={order}
                staffNote={staffNote}
                text={text}
                onUpdateStaffNote={onUpdateStaffNote}
              />
            ) : (
              <NoteValue
                label={text.orders.details.staffNote}
                value={staffNote || text.common.none}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StaffNoteEditor({
  isMutating,
  order,
  staffNote,
  text,
  onUpdateStaffNote,
}: {
  isMutating: boolean;
  order: AdminOrder;
  staffNote: string;
  text: AdminText;
  onUpdateStaffNote: (order: AdminOrder, staffNote: string) => void;
}) {
  const [draft, setDraft] = React.useState(staffNote);
  const [isEditing, setIsEditing] = React.useState(false);
  const normalizedDraft = draft.trim();
  const hasChanges = normalizedDraft !== staffNote.trim();

  if (!isEditing) {
    return (
      <div className="min-w-0 rounded bg-white/75 px-1.5 py-1">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] font-black leading-none text-amber-700/80">
            {text.orders.details.staffNote}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isMutating}
            className="h-6 shrink-0 gap-1 rounded px-1.5 text-[10px] font-bold"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="size-3" />
            {text.common.edit}
          </Button>
        </div>
        <div className="mt-0.5 break-words font-mono text-[12px] font-black leading-snug text-slate-950">
          {staffNote || text.common.none}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded bg-white/75 px-1.5 py-1">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-black leading-none text-amber-700/80">
          {text.orders.details.staffNote}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isMutating}
            className="h-6 rounded px-1.5 text-[10px] font-bold text-slate-500"
            onClick={() => {
              setDraft(staffNote);
              setIsEditing(false);
            }}
          >
            <XCircle className="size-3" />
            {text.common.cancel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!hasChanges || isMutating}
            className="h-6 gap-1 rounded px-1.5 text-[10px] font-bold"
            onClick={() => {
              onUpdateStaffNote(order, draft);
              setIsEditing(false);
            }}
          >
            {isMutating ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Save className="size-3" />
            )}
            {text.common.saveChanges}
          </Button>
        </div>
      </div>
      <textarea
        value={draft}
        maxLength={1000}
        rows={2}
        disabled={isMutating}
        placeholder={text.common.none}
        onChange={(event) => setDraft(event.target.value)}
        className="mt-1 min-h-12 w-full resize-y rounded border border-amber-200/80 bg-white px-2 py-1 font-mono text-[12px] font-bold leading-snug text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-70"
      />
    </div>
  );
}

function NoteValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded bg-white/65 px-1.5 py-1">
      <div className="text-[10px] font-black leading-none text-amber-700/80">
        {label}
      </div>
      <div className="mt-0.5 break-words font-mono text-[12px] font-black leading-snug text-slate-950">
        {value}
      </div>
    </div>
  );
}

function getDisplayStaffNote(order: AdminOrder, text: AdminText) {
  const staffNote = order.staffNote.trim();

  return isGeneratedOperationNote(staffNote, order, text) ? "" : staffNote;
}

function isGeneratedOperationNote(note: string, order: AdminOrder, text: AdminText) {
  const normalized = normalizeGeneratedNoteToken(note);

  if (!normalized) {
    return false;
  }

  const labels = buildOrderLabels(text);
  const statusTokens = new Set(
    [
      ...Object.keys(labels.status),
      ...Object.values(labels.status),
      "新订单",
      "已接单",
      "拣货中",
      "已打包",
      "已发货",
      "已完成",
      "已取消",
      "submitted",
      "accepted",
      "picking",
      "packed",
      "shipped",
      "completed",
      "cancelled",
      "Nuovo ordine",
      "Accettato",
      "Picking",
      "Imballato",
      "Spedito",
      "Completato",
      "Annullato",
    ].map(normalizeGeneratedNoteToken)
  );
  const rollbackPrefixes = [
    `${text.orders.rollbackStatus}:`,
    "回滚状态:",
    "rollback status:",
    "ripristina stato:",
  ].map(normalizeGeneratedNoteToken);
  const exactOperationNotes = [
    text.orders.cancelOrder,
    text.orders.activity.staffNoteUpdated,
    "取消订单",
    "Annulla ordine",
    "Cancel order",
    "Admin order update",
    "Admin order status rollback",
    "Staff note updated",
  ].map(normalizeGeneratedNoteToken);

  if (exactOperationNotes.includes(normalized)) {
    return true;
  }

  const transitionParts = normalized.split("->").map((part) => part.trim());

  if (transitionParts.length === 2) {
    const fromStatus = stripGeneratedOperationPrefix(
      transitionParts[0],
      rollbackPrefixes
    );
    const toStatus = transitionParts[1];

    if (statusTokens.has(fromStatus) && statusTokens.has(toStatus)) {
      return true;
    }
  }

  const carrierPrefixes = [
    `${text.common.carrier}:`,
    "carrier:",
    "corriere:",
    "运输公司:",
    "配送服务:",
    "物流单号:",
    "tracking:",
    "codice tracking:",
    "numero tracking:",
  ].map(normalizeGeneratedNoteToken);

  if (carrierPrefixes.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }

  const carrier = normalizeGeneratedNoteToken(carrierLabel(order.carrier, text));

  return Boolean(carrier && normalized === carrier);
}

function normalizeGeneratedNoteToken(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function stripGeneratedOperationPrefix(value: string, prefixes: string[]) {
  const normalized = normalizeGeneratedNoteToken(value);
  const prefix = prefixes.find((candidate) => normalized.startsWith(candidate));

  return prefix ? normalized.slice(prefix.length).trim() : normalized;
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
  void waitForPrintAssets(printWindow).then(() => {
    printWindow.print();
  });
}

function waitForPrintAssets(printWindow: Window) {
  const images = Array.from(printWindow.document.images);
  const imagePromises = images.map(
    (image) =>
      new Promise<void>((resolve) => {
        if (image.complete) {
          resolve();
          return;
        }

        image.onload = () => resolve();
        image.onerror = () => resolve();
      })
  );
  const timeout = new Promise<void>((resolve) => {
    window.setTimeout(resolve, 1400);
  });

  return Promise.race([Promise.all(imagePromises).then(() => undefined), timeout]);
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
    .map((line, index) => {
      const imageUrl = getOrderLinePrintImageUrl(line);
      const imageAlt = line.imageAlt || line.name;

      return `
        <tr>
          <td class="check"><span></span></td>
          <td class="index">${index + 1}</td>
          <td class="photo">
            ${
              imageUrl
                ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageAlt)}" />`
                : `<span>${escapeHtml(printText.productImage)}</span>`
            }
          </td>
          <td class="sku">${escapeHtml(line.sku)}</td>
          <td>
            <div class="product">${escapeHtml(line.name)}</div>
            <div class="sub">${escapeHtml(orderValueLabel(text, line.category))}${
              line.batchCode ? ` · ${escapeHtml(line.batchCode)}` : ""
            }</div>
          </td>
          <td class="qty">${line.quantity}</td>
          <td class="actual"><span></span></td>
        </tr>
      `;
    })
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
    tr { break-inside: avoid; }
    .check { width: 28px; text-align: center; }
    .check span {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid #0f172a;
      border-radius: 3px;
    }
    .index { width: 28px; color: #64748b; font-weight: 800; text-align: center; }
    .photo { width: 58px; text-align: center; }
    .photo img {
      display: block;
      width: 46px;
      height: 46px;
      margin: 0 auto;
      object-fit: contain;
      border: 1px solid #dbe3ef;
      border-radius: 5px;
      background: #fff;
    }
    .photo span {
      display: grid;
      width: 46px;
      height: 46px;
      margin: 0 auto;
      place-items: center;
      border: 1px dashed #cbd5e1;
      border-radius: 5px;
      color: #94a3b8;
      font-size: 9px;
      font-weight: 800;
    }
    .sku { width: 112px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
    .qty { width: 58px; text-align: center; font-size: 15px; font-weight: 900; }
    .actual { width: 76px; text-align: center; }
    .actual span {
      display: inline-block;
      width: 46px;
      height: 24px;
      border: 2px solid #0f172a;
      border-radius: 5px;
      background: #fff;
    }
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
          <th class="photo">${escapeHtml(printText.productImage)}</th>
          <th class="sku">${escapeHtml(printText.sku)}</th>
          <th>${escapeHtml(printText.product)}</th>
          <th class="qty">${escapeHtml(printText.requestedQuantity)}</th>
          <th class="actual">${escapeHtml(printText.actualQuantity)}</th>
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
    <div className="min-w-0">
      <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
        <div className="text-[11px] font-black uppercase text-slate-400">
          {text.orders.details.operationHistory}
        </div>
        <Badge variant="outline" className="h-5 bg-white px-1.5 text-[10px]">
          {events.length || fallbackActivity.length}
        </Badge>
      </div>
      {events.length > 0 ? (
        <div className="max-h-[220px] overflow-y-auto pr-1 sm:max-h-[260px] xl:max-h-[360px]">
          {events.map((event, index) => {
            const actorName = activityActorPrimaryLabel(event, text);
            const actorSecondary = activityActorSecondaryLabel(event, actorName);
            const actorRole = event.actor.role
              ? adminRoleTemplateLabel(text, event.actor.role, event.actor.role)
              : null;

            return (
              <div key={event.id} className="relative flex min-w-0 gap-2 pb-2 last:pb-0">
                <div className="relative flex w-4 shrink-0 justify-center">
                  <span
                    className={cn(
                      "mt-3 h-2.5 w-2.5 rounded-full ring-4 ring-white",
                      activityDotClass(event.eventType)
                    )}
                  />
                  {index < events.length - 1 && (
                    <span className="absolute bottom-0 top-6 w-px bg-slate-200" />
                  )}
                </div>
                <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 shadow-sm">
                  <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
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
                    <time className="shrink-0 whitespace-nowrap text-[10px] font-bold text-slate-400 sm:text-right">
                      {formatDisplayDate(event.createdAt)}
                    </time>
                  </div>
                  <div className="mt-2 grid min-w-0 gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-[11px] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-400">
                        {text.activity.actor}
                      </div>
                      <div className="mt-0.5 break-words text-xs font-black text-slate-800">
                        {actorName}
                      </div>
                      {actorSecondary && (
                        <div className="mt-0.5 break-all text-[11px] font-semibold text-slate-500">
                          {actorSecondary}
                        </div>
                      )}
                    </div>
                    {actorRole && (
                      <span className="w-fit rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">
                        {actorRole}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : fallbackActivity.length > 0 ? (
        <div className="space-y-2">
          {fallbackActivity.map((activity) => (
            <div
              key={activity}
              className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600"
            >
              {orderActivityLineLabel(text, activity)}
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

function activityActorPrimaryLabel(event: OrderActivityEvent, text: AdminText) {
  const candidate =
    preferredActorText(event.actor.name) ??
    preferredActorText(event.actor.label) ??
    preferredActorText(event.actor.email) ??
    preferredActorText(event.actor.id) ??
    text.orders.activity.systemActor;

  return orderValueLabel(text, candidate, text.orders.activity.systemActor);
}

function activityActorSecondaryLabel(event: OrderActivityEvent, primaryLabel: string) {
  const email = preferredActorText(event.actor.email);
  const id = preferredActorText(event.actor.id);

  if (email && !sameText(email, primaryLabel)) {
    return email;
  }

  if (id && !sameText(id, primaryLabel)) {
    return shortActorId(id);
  }

  return null;
}

function preferredActorText(value: string | null | undefined) {
  const text = sanitizeSupplierText(value);

  if (!text || sameText(text, "System")) {
    return null;
  }

  return text;
}

function sameText(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function shortActorId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
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
        "rounded-md border bg-white px-2 py-1.5",
        cancelled ? "border-red-100 bg-red-50/40" : "border-slate-200"
      )}
      aria-label={`${labels.status[status]} ${progressValue}/5`}
    >
      <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
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
                    "absolute left-[-50%] top-2 h-0.5 w-full rounded-full bg-slate-200",
                    done && "bg-primary",
                    cancelled && "bg-red-100"
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
                  cancelled && "border-red-100 bg-white text-red-300"
                )}
              >
                {stepIndex}
              </span>
              <span
                className={cn(
                  "mt-0.5 block truncate text-[10px] font-semibold leading-tight text-slate-400",
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
  helper?: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-white p-2">
      <div className="truncate text-[11px] font-semibold uppercase leading-none text-slate-500">
        {label}
      </div>
      <div className="mt-1 break-words text-[13px] font-black leading-tight text-slate-900">
        {value}
      </div>
      {helper ? (
        <div className="mt-0.5 break-words text-[10px] leading-tight text-slate-500">{helper}</div>
      ) : null}
    </div>
  );
}

function ReservationBadge({
  compact = false,
  order,
  text,
}: {
  compact?: boolean;
  order: AdminOrder;
  text: AdminText;
}) {
  const hasReservation = order.reservedQty > 0 && isOpenReservedOrderStatus(order.status);
  const hasUnavailableReservation =
    order.reservedQty > 0 && order.status === "cancelled";
  const consumed = order.fulfilledQty > 0 && order.status === "completed";
  const className = cn(
    compact
      ? "h-5 shrink-0 rounded px-1.5 text-[11px] leading-none"
      : "border px-1.5 py-0.5 text-[11px]",
    order.reservationOverdue
      ? "border-red-200 bg-red-50 text-red-700"
      : hasUnavailableReservation
        ? "border-violet-200 bg-violet-50 text-violet-700"
        : order.reservationWarning
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : hasReservation
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : consumed
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-600"
  );

  return (
    <Badge className={className} title={reservationHelper(order, text)}>
      {reservationValue(order, text)}
    </Badge>
  );
}

function reservationValue(order: AdminOrder, text: AdminText) {
  if (order.reservationOverdue && order.reservedQty > 0) {
    return formatAdminMessage(text.orders.reservation.overdueValue, {
      count: order.reservedQty,
    });
  }

  if (order.reservedQty > 0 && isOpenReservedOrderStatus(order.status)) {
    return formatAdminMessage(text.orders.reservation.reservedValue, {
      count: order.reservedQty,
    });
  }

  if (order.reservedQty > 0 && order.status === "cancelled") {
    return formatAdminMessage(text.orders.reservation.heldValue, {
      count: order.reservedQty,
    });
  }

  if (order.fulfilledQty > 0 && order.status === "completed") {
    return formatAdminMessage(text.orders.reservation.consumedValue, {
      count: order.fulfilledQty,
    });
  }

  return text.orders.reservation.none;
}

function reservationHelper(order: AdminOrder, text: AdminText) {
  if (order.reservationOverdue && order.reservationAgeHours !== null) {
    return formatAdminMessage(text.orders.reservation.overdue, {
      hours: order.reservationAgeHours,
    });
  }

  if (order.reservationWarning && order.reservationAgeHours !== null) {
    return formatAdminMessage(text.orders.reservation.warning, {
      hours: order.reservationAgeHours,
    });
  }

  if (order.reservedQty > 0 && order.reservationAgeHours !== null) {
    return formatAdminMessage(text.orders.reservation.age, {
      hours: order.reservationAgeHours,
    });
  }

  if (order.fulfilledQty > 0 && order.status === "completed") {
    return text.orders.reservation.completed;
  }

  if (order.reservedQty > 0 && order.status === "cancelled") {
    return text.orders.reservation.held;
  }

  return text.orders.reservation.noneHelper;
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
    <div className="grid min-w-0 grid-cols-[70px_minmax(0,1fr)] gap-1">
      <span className="text-[11px] font-semibold uppercase text-slate-400">{label}</span>
      <span className="min-w-0 break-words text-[12px] font-medium leading-snug text-slate-700">{value}</span>
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
    sort: "operations_queue",
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

async function fetchWalletRefundsForOrderFromApi(
  orderId: string,
  text: AdminText,
  signal?: AbortSignal
) {
  const params = new URLSearchParams({
    limit: "50",
    offset: "0",
    orderId,
  });
  const path = `/api/admin/wallet-refunds?${params.toString()}`;
  const response = await fetch(path, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
    signal,
  });

  if (!response.ok) {
    const payload = await readJsonSafely(response);
    const message = readApiErrorMessage(payload, text);

    throw new Error(
      message ??
        formatAdminMessage(text.orders.notices.requestFailed, {
          method: "GET",
          path,
          status: response.status,
        })
    );
  }

  const payload = (await response.json()) as unknown;
  const rows = isRecord(payload) ? readArrayPayload(payload, ["data", "refunds"]) : null;

  return normalizeWalletRefunds(rows);
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

async function patchOrderInApi(
  orderId: string,
  patch: OrderPatchInput,
  text: AdminText
) {
  const encodedOrderId = encodeURIComponent(orderId);
  const useStatusEndpoint = isPlainStatusTransitionPatch(patch);
  const path = useStatusEndpoint
    ? `/api/admin/orders/${encodedOrderId}/status`
    : `/api/admin/orders/${encodedOrderId}`;
  const response = await fetch(path, {
    body: JSON.stringify(
      useStatusEndpoint
        ? serializeOrderStatusPatch(patch)
        : serializeOrderPatch(patch)
    ),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    const payload = await readJsonSafely(response);
    const message = readApiErrorMessage(payload, text);

    throw new Error(
      message ??
        formatAdminMessage(text.orders.notices.requestFailed, {
          method: "PATCH",
          path,
          status: response.status,
        })
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

async function voidOrderWithDangerAction(
  orderId: string,
  input: OrderDangerActionInput,
  text: AdminText
) {
  const encodedOrderId = encodeURIComponent(orderId);
  const path = `/api/admin/orders/${encodedOrderId}/danger-actions`;
  const response = await fetch(path, {
    body: JSON.stringify({
      action: "void_and_soft_delete",
      confirmOrderNo: input.confirmOrderNo,
      reason: input.reason,
    }),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const payload = await readJsonSafely(response);
    const message = readApiErrorMessage(payload, text);

    throw new Error(
      message ??
        formatAdminMessage(text.orders.notices.requestFailed, {
          method: "POST",
          path,
          status: response.status,
        })
    );
  }

  const payload = await readJsonSafely(response);
  const meta = isRecord(payload) && isRecord(payload.meta) ? payload.meta : {};
  const dangerAction = isRecord(meta.dangerAction)
    ? meta.dangerAction
    : isRecord(payload) && isRecord(payload.data) && isRecord(payload.data.dangerAction)
      ? payload.data.dangerAction
      : {};

  return {
    restoredQty:
      readNumber(readRecordValue(dangerAction, ["restored_qty", "restoredQty"])) ?? 0,
    walletRefundAmount:
      readNumber(readRecordValue(dangerAction, ["wallet_refund_amount", "walletRefundAmount"])) ??
      0,
    walletRefundRequestId:
      readString(
        readRecordValue(dangerAction, [
          "wallet_refund_request_id",
          "walletRefundRequestId",
        ])
      ) ??
      readString(
        readRecordValue(
          isRecord(meta.walletRefundRequest) ? meta.walletRefundRequest : null,
          ["id"]
        )
      ),
  };
}

async function patchWalletRefundApprovalInApi(
  refundId: string,
  decision: "approve" | "reject",
  text: AdminText
) {
  const path = `/api/admin/wallet-refunds/${encodeURIComponent(refundId)}`;
  const response = await fetch(path, {
    body: JSON.stringify({ decision }),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    const payload = await readJsonSafely(response);
    const message = readApiErrorMessage(payload, text);

    throw new Error(
      message ??
        formatAdminMessage(text.orders.notices.requestFailed, {
          method: "PATCH",
          path,
          status: response.status,
        })
    );
  }

  const payload = await readJsonSafely(response);
  const row = extractOrderPayload(payload);
  const refund = normalizeWalletRefund(row);

  if (!refund) {
    throw new Error("PATCH /api/admin/wallet-refunds returned an incomplete refund request");
  }

  return refund;
}

async function patchOrderPaymentInApi(
  orderId: string,
  patch: OrderPaymentPatchInput,
  text: AdminText
) {
  const encodedOrderId = encodeURIComponent(orderId);
  const path = `/api/admin/orders/${encodedOrderId}/payment`;
  const response = await fetch(path, {
    body: JSON.stringify(serializeOrderPaymentPatch(patch)),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    const payload = await readJsonSafely(response);
    const message = readApiErrorMessage(payload, text);

    throw new Error(
      message ??
        formatAdminMessage(text.orders.notices.requestFailed, {
          method: "PATCH",
          path,
          status: response.status,
        })
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

async function patchOrderShippingInApi(
  orderId: string,
  patch: OrderShippingPatchInput,
  text: AdminText
) {
  const encodedOrderId = encodeURIComponent(orderId);
  const path = `/api/admin/orders/${encodedOrderId}/shipping`;
  const response = await fetch(path, {
    body: JSON.stringify(serializeOrderShippingPatch(patch)),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    const payload = await readJsonSafely(response);
    const message = readApiErrorMessage(payload, text);

    throw new Error(
      message ??
        formatAdminMessage(text.orders.notices.requestFailed, {
          method: "PATCH",
          path,
          status: response.status,
        })
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

async function patchOrderLineFulfillmentInApi(
  orderId: string,
  lineId: string,
  patch: OrderLineFulfillmentInput,
  text: AdminText
) {
  const encodedOrderId = encodeURIComponent(orderId);
  const path = `/api/admin/orders/${encodedOrderId}/lines/${encodeURIComponent(lineId)}/fulfillment`;
  const response = await fetch(path, {
    body: JSON.stringify(patch),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const payload = await readJsonSafely(response);
    const message = readApiErrorMessage(payload, text);

    throw new Error(
      message ??
        formatAdminMessage(text.orders.notices.requestFailed, {
          method: "POST",
          path,
          status: response.status,
        })
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
    readRecordValue(row, ["paymentStatus", "payment_status"])
  );
  const fulfillmentStatus = normalizeFulfillmentStatusValue(
    readRecordValue(row, ["fulfillmentStatus", "fulfillment_status"]),
    status
  );
  const rawLines = readArrayPayload(row, ["lines", "orderLines", "items"]) ?? [];
  const lines = rawLines
    .map((line, index) => normalizeOrderLine(line, fulfillmentStatus, index))
    .filter((line): line is OrderLine => line !== null);
  const lineReservedQty = lines.reduce((total, line) => total + line.reservedQty, 0);
  const lineFulfilledQty = lines.reduce((total, line) => total + line.fulfilledQty, 0);
  const reservedQty =
    readNumber(readRecordValue(row, ["reservedQty", "reserved_qty"])) ??
    lineReservedQty;
  const fulfilledQty =
    readNumber(readRecordValue(row, ["fulfilledQty", "fulfilled_qty"])) ??
    lineFulfilledQty;
  const lockedSince =
    readString(readRecordValue(row, ["lockedSince", "locked_since"])) ??
    (reservedQty > 0 && isOpenReservedOrderStatus(status) ? createdAt : null);
  const reservationAgeHours =
    readNumber(readRecordValue(row, ["reservationAgeHours", "reservation_age_hours"])) ??
    (lockedSince ? hoursSinceIso(lockedSince) : null);
  const reservationWarning =
    readBoolean(readRecordValue(row, ["reservationWarning", "reservation_warning"])) ||
    (reservationAgeHours !== null &&
      reservationAgeHours >= 72 &&
      isOpenReservedOrderStatus(status));
  const reservationOverdue =
    readBoolean(readRecordValue(row, ["reservationOverdue", "reservation_overdue"])) ||
    (reservationAgeHours !== null &&
      reservationAgeHours >= 14 * 24 &&
      isOpenReservedOrderStatus(status));
  const itemCount =
    readNumber(readRecordValue(row, ["items", "itemCount", "items_count"])) ??
    lines.reduce((total, line) => total + line.quantity, 0);
  const total = readMoney(
    readRecordValue(row, ["total", "totalAmount", "total_amount", "grandTotal"]) ??
      readRecordValue(totalsRecord, ["total", "gross", "grandTotal", "grand_total"])
  );
  const totalNet = readMoney(
    readRecordValue(row, ["totalNet", "total_net"]) ??
      readRecordValue(totalsRecord, ["totalNet", "total_net", "subtotal", "net"])
  );
  const vat = readMoney(
    readRecordValue(row, ["vat"]) ?? readRecordValue(totalsRecord, ["vat", "tax"])
  );
  const shipping = readMoney(
    readRecordValue(row, ["shipping", "shippingAmount", "shipping_amount"]) ??
      readRecordValue(totalsRecord, ["shipping", "shippingAmount", "shipping_amount"])
  );
  const warehouse = normalizeWarehouseValue(
    readRecordValue(row, ["warehouse"]) ??
      readRecordValue(shippingRecord, ["warehouse"])
  );
  const customer = normalizeCustomerSnapshot(customerRecord, company);
  const operationHistory = normalizeOperationHistory(
    readArrayPayload(row, ["operationHistory", "operation_history", "events"])
  );
  const walletRefunds = normalizeWalletRefunds(
    readArrayPayload(row, ["walletRefunds", "wallet_refunds", "walletRefundRequests"])
  );
  const customerNote =
    readString(readRecordValue(row, ["customerNote", "customer_note"])) ?? "";
  const staffNote =
    readString(readRecordValue(row, ["staffNote", "staff_note", "internalNote", "internal_note"])) ??
    "";
  const legacyNote = readString(row.notes) ?? "";
  const paymentReconciliation = normalizePaymentReconciliation(
    readRecordValue(row, ["paymentReconciliation", "payment_reconciliation"])
  );
  const walletAppliedAmount = readMoney(readRecordValue(row, ["walletAppliedAmount", "wallet_applied_amount"]));
  const receivedAmountForDue =
    (paymentReconciliation.receivedAmount ??
      (paymentStatus === "paid" && walletAppliedAmount <= 0 ? total : 0)) +
    walletAppliedAmount;
  const paymentOverpaidAmount =
    readMoney(readRecordValue(row, ["paymentOverpaidAmount", "payment_overpaid_amount"])) ??
    Math.max(0, roundMoney(receivedAmountForDue - total));
  const paymentDueAmountValue = readRecordValue(row, [
    "paymentDueAmount",
    "payment_due_amount",
  ]);
  const paymentDueAmount =
    paymentDueAmountValue !== undefined
      ? readMoney(paymentDueAmountValue)
      : Math.max(0, roundMoney(total - receivedAmountForDue));

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
    totalNet,
    vat,
    shipping,
    items: itemCount,
    paymentStatus,
    fulfillmentStatus,
    priority: normalizePriorityValue(row.priority, status, index),
    customer,
    paymentMethod: normalizePaymentMethodValue(
      readRecordValue(row, ["paymentMethod", "payment_method"])
    ),
    paymentDue:
      readString(readRecordValue(row, ["paymentDue", "payment_due", "dueDate"])) ??
      (paymentStatus === "paid" ? "Pagato" : "Da verificare"),
    paymentDueAmount,
    paymentOverpaidAmount,
    walletAppliedAmount,
    softDeletedAt: readString(readRecordValue(row, ["softDeletedAt", "soft_deleted_at"])),
    softDeletedBy: readString(readRecordValue(row, ["softDeletedBy", "soft_deleted_by"])),
    dangerActionType:
      readString(readRecordValue(row, ["dangerActionType", "danger_action_type"])) ?? "",
    dangerActionReason:
      readString(readRecordValue(row, ["dangerActionReason", "danger_action_reason"])) ?? "",
    dangerActionMetadata:
      readRecordValue(row, ["dangerActionMetadata", "danger_action_metadata"]) ?? {},
    paymentReconciliation,
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
    customerNote,
    staffNote,
    notes:
      legacyNote ||
      staffNote ||
      customerNote ||
      `Ordine importato da /api/admin/orders (${sourceLabel(source)})`,
    reservedQty,
    fulfilledQty,
    lockedSince,
    reservationAgeHours,
    reservationOverdue,
    reservationWarning,
    lines,
    walletRefunds,
    activity: normalizeActivity(row.activity, date, source, operationHistory),
    operationHistory,
  };
}

function normalizeOrderLine(
  row: unknown,
  fulfillmentStatus: FulfillmentStatus,
  index: number
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
    (fulfillmentStatus === "delivered"
      ? quantity
      : 0);
  const reservedQty =
    readNumber(readRecordValue(row, ["reservedQty", "reserved_qty"])) ??
    (fulfilledQty > 0
      ? 0
      : fulfillmentStatus === "allocated" ||
          fulfillmentStatus === "picking" ||
          fulfillmentStatus === "packed" ||
          fulfillmentStatus === "shipped"
        ? quantity
        : 0);
  const picked =
    readNumber(readRecordValue(row, ["picked", "pickedQuantity", "picked_quantity"])) ??
    fulfilledQty ??
    reservedQty;
  const cancelledQty =
    readNumber(readRecordValue(row, ["cancelledQty", "cancelled_qty"])) ??
    readNumber(readRecordValue(row, ["shortageQty", "shortage_qty"])) ??
    0;
  const pickedQty =
    readNumber(readRecordValue(row, ["pickedQty", "picked_qty"])) ??
    picked;
  const billableQty =
    readNumber(readRecordValue(row, ["billableQty", "billable_qty"])) ??
    Math.max(0, quantity - cancelledQty);

  return {
    id: readString(readRecordValue(row, ["id", "lineId", "line_id", "orderLineId", "order_line_id"])) ?? `${sku}:${index}`,
    sku,
    name:
      readString(readRecordValue(row, ["name", "productName", "product_name"])) ??
      readString(readRecordValue(product, ["name"])) ??
      "Prodotto ordine",
    imageUrl:
      readString(readRecordValue(row, ["imageUrl", "image_url", "productImageUrl", "product_image_url"])) ??
      readString(readRecordValue(product, ["imageUrl", "image_url", "productImageUrl", "product_image_url"])) ??
      undefined,
    imageAlt:
      readString(readRecordValue(row, ["imageAlt", "image_alt", "productImageAlt", "product_image_alt"])) ??
      readString(readRecordValue(product, ["imageAlt", "image_alt", "productImageAlt", "product_image_alt"])) ??
      undefined,
    category:
      sanitizeSupplierText(
        readString(row.category) ??
          readString(readRecordValue(product, ["category"])) ??
          ""
      ) ||
      "Ricambio",
    quantity,
    picked,
    pickedQty,
    cancelledQty,
    shortageQty: cancelledQty,
    lineStatus: readString(readRecordValue(row, ["lineStatus", "line_status"])) ?? "",
    billableQty,
    reservedQty,
    fulfilledQty,
    stockStatus: readString(readRecordValue(row, ["stockStatus", "stock_status"])) ?? "",
    batchCode: sanitizeSupplierText(
      readString(readRecordValue(row, ["batchCode", "batch_code"]))
    ),
    unitPrice,
    lineTotal: lineTotal > 0 ? lineTotal : roundMoney(unitPrice * billableQty),
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

function normalizePaymentReconciliation(value: unknown): PaymentReconciliation {
  const row = isRecord(value) ? value : null;
  const receivedByValue = readRecordValue(row, ["receivedBy", "received_by"]);
  const receivedByRow = isRecord(receivedByValue) ? receivedByValue : null;
  const actorId = readString(readRecordValue(receivedByRow, ["id"]));
  const actorEmail = readString(readRecordValue(receivedByRow, ["email"]));
  const actorName = readString(readRecordValue(receivedByRow, ["name", "displayName", "display_name"]));
  const actorRole = readString(readRecordValue(receivedByRow, ["role"]));
  const actorLabel =
    readString(readRecordValue(receivedByRow, ["label"])) ??
    actorName ??
    actorEmail ??
    actorRole ??
    actorId ??
    "";

  return {
    receivedAt: readString(readRecordValue(row, ["receivedAt", "received_at"])) ?? null,
    receivedAmount: readNumber(readRecordValue(row, ["receivedAmount", "received_amount"])),
    receivedBy: actorId || actorEmail || actorName || actorRole || actorLabel
      ? {
          id: actorId,
          email: actorEmail,
          label: sanitizeSupplierText(actorLabel) || actorLabel,
          name: actorName,
          role: actorRole,
        }
      : null,
    reference: readString(readRecordValue(row, ["reference"])) ?? "",
    note: readString(readRecordValue(row, ["note"])) ?? "",
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
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    });
}

function normalizeWalletRefunds(value: unknown[] | null): WalletRefundRequest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeWalletRefund)
    .filter((refund): refund is WalletRefundRequest => refund !== null)
    .sort(
      (left, right) =>
        orderTimestamp(right.requestedAt || right.createdAt) -
        orderTimestamp(left.requestedAt || left.createdAt)
    );
}

function normalizeWalletRefund(row: unknown): WalletRefundRequest | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = readString(readRecordValue(row, ["id"]));
  const amount = readMoney(
    readRecordValue(row, [
      "amount",
      "approvedAmount",
      "approved_amount",
      "requestedAmount",
      "requested_amount",
      "refundAmount",
      "refund_amount",
      "walletRefundAmount",
      "wallet_refund_amount",
    ])
  );

  if (!id || amount <= 0) {
    return null;
  }

  return {
    amount,
    approvedAt: readString(readRecordValue(row, ["approvedAt", "approved_at", "reviewedAt", "reviewed_at"])),
    approvedBy: readString(readRecordValue(row, ["approvedBy", "approved_by", "reviewedBy", "reviewed_by"])),
    createdAt: readString(readRecordValue(row, ["createdAt", "created_at"])) ?? "",
    creditedAt: readString(readRecordValue(row, ["creditedAt", "credited_at", "settledAt", "settled_at"])),
    currency: "EUR",
    customerId: readString(readRecordValue(row, ["customerId", "customer_id", "companyId", "company_id"])),
    customerName: readString(readRecordValue(row, ["customerName", "customer_name", "companyName", "company_name"])),
    id,
    metadata: readRecordValue(row, ["metadata", "requestMetadata", "request_metadata"]) ?? {},
    orderId: readString(readRecordValue(row, ["orderId", "order_id"])),
    orderLineId: readString(readRecordValue(row, ["orderLineId", "order_line_id"])),
    orderNo: readString(readRecordValue(row, ["orderNo", "order_no", "orderNumber", "order_number"])),
    reason: readString(readRecordValue(row, ["reason", "note"])) ?? "",
    requestType: readString(readRecordValue(row, ["requestType", "request_type", "type"])) ?? "",
    requestedAt:
      readString(readRecordValue(row, ["requestedAt", "requested_at", "submittedAt", "submitted_at", "createdAt", "created_at"])) ?? "",
    requestedBy: readString(readRecordValue(row, ["requestedBy", "requested_by", "createdBy", "created_by"])),
    status: normalizeWalletRefundStatus(readRecordValue(row, ["status"])),
    updatedAt: readString(readRecordValue(row, ["updatedAt", "updated_at"])) ?? "",
  };
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
    walletRefunds:
      incoming.walletRefunds.length > 0
        ? incoming.walletRefunds
        : current.walletRefunds,
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

function normalizePaymentStatusValue(value: unknown): PaymentStatus {
  if (value === "paid") {
    return "paid";
  }

  if (value === "authorized" || value === "bank_waiting") {
    return "authorized";
  }

  if (value === "refunded" || value === "failed") {
    return "refunded";
  }

  return "unpaid";
}

function normalizeWalletRefundStatus(value: unknown): WalletRefundStatus {
  if (value === "pending") {
    return "requested";
  }

  if (
    value === "approved" ||
    value === "rejected" ||
    value === "credited" ||
    value === "cancelled"
  ) {
    return value;
  }

  if (value === "paid" || value === "completed" || value === "settled") {
    return "credited";
  }

  if (value === "denied") {
    return "rejected";
  }

  return "requested";
}

function normalizePaymentMethodValue(value: unknown): PaymentMethod {
  return value === "cash" ? "cash" : "bank_transfer";
}

function parsePaymentAmountInput(value: string) {
  const parsed = Number(value.replace(",", "."));

  return Number.isFinite(parsed) && parsed >= 0 ? roundMoney(parsed) : null;
}

function formatPaymentAmountInput(value: number) {
  return Number.isFinite(value) ? roundMoney(value).toFixed(2) : "0.00";
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
  const normalized = carrier?.toLowerCase();
  const match = carrierOptions.find(
    (item) => item.toLowerCase() === normalized
  );

  if (match) {
    return match;
  }

  if (normalized === "brt" || normalized?.includes("brt")) {
    return "BRT 24-48h";
  }

  if (normalized === "gls" || normalized?.includes("gls")) {
    return "GLS 24-48h";
  }

  if (normalized?.includes("dhl")) {
    return "DHL Express";
  }

  if (normalized?.includes("ups")) {
    return "UPS";
  }

  if (normalized === "pickup" || normalized?.includes("ritiro")) {
    return "Ritiro in sede";
  }

  return unassignedCarrier;
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

function sortOrdersForOperationsQueue(orders: AdminOrder[]): AdminOrder[] {
  return [...orders].sort(compareOrdersForOperationsQueue);
}

function compareOrdersForOperationsQueue(left: AdminOrder, right: AdminOrder) {
  const bucketDelta =
    orderQueueBucket(left.status) - orderQueueBucket(right.status);

  if (bucketDelta !== 0) {
    return bucketDelta;
  }

  const timeDelta = orderTimestamp(right.createdAt) - orderTimestamp(left.createdAt);

  if (timeDelta !== 0) {
    return timeDelta;
  }

  const statusDelta = orderStatusRank(left.status) - orderStatusRank(right.status);

  if (statusDelta !== 0) {
    return statusDelta;
  }

  return right.id.localeCompare(left.id, undefined, { numeric: true });
}

function orderQueueBucket(status: OrderDbStatus) {
  return status === "completed" || status === "cancelled" ? 1 : 0;
}

function orderStatusRank(status: OrderDbStatus) {
  const index = statusFlow.indexOf(status);
  return index >= 0 ? index : statusFlow.length;
}

function orderTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
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
    paymentMethod: {
      bank_transfer: adminValueLabel(text, "bank_transfer"),
      cash: adminValueLabel(text, "cash"),
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

function paymentDueLabel(order: AdminOrder, text: AdminText) {
  if (hasSupplementalPaymentDue(order)) {
    return formatAdminMessage(text.orders.paymentSupplementDue, {
      amount: formatEuro(order.paymentDueAmount),
    });
  }

  return orderValueLabel(text, order.paymentDue);
}

function hasSupplementalPaymentDue(order: AdminOrder) {
  return (
    order.paymentStatus !== "paid" &&
    order.paymentDueAmount > 0 &&
    (order.paymentReconciliation.receivedAmount ?? 0) > 0
  );
}

function defaultPaymentReconciliationAmount(
  order: AdminOrder,
  nextStatus: PaymentStatus
) {
  if (nextStatus !== "paid") {
    return order.paymentReconciliation.receivedAmount ?? order.total;
  }

  if (order.paymentStatus !== "paid" || hasSupplementalPaymentDue(order)) {
    return order.total;
  }

  return order.paymentReconciliation.receivedAmount ?? order.total;
}

function suggestedShippingAmount(order: AdminOrder) {
  if (isPickupCarrier(order.carrier)) {
    return order.shipping > 0 ? order.shipping : 0;
  }

  if (order.shipping > 0) {
    return order.shipping;
  }

  return roundMoney(calculateShippingCents(Math.round(order.totalNet * 100)) / 100);
}

function orderValueLabel(
  text: AdminText,
  value: string | null | undefined,
  fallback?: string | null
) {
  return adminValueLabel(text, value, fallback ?? value ?? "");
}

function sourceLabel(source: OrdersSource, text?: AdminText) {
  if (text) {
    return adminSourceLabel(text, source, source);
  }

  if (source === "admin_api") {
    return "Admin API";
  }

  if (source === "supabase") {
    return "Supabase";
  }

  return "Nessun dato locale";
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

function readApiErrorMessage(payload: unknown, text: AdminText) {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return null;
  }

  const errorCode = readString(payload.error.code);
  const message =
    adminOrderErrorMessage(errorCode, text) ?? readString(payload.error.message);
  const details = isRecord(payload.error.details) ? payload.error.details : null;
  const reservationIssues = normalizeReservationIssues(
    details
      ? readRecordValue(details, ["reservationIssues", "reservation_issues", "details"])
      : null
  );
  const reservationMessage =
    reservationIssues.length > 0
      ? formatAdminMessage(text.orders.notices.stockReservationFailed, {
          items: reservationIssues
          .map((issue) => {
            const availability =
              issue.inventoryAvailableQty > 0
                ? issue.inventoryAvailableQty
                : issue.productStockQty;

            return formatAdminMessage(text.orders.notices.stockReservationIssue, {
              available: availability,
              needed: issue.neededQty,
              reason: reservationIssueLabel(issue.reason, text),
              sku: issue.sku,
            });
          })
          .join(text.orders.notices.issueSeparator),
        })
      : null;

  return [message, reservationMessage].filter(Boolean).join(" ") || null;
}

function adminOrderErrorMessage(code: string | null, text: AdminText) {
  switch (code) {
    case "ADMIN_ORDER_STATUS_TRANSITION_FAILED":
      return text.orders.notices.transitionRejected;
    case "ADMIN_ORDER_LOGISTICS_REQUIRED":
      return text.orders.logisticsRequired;
    case "ADMIN_ORDER_FORCE_CANCEL_REASON_REQUIRED":
      return text.orders.forceCancelReasonRequired;
    case "ADMIN_ORDER_FORCE_CANCEL_ADMIN_REQUIRED":
      return text.orders.notices.adminOnlyForceCancel;
    case "ADMIN_ORDER_DANGER_REASON_REQUIRED":
      return text.orders.dangerActionReasonRequired;
    case "ADMIN_ORDER_DANGER_CONFIRMATION_REQUIRED":
    case "ADMIN_ORDER_DANGER_ACTION_FAILED":
      return text.orders.dangerActionFailed;
    case "ADMIN_ORDER_DANGER_ADMIN_REQUIRED":
      return text.orders.notices.adminOnlyDangerAction;
    default:
      return null;
  }
}

function normalizeReservationIssues(value: unknown) {
  const payload =
    typeof value === "string" && value.trim().startsWith("[")
      ? parseJsonPayload(value)
      : value;

  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const sku = readString(readRecordValue(item, ["sku", "sku_code"])) ?? "SKU";
      const reason = readString(item.reason) ?? "unknown";

      return {
        inventoryAvailableQty:
          readNumber(readRecordValue(item, ["inventoryAvailableQty", "inventory_available_qty"])) ??
          0,
        neededQty: readNumber(readRecordValue(item, ["neededQty", "needed_qty"])) ?? 0,
        productStockQty:
          readNumber(readRecordValue(item, ["productStockQty", "product_stock_qty"])) ?? 0,
        reason,
        sku,
      };
    })
    .filter(Boolean) as Array<{
    inventoryAvailableQty: number;
    neededQty: number;
    productStockQty: number;
    reason: string;
    sku: string;
  }>;
}

function reservationIssueLabel(reason: string, text: AdminText) {
  switch (reason) {
    case "missing_product":
      return text.orders.reservationIssueReasons.missingProduct;
    case "inactive_product":
      return text.orders.reservationIssueReasons.inactiveProduct;
    case "insufficient_inventory_ledger":
      return text.orders.reservationIssueReasons.inventoryLedger;
    case "insufficient_product_stock":
      return text.orders.reservationIssueReasons.productStock;
    default:
      return text.orders.reservationIssueReasons.default;
  }
}

function parseJsonPayload(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function extractOrderPayload(payload: unknown) {
  if (!isRecord(payload)) {
    return null;
  }

  if (isRecord(payload.data)) {
    if (isRecord(payload.data.order)) {
      return payload.data.order;
    }

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

function serializeOrderPaymentPatch(patch: OrderPaymentPatchInput) {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  );
}

function serializeOrderShippingPatch(patch: OrderShippingPatchInput) {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  );
}

function serializeOrderStatusPatch(patch: OrderPatchInput) {
  return Object.fromEntries(
    Object.entries({
      note: patch.note,
      status: patch.status,
    }).filter(([, value]) => value !== undefined)
  );
}

function isPlainStatusTransitionPatch(patch: OrderPatchInput) {
  return (
    patch.status !== undefined &&
    patch.status !== "cancelled" &&
    patch.carrier === undefined &&
    patch.forceCancel === undefined &&
    patch.paymentMethod === undefined &&
    patch.paymentStatus === undefined &&
    patch.rollback === undefined &&
    patch.staffNote === undefined &&
    patch.tracking === undefined
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

function readBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true" || normalized === "1") {
      return true;
    }

    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }

  return false;
}

function isOpenReservedOrderStatus(status: OrderDbStatus) {
  return (
    status === "submitted" ||
    status === "accepted" ||
    status === "picking" ||
    status === "packed" ||
    status === "shipped"
  );
}

function hoursSinceIso(value: string) {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return Math.max(0, Math.floor((Date.now() - timestamp) / 3_600_000));
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

function toDateTimeLocalInput(value: string) {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return "";
  }

  const date = new Date(timestamp);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return local.toISOString().slice(0, 16);
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
  if (eventType === "admin_voided_soft_deleted") {
    return text.orders.activity.adminVoidedSoftDeleted;
  }

  if (eventType === "shipping_adjusted") {
    return text.orders.activity.shippingAdjusted;
  }

  if (eventType === "payment_reconciled") {
    return text.orders.activity.paymentReconciled;
  }

  if (eventType === "order_created") {
    return text.orders.activity.orderCreated;
  }

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

function orderActivityLineLabel(text: AdminText, value: string) {
  return value
    .replace("Ordine importato da /api/admin/orders", text.orders.activity.imported)
    .replace("Admin API", adminSourceLabel(text, "admin_api", "Admin API"))
    .replace("Supabase", adminSourceLabel(text, "supabase", "Supabase"))
    .replace("Nessun dato locale", adminSourceLabel(text, "empty", "Nessun dato locale"));
}

function activityBadgeClass(eventType: string) {
  if (eventType === "admin_voided_soft_deleted") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (eventType === "status_rolled_back") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (eventType === "shipping_adjusted") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (eventType === "operations_updated") {
    return "border-cyan-200 bg-cyan-50 text-cyan-700";
  }

  if (eventType === "payment_reconciled") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (eventType === "created" || eventType === "order_created") {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function activityDotClass(eventType: string) {
  if (eventType === "admin_voided_soft_deleted") {
    return "bg-red-500";
  }

  if (eventType === "status_rolled_back" || eventType === "shipping_adjusted") {
    return "bg-amber-500";
  }

  if (eventType === "operations_updated") {
    return "bg-cyan-500";
  }

  if (eventType === "payment_reconciled") {
    return "bg-blue-500";
  }

  if (eventType === "created" || eventType === "order_created") {
    return "bg-slate-400";
  }

  return "bg-emerald-500";
}

function sourceBadgeClass(source: OrdersSource) {
  if (source === "admin_api" || source === "supabase") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function hasAdminSessionPermission(session: AdminSessionState, permission: string) {
  return session.allowed && session.permissions.includes(permission);
}

function canReadWalletRefunds(session: AdminSessionState) {
  return (
    hasAdminSessionPermission(session, "wallet_refunds.request") ||
    hasAdminSessionPermission(session, "wallet_refunds.approve")
  );
}

function replaceWalletRefund(
  refunds: WalletRefundRequest[],
  nextRefund: WalletRefundRequest
) {
  const exists = refunds.some((refund) => refund.id === nextRefund.id);
  const nextRefunds = exists
    ? refunds.map((refund) => (refund.id === nextRefund.id ? nextRefund : refund))
    : [nextRefund, ...refunds];

  return nextRefunds.sort(
    (left, right) =>
      orderTimestamp(right.requestedAt || right.createdAt) -
      orderTimestamp(left.requestedAt || left.createdAt)
  );
}

function summarizeWalletRefunds(refunds: WalletRefundRequest[]) {
  return refunds.reduce(
    (summary, refund) => {
      if (isWalletRefundCredited(refund.status)) {
        summary.creditedAmount += refund.amount;
      } else if (refund.status === "requested") {
        summary.pendingAmount += refund.amount;
      }

      return summary;
    },
    { creditedAmount: 0, pendingAmount: 0 }
  );
}

function lineShortageRefundAmount(line: OrderLine) {
  return roundMoney(Math.max(0, line.cancelledQty) * line.unitPrice);
}

function isWalletRefundCredited(status: WalletRefundStatus) {
  return status === "credited" || status === "approved";
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

function walletRefundBadgeClass(status: WalletRefundStatus) {
  if (status === "credited") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "approved") {
    return "border-cyan-200 bg-cyan-50 text-cyan-700";
  }

  if (status === "rejected" || status === "cancelled") {
    return "border-slate-200 bg-slate-50 text-slate-600";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function walletRefundStatusLabel(status: WalletRefundStatus, text: AdminText) {
  switch (status) {
    case "approved":
      return text.orders.walletRefundStatus.approved;
    case "credited":
      return text.orders.walletRefundStatus.credited;
    case "rejected":
      return text.orders.walletRefundStatus.rejected;
    case "cancelled":
      return text.orders.walletRefundStatus.cancelled;
    case "requested":
    default:
      return text.orders.walletRefundStatus.requested;
  }
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

function orderLineOperationalBadgeClass(line: OrderLine) {
  if (line.cancelledQty >= line.quantity) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (line.cancelledQty > 0) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (line.pickedQty >= line.quantity) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function orderLineOperationalLabel(line: OrderLine) {
  if (line.cancelledQty >= line.quantity) {
    return "缺货核销";
  }

  if (line.cancelledQty > 0) {
    return "部分缺货";
  }

  if (line.pickedQty >= line.quantity) {
    return "已确认";
  }

  return "待确认";
}
