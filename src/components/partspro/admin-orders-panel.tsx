"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  ClipboardList,
  CreditCard,
  Download,
  Info,
  PackageCheck,
  RefreshCw,
  Search,
  Truck,
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
  type OrderStatus,
  type PartProduct,
} from "@/lib/partspro-data";
import { cn } from "@/lib/utils";

type PaymentStatus = "unpaid" | "authorized" | "paid" | "refunded";
type FulfillmentStatus =
  | "queued"
  | "allocated"
  | "picking"
  | "packed"
  | "shipped"
  | "delivered"
  | "blocked";
type Priority = "standard" | "high" | "urgent";
type ViewMode = "orders" | "payments" | "shipping";
type StatusFilterValue = "all" | OrderStatus;
type WarehouseName = PartProduct["warehouse"];
type Carrier = (typeof carriers)[number];
type OrdersSource = "admin_api" | "supabase" | "empty";
type ApiOrdersSource = OrdersSource;
type NoticeTone = "success" | "info" | "warning" | "error";

type CustomerSnapshot = {
  name: string;
  partitaIva: string;
  pec: string;
  status: CompanyStatus;
  priceList: "Standard" | "Pro" | "Partner";
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
};

type AdminOrder = {
  id: string;
  date: string;
  status: OrderStatus;
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
  carrier?: Carrier;
  fulfillmentStatus?: FulfillmentStatus;
  paymentStatus?: PaymentStatus;
  status?: OrderStatus;
  tracking?: string;
  warehouse?: WarehouseName;
};

const carriers = ["DHL Express", "BRT", "GLS", "UPS", "Ritiro in sede"] as const;
const warehouses: WarehouseName[] = ["Milano", "Roma", "Shenzhen"];
const orderStatuses: OrderStatus[] = [
  "draft",
  "pending_payment",
  "paid",
  "picking",
  "shipped",
  "delivered",
  "cancelled",
];
const statusFlow: OrderStatus[] = [
  "draft",
  "pending_payment",
  "paid",
  "picking",
  "shipped",
  "delivered",
];

const orderStatusLabels: Record<OrderStatus, string> = {
  draft: "Bozza",
  pending_payment: "Attesa pagamento",
  paid: "Pagato",
  picking: "Picking",
  shipped: "Spedito",
  delivered: "Consegnato",
  cancelled: "Annullato",
};

const paymentStatusLabels: Record<PaymentStatus, string> = {
  unpaid: "Da incassare",
  authorized: "Autorizzato",
  paid: "Pagato",
  refunded: "Rimborsato",
};

const fulfillmentStatusLabels: Record<FulfillmentStatus, string> = {
  queued: "In coda",
  allocated: "Allocato",
  picking: "Picking",
  packed: "Imballato",
  shipped: "Spedito",
  delivered: "Consegnato",
  blocked: "Bloccato",
};

const priorityLabels: Record<Priority, string> = {
  standard: "Standard",
  high: "Alta",
  urgent: "Urgente",
};

export function AdminOrdersPanel() {
  const [orders, setOrders] = React.useState<AdminOrder[]>([]);
  const [dataSource, setDataSource] = React.useState<OrdersDataSource>(() => ({
    source: "empty",
    label: "Nessun dato locale",
    syncedAt: null,
    total: 0,
    returned: 0,
  }));
  const [isLoadingOrders, setIsLoadingOrders] = React.useState(false);
  const [pendingOrderAction, setPendingOrderAction] = React.useState<string | null>(
    null
  );
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] =
    React.useState<StatusFilterValue>("all");
  const [viewMode, setViewMode] = React.useState<ViewMode>("orders");
  const [selectedOrderId, setSelectedOrderId] = React.useState("");
  const [mobileDetailsOpen, setMobileDetailsOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<PanelNotice | null>(null);

  const refreshOrders = React.useCallback(async (signal?: AbortSignal) => {
    setIsLoadingOrders(true);

    try {
      const result = await fetchOrdersFromApi(signal);

      if (signal?.aborted) {
        return;
      }

      setOrders(result.orders);
      setDataSource({
        source: result.source,
        label: sourceLabel(result.source),
        syncedAt: formatSyncTime(),
        total: result.total,
        returned: result.returned,
      });
      setNotice({
        tone: "success",
        message:
          result.orders.length > 0
            ? "Ordini sincronizzati da /api/admin/orders."
            : "Nessun ordine disponibile da /api/admin/orders.",
      });
    } catch (error) {
      if (signal?.aborted) {
        return;
      }

      setOrders([]);
      setDataSource({
        source: "empty",
        label: "Nessun dato locale",
        syncedAt: formatSyncTime(),
        total: 0,
        returned: 0,
        error: error instanceof Error ? error.message : "Errore sconosciuto",
      });
      setNotice({
        tone: "error",
        message:
          "/api/admin/orders non disponibile: nessun ordine viene mostrato.",
      });
    } finally {
      if (!signal?.aborted) {
        setIsLoadingOrders(false);
      }
    }
  }, []);

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

  const filteredOrders = React.useMemo(
    () =>
      orders.filter((order) => {
        const normalizedQuery = query.trim().toLowerCase();
        const haystack = [
          order.id,
          order.company,
          order.customer.partitaIva,
          order.customer.city,
          order.customer.pec,
          order.tracking,
          order.lines.map((line) => `${line.sku} ${line.name}`).join(" "),
        ]
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          normalizedQuery.length === 0 || haystack.includes(normalizedQuery);
        const matchesStatus =
          statusFilter === "all" || order.status === statusFilter;
        const matchesView = orderMatchesView(order, viewMode);

        return matchesSearch && matchesStatus && matchesView;
      }),
    [orders, query, statusFilter, viewMode]
  );

  const selectedOrder =
    filteredOrders.find((order) => order.id === selectedOrderId) ??
    filteredOrders[0] ??
    null;

  const metrics = React.useMemo(() => {
    const pendingPayments = orders.filter(
      (order) => order.paymentStatus !== "paid" && order.status !== "cancelled"
    ).length;
    const shippingQueue = orders.filter((order) =>
      ["paid", "picking", "shipped"].includes(order.status)
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

  const patchOrder = React.useCallback(
    async (orderId: string, patch: OrderPatchInput, successMessage: string) => {
      const actionKey = `${orderId}:${Object.keys(patch).sort().join(",")}`;

      setPendingOrderAction(actionKey);

      try {
        const result = await patchOrderInApi(orderId, patch);

        setOrders((currentOrders) =>
          currentOrders.map((order) =>
            order.id === orderId
              ? result.order ?? applyOrderPatch(order, patch, successMessage)
              : order
          )
        );
        setNotice({
          tone: "success",
          message: `${successMessage} Persistito tramite /api/admin/orders/${orderId}.`,
        });
      } catch (error) {
        setNotice({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Aggiornamento ordine non riuscito.",
        });
      } finally {
        setPendingOrderAction(null);
      }
    },
    []
  );

  const handleAdvanceStatus = React.useCallback(
    (orderId: string) => {
      const order = orders.find((item) => item.id === orderId);
      const nextStatus = order ? getNextOrderStatus(order.status) : null;

      if (!order || !nextStatus) {
        return;
      }

      void patchOrder(
        orderId,
        {
          status: nextStatus,
          paymentStatus: paymentStatusFromOrderStatus(
            nextStatus,
            order.paymentStatus
          ),
          fulfillmentStatus: fulfillmentStatusFromOrderStatus(nextStatus),
        },
        `Stato ordine aggiornato a ${orderStatusLabels[nextStatus]}.`
      );
    },
    [orders, patchOrder]
  );

  const handleMarkPaid = React.useCallback(
    (orderId: string) => {
      const order = orders.find((item) => item.id === orderId);

      if (!order) {
        return;
      }

      void patchOrder(
        orderId,
        {
          status:
            order.status === "draft" || order.status === "pending_payment"
              ? "paid"
              : order.status,
          paymentStatus: "paid",
          fulfillmentStatus:
            order.fulfillmentStatus === "queued"
              ? "allocated"
              : order.fulfillmentStatus,
        },
        "Pagamento segnato come incassato."
      );
    },
    [orders, patchOrder]
  );

  const handleAssignWarehouse = React.useCallback(
    (orderId: string, warehouse: WarehouseName) => {
      const order = orders.find((item) => item.id === orderId);

      if (!order) {
        return;
      }

      void patchOrder(
        orderId,
        {
          warehouse,
          fulfillmentStatus:
            order.fulfillmentStatus === "queued"
              ? "allocated"
              : order.fulfillmentStatus,
        },
        `Magazzino aggiornato a ${warehouse}.`
      );
    },
    [orders, patchOrder]
  );

  const handleAssignCarrier = React.useCallback(
    (orderId: string, carrier: Carrier) => {
      void patchOrder(orderId, { carrier }, `Corriere aggiornato a ${carrier}.`);
    },
    [patchOrder]
  );

  const handleUpdateTracking = React.useCallback(
    (orderId: string, tracking: string) => {
      void patchOrder(
        orderId,
        { tracking },
        tracking.trim()
          ? `Tracking aggiornato a ${tracking.trim()}.`
          : "Tracking rimosso."
      );
    },
    [patchOrder]
  );

  const handleExportOrders = React.useCallback(() => {
    if (filteredOrders.length === 0) {
      return;
    }

    downloadOrdersCsv(filteredOrders, viewMode);
    setNotice({
      tone: "success",
      message:
        filteredOrders.length === 1
          ? "CSV generato per 1 ordine."
          : `CSV generato per ${filteredOrders.length} ordini.`,
    });
  }, [filteredOrders, viewMode]);

  const handleOpenMobileDetails = React.useCallback((orderId: string) => {
    setSelectedOrderId(orderId);
    setMobileDetailsOpen(true);
  }, []);

  const hasFilters = query.trim().length > 0 || statusFilter !== "all";
  return (
    <section className="w-full min-w-0 space-y-4 text-slate-950">
      <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Ordini caricati"
          value={`${metrics.totalOrders}`}
          detail={`${filteredOrders.length} nella vista`}
          icon={ClipboardList}
        />
        <MetricCard
          label="Incassi aperti"
          value={`${metrics.pendingPayments}`}
          detail="Pagamenti da seguire"
          icon={CreditCard}
        />
        <MetricCard
          label="Coda spedizioni"
          value={`${metrics.shippingQueue}`}
          detail={`${metrics.urgentOrders} urgenti`}
          icon={Truck}
        />
        <MetricCard
          label="Incassato"
          value={formatEuro(metrics.revenue)}
          detail="Totale ordini pagati"
          icon={BadgeCheck}
        />
      </div>

      <Card className="rounded-lg border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <CardTitle>Gestione ordini</CardTitle>
            <CardDescription>
              Ricerca, avanzamento stato, assegnazione logistica ed export operativo
            </CardDescription>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-2 lg:w-auto lg:items-end">
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 lg:justify-end">
              <Badge className={sourceBadgeClass(dataSource.source)}>
                Fonte: {dataSource.label}
              </Badge>
              <span className="min-w-0 break-words">
                {dataSource.syncedAt
                  ? `${dataSource.returned}/${dataSource.total} ordini · ${dataSource.syncedAt}`
                  : "In attesa di sincronizzazione"}
              </span>
              <Button
                variant="outline"
                size="xs"
                className="bg-white"
                onClick={() => void refreshOrders()}
                disabled={isLoadingOrders}
              >
                <RefreshCw
                  className={cn("size-3", isLoadingOrders && "animate-spin")}
                />
                Aggiorna
              </Button>
            </div>
            <Tabs
              value={viewMode}
              onValueChange={(value) => setViewMode(value as ViewMode)}
              className="w-full sm:w-auto"
            >
              <TabsList className="grid w-full grid-cols-3 bg-slate-100 sm:w-auto">
                <TabsTrigger value="orders">Ordini</TabsTrigger>
                <TabsTrigger value="payments">Pagamenti</TabsTrigger>
                <TabsTrigger value="shipping">Spedizioni</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
              <div className="relative w-full sm:w-[260px]">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-9 bg-white pl-9"
                  placeholder="Cerca ordine, cliente, SKU"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as StatusFilterValue)
                }
              >
                <SelectTrigger size="sm" className="w-full bg-white sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli stati</SelectItem>
                  {orderStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {orderStatusLabels[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="bg-white"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                }}
                disabled={!hasFilters}
              >
                Reset
              </Button>
              <Button
                variant="outline"
                className="bg-white"
                onClick={handleExportOrders}
                disabled={filteredOrders.length === 0}
              >
                <Download className="size-4" />
                Esporta CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4">
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
                OK
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
                Ricarica /api/admin/orders
              </Button>
            </div>
          )}

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <OrdersList
              orders={filteredOrders}
              selectedOrderId={selectedOrder?.id ?? ""}
              viewMode={viewMode}
              onSelectOrder={setSelectedOrderId}
              onOpenMobileDetails={handleOpenMobileDetails}
            />
            <div className="hidden min-w-0 md:block">
              <OrderDetailsPanel
                order={selectedOrder}
                pendingActionKey={pendingOrderAction}
                onAdvanceStatus={handleAdvanceStatus}
                onMarkPaid={handleMarkPaid}
                onAssignWarehouse={handleAssignWarehouse}
                onAssignCarrier={handleAssignCarrier}
                onUpdateTracking={handleUpdateTracking}
              />
            </div>
          </div>
          <Dialog
            open={mobileDetailsOpen && selectedOrder !== null}
            onOpenChange={setMobileDetailsOpen}
          >
            {selectedOrder && (
              <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg bg-white p-2 pt-10 sm:max-w-[720px] sm:p-4 sm:pt-10">
                <DialogHeader className="sr-only">
                  <DialogTitle>Dettaglio ordine {selectedOrder.id}</DialogTitle>
                  <DialogDescription>
                    Stato, pagamento, logistica e righe dell&apos;ordine selezionato.
                  </DialogDescription>
                </DialogHeader>
                <OrderDetailsPanel
                  order={selectedOrder}
                  pendingActionKey={pendingOrderAction}
                  onAdvanceStatus={handleAdvanceStatus}
                  onMarkPaid={handleMarkPaid}
                  onAssignWarehouse={handleAssignWarehouse}
                  onAssignCarrier={handleAssignCarrier}
                  onUpdateTracking={handleUpdateTracking}
                />
              </DialogContent>
            )}
          </Dialog>
        </CardContent>
      </Card>
    </section>
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
    <Card className="rounded-lg border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
      <CardContent className="p-4 sm:p-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-500">{label}</p>
            <div className="mt-2 truncate text-2xl font-black sm:text-3xl">
              {value}
            </div>
            <p className="mt-2 truncate text-xs font-semibold text-slate-500">
              {detail}
            </p>
          </div>
          <div className="hidden size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary sm:grid">
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OrdersList({
  orders,
  selectedOrderId,
  viewMode,
  onSelectOrder,
  onOpenMobileDetails,
}: {
  orders: AdminOrder[];
  selectedOrderId: string;
  viewMode: ViewMode;
  onSelectOrder: (orderId: string) => void;
  onOpenMobileDetails: (orderId: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-slate-900">
            Lista operativa
          </h3>
          <p className="truncate text-xs text-slate-500">
            Seleziona un ordine per vedere linee e logistica
          </p>
        </div>
        <Badge variant="outline" className="bg-white">
          {orders.length} ordini
        </Badge>
      </div>

      <div className="space-y-2 md:hidden">
        {orders.length > 0 ? (
          orders.map((order) => {
            const summaryFacts = getMobileSummaryFacts(order, viewMode);

            return (
              <button
                key={order.id}
                type="button"
                aria-label={`Apri dettagli ordine ${order.id}`}
                className={cn(
                  "w-full min-w-0 rounded-lg border bg-white p-2.5 text-left transition hover:border-primary/40 hover:bg-primary/4",
                  selectedOrderId === order.id
                    ? "border-primary/50 ring-2 ring-primary/12"
                    : "border-slate-200"
                )}
                onClick={() => onOpenMobileDetails(order.id)}
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="break-words font-mono text-[13px] font-black leading-tight text-slate-900">
                      {order.id}
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
                    {orderStatusLabels[order.status]}
                  </Badge>
                  <Badge
                    className={cn(
                      priorityBadgeClass(order.priority),
                      "h-auto min-h-5 whitespace-normal text-[11px] leading-tight"
                    )}
                  >
                    {priorityLabels[order.priority]}
                  </Badge>
                </div>
                <div className="mt-2 min-w-0 break-words text-xs font-semibold leading-5 text-slate-500">
                  {summaryFacts.map((fact) => `${fact.label}: ${fact.value}`).join(" · ")}
                </div>
              </button>
            );
          })
        ) : (
          <EmptyState />
        )}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-slate-200 md:block">
        <Table className="min-w-[760px]">
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Ordine</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Stato</TableHead>
              {viewMode === "shipping" ? (
                <>
                  <TableHead>Magazzino</TableHead>
                  <TableHead>Corriere</TableHead>
                </>
              ) : viewMode === "payments" ? (
                <>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Scadenza</TableHead>
                </>
              ) : (
                <>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Totale</TableHead>
                </>
              )}
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length > 0 ? (
              orders.map((order) => (
                <TableRow
                  key={order.id}
                  data-state={selectedOrderId === order.id ? "selected" : undefined}
                >
                  <TableCell>
                    <div className="font-mono text-xs font-semibold text-slate-600">
                      {order.id}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{order.date}</div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[190px] truncate text-sm font-bold text-slate-900">
                      {order.company}
                    </div>
                    <div className="text-xs text-slate-500">
                      {order.customer.city} ({order.customer.province})
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge className={orderStatusBadgeClass(order.status)}>
                        {orderStatusLabels[order.status]}
                      </Badge>
                      <Badge className={priorityBadgeClass(order.priority)}>
                        {priorityLabels[order.priority]}
                      </Badge>
                    </div>
                  </TableCell>
                  {viewMode === "shipping" ? (
                    <>
                      <TableCell>{order.warehouse}</TableCell>
                      <TableCell>
                        <div className="text-sm font-semibold">{order.carrier}</div>
                        <div className="text-xs text-slate-500">{order.eta}</div>
                      </TableCell>
                    </>
                  ) : viewMode === "payments" ? (
                    <>
                      <TableCell>
                        <Badge className={paymentBadgeClass(order.paymentStatus)}>
                          {paymentStatusLabels[order.paymentStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-semibold">{order.paymentDue}</div>
                        <div className="text-xs text-slate-500">
                          {order.paymentMethod}
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>
                        <Badge className={paymentBadgeClass(order.paymentStatus)}>
                          {paymentStatusLabels[order.paymentStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatEuro(order.total)}
                      </TableCell>
                    </>
                  )}
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white"
                      onClick={() => onSelectOrder(order.id)}
                    >
                      Apri
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center text-slate-500">
                  Nessun ordine corrispondente
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function getMobileSummaryFacts(order: AdminOrder, viewMode: ViewMode) {
  if (viewMode === "shipping") {
    return [
      { label: "Magazzino", value: order.warehouse },
      { label: "Corriere", value: `${order.carrier} / ${order.eta}` },
    ];
  }

  if (viewMode === "payments") {
    return [
      { label: "Pagamento", value: paymentStatusLabels[order.paymentStatus] },
      { label: "Scadenza", value: order.paymentDue },
    ];
  }

  return [
    { label: "Pagamento", value: paymentStatusLabels[order.paymentStatus] },
    {
      label: "Logistica",
      value: `${fulfillmentStatusLabels[order.fulfillmentStatus]} / ${order.warehouse}`,
    },
  ];
}

function OrderDetailsPanel({
  order,
  pendingActionKey,
  onAdvanceStatus,
  onMarkPaid,
  onAssignWarehouse,
  onAssignCarrier,
  onUpdateTracking,
}: {
  order: AdminOrder | null;
  pendingActionKey: string | null;
  onAdvanceStatus: (orderId: string) => void;
  onMarkPaid: (orderId: string) => void;
  onAssignWarehouse: (orderId: string, warehouse: WarehouseName) => void;
  onAssignCarrier: (orderId: string, carrier: Carrier) => void;
  onUpdateTracking: (orderId: string, tracking: string) => void;
}) {
  if (!order) {
    return (
      <div className="grid min-h-[360px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
        <div>
          <AlertTriangle className="mx-auto size-8 text-slate-400" />
          <h3 className="mt-3 text-sm font-bold text-slate-900">
            Nessun ordine nella vista
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Modifica ricerca o filtri per tornare alla lista operativa.
          </p>
        </div>
      </div>
    );
  }

  const nextStatus = getNextOrderStatus(order.status);
  const pickedItems = order.lines.reduce((total, line) => total + line.picked, 0);
  const isMutating = pendingActionKey?.startsWith(`${order.id}:`) ?? false;

  return (
    <div className="min-w-0 space-y-4 rounded-lg border border-slate-200 bg-slate-50/40 p-3 sm:p-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-base font-black text-slate-950">
              {order.id}
            </h3>
            <Badge className={orderStatusBadgeClass(order.status)}>
              {orderStatusLabels[order.status]}
            </Badge>
            <Badge className={priorityBadgeClass(order.priority)}>
              {priorityLabels[order.priority]}
            </Badge>
            {isMutating && (
              <Badge className="border-cyan-200 bg-cyan-50 text-cyan-700">
                Salvataggio
              </Badge>
            )}
          </div>
          <p className="mt-1 break-words text-sm text-slate-500">
            {order.company} - {order.customer.city} ({order.customer.province})
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="bg-white"
            onClick={() => onMarkPaid(order.id)}
            disabled={order.paymentStatus === "paid" || isMutating}
          >
            <CreditCard className="size-4" />
            Segna pagato
          </Button>
          <Button
            onClick={() => onAdvanceStatus(order.id)}
            disabled={!nextStatus || isMutating}
          >
            <ArrowRight className="size-4" />
            {nextStatus ? orderStatusLabels[nextStatus] : "Completato"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-600 md:hidden">
        <div className="flex min-w-0 justify-between gap-3">
          <span className="text-slate-400">Pagamento</span>
          <span className="min-w-0 break-words text-right font-bold text-slate-900">
            {paymentStatusLabels[order.paymentStatus]} · {order.paymentDue}
          </span>
        </div>
        <div className="mt-1.5 flex min-w-0 justify-between gap-3">
          <span className="text-slate-400">Fulfillment</span>
          <span className="min-w-0 break-words text-right font-bold text-slate-900">
            {fulfillmentStatusLabels[order.fulfillmentStatus]} · {pickedItems}/{order.items}
          </span>
        </div>
      </div>

      <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">
        <DetailFact
          label="Totale ordine"
          value={formatEuro(order.total)}
          helper={`${order.items} pezzi ordinati`}
        />
        <DetailFact
          label="Pagamento"
          value={paymentStatusLabels[order.paymentStatus]}
          helper={`${order.paymentMethod} - ${order.paymentDue}`}
        />
        <DetailFact
          label="Fulfillment"
          value={fulfillmentStatusLabels[order.fulfillmentStatus]}
          helper={`${pickedItems}/${order.items} pezzi prelevati`}
        />
        <DetailFact
          label="Cliente"
          value={order.customer.priceList}
          helper={order.customer.partitaIva}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Magazzino assegnato">
          <Select
            value={order.warehouse}
            onValueChange={(value) =>
              onAssignWarehouse(order.id, value as WarehouseName)
            }
            disabled={isMutating}
          >
            <SelectTrigger className="w-full bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse} value={warehouse}>
                  {warehouse}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Corriere">
          <Select
            value={order.carrier}
            onValueChange={(value) => onAssignCarrier(order.id, value as Carrier)}
            disabled={isMutating}
          >
            <SelectTrigger className="w-full bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {carriers.map((carrier) => (
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
            isMutating={isMutating}
            orderId={order.id}
            tracking={order.tracking}
            onUpdateTracking={onUpdateTracking}
          />
        </Field>
      </div>

      <div className="hidden md:block">
        <StatusStepper status={order.status} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-3 flex items-center gap-2">
            <PackageCheck className="size-4 text-primary" />
            <div className="text-sm font-bold text-slate-900">Righe ordine</div>
          </div>
          <OrderLines lines={order.lines} />
        </div>
        <div className="min-w-0 space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900">
              <Truck className="size-4 text-primary" />
              Logistica
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <InfoRow label="Servizio" value={order.service} />
              <InfoRow label="ETA" value={order.eta} />
              <InfoRow label="Indirizzo" value={order.shippingAddress} />
              <InfoRow label="Owner" value={order.owner} />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 text-sm font-bold text-slate-900">Note e audit</div>
            <p className="text-sm leading-6 text-slate-600">{order.notes}</p>
            <div className="mt-3 space-y-2">
              {order.activity.map((activity) => (
                <div
                  key={activity}
                  className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600"
                >
                  {activity}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackingEditor({
  isMutating,
  orderId,
  tracking,
  onUpdateTracking,
}: {
  isMutating: boolean;
  orderId: string;
  tracking: string;
  onUpdateTracking: (orderId: string, tracking: string) => void;
}) {
  const [trackingDraft, setTrackingDraft] = React.useState(tracking);
  const trackingChanged = trackingDraft !== tracking;

  return (
    <div className="flex min-w-0 gap-2">
      <Input
        value={trackingDraft}
        onChange={(event) => setTrackingDraft(event.target.value)}
        className="min-w-0 bg-white"
        placeholder="Tracking"
        disabled={isMutating}
      />
      <Button
        type="button"
        variant="outline"
        className="shrink-0 bg-white"
        onClick={() => onUpdateTracking(orderId, trackingDraft)}
        disabled={!trackingChanged || isMutating}
      >
        Salva
      </Button>
    </div>
  );
}

function OrderLines({ lines }: { lines: OrderLine[] }) {
  return (
    <div className="min-w-0">
      <div className="space-y-2 md:hidden">
        {lines.map((line) => (
          <div key={line.sku} className="rounded-lg border border-slate-200 p-3">
            <div className="min-w-0">
              <div className="break-words text-sm font-bold text-slate-900">
                {line.name}
              </div>
              <div className="mt-1 font-mono text-xs text-slate-500">{line.sku}</div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <MobileFact label="Qty" value={`${line.quantity}`} />
              <MobileFact label="Prelevati" value={`${line.picked}`} />
              <MobileFact label="Prezzo" value={formatEuro(line.unitPrice)} />
              <MobileFact label="Magazzino" value={line.warehouse} />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-lg border border-slate-200 md:block">
        <Table className="min-w-[700px]">
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Prodotto</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Pick</TableHead>
              <TableHead>Prezzo</TableHead>
              <TableHead>Magazzino</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.sku}>
                <TableCell className="font-mono text-xs font-semibold text-slate-600">
                  {line.sku}
                </TableCell>
                <TableCell>
                  <div className="max-w-[230px] truncate text-sm font-bold text-slate-900">
                    {line.name}
                  </div>
                  <div className="text-xs text-slate-500">{line.category}</div>
                </TableCell>
                <TableCell>{line.quantity}</TableCell>
                <TableCell>
                  <Badge
                    className={
                      line.picked === line.quantity
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }
                  >
                    {line.picked}/{line.quantity}
                  </Badge>
                </TableCell>
                <TableCell>{formatEuro(line.unitPrice)}</TableCell>
                <TableCell>{line.warehouse}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatusStepper({ status }: { status: OrderStatus }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {statusFlow.slice(1).map((step, index) => {
          const currentIndex = statusFlow.indexOf(status);
          const stepIndex = index + 1;
          const active = currentIndex >= stepIndex;

          return (
            <div key={step} className="min-w-0 text-center">
              <div
                className={cn(
                  "mx-auto grid size-8 place-items-center rounded-full text-xs font-bold",
                  active ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
                )}
              >
                {stepIndex}
              </div>
              <div className="mt-2 break-words text-xs leading-tight text-slate-500">
                {orderStatusLabels[step]}
              </div>
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
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
      <div className="truncate text-xs font-semibold uppercase text-slate-500">
        {label}
      </div>
      <div className="mt-2 break-words text-sm font-black text-slate-900">
        {value}
      </div>
      <div className="mt-1 break-words text-xs text-slate-500">{helper}</div>
    </div>
  );
}

function MobileFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 px-2 py-1.5">
      <div className="break-words text-[10px] font-semibold uppercase leading-tight text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 break-words text-xs font-bold leading-snug text-slate-700">
        {value}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 grid-cols-[92px_minmax(0,1fr)] gap-2">
      <span className="text-xs font-semibold uppercase text-slate-400">{label}</span>
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
    <div className="min-w-0 space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
      Nessun ordine corrispondente
    </div>
  );
}

async function fetchOrdersFromApi(signal?: AbortSignal): Promise<OrdersApiResult> {
  const response = await fetch("/api/admin/orders?limit=50&sort=date_desc", {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`GET /api/admin/orders ha risposto ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  return parseOrdersApiPayload(payload);
}

function parseOrdersApiPayload(payload: unknown): OrdersApiResult {
  if (!isRecord(payload)) {
    throw new Error("Risposta /api/admin/orders incompleta");
  }

  const meta = isRecord(payload.meta) ? payload.meta : {};
  const source = readSource(meta.source ?? payload.source);
  const rows = readArrayPayload(payload, ["data", "orders"]);

  if (!rows) {
    throw new Error("Risposta /api/admin/orders incompleta");
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
      `PATCH /api/admin/orders/${orderId} ha risposto ${response.status}. Modifica non applicata localmente.`
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
    readRecordValue(row, ["id", "orderId", "order_id", "number"])
  );
  const date =
    readString(
      readRecordValue(row, ["date", "createdAt", "created_at", "orderedAt"])
    ) ?? "Data non disponibile";
  const company =
    readString(row.company) ??
    readString(readRecordValue(customerRecord, ["name", "companyName"])) ??
    "Cliente non disponibile";

  if (!id) {
    return null;
  }

  const status = normalizeOrderStatusValue(
    readRecordValue(row, ["status", "orderStatus", "order_status"])
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
  const summaryLines =
    lines.length > 0
      ? lines
      : buildSummaryOrderLines(
          { id, date, company, status, total, items: itemCount },
          fulfillmentStatus
        );
  const warehouse = normalizeWarehouseValue(
    readRecordValue(row, ["warehouse"]) ??
      readRecordValue(shippingRecord, ["warehouse"]) ??
      summaryLines[0]?.warehouse
  );
  const customer = normalizeCustomerSnapshot(customerRecord, company);

  return {
    id,
    date,
    company,
    status,
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
      readString(readRecordValue(row, ["service"])) ??
      readString(readRecordValue(shippingRecord, ["service"])) ??
      "Da pianificare",
    tracking:
      readString(readRecordValue(row, ["tracking", "trackingCode"])) ??
      readString(readRecordValue(shippingRecord, ["tracking", "trackingCode"])) ??
      "",
    eta:
      readString(readRecordValue(row, ["eta", "estimatedDelivery"])) ??
      readString(readRecordValue(shippingRecord, ["eta", "estimatedDelivery"])) ??
      "Da pianificare",
    shippingAddress:
      readString(readRecordValue(row, ["shippingAddress"])) ??
      readString(readRecordValue(shippingRecord, ["address", "shippingAddress"])) ??
      (customer.city ? `${customer.city}, Italia` : "Non disponibile"),
    owner: readString(readRecordValue(row, ["owner", "accountOwner"])) ?? "Operations",
    notes:
      readString(row.notes) ??
      `Ordine importato da /api/admin/orders (${sourceLabel(source)}).`,
    lines: summaryLines,
    activity: normalizeActivity(row.activity, date, source),
  };
}

function buildSummaryOrderLines(
  summary: {
    company: string;
    date: string;
    id: string;
    items: number;
    status: OrderStatus;
    total: number;
  },
  fulfillmentStatus: FulfillmentStatus
): OrderLine[] {
  if (summary.items <= 0) {
    return [];
  }

  const picked =
    fulfillmentStatus === "shipped" || fulfillmentStatus === "delivered"
      ? summary.items
      : fulfillmentStatus === "picking"
        ? Math.ceil(summary.items / 2)
        : 0;

  return [
    {
      sku: `${summary.id}-SUMMARY`,
      name: "Dettaglio righe non esposto da /api/admin/orders",
      category: "Riepilogo API",
      quantity: summary.items,
      picked,
      unitPrice: summary.items > 0 ? roundMoney(summary.total / summary.items) : summary.total,
      warehouse: "Milano",
    },
  ];
}

function normalizeOrderLine(
  row: unknown,
  fulfillmentStatus: FulfillmentStatus
): OrderLine | null {
  if (!isRecord(row)) {
    return null;
  }

  const product = isRecord(row.product) ? row.product : null;
  const sku =
    readString(readRecordValue(row, ["sku", "productSku", "product_sku"])) ??
    readString(readRecordValue(product, ["sku"]));
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
  const picked =
    readNumber(readRecordValue(row, ["picked", "pickedQuantity", "picked_quantity"])) ??
    (fulfillmentStatus === "shipped" || fulfillmentStatus === "delivered"
      ? quantity
      : 0);

  return {
    sku,
    name:
      readString(readRecordValue(row, ["name", "productName", "product_name"])) ??
      readString(readRecordValue(product, ["name"])) ??
      "Prodotto ordine",
    category:
      readString(row.category) ??
      readString(readRecordValue(product, ["category"])) ??
      "Ricambio",
    quantity,
    picked,
    unitPrice,
    warehouse: normalizeWarehouseValue(row.warehouse),
  };
}

function normalizeCustomerSnapshot(
  row: Record<string, unknown> | null,
  fallbackName: string
): CustomerSnapshot {
  const address = isRecord(row?.address) ? row?.address : null;

  return {
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

function applyOrderPatch(
  order: AdminOrder,
  patch: OrderPatchInput,
  activityMessage: string
) {
  const status = patch.status ?? order.status;
  const fulfillmentStatus =
    patch.fulfillmentStatus ??
    (patch.status
      ? fulfillmentStatusFromOrderStatus(status)
      : order.fulfillmentStatus);
  const paymentStatus =
    patch.paymentStatus ??
    (patch.status
      ? paymentStatusFromOrderStatus(status, order.paymentStatus)
      : order.paymentStatus);
  const warehouse = patch.warehouse ?? order.warehouse;
  const linesWithWarehouse = patch.warehouse
    ? order.lines.map((line) => ({ ...line, warehouse }))
    : order.lines;

  const nextOrder = {
    ...order,
    ...patch,
    status,
    paymentStatus,
    fulfillmentStatus,
    warehouse,
    lines: updatePickedLines(linesWithWarehouse, fulfillmentStatus),
  };

  return {
    ...nextOrder,
    activity: prependActivity(nextOrder, activityMessage.replace(/\.$/, "")),
  };
}

function normalizeActivity(
  value: unknown,
  fallbackDate: string,
  source: ApiOrdersSource
) {
  if (Array.isArray(value)) {
    const activity = value
      .map((item) => readString(item))
      .filter((item): item is string => item !== null);

    if (activity.length > 0) {
      return activity.slice(0, 5);
    }
  }

  return [
    `${fallbackDate} - Ordine importato da /api/admin/orders (${sourceLabel(source)})`,
  ];
}

function normalizePaymentStatusValue(
  value: unknown,
  status: OrderStatus
): PaymentStatus {
  return ["unpaid", "authorized", "paid", "refunded"].includes(
    value as PaymentStatus
  )
    ? (value as PaymentStatus)
    : paymentStatusFromOrderStatus(status);
}

function normalizeFulfillmentStatusValue(
  value: unknown,
  status: OrderStatus
): FulfillmentStatus {
  return [
    "queued",
    "allocated",
    "picking",
    "packed",
    "shipped",
    "delivered",
    "blocked",
  ].includes(value as FulfillmentStatus)
    ? (value as FulfillmentStatus)
    : fulfillmentStatusFromOrderStatus(status);
}

function normalizePriorityValue(
  value: unknown,
  status: OrderStatus,
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
  return ["Standard", "Pro", "Partner"].includes(
    value as CustomerSnapshot["priceList"]
  )
    ? (value as CustomerSnapshot["priceList"])
    : "Standard";
}

function normalizeWarehouseValue(value: unknown): WarehouseName {
  const warehouse = readString(value);
  const match = warehouses.find(
    (item) => item.toLowerCase() === warehouse?.toLowerCase()
  );

  return match ?? "Milano";
}

function normalizeCarrierValue(value: unknown): Carrier {
  const carrier = readString(value);
  const match = carriers.find(
    (item) => item.toLowerCase() === carrier?.toLowerCase()
  );

  return match ?? "GLS";
}

function priorityForOrder(status: OrderStatus, index: number): Priority {
  if (status === "pending_payment") {
    return "high";
  }

  if (index === 0) {
    return "urgent";
  }

  return "standard";
}

function orderMatchesView(order: AdminOrder, viewMode: ViewMode) {
  if (viewMode === "payments") {
    return order.paymentStatus !== "paid" && order.status !== "cancelled";
  }

  if (viewMode === "shipping") {
    return ["paid", "picking", "shipped"].includes(order.status);
  }

  return true;
}

function getNextOrderStatus(status: OrderStatus) {
  const currentIndex = statusFlow.indexOf(status);

  if (currentIndex === -1 || currentIndex === statusFlow.length - 1) {
    return null;
  }

  return statusFlow[currentIndex + 1];
}

function paymentStatusFromOrderStatus(
  status: OrderStatus,
  currentStatus: PaymentStatus = "unpaid"
): PaymentStatus {
  if (status === "cancelled") {
    return currentStatus === "paid" ? "refunded" : "unpaid";
  }

  if (["paid", "picking", "shipped", "delivered"].includes(status)) {
    return "paid";
  }

  if (status === "draft") {
    return "authorized";
  }

  return currentStatus === "authorized" ? "authorized" : "unpaid";
}

function fulfillmentStatusFromOrderStatus(status: OrderStatus): FulfillmentStatus {
  if (status === "draft" || status === "pending_payment") {
    return "queued";
  }

  if (status === "paid") {
    return "allocated";
  }

  if (status === "picking") {
    return "picking";
  }

  if (status === "shipped") {
    return "shipped";
  }

  if (status === "delivered") {
    return "delivered";
  }

  return "blocked";
}

function updatePickedLines(lines: OrderLine[], status: FulfillmentStatus) {
  if (status === "shipped" || status === "delivered") {
    return lines.map((line) => ({ ...line, picked: line.quantity }));
  }

  if (status === "picking" || status === "packed") {
    return lines.map((line) => ({
      ...line,
      picked: Math.max(line.picked, Math.ceil(line.quantity / 2)),
    }));
  }

  return lines;
}

function prependActivity(order: AdminOrder, message: string) {
  return [`${formatActivityTime()} - ${message}`, ...order.activity].slice(0, 5);
}

function formatActivityTime() {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function formatSyncTime() {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function sourceLabel(source: OrdersSource) {
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

function normalizeOrderStatusValue(value: unknown): OrderStatus {
  return orderStatuses.includes(value as OrderStatus)
    ? (value as OrderStatus)
    : "pending_payment";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadOrdersCsv(orders: AdminOrder[], viewMode: ViewMode) {
  const headers = [
    "id",
    "date",
    "company",
    "status",
    "paymentStatus",
    "fulfillmentStatus",
    "priority",
    "total",
    "items",
    "warehouse",
    "carrier",
    "tracking",
    "lineSkus",
  ];
  const rows = orders.map((order) => [
    order.id,
    order.date,
    order.company,
    orderStatusLabels[order.status],
    paymentStatusLabels[order.paymentStatus],
    fulfillmentStatusLabels[order.fulfillmentStatus],
    priorityLabels[order.priority],
    order.total.toFixed(2),
    order.items,
    order.warehouse,
    order.carrier,
    order.tracking,
    order.lines.map((line) => `${line.sku} x${line.quantity}`).join(" | "),
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((value) => csvEscape(value)).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `partspro-ordini-${viewMode}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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

function sourceBadgeClass(source: OrdersSource) {
  if (source === "admin_api" || source === "supabase") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function orderStatusBadgeClass(status: OrderStatus) {
  if (status === "delivered" || status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "shipped" || status === "picking") {
    return "border-cyan-200 bg-cyan-50 text-cyan-700";
  }

  if (status === "pending_payment" || status === "draft") {
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
