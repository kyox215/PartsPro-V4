"use client";

import * as React from "react";
import Image from "next/image";
import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
  Pencil,
  RefreshCcw,
  Save,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Store,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getAdminDictionary } from "@/i18n/dictionaries/admin";
import { formatEuro } from "@/lib/partspro-data";
import { cn } from "@/lib/utils";
import { useI18n } from "./i18n-provider";

type CustomerStatus = "active" | "pending" | "suspended";
type CustomerType = "retail" | "wholesale";
type AssignmentStatus = "needs_review" | "assigned" | "converted_to_employee" | "archived";
type CustomerTier = "bronze" | "silver" | "gold" | "emerald" | "diamond" | "master" | "king";
type EmployeeRoleTemplate =
  | "admin"
  | "auditor"
  | "catalog_manager"
  | "inventory_manager"
  | "pricing_manager"
  | "purchasing"
  | "sales"
  | "sales_support"
  | "warehouse";

type CustomerMembership = {
  accountType: "customer" | "employee";
  avatarUrl: string | null;
  displayName: string | null;
  email: string | null;
  memberRole: "owner" | "buyer" | "finance" | "support";
  role: string | null;
  roleTemplate: string | null;
  status: "active" | "invited" | "disabled";
  userId: string;
};

type CustomerOrderSummary = {
  createdAt: string;
  id: string;
  lineCount: number;
  orderNo: string;
  paymentStatus: string;
  status: string;
  shipping?: number;
  totalNet?: number;
  total: number;
  vat?: number;
};

type CustomerOrderDetailLine = {
  category?: string;
  fulfilledQty?: number;
  id: string;
  imageAlt?: string;
  imageUrl?: string;
  lineTotal: number;
  name?: string;
  productName?: string;
  quantity: number;
  reservedQty?: number;
  sku: string;
  unitPrice: number;
};

type CustomerOrderDetailEvent = {
  action?: string;
  createdAt: string;
  eventType?: string;
  id: string;
  note?: string;
};

type CustomerOrderDetail = {
  carrier?: string;
  company?: string;
  createdAt: string;
  customerNote?: string;
  date?: string;
  eta?: string;
  fulfillmentStatus?: string;
  id: string;
  items: number;
  lines: CustomerOrderDetailLine[];
  number?: string;
  operationHistory?: CustomerOrderDetailEvent[];
  orderId?: string;
  paymentDue?: string;
  paymentMethod?: string;
  paymentStatus: string;
  service?: string;
  shipping?: number;
  shippingAddress?: string;
  staffNote?: string;
  status: string;
  total: number;
  totalNet?: number;
  tracking?: string;
  vat?: number;
};

type CustomerRmaSummary = {
  createdAt: string;
  id: string;
  orderNo: string;
  productName: string;
  quantity: number;
  requestedResolution: string;
  sku: string;
  status: string;
};

type CustomerAuditEvent = {
  action: string;
  actorEmail: string | null;
  actorRole: string | null;
  createdAt: string;
  id: string;
  reason: string | null;
  result: string;
};

type AdminCustomer = {
  accountOwner: string | null;
  assignedAt: string | null;
  assignmentStatus: AssignmentStatus;
  auditEvents?: CustomerAuditEvent[];
  avgPaymentDays: number | null;
  billingAddress: string;
  city: string;
  codiceDestinatario: string;
  codiceFiscale: string;
  companyName: string;
  contactName: string;
  createdAt: string;
  creditLimit: number;
  customerStatus: CustomerStatus;
  customerType: CustomerType;
  email: string;
  id: string;
  lastContact: string | null;
  memberships?: CustomerMembership[];
  monthlyPurchase: string;
  name: string;
  orders?: CustomerOrderSummary[];
  ordersCount: number;
  overdue: number;
  partitaIva: string;
  paymentTerms: string;
  pec: string;
  phone: string;
  priceGroupId: string | null;
  primarySku: string | null;
  receivables: number;
  registeredAddress: string;
  revenue: number;
  rmas?: CustomerRmaSummary[];
  shippingAddress: string;
  sdi: string;
  status: CustomerStatus;
  tier: CustomerTier;
  updatedAt: string;
  vatNumber: string;
};

type CustomerFacets = {
  active: number;
  creditRisk: number;
  needsReview: number;
  pending: number;
  retail: number;
  suspended: number;
  wholesale: number;
};

type CustomerListResponse = {
  data: AdminCustomer[];
  meta: {
    facets?: CustomerFacets;
    limit: number;
    nextCursor: string | null;
    offset: number;
    returned: number;
    total: number;
  };
};

type CustomerDetailResponse = {
  data: AdminCustomer;
};

type OrderDetailResponse = {
  data: CustomerOrderDetail;
};

type CustomerMutationResponse = {
  data: AdminCustomer;
};

type Notice = {
  tone: "success" | "info" | "warning" | "error";
  message: string;
};

type PendingAction = {
  endpoint: "classification" | "commercial-terms";
  ids: string[];
  payload: Record<string, unknown>;
  summary: string;
  title: string;
};

type CustomerProfileDraft = {
  billingAddress: string;
  companyName: string;
  contactName: string;
  email: string;
  fiscalCode: string;
  pec: string;
  phone: string;
  registeredAddress: string;
  sdi: string;
  shippingAddress: string;
  vatNumber: string;
};

type CustomerTermsDraft = {
  creditLimit: string;
  monthlyPurchase: string;
  paymentTerms: string;
  priceGroupId: string;
  tier: CustomerTier;
};

type CustomerClassificationDraft = {
  customerType: CustomerType;
};

type CustomerEditState =
  | {
      customer: AdminCustomer;
      draft: CustomerProfileDraft;
      kind: "profile";
    }
  | {
      customer: AdminCustomer;
      draft: CustomerTermsDraft;
      kind: "terms";
    }
  | {
      customer: AdminCustomer;
      draft: CustomerClassificationDraft;
      kind: "classification";
    };

type EmployeePromotionState = {
  customer: AdminCustomer;
  membership: CustomerMembership;
  reason: string;
  roleTemplate: EmployeeRoleTemplate;
};

const pageSize = 25;
const allValue = "all";
const tiers: CustomerTier[] = ["bronze", "silver", "gold", "emerald", "diamond", "master", "king"];
const employeeRoleTemplates: EmployeeRoleTemplate[] = [
  "sales_support",
  "sales",
  "warehouse",
  "inventory_manager",
  "catalog_manager",
  "pricing_manager",
  "purchasing",
  "auditor",
  "admin",
];
const emptyFacets: CustomerFacets = {
  active: 0,
  creditRisk: 0,
  needsReview: 0,
  pending: 0,
  retail: 0,
  suspended: 0,
  wholesale: 0,
};

export function AdminCustomersPanel() {
  const { locale } = useI18n();
  const text = getAdminDictionary(locale).admin;
  const copy = text.customers.workbench;
  const [customers, setCustomers] = React.useState<AdminCustomer[]>([]);
  const [detail, setDetail] = React.useState<AdminCustomer | null>(null);
  const [facets, setFacets] = React.useState<CustomerFacets>(emptyFacets);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<CustomerStatus | typeof allValue>(allValue);
  const [customerType, setCustomerType] = React.useState<CustomerType | typeof allValue>(allValue);
  const [assignmentStatus, setAssignmentStatus] = React.useState<AssignmentStatus | typeof allValue>(
    allValue
  );
  const [tier, setTier] = React.useState<CustomerTier | typeof allValue>(allValue);
  const [sort, setSort] = React.useState("created_desc");
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = React.useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [pendingAction, setPendingAction] = React.useState<PendingAction | null>(null);
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [editState, setEditState] = React.useState<CustomerEditState | null>(null);
  const [editReason, setEditReason] = React.useState("");
  const [editSubmitting, setEditSubmitting] = React.useState(false);
  const [promotionState, setPromotionState] = React.useState<EmployeePromotionState | null>(null);
  const [promotionSubmitting, setPromotionSubmitting] = React.useState(false);
  const [orderDetailOpen, setOrderDetailOpen] = React.useState(false);
  const [orderDetail, setOrderDetail] = React.useState<CustomerOrderDetail | null>(null);
  const [orderDetailLoading, setOrderDetailLoading] = React.useState(false);
  const [orderDetailError, setOrderDetailError] = React.useState<string | null>(null);

  const offset = page * pageSize;
  const activeFilterCount = [
    status !== allValue,
    customerType !== allValue,
    assignmentStatus !== allValue,
    tier !== allValue,
  ].filter(Boolean).length;
  const statusOptions = [
    [allValue, copy.allStatuses],
    ["active", statusLabel("active", copy, text.enums.companyStatus.suspended, text.customers.labels.active)],
    ["pending", copy.pendingReview],
    ["suspended", text.enums.companyStatus.suspended],
  ] as const;
  const customerTypeOptions = [
    [allValue, copy.allCustomerTypes],
    ["retail", customerTypeLabel("retail", copy)],
    ["wholesale", customerTypeLabel("wholesale", copy)],
  ] as const;
  const assignmentOptions = [
    [allValue, copy.allAssignments],
    ["needs_review", assignmentStatusLabel("needs_review", copy)],
    ["assigned", assignmentStatusLabel("assigned", copy)],
    ["converted_to_employee", assignmentStatusLabel("converted_to_employee", copy)],
    ["archived", assignmentStatusLabel("archived", copy)],
  ] as const;
  const tierOptions = [
    [allValue, copy.allTiers],
    ...tiers.map((value) => [value, tierLabel(value, copy)] as const),
  ] as const;
  const sortOptions = [
    ["created_desc", copy.sortCreated],
    ["name_asc", copy.sortName],
    ["revenue_desc", copy.sortRevenue],
    ["last_order_desc", copy.sortLastOrder],
  ] as const;

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadCustomers() {
      setLoading(true);
      setNotice(null);

      try {
        const params = new URLSearchParams({
          limit: String(pageSize),
          offset: String(offset),
          sort,
        });

        if (query.trim().length >= 2) {
          params.set("q", query.trim());
        }

        if (status !== allValue) {
          params.set("status", status);
        }

        if (customerType !== allValue) {
          params.set("customerType", customerType);
        }

        if (assignmentStatus !== allValue) {
          params.set("assignmentStatus", assignmentStatus);
        }

        if (tier !== allValue) {
          params.set("tier", tier);
        }

        const payload = await fetchJson<CustomerListResponse>(
          `/api/admin/customers?${params.toString()}`,
          { signal: controller.signal }
        );

        setCustomers(payload.data);
        setFacets(payload.meta.facets ?? emptyFacets);
        emitCustomerReviewCount(payload.meta.facets?.needsReview ?? 0);
        setTotal(payload.meta.total);
        if (payload.data.length === 0) {
          setDetail(null);
        }
        setActiveId((current) =>
          current && payload.data.some((customer) => customer.id === current)
            ? current
            : payload.data[0]?.id ?? null
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          setCustomers([]);
          setNotice({ tone: "error", message: error instanceof Error ? error.message : copy.error });
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadCustomers();

    return () => controller.abort();
  }, [assignmentStatus, copy.error, customerType, offset, query, refreshKey, sort, status, tier]);

  React.useEffect(() => {
    if (!activeId) {
      return;
    }

    const controller = new AbortController();

    async function loadDetail() {
      setDetailLoading(true);

      try {
        const payload = await fetchJson<CustomerDetailResponse>(`/api/admin/customers/${activeId}`, {
          signal: controller.signal,
        });
        setDetail(payload.data);
      } catch (error) {
        if (!controller.signal.aborted) {
          setNotice({ tone: "error", message: error instanceof Error ? error.message : copy.error });
        }
      } finally {
        if (!controller.signal.aborted) {
          setDetailLoading(false);
        }
      }
    }

    loadDetail();

    return () => controller.abort();
  }, [activeId, copy.error, refreshKey]);

  function resetPage() {
    setPage(0);
  }

  function openCustomerDetail(customerId: string) {
    setActiveId(customerId);

    if (window.matchMedia("(max-width: 1023px)").matches) {
      setMobileDetailOpen(true);
    }
  }

  function openSingleAction(action: Omit<PendingAction, "ids">, id: string) {
    setPendingAction({ ...action, ids: [id] });
    setReason("");
  }

  async function openCustomerOrderDetail(order: CustomerOrderSummary) {
    setOrderDetailOpen(true);
    setOrderDetail(null);
    setOrderDetailError(null);
    setOrderDetailLoading(true);

    try {
      const payload = await fetchJson<OrderDetailResponse>(
        `/api/admin/orders/${encodeURIComponent(order.id)}`
      );
      setOrderDetail(payload.data);
    } catch (error) {
      setOrderDetailError(error instanceof Error ? error.message : text.orders.detailError);
      setOrderDetail({
        carrier: "",
        company: detail?.companyName,
        createdAt: order.createdAt,
        fulfillmentStatus: order.status,
        id: order.orderNo,
        items: order.lineCount,
        lines: [],
        number: order.orderNo,
        paymentStatus: order.paymentStatus,
        status: order.status,
        total: order.total,
      });
    } finally {
      setOrderDetailLoading(false);
    }
  }

  function openCustomerEdit(kind: CustomerEditState["kind"], customer: AdminCustomer) {
    setEditState(
      kind === "profile"
        ? {
            customer,
            draft: profileDraftFromCustomer(customer),
            kind,
          }
        : kind === "classification"
          ? {
              customer,
              draft: classificationDraftFromCustomer(customer),
              kind,
            }
          : {
              customer,
              draft: termsDraftFromCustomer(customer),
              kind,
            }
    );
    setEditReason("");
  }

  function openEmployeePromotion(customer: AdminCustomer, membership: CustomerMembership) {
    setPromotionState({
      customer,
      membership,
      reason: "",
      roleTemplate: "sales_support",
    });
  }

  function updateProfileDraft(field: keyof CustomerProfileDraft, value: string) {
    setEditState((current) =>
      current?.kind === "profile"
        ? { ...current, draft: { ...current.draft, [field]: value } }
        : current
    );
  }

  function updateTermsDraft(field: keyof CustomerTermsDraft, value: string) {
    setEditState((current) =>
      current?.kind === "terms"
        ? { ...current, draft: { ...current.draft, [field]: value } }
        : current
    );
  }

  function updateClassificationDraft(field: keyof CustomerClassificationDraft, value: string) {
    setEditState((current) =>
      current?.kind === "classification"
        ? { ...current, draft: { ...current.draft, [field]: value as CustomerType } }
        : current
    );
  }

  async function submitAction() {
    if (!pendingAction || reason.trim().length < 3) {
      return;
    }

    setSubmitting(true);

    try {
      await Promise.all(
        pendingAction.ids.map((id) =>
          fetchJson(`/api/admin/customers/${id}/${pendingAction.endpoint}`, {
            body: JSON.stringify({ ...pendingAction.payload, reason: reason.trim() }),
            headers: { "Content-Type": "application/json" },
            method: "PATCH",
          })
        )
      );

      setNotice({
        tone: "success",
        message: `${pendingAction.title}: ${pendingAction.ids.length}`,
      });
      setPendingAction(null);
      setReason("");
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : copy.error,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCustomerEdit() {
    if (!editState || editReason.trim().length < 3) {
      return;
    }

    const payloadResult = buildCustomerEditPayload(
      editState,
      editReason.trim(),
      copy.invalidCreditLimit
    );

    if (!payloadResult.ok) {
      setNotice({ tone: "error", message: payloadResult.message });
      return;
    }

    setEditSubmitting(true);

    try {
      const endpoint =
        editState.kind === "profile"
          ? "profile"
          : editState.kind === "terms"
            ? "commercial-terms"
            : "classification";
      const response = await fetchJson<CustomerMutationResponse>(
        `/api/admin/customers/${editState.customer.id}/${endpoint}`,
        {
          body: JSON.stringify(payloadResult.payload),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        }
      );

      setCustomers((current) =>
        current.map((customer) =>
          customer.id === response.data.id ? { ...customer, ...response.data } : customer
        )
      );
      setDetail((current) =>
        current?.id === response.data.id ? { ...current, ...response.data } : current
      );
      setNotice({
        tone: "success",
        message:
          editState.kind === "profile"
            ? copy.profileSaved
            : editState.kind === "terms"
              ? copy.termsSaved
              : copy.classificationSaved,
      });
      setEditState(null);
      setEditReason("");
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : copy.error,
      });
    } finally {
      setEditSubmitting(false);
    }
  }

  async function submitEmployeePromotion() {
    if (!promotionState || promotionState.reason.trim().length < 3) {
      return;
    }

    setPromotionSubmitting(true);

    try {
      await fetchJson(
        `/api/admin/customers/${promotionState.customer.id}/members/${promotionState.membership.userId}/promote`,
        {
          body: JSON.stringify({
            reason: promotionState.reason.trim(),
            roleTemplate: promotionState.roleTemplate,
          }),
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          method: "PATCH",
        }
      );

      setNotice({
        tone: "success",
        message: copy.employeePromotionSaved,
      });
      setPromotionState(null);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : copy.error,
      });
    } finally {
      setPromotionSubmitting(false);
    }
  }

  return (
    <section className="min-w-0 space-y-3 text-slate-950" aria-labelledby="customers-workbench-title">
      {notice ? (
        <div
          className={cn(
            "rounded-md border px-3 py-1.5 text-xs leading-5",
            notice.tone === "error"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-border bg-muted/50 text-foreground"
          )}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.message}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(360px,400px)] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 sm:px-4 sm:py-3">
            <div className="min-w-0">
              <h2 id="customers-workbench-title" className="truncate text-lg font-semibold tracking-normal sm:text-xl">
                {copy.title}
              </h2>
              <p className="mt-0.5 line-clamp-1 max-w-3xl text-xs text-muted-foreground">
                {text.customers.description}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 shrink-0 px-2 text-xs sm:h-8 sm:px-2.5"
              onClick={() => setRefreshKey((value) => value + 1)}
            >
              <RefreshCcw />
              {copy.refresh}
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-1 border-b border-slate-200 bg-slate-50/70 px-2 py-1.5 sm:gap-1.5 sm:px-4 sm:py-2">
            <Kpi icon={ShieldAlert} label={copy.pendingReview} value={facets.needsReview} />
            <Kpi icon={CheckCircle2} label={copy.activeCustomers} value={facets.active} />
            <Kpi icon={Store} label={copy.wholesaleCustomers} value={facets.wholesale} />
            <Kpi icon={Building2} label={copy.creditRisk} value={facets.creditRisk} />
          </div>

          <div className="min-w-0 bg-white">
            <div className="grid gap-1.5 border-b border-slate-200 bg-white px-2 py-1.5 sm:px-4 sm:py-2 lg:grid-cols-[minmax(220px,1fr)_minmax(0,1.4fr)] lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Label htmlFor="customer-search" className="sr-only">
                  {copy.search}
                </Label>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground sm:left-3 sm:size-4" />
                <Input
                  id="customer-search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    resetPage();
                  }}
                  placeholder={copy.searchPlaceholder}
                  className="h-7 pl-7 text-[11px] sm:h-8 sm:pl-8 sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-1.5 sm:hidden">
                <Button
                  type="button"
                  variant={mobileFiltersOpen || activeFilterCount > 0 ? "default" : "outline"}
                  size="sm"
                  className="h-7 justify-start gap-1.5 px-2 text-[11px]"
                  onClick={() => setMobileFiltersOpen((open) => !open)}
                >
                  <SlidersHorizontal className="size-3.5" />
                  <span className="min-w-0 truncate">{copy.filters}</span>
                  {activeFilterCount > 0 ? (
                    <Badge className="ml-auto h-4 min-w-4 justify-center px-1 text-[10px]" variant="secondary">
                      {activeFilterCount}
                    </Badge>
                  ) : null}
                </Button>
                <FilterSelect
                  ariaLabel={copy.sort}
                  value={sort}
                  onValueChange={(value) => {
                    setSort(value);
                    resetPage();
                  }}
                  options={sortOptions}
                />
              </div>

              {mobileFiltersOpen ? (
                <div className="grid grid-cols-2 gap-1.5 sm:hidden">
                  <FilterSelect
                    ariaLabel={copy.status}
                    value={status}
                    onValueChange={(value) => {
                      setStatus(value as CustomerStatus | typeof allValue);
                      resetPage();
                    }}
                    options={statusOptions}
                  />
                  <FilterSelect
                    ariaLabel={copy.customerType}
                    value={customerType}
                    onValueChange={(value) => {
                      setCustomerType(value as CustomerType | typeof allValue);
                      resetPage();
                    }}
                    options={customerTypeOptions}
                  />
                  <FilterSelect
                    ariaLabel={copy.filters}
                    value={assignmentStatus}
                    onValueChange={(value) => {
                      setAssignmentStatus(value as AssignmentStatus | typeof allValue);
                      resetPage();
                    }}
                    options={assignmentOptions}
                  />
                  <FilterSelect
                    ariaLabel={text.customers.currentTier}
                    value={tier}
                    onValueChange={(value) => {
                      setTier(value as CustomerTier | typeof allValue);
                      resetPage();
                    }}
                    options={tierOptions}
                  />
                </div>
              ) : null}

              <div className="hidden gap-1.5 sm:grid sm:grid-cols-3 xl:grid-cols-5">
                <FilterSelect
                  ariaLabel={copy.status}
                  value={status}
                  onValueChange={(value) => {
                    setStatus(value as CustomerStatus | typeof allValue);
                    resetPage();
                  }}
                  options={statusOptions}
                />
                <FilterSelect
                  ariaLabel={copy.customerType}
                  value={customerType}
                  onValueChange={(value) => {
                    setCustomerType(value as CustomerType | typeof allValue);
                    resetPage();
                  }}
                  options={customerTypeOptions}
                />
                <FilterSelect
                  ariaLabel={copy.filters}
                  value={assignmentStatus}
                  onValueChange={(value) => {
                    setAssignmentStatus(value as AssignmentStatus | typeof allValue);
                    resetPage();
                  }}
                  options={assignmentOptions}
                />
                <FilterSelect
                  ariaLabel={text.customers.currentTier}
                  value={tier}
                  onValueChange={(value) => {
                    setTier(value as CustomerTier | typeof allValue);
                    resetPage();
                  }}
                  options={tierOptions}
                />
                <FilterSelect
                  ariaLabel={copy.sort}
                  value={sort}
                  onValueChange={(value) => {
                    setSort(value);
                    resetPage();
                  }}
                  options={sortOptions}
                />
              </div>
            </div>

            <div className="min-h-0 min-w-0 bg-white sm:min-h-[320px]">
              <Table className="text-xs sm:text-sm">
              <caption className="sr-only">{copy.title}</caption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="min-w-[180px] px-3 sm:px-2">{text.customers.title}</TableHead>
                  <TableHead scope="col" className="hidden px-2 sm:table-cell">{copy.status}</TableHead>
                  <TableHead scope="col" className="hidden px-2 md:table-cell">{text.customers.currentTier}</TableHead>
                  <TableHead scope="col" className="hidden px-2 text-right sm:table-cell">{text.customers.labels.orderCount}</TableHead>
                  <TableHead scope="col" className="hidden px-2 text-right lg:table-cell">{text.customers.labels.spent}</TableHead>
                  <TableHead scope="col" className="hidden px-2 text-right xl:table-cell">{text.customers.labels.last}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={6} className="p-2">
                        <div className="h-9 animate-pulse rounded-md bg-muted" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                      <div className="space-y-2">
                        <p>{copy.empty}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setQuery("");
                            setStatus(allValue);
                            setCustomerType(allValue);
                            setAssignmentStatus(allValue);
                            setTier(allValue);
                            resetPage();
                          }}
                        >
                          {copy.clearFilters}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow
                      key={customer.id}
                      className={cn(
                        "group cursor-pointer transition-colors hover:bg-slate-50",
                        activeId === customer.id && "bg-primary/5 sm:bg-muted/60"
                      )}
                      onClick={() => openCustomerDetail(customer.id)}
                    >
                      <TableCell className="px-2 py-1.5 sm:px-2">
                        <div
                          className={cn(
                            "sm:hidden rounded-md border border-slate-200 bg-white px-2.5 py-2 shadow-[0_8px_20px_rgba(15,23,42,0.035)] transition-colors group-hover:border-primary/30",
                            activeId === customer.id && "border-primary/35 bg-primary/5"
                          )}
                        >
                          <div className="flex min-w-0 items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold leading-5 text-slate-950">
                                {customer.companyName}
                              </div>
                              <div className="mt-0.5 truncate text-[11px] font-medium leading-4 text-slate-500">
                                {customer.email || customer.vatNumber || copy.noData}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <StatusBadge
                                active={text.customers.labels.active}
                                status={customer.customerStatus}
                                copy={copy}
                                suspended={text.enums.companyStatus.suspended}
                              />
                              <ChevronRight className="size-3.5 text-slate-400" />
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-4 gap-1">
                            <CustomerMobileFact
                              label={copy.customerLevel}
                              value={tierLabel(customer.tier, copy)}
                              emphasis
                            />
                            <CustomerMobileFact
                              label={text.customers.labels.orderCount}
                              value={customer.ordersCount}
                            />
                            <CustomerMobileFact
                              label={text.customers.labels.spent}
                              value={formatEuro(customer.revenue)}
                            />
                            <CustomerMobileFact
                              label={text.customers.labels.last}
                              value={formatDate(customer.lastContact) ?? copy.noData}
                            />
                          </div>
                          <div className="mt-1.5 grid grid-cols-2 gap-1 text-[10px] font-semibold leading-3 text-slate-500">
                            <div className="min-w-0 truncate rounded bg-slate-50 px-1.5 py-1">
                              {text.customers.labels.reference}: {customer.contactName || copy.noData}
                            </div>
                            <div className="min-w-0 truncate rounded bg-slate-50 px-1.5 py-1">
                              {copy.fieldLabels.vat}: {customer.vatNumber || customer.partitaIva || copy.noData}
                            </div>
                          </div>
                        </div>
                        <div className="hidden min-w-0 max-w-[360px] sm:block">
                          <div className="truncate font-medium">{customer.companyName}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {customer.email || customer.vatNumber || copy.noData}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden px-2 py-2 sm:table-cell">
                        <StatusBadge
                          active={text.customers.labels.active}
                          status={customer.customerStatus}
                          copy={copy}
                          suspended={text.enums.companyStatus.suspended}
                        />
                      </TableCell>
                      <TableCell className="hidden px-2 py-2 md:table-cell">{tierLabel(customer.tier, copy)}</TableCell>
                      <TableCell className="hidden px-2 py-2 text-right sm:table-cell">{customer.ordersCount}</TableCell>
                      <TableCell className="hidden px-2 py-2 text-right lg:table-cell">{formatEuro(customer.revenue)}</TableCell>
                      <TableCell className="hidden px-2 py-2 text-right xl:table-cell">{formatDate(customer.lastContact) ?? copy.noData}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              </Table>

            <div className="flex items-center justify-between border-t p-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => setPage((value) => Math.max(value - 1, 0))}
                disabled={page === 0 || loading}
              >
                <ChevronLeft />
                {copy.previousPage}
              </Button>
              <span className="text-xs text-muted-foreground">
                {offset + 1}-{Math.min(offset + customers.length, total)} / {total}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => setPage((value) => value + 1)}
                disabled={offset + customers.length >= total || loading}
              >
                {copy.nextPage}
                <ChevronRight />
              </Button>
            </div>
            </div>
          </div>
        </div>

        <div className="hidden min-w-0 lg:block">
          <CustomerDetail
            copy={copy}
            customer={detail}
            detailLoading={detailLoading}
            onAction={openSingleAction}
            onEdit={openCustomerEdit}
            onOpenOrder={openCustomerOrderDetail}
            onPromoteMember={openEmployeePromotion}
            suspended={text.enums.companyStatus.suspended}
            text={text}
          />
        </div>
      </div>

      <Dialog open={mobileDetailOpen} onOpenChange={setMobileDetailOpen}>
        <DialogContent
          showCloseButton={false}
          className="grid max-h-[calc(100dvh-0.5rem)] w-[calc(100vw-0.5rem)] max-w-[calc(100vw-0.5rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-lg bg-white p-0 sm:max-w-lg lg:hidden"
          style={{ height: "min(760px, calc(100dvh - 0.5rem))" }}
          onClick={(event) => event.stopPropagation()}
          onInteractOutside={(event) => event.preventDefault()}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute right-2 top-2 z-20 size-7 rounded-md bg-white/90 text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-white"
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
          <DialogHeader className="sr-only">
            <DialogTitle>
              {detail?.companyName ?? copy.detailsEmpty}
            </DialogTitle>
            <DialogDescription>
              {detail?.email || detail?.vatNumber || text.customers.description}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto bg-white">
            <CustomerDetail
              copy={copy}
              customer={detail}
              detailLoading={detailLoading}
              embedded
              onAction={openSingleAction}
              onEdit={openCustomerEdit}
              onOpenOrder={openCustomerOrderDetail}
              onPromoteMember={openEmployeePromotion}
              suspended={text.enums.companyStatus.suspended}
              text={text}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && setPendingAction(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{pendingAction?.title ?? copy.confirm}</DialogTitle>
            <DialogDescription>
              {pendingAction?.summary} · {pendingAction?.ids.length ?? 0}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="customer-action-reason">{copy.reason}</Label>
            <Textarea
              id="customer-action-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={copy.reasonPlaceholder}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingAction(null)} disabled={submitting}>
              {copy.cancel}
            </Button>
            <Button onClick={submitAction} disabled={reason.trim().length < 3 || submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              {copy.submit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomerEditDialog
        copy={copy}
        editState={editState}
        onClose={() => {
          setEditState(null);
          setEditReason("");
        }}
        onClassificationChange={updateClassificationDraft}
        onProfileChange={updateProfileDraft}
        onReasonChange={setEditReason}
        onSubmit={submitCustomerEdit}
        onTermsChange={updateTermsDraft}
        reason={editReason}
        submitting={editSubmitting}
        text={text}
      />
      <EmployeePromotionDialog
        copy={copy}
        onClose={() => setPromotionState(null)}
        onReasonChange={(reason) =>
          setPromotionState((current) => (current ? { ...current, reason } : current))
        }
        onRoleTemplateChange={(roleTemplate) =>
          setPromotionState((current) =>
            current ? { ...current, roleTemplate: roleTemplate as EmployeeRoleTemplate } : current
          )
        }
        onSubmit={submitEmployeePromotion}
        promotionState={promotionState}
        submitting={promotionSubmitting}
      />
      <CustomerOrderDetailDialog
        copy={copy}
        error={orderDetailError}
        loading={orderDetailLoading}
        onOpenChange={setOrderDetailOpen}
        open={orderDetailOpen}
        order={orderDetail}
        text={text}
      />
    </section>
  );
}

function CustomerDetail({
  copy,
  customer,
  detailLoading,
  embedded = false,
  onAction,
  onEdit,
  onOpenOrder,
  onPromoteMember,
  suspended,
  text,
}: {
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"];
  customer: AdminCustomer | null;
  detailLoading: boolean;
  embedded?: boolean;
  onAction: (action: Omit<PendingAction, "ids">, id: string) => void;
  onEdit: (kind: CustomerEditState["kind"], customer: AdminCustomer) => void;
  onOpenOrder: (order: CustomerOrderSummary) => void;
  onPromoteMember: (customer: AdminCustomer, membership: CustomerMembership) => void;
  suspended: string;
  text: ReturnType<typeof getAdminDictionary>["admin"];
}) {
  const [tabState, setTabState] = React.useState<{ customerId: string | null; value: string }>({
    customerId: null,
    value: "profile",
  });
  const activeTab = tabState.customerId === customer?.id ? tabState.value : "profile";

  if (detailLoading) {
    return (
      <aside
        className={cn(
          "min-h-full bg-white p-1.5 lg:sticky lg:top-3 lg:min-h-0 lg:max-h-[calc(100vh-96px)] lg:overflow-y-auto lg:p-3 lg:shadow-[0_16px_40px_rgba(15,23,42,0.05)]",
          embedded ? "rounded-none border-0" : "rounded-md border border-slate-200 lg:rounded-lg"
        )}
      >
        <div className="space-y-1.5 lg:space-y-2">
          <div className="h-6 animate-pulse rounded-md bg-muted lg:h-7" />
          <div className="h-16 animate-pulse rounded-md bg-muted lg:h-20" />
          <div className="h-28 animate-pulse rounded-md bg-muted lg:h-36" />
        </div>
      </aside>
    );
  }

  if (!customer) {
    return (
      <aside
        className={cn(
          "grid min-h-full place-items-center bg-white p-2 text-center text-xs text-muted-foreground lg:sticky lg:top-3 lg:min-h-64 lg:p-4 lg:text-sm lg:shadow-[0_16px_40px_rgba(15,23,42,0.05)]",
          embedded ? "rounded-none border-0" : "rounded-md border border-slate-200 lg:rounded-lg"
        )}
      >
        {copy.detailsEmpty}
      </aside>
    );
  }

  const customerStatusChoices: CustomerStatus[] = ["active", "pending", "suspended"];
  const assignmentStatusChoices: AssignmentStatus[] = [
    "needs_review",
    "assigned",
    "converted_to_employee",
    "archived",
  ];
  const statusCopy = (status: CustomerStatus) =>
    statusLabel(status, copy, suspended, text.customers.labels.active);
  const assignmentCopy = (status: AssignmentStatus) => assignmentStatusLabel(status, copy);

  function handleStatusChange(nextStatus: string) {
    if (!customer || nextStatus === customer.customerStatus) {
      return;
    }

    const status = nextStatus as CustomerStatus;
    const label = statusCopy(status);

    onAction(
      {
        endpoint: "classification",
        payload: { status },
        summary: label,
        title: `${copy.status}: ${label}`,
      },
      customer.id
    );
  }

  function handleAssignmentChange(nextAssignment: string) {
    if (!customer || nextAssignment === customer.assignmentStatus) {
      return;
    }

    const assignmentStatus = nextAssignment as AssignmentStatus;
    const label = assignmentCopy(assignmentStatus);

    onAction(
      {
        endpoint: "classification",
        payload:
          assignmentStatus === "archived"
            ? { assignmentStatus, status: "suspended" }
            : { assignmentStatus },
        summary: label,
        title: `${copy.fieldLabels.assignment}: ${label}`,
      },
      customer.id
    );
  }

  const sortedOrders = [...(customer.orders ?? [])].sort(compareCreatedAtDesc);
  const sortedRmas = [...(customer.rmas ?? [])].sort(compareCreatedAtDesc);

  return (
    <aside
      className={cn(
        "min-h-full min-w-0 overflow-hidden bg-white text-slate-950 lg:sticky lg:top-3 lg:min-h-0 lg:max-h-[calc(100vh-96px)] lg:overflow-y-auto lg:shadow-[0_16px_40px_rgba(15,23,42,0.05)]",
        embedded ? "rounded-none border-0" : "rounded-md border border-slate-200 lg:rounded-lg"
      )}
    >
      <div className="border-b border-slate-200 px-2 py-1.5 lg:p-3">
        <div className="flex items-start justify-between gap-2 pr-8 lg:gap-3 lg:pr-0">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <h3 className="min-w-0 truncate text-[15px] font-semibold leading-5 lg:text-base">{customer.companyName}</h3>
              <div className="shrink-0 lg:hidden">
                <StatusBadge
                  active={text.customers.labels.active}
                  status={customer.customerStatus}
                  copy={copy}
                  suspended={suspended}
                />
              </div>
            </div>
            <p className="truncate text-[11px] leading-4 text-muted-foreground lg:text-xs">{customer.email || customer.vatNumber || copy.noData}</p>
          </div>
          <div className="hidden shrink-0 lg:block">
            <StatusBadge
              active={text.customers.labels.active}
              status={customer.customerStatus}
              copy={copy}
              suspended={suspended}
            />
          </div>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-1 lg:mt-2 lg:gap-1.5">
          <StatusChangeSelect
            label={copy.status}
            options={customerStatusChoices.map((status) => [status, statusCopy(status)] as const)}
            value={customer.customerStatus}
            onValueChange={handleStatusChange}
          />
          <StatusChangeSelect
            label={copy.fieldLabels.assignment}
            options={assignmentStatusChoices.map((status) => [status, assignmentCopy(status)] as const)}
            value={customer.assignmentStatus}
            onValueChange={handleAssignmentChange}
          />
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setTabState({ customerId: customer.id, value })}
        className="p-2 lg:p-3"
      >
        <div className="-mx-2 overflow-x-auto px-2 lg:-mx-3 lg:px-3">
          <TabsList className="inline-flex h-7 w-max min-w-full justify-start rounded-md bg-slate-100 p-0.5 lg:h-8">
            <TabsTrigger className="h-6 px-2 text-[11px] lg:h-7 lg:text-xs" value="profile">{copy.profile}</TabsTrigger>
            <TabsTrigger className="h-6 px-2 text-[11px] lg:h-7 lg:text-xs" value="contacts">{copy.contacts}</TabsTrigger>
            <TabsTrigger className="h-6 px-2 text-[11px] lg:h-7 lg:text-xs" value="terms">{copy.commercialTerms}</TabsTrigger>
            <TabsTrigger className="h-6 px-2 text-[11px] lg:h-7 lg:text-xs" value="orders">{copy.ordersRmas}</TabsTrigger>
            <TabsTrigger className="h-6 px-2 text-[11px] lg:h-7 lg:text-xs" value="audit">{copy.activity}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile" className="mt-2 space-y-1.5 lg:mt-3 lg:space-y-2">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] lg:h-8 lg:text-xs" onClick={() => onEdit("profile", customer)}>
              <Pencil />
              {copy.editProfile}
            </Button>
          </div>
          <DetailGrid
            items={[
              {
                actionLabel: copy.editTerms,
                label: copy.customerLevel,
                onClick: () => onEdit("terms", customer),
                value: tierLabel(customer.tier, copy),
              },
              [text.customers.labels.reference, customer.contactName || copy.noData],
              [copy.fieldLabels.email, customer.email || copy.noData],
              [copy.fieldLabels.phone, customer.phone || copy.noData],
              [copy.fieldLabels.vat, customer.vatNumber || customer.partitaIva || copy.noData],
              [text.customers.sdi, customer.sdi || customer.codiceDestinatario || copy.noData],
              {
                actionLabel: copy.customerType,
                label: copy.customerType,
                onClick: () => onEdit("classification", customer),
                value: customerTypeLabel(customer.customerType, copy),
              },
              [copy.status, statusLabel(customer.customerStatus, copy, suspended, text.customers.labels.active)],
              [copy.fieldLabels.assignment, assignmentStatusLabel(customer.assignmentStatus, copy)],
              [copy.fieldLabels.created, formatDate(customer.createdAt) ?? copy.noData],
            ]}
          />
          <AddressBlock label={copy.registeredAddress} value={customer.registeredAddress} fallback={copy.noData} />
          <AddressBlock label={copy.billingAddress} value={customer.billingAddress} fallback={copy.noData} />
          <AddressBlock label={copy.shippingAddress} value={customer.shippingAddress} fallback={copy.noData} />
        </TabsContent>

        <TabsContent value="contacts" className="mt-2 space-y-1.5 lg:mt-3 lg:space-y-2">
          {(customer.memberships ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/70 px-2 py-2 text-xs lg:p-3">
              <div className="flex items-start gap-2">
                <div className="grid size-7 shrink-0 place-items-center rounded-md bg-white text-slate-500 shadow-sm">
                  <Users className="size-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{copy.accountMembersEmptyTitle}</div>
                  <p className="mt-0.5 leading-4 text-muted-foreground">{copy.accountMembersEmptyDescription}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 lg:space-y-2">
              {(customer.memberships ?? []).map((membership) => (
                <div key={membership.userId} className="rounded-md border border-slate-200 bg-white px-1.5 py-1.5 text-xs lg:p-2 lg:text-sm">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{membership.displayName || membership.email || membership.userId}</div>
                      <div className="mt-0.5 truncate text-[11px] text-muted-foreground lg:mt-1 lg:text-xs">
                        {membership.email || copy.noData}
                      </div>
                    </div>
                    <Badge className="shrink-0 text-[10px]" variant="outline">
                      {memberStatusLabel(membership.status, copy)}
                    </Badge>
                  </div>
                  <div className="mt-1 flex min-w-0 items-center gap-1 overflow-hidden rounded bg-slate-50 px-1.5 py-1 text-[11px] font-medium text-slate-600">
                    <span className="truncate">{memberRoleLabel(membership.memberRole, copy)}</span>
                    <span className="text-slate-300">/</span>
                    <span className="truncate">{accountTypeLabel(membership.accountType, copy)}</span>
                  </div>
                  {membership.accountType === "customer" && membership.status !== "disabled" ? (
                    <div className="mt-1.5 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px] lg:h-8 lg:text-xs"
                        onClick={() => onPromoteMember(customer, membership)}
                      >
                        <UserCog />
                        {copy.promoteToEmployee}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="terms" className="mt-2 space-y-1.5 lg:mt-3 lg:space-y-3">
          <CustomerAmountBreakdown
            copy={copy}
            customer={customer}
            text={text}
          />
        </TabsContent>

        <TabsContent value="orders" className="mt-2 space-y-2 lg:mt-3 lg:space-y-4">
          <section>
            <h4 className="mb-1.5 text-xs font-semibold lg:mb-2 lg:text-sm">{text.customers.historyTitle}</h4>
            {sortedOrders.length === 0 ? (
              <EmptyState label={text.customers.historyEmpty} />
            ) : (
              <div className="space-y-1.5 lg:space-y-2">
                {sortedOrders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    className="grid w-full grid-cols-[4.25rem_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md border border-slate-200 bg-white px-1.5 py-1.5 text-left text-xs transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 lg:grid-cols-[5rem_minmax(0,1fr)_auto_auto] lg:p-2 lg:text-sm"
                    onClick={() => onOpenOrder(order)}
                  >
                    <div className="min-w-0 rounded bg-slate-50 px-1.5 py-1 text-center">
                      <div className="truncate font-mono text-[12px] font-bold leading-4 text-slate-950 lg:text-sm">
                        {formatDate(order.createdAt) ?? copy.noData}
                      </div>
                      <div className="truncate text-[10px] font-medium leading-3 text-muted-foreground lg:text-[11px]">
                        {orderStatusLabel(order.status, text)}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold leading-4">{order.orderNo}</div>
                      <div className="mt-0.5 truncate text-[11px] text-muted-foreground lg:text-xs">
                        {orderStatusLabel(order.status, text)}
                      </div>
                    </div>
                    <div className="text-right font-semibold">
                      <div className="whitespace-nowrap">{formatEuro(order.total)}</div>
                      <div className="text-[11px] font-medium text-muted-foreground lg:text-xs">{order.lineCount}</div>
                    </div>
                    <ChevronRight className="size-3.5 text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </section>
          <section>
            <h4 className="mb-1.5 text-xs font-semibold lg:mb-2 lg:text-sm">{text.customers.rmaTitle}</h4>
            {sortedRmas.length === 0 ? (
              <EmptyState label={text.customers.noRma} />
            ) : (
              <div className="space-y-1.5 lg:space-y-2">
                {sortedRmas.map((rma) => (
                  <div key={rma.id} className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-2 rounded-md border border-slate-200 bg-white px-1.5 py-1.5 text-xs lg:grid-cols-[5rem_minmax(0,1fr)] lg:p-2 lg:text-sm">
                    <div className="rounded bg-slate-50 px-1.5 py-1 text-center">
                      <div className="truncate font-mono text-[12px] font-bold leading-4 text-slate-950 lg:text-sm">
                        {formatDate(rma.createdAt) ?? copy.noData}
                      </div>
                      <div className="truncate text-[10px] font-medium leading-3 text-muted-foreground lg:text-[11px]">
                        {rmaStatusLabel(rma.status, text)}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{rma.sku}</div>
                      <div className="truncate text-[11px] text-muted-foreground lg:text-xs">
                        {rma.orderNo || copy.noData} · {rma.quantity}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="audit" className="mt-2 lg:mt-3">
          {(customer.auditEvents ?? []).length === 0 ? (
            <EmptyState label={copy.auditEmpty} />
          ) : (
            <ol className="space-y-1.5 lg:space-y-2">
              {(customer.auditEvents ?? []).map((event) => (
                <li key={event.id} className="rounded-md border border-slate-200 bg-white px-1.5 py-1.5 text-xs lg:p-2 lg:text-sm">
                  <div className="flex items-center justify-between gap-2 lg:gap-3">
                    <span className="font-medium">{event.action}</span>
                    <span className="text-[11px] text-muted-foreground lg:text-xs">{formatDate(event.createdAt)}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground lg:mt-1 lg:text-xs">
                    {event.actorEmail || event.actorRole || copy.noData}
                  </div>
                  {event.reason ? <p className="mt-1.5 text-[11px] lg:mt-2 lg:text-xs">{event.reason}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function CustomerAmountBreakdown({
  copy,
  customer,
  text,
}: {
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"];
  customer: AdminCustomer;
  text: ReturnType<typeof getAdminDictionary>["admin"];
}) {
  const summary = buildCustomerAmountSummary(customer);

  return (
    <div className="space-y-1.5 lg:space-y-3">
      <section className="rounded-md border border-slate-200 bg-white px-2 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold leading-5">{copy.amountBreakdown}</h4>
            <p className="truncate text-[11px] text-muted-foreground lg:text-xs">
              {copy.amountBreakdownHelper}
            </p>
          </div>
          <Badge className={cn("shrink-0 border text-[11px]", creditUsageBadgeClass(summary.usagePercent))} variant="outline">
            {copy.creditUsage}: {formatPercent(summary.usagePercent)}
          </Badge>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1">
          <AmountTile label={copy.totalSpend} value={formatEuro(summary.totalSpend)} emphasis />
          <AmountTile
            label={copy.availableCredit}
            value={formatEuro(summary.availableCredit)}
            tone={summary.availableCredit <= 0 && summary.creditLimit > 0 ? "danger" : "success"}
          />
          <AmountTile label={copy.creditUsed} value={formatEuro(summary.creditUsed)} />
          <AmountTile label={text.customers.labels.creditLimit} value={formatEuro(summary.creditLimit)} />
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn(
              "h-full rounded-full",
              summary.usagePercent >= 90
                ? "bg-red-500"
                : summary.usagePercent >= 70
                  ? "bg-amber-500"
                  : "bg-emerald-500"
            )}
            style={{ width: `${Math.min(summary.usagePercent, 100)}%` }}
          />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-1">
        <AmountTile label={text.customers.metrics.receivables} value={formatEuro(summary.receivables)} />
        <AmountTile
          label={text.customers.metrics.overdue}
          value={formatEuro(summary.overdue)}
          tone={summary.overdue > 0 ? "danger" : "default"}
        />
        <AmountTile label={copy.paidOrdersAmount} value={formatEuro(summary.paidOrdersAmount)} tone="success" />
        <AmountTile
          label={copy.unpaidOrdersAmount}
          value={formatEuro(summary.unpaidOrdersAmount)}
          tone={summary.unpaidOrdersAmount > 0 ? "warning" : "default"}
        />
        <AmountTile label={copy.recentOrdersAmount} value={formatEuro(summary.recentOrdersAmount)} />
        <AmountTile label={copy.averageOrderValue} value={formatEuro(summary.averageOrderValue)} />
      </div>

      <section className="rounded-md border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-2 py-1.5">
          <h4 className="text-xs font-semibold">{copy.recentOrderAmounts}</h4>
          <span className="text-[11px] text-muted-foreground">
            {summary.ordersCount} {text.customers.labels.orderCount}
          </span>
        </div>
        {summary.recentOrders.length === 0 ? (
          <EmptyState label={text.customers.historyEmpty} />
        ) : (
          <div className="divide-y divide-slate-100">
            {summary.recentOrders.map((order) => (
              <div key={order.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-2 py-1.5 text-xs">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{order.orderNo}</div>
                  <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Badge
                      className={cn("h-4 shrink-0 px-1 text-[10px]", paymentStatusBadgeClass(order.paymentStatus))}
                      variant="outline"
                    >
                      {paymentStatusLabel(order.paymentStatus, copy)}
                    </Badge>
                    <span className="truncate">{formatDate(order.createdAt) ?? copy.noData}</span>
                  </div>
                </div>
                <div className="text-right font-semibold">{formatEuro(order.total)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EmployeePromotionDialog({
  copy,
  onClose,
  onReasonChange,
  onRoleTemplateChange,
  onSubmit,
  promotionState,
  submitting,
}: {
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"];
  onClose: () => void;
  onReasonChange: (reason: string) => void;
  onRoleTemplateChange: (roleTemplate: string) => void;
  onSubmit: () => void;
  promotionState: EmployeePromotionState | null;
  submitting: boolean;
}) {
  const memberName =
    promotionState?.membership.displayName ??
    promotionState?.membership.email ??
    promotionState?.membership.userId ??
    copy.noData;

  return (
    <Dialog open={Boolean(promotionState)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.employeePromotionTitle}</DialogTitle>
          <DialogDescription>
            {memberName} · {promotionState?.customer.companyName ?? copy.noData}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <EditField label={copy.employeeRoleTemplate}>
            <Select
              value={promotionState?.roleTemplate ?? "sales_support"}
              onValueChange={onRoleTemplateChange}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {employeeRoleTemplates.map((roleTemplate) => (
                  <SelectItem key={roleTemplate} value={roleTemplate}>
                    {roleTemplateLabel(roleTemplate, copy)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EditField>

          <div className="space-y-2">
            <Label htmlFor="employee-promotion-reason">{copy.reason}</Label>
            <Textarea
              id="employee-promotion-reason"
              value={promotionState?.reason ?? ""}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder={copy.reasonPlaceholder}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {copy.cancel}
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!promotionState || promotionState.reason.trim().length < 3 || submitting}
          >
            {submitting ? <Loader2 className="animate-spin" /> : <UserCog />}
            {copy.promoteToEmployee}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomerOrderDetailDialog({
  copy,
  error,
  loading,
  onOpenChange,
  open,
  order,
  text,
}: {
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"];
  error: string | null;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  order: CustomerOrderDetail | null;
  text: ReturnType<typeof getAdminDictionary>["admin"];
}) {
  const orderNo = order?.number || order?.id || copy.noData;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-md bg-white p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-slate-200 px-3 py-2 text-left">
          <DialogTitle className="truncate text-base font-bold">
            {text.orders.table.order} {orderNo}
          </DialogTitle>
          <DialogDescription className="truncate text-xs">
            {text.orders.detailDialogDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto bg-slate-50/60 p-2">
          {loading && !order ? (
            <div className="space-y-1.5">
              <div className="h-20 animate-pulse rounded-md bg-white" />
              <div className="h-28 animate-pulse rounded-md bg-white" />
              <div className="h-40 animate-pulse rounded-md bg-white" />
            </div>
          ) : null}

          {error ? (
            <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-800">
              {text.orders.detailError}: {error}
            </div>
          ) : null}

          {order ? (
            <div className="space-y-2">
              <section className="rounded-md border border-slate-200 bg-white p-2">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-slate-950">{orderNo}</div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {order.company || copy.noData} · {formatDate(order.createdAt || order.date) ?? copy.noData}
                    </div>
                  </div>
                  {loading ? (
                    <Badge className="border-cyan-200 bg-cyan-50 text-cyan-700" variant="outline">
                      <Loader2 className="size-3 animate-spin" />
                      {text.orders.detailLoading}
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1">
                  <AmountTile label={text.orders.details.orderTotal} value={formatEuro(order.total)} emphasis />
                  <AmountTile label={text.common.payment} value={paymentStatusLabel(order.paymentStatus, copy)} />
                  <AmountTile
                    label={text.orders.details.fulfillment}
                    value={orderStatusLabel(order.fulfillmentStatus || order.status, text)}
                  />
                  <AmountTile label={text.customers.labels.orderCount} value={`${order.items}`} />
                </div>
              </section>

              <section className="rounded-md border border-slate-200 bg-white p-2">
                <h4 className="mb-1.5 text-xs font-semibold">{text.orders.details.logistics}</h4>
                <DetailGrid
                  items={[
                    [text.common.carrier, order.carrier || text.common.none],
                    [copy.fieldLabels.tracking, order.tracking || text.common.none],
                    [text.common.service, valueLabel(order.service, copy) || copy.noData],
                    [text.common.eta, valueLabel(order.eta, copy) || copy.noData],
                  ]}
                />
                {order.shippingAddress ? (
                  <AddressBlock
                    fallback={copy.noData}
                    label={text.orders.details.deliveryAddress}
                    value={order.shippingAddress}
                  />
                ) : null}
              </section>

              <section className="rounded-md border border-slate-200 bg-white p-2">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold">{text.orders.details.orderLines}</h4>
                  <span className="text-[11px] text-muted-foreground">{order.lines.length}</span>
                </div>
                {order.lines.length === 0 ? (
                  <EmptyState label={copy.noData} />
                ) : (
                  <div className="space-y-1.5">
                    {order.lines.map((line) => (
                      <div
                        key={line.id}
                        className="grid grid-cols-[44px_minmax(0,1fr)_auto] gap-2 rounded-md border border-slate-200 px-2 py-1.5 text-xs sm:grid-cols-[48px_minmax(0,1fr)_auto]"
                      >
                        <OrderLineThumb line={line} />
                        <div className="min-w-0">
                          <div className="line-clamp-2 font-semibold leading-4">
                            {line.productName || line.name || line.sku}
                          </div>
                          <div className="mt-0.5 truncate text-[11px] font-mono text-muted-foreground">
                            {line.sku}
                          </div>
                          <div className="mt-1 flex min-w-0 items-center gap-1 overflow-hidden rounded bg-slate-50 px-1.5 py-1 text-[11px] text-slate-600">
                            <span>{text.orders.print.quantity}: {line.quantity}</span>
                            <span className="text-slate-300">/</span>
                            <span>{text.orders.details.fulfillment}: {line.fulfilledQty ?? 0}</span>
                            <span className="text-slate-300">/</span>
                            <span>{text.common.price}: {formatEuro(line.unitPrice)}</span>
                          </div>
                        </div>
                        <div className="text-right font-semibold">{formatEuro(line.lineTotal)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {order.customerNote || order.staffNote ? (
                <section className="rounded-md border border-slate-200 bg-white p-2">
                  <h4 className="mb-1.5 text-xs font-semibold">{text.orders.details.orderNote}</h4>
                  <div className="space-y-1.5">
                    {order.customerNote ? (
                      <AddressBlock
                        fallback={copy.noData}
                        label={text.orders.details.customerNote}
                        value={order.customerNote}
                      />
                    ) : null}
                    {order.staffNote ? (
                      <AddressBlock
                        fallback={copy.noData}
                        label={text.orders.details.staffNote}
                        value={order.staffNote}
                      />
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OrderLineThumb({ line }: { line: CustomerOrderDetailLine }) {
  const fallbackImageUrl = React.useMemo(
    () => getExternalOrderLineImageFallbackUrl(line.imageUrl),
    [line.imageUrl]
  );
  const [failedImageUrls, setFailedImageUrls] = React.useState<string[]>([]);
  const primaryImageUrl = line.imageUrl?.trim() ?? "";
  const imageUrl =
    primaryImageUrl && !failedImageUrls.includes(primaryImageUrl)
      ? primaryImageUrl
      : fallbackImageUrl && !failedImageUrls.includes(fallbackImageUrl)
        ? fallbackImageUrl
        : "";
  const label = line.imageAlt || line.productName || line.name || line.sku;
  const handleImageError = React.useCallback(() => {
    setFailedImageUrls((currentUrls) => {
      if (!imageUrl || currentUrls.includes(imageUrl)) {
        return currentUrls;
      }

      return [...currentUrls, imageUrl];
    });
  }, [imageUrl]);

  return (
    <div className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 sm:h-12 sm:w-12">
      {imageUrl ? (
        <Image
          alt={label}
          className="object-contain p-1"
          fill
          sizes="48px"
          src={imageUrl}
          unoptimized
          onError={handleImageError}
        />
      ) : (
        <Package className="size-4 text-slate-400" />
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

function CustomerEditDialog({
  copy,
  editState,
  onClose,
  onClassificationChange,
  onProfileChange,
  onReasonChange,
  onSubmit,
  onTermsChange,
  reason,
  submitting,
  text,
}: {
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"];
  editState: CustomerEditState | null;
  onClose: () => void;
  onClassificationChange: (field: keyof CustomerClassificationDraft, value: string) => void;
  onProfileChange: (field: keyof CustomerProfileDraft, value: string) => void;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
  onTermsChange: (field: keyof CustomerTermsDraft, value: string) => void;
  reason: string;
  submitting: boolean;
  text: ReturnType<typeof getAdminDictionary>["admin"];
}) {
  const title =
    editState?.kind === "profile"
      ? copy.editProfile
      : editState?.kind === "terms"
        ? copy.editTerms
        : editState?.kind === "classification"
          ? copy.customerType
          : copy.confirm;
  const saveLabel =
    editState?.kind === "profile"
      ? copy.saveProfile
      : editState?.kind === "terms"
        ? copy.saveTerms
        : editState?.kind === "classification"
          ? copy.saveClassification
        : copy.submit;
  const canSubmit =
    Boolean(editState) &&
    reason.trim().length >= 3 &&
    (editState?.kind !== "profile" || editState.draft.companyName.trim().length >= 2);

  return (
    <Dialog open={Boolean(editState)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {editState?.customer.companyName ?? copy.noData}
          </DialogDescription>
        </DialogHeader>

        {editState?.kind === "profile" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <EditField label={copy.companyName}>
              <Input
                className="h-8"
                value={editState.draft.companyName}
                onChange={(event) => onProfileChange("companyName", event.target.value)}
              />
            </EditField>
            <EditField label={copy.contactName}>
              <Input
                className="h-8"
                value={editState.draft.contactName}
                onChange={(event) => onProfileChange("contactName", event.target.value)}
              />
            </EditField>
            <EditField label={copy.fieldLabels.email}>
              <Input
                className="h-8"
                value={editState.draft.email}
                onChange={(event) => onProfileChange("email", event.target.value)}
              />
            </EditField>
            <EditField label={copy.phone}>
              <Input
                className="h-8"
                value={editState.draft.phone}
                onChange={(event) => onProfileChange("phone", event.target.value)}
              />
            </EditField>
            <EditField label={copy.fieldLabels.vat}>
              <Input
                className="h-8"
                value={editState.draft.vatNumber}
                onChange={(event) => onProfileChange("vatNumber", event.target.value)}
              />
            </EditField>
            <EditField label={copy.fiscalCode}>
              <Input
                className="h-8"
                value={editState.draft.fiscalCode}
                onChange={(event) => onProfileChange("fiscalCode", event.target.value)}
              />
            </EditField>
            <EditField label={text.customers.sdi}>
              <Input
                className="h-8"
                value={editState.draft.sdi}
                onChange={(event) => onProfileChange("sdi", event.target.value)}
              />
            </EditField>
            <EditField label={copy.fieldLabels.pec}>
              <Input
                className="h-8"
                value={editState.draft.pec}
                onChange={(event) => onProfileChange("pec", event.target.value)}
              />
            </EditField>
            <EditField className="sm:col-span-2" label={copy.registeredAddress}>
              <Textarea
                value={editState.draft.registeredAddress}
                onChange={(event) => onProfileChange("registeredAddress", event.target.value)}
                className="min-h-16"
                rows={2}
              />
            </EditField>
            <EditField label={copy.billingAddress}>
              <Textarea
                value={editState.draft.billingAddress}
                onChange={(event) => onProfileChange("billingAddress", event.target.value)}
                className="min-h-16"
                rows={2}
              />
            </EditField>
            <EditField label={copy.shippingAddress}>
              <Textarea
                value={editState.draft.shippingAddress}
                onChange={(event) => onProfileChange("shippingAddress", event.target.value)}
                className="min-h-16"
                rows={2}
              />
            </EditField>
          </div>
        ) : null}

        {editState?.kind === "terms" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <EditField label={text.customers.currentTier}>
              <Select
                value={editState.draft.tier}
                onValueChange={(value) => onTermsChange("tier", value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiers.map((value) => (
                    <SelectItem key={value} value={value}>
                      {tierLabel(value, copy)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </EditField>
            <EditField label={copy.priceGroupId}>
              <Input
                className="h-8"
                value={editState.draft.priceGroupId}
                onChange={(event) => onTermsChange("priceGroupId", event.target.value)}
              />
            </EditField>
            <EditField label={text.customers.labels.creditLimit}>
              <Input
                className="h-8"
                inputMode="decimal"
                value={editState.draft.creditLimit}
                onChange={(event) => onTermsChange("creditLimit", event.target.value)}
              />
            </EditField>
            <EditField label={copy.monthlyPurchase}>
              <Input
                className="h-8"
                value={editState.draft.monthlyPurchase}
                onChange={(event) => onTermsChange("monthlyPurchase", event.target.value)}
              />
            </EditField>
            <EditField className="sm:col-span-2" label={text.customers.labels.paymentTerms}>
              <Textarea
                value={editState.draft.paymentTerms}
                onChange={(event) => onTermsChange("paymentTerms", event.target.value)}
                className="min-h-16"
                rows={2}
              />
            </EditField>
          </div>
        ) : null}

        {editState?.kind === "classification" ? (
          <div className="grid gap-2">
            <EditField label={copy.customerType}>
              <Select
                value={editState.draft.customerType}
                onValueChange={(value) => onClassificationChange("customerType", value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retail">{customerTypeLabel("retail", copy)}</SelectItem>
                  <SelectItem value="wholesale">{customerTypeLabel("wholesale", copy)}</SelectItem>
                </SelectContent>
              </Select>
            </EditField>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="customer-edit-reason">{copy.reason}</Label>
          <Textarea
            id="customer-edit-reason"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder={copy.reasonPlaceholder}
            className="min-h-20"
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {copy.cancel}
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit || submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : <Save />}
            {saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditField({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-white px-1.5 py-1.5 shadow-[0_8px_20px_rgba(15,23,42,0.03)] sm:p-2">
      <div className="flex items-center justify-between gap-1 sm:gap-2">
        <span className="min-w-0 truncate text-[10px] leading-3 text-muted-foreground sm:text-xs">{label}</span>
        <Icon className="hidden size-3 shrink-0 text-muted-foreground sm:block sm:size-3.5" />
      </div>
      <div className="mt-0.5 text-base font-semibold leading-none sm:mt-1 sm:text-lg">{value}</div>
    </div>
  );
}

function CustomerMobileFact({
  emphasis = false,
  label,
  value,
}: {
  emphasis?: boolean;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-h-[40px] min-w-0 rounded bg-slate-50 px-1.5 py-1">
      <div className="truncate text-[10px] font-semibold leading-3 text-slate-400">{label}</div>
      <div
        className={cn(
          "mt-0.5 truncate text-[12px] font-black leading-4 text-slate-800",
          emphasis && "text-primary"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function FilterSelect({
  ariaLabel,
  onValueChange,
  options,
  value,
}: {
  ariaLabel: string;
  onValueChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
  value: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger size="sm" className="h-7 w-full px-2 text-[11px] sm:h-8 sm:text-xs" aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([optionValue, label]) => (
          <SelectItem key={optionValue} value={optionValue}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StatusChangeSelect({
  label,
  onValueChange,
  options,
  value,
}: {
  label: string;
  onValueChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50/70 p-1">
      <div className="truncate px-0.5 text-[10px] font-semibold leading-3 text-muted-foreground lg:text-[11px]">
        {label}
      </div>
      <select
        aria-label={label}
        className="mt-1 h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20 lg:h-8 lg:text-xs"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatusBadge({
  active,
  copy,
  status,
  suspended,
}: {
  active: string;
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"];
  status: CustomerStatus;
  suspended: string;
}) {
  return (
    <Badge className={statusBadgeClass(status)} variant="outline">
      {statusLabel(status, copy, suspended, active)}
    </Badge>
  );
}

function AmountTile({
  emphasis,
  label,
  tone = "default",
  value,
}: {
  emphasis?: boolean;
  label: string;
  tone?: "default" | "danger" | "success" | "warning";
  value: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0 rounded-md border px-1.5 py-1.5", amountTileClass(tone, emphasis))}>
      <div className="truncate text-[11px] leading-3 text-muted-foreground lg:text-xs">{label}</div>
      <div className="mt-0.5 truncate text-[13px] font-semibold leading-4 lg:text-sm lg:leading-5">{value}</div>
    </div>
  );
}

type DetailGridItem =
  | [string, React.ReactNode]
  | {
      actionLabel?: string;
      label: string;
      onClick?: () => void;
      value: React.ReactNode;
    };

function DetailGrid({ items }: { items: DetailGridItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-1 text-xs lg:gap-1.5 lg:text-sm">
      {items.map((item) => {
        const normalized = Array.isArray(item)
          ? { label: item[0], value: item[1] }
          : item;
        const content = (
          <>
            <div className="flex min-w-0 items-center justify-between gap-1 text-[11px] leading-3 text-muted-foreground lg:text-xs">
              <span className="min-w-0 truncate">{normalized.label}</span>
              {normalized.onClick ? (
                <Pencil className="size-3 shrink-0 text-primary/70" />
              ) : null}
            </div>
            <div className="mt-0.5 break-words text-[13px] font-semibold leading-4 lg:text-sm lg:leading-5">{normalized.value}</div>
          </>
        );

        if (normalized.onClick) {
          return (
            <button
              key={normalized.label}
              type="button"
              aria-label={normalized.actionLabel ?? normalized.label}
              className="min-w-0 rounded-md border border-primary/25 bg-primary/5 px-1.5 py-1.5 text-left transition hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              onClick={normalized.onClick}
            >
              {content}
            </button>
          );
        }

        return (
          <div key={normalized.label} className="min-w-0 rounded-md border border-slate-200 bg-white px-1.5 py-1.5">
            {content}
          </div>
        );
      })}
    </div>
  );
}

function AddressBlock({ fallback, label, value }: { fallback: string; label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-1.5 py-1.5 text-xs lg:p-2 lg:text-sm">
      <div className="text-[11px] leading-3 text-muted-foreground lg:text-xs">{label}</div>
      <div className="mt-0.5 break-words text-[13px] font-medium leading-4 lg:text-sm lg:leading-5">{value || fallback}</div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-md border border-dashed border-slate-200 px-2 py-2 text-xs text-muted-foreground lg:p-3 lg:text-sm">{label}</div>;
}

function profileDraftFromCustomer(customer: AdminCustomer): CustomerProfileDraft {
  return {
    billingAddress: customer.billingAddress ?? "",
    companyName: customer.companyName ?? "",
    contactName: customer.contactName ?? "",
    email: customer.email ?? "",
    fiscalCode: customer.codiceFiscale ?? "",
    pec: customer.pec ?? "",
    phone: customer.phone ?? "",
    registeredAddress: customer.registeredAddress ?? "",
    sdi: customer.sdi || customer.codiceDestinatario || "",
    shippingAddress: customer.shippingAddress ?? "",
    vatNumber: customer.vatNumber || customer.partitaIva || "",
  };
}

function termsDraftFromCustomer(customer: AdminCustomer): CustomerTermsDraft {
  return {
    creditLimit: String(customer.creditLimit ?? 0),
    monthlyPurchase: customer.monthlyPurchase ?? "",
    paymentTerms: customer.paymentTerms ?? "",
    priceGroupId: customer.priceGroupId ?? "",
    tier: customer.tier,
  };
}

function classificationDraftFromCustomer(customer: AdminCustomer): CustomerClassificationDraft {
  return {
    customerType: customer.customerType,
  };
}

function buildCustomerEditPayload(
  editState: CustomerEditState,
  reason: string,
  invalidCreditLimit: string
): { ok: true; payload: Record<string, unknown> } | { ok: false; message: string } {
  if (editState.kind === "profile") {
    return {
      ok: true,
      payload: {
        billingAddress: nullableDraftText(editState.draft.billingAddress),
        companyName: editState.draft.companyName.trim(),
        contactName: nullableDraftText(editState.draft.contactName),
        email: nullableDraftText(editState.draft.email),
        fiscalCode: nullableDraftText(editState.draft.fiscalCode),
        pec: nullableDraftText(editState.draft.pec),
        phone: nullableDraftText(editState.draft.phone),
        reason,
        registeredAddress: nullableDraftText(editState.draft.registeredAddress),
        sdi: nullableDraftText(editState.draft.sdi),
        shippingAddress: nullableDraftText(editState.draft.shippingAddress),
        vatNumber: nullableDraftText(editState.draft.vatNumber),
      },
    };
  }

  if (editState.kind === "classification") {
    return {
      ok: true,
      payload: {
        customerType: editState.draft.customerType,
        reason,
      },
    };
  }

  const creditLimit = parseDraftMoney(editState.draft.creditLimit);

  if (creditLimit === null) {
    return { ok: false, message: invalidCreditLimit };
  }

  return {
    ok: true,
    payload: {
      creditLimit,
      monthlyPurchase: nullableDraftText(editState.draft.monthlyPurchase),
      paymentTerms: nullableDraftText(editState.draft.paymentTerms),
      priceGroupId: nullableDraftText(editState.draft.priceGroupId),
      reason,
      tier: editState.draft.tier,
    },
  };
}

function nullableDraftText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseDraftMoney(value: string) {
  const normalized = value.trim().replace(",", ".");

  if (normalized.length === 0) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function compareCreatedAtDesc<T extends { createdAt: string }>(first: T, second: T) {
  return timestampForSort(second.createdAt) - timestampForSort(first.createdAt);
}

function timestampForSort(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload) ?? `${response.status}`);
  }

  return payload as T;
}

function readErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const error = (payload as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" ? error.message : null;
}

function emitCustomerReviewCount(count: number) {
  window.dispatchEvent(
    new CustomEvent("partspro:customer-review-count", {
      detail: { count },
    })
  );
}

function statusLabel(
  status: CustomerStatus,
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"],
  suspended: string,
  active: string
) {
  if (status === "active") {
    return active;
  }

  if (status === "suspended") {
    return suspended;
  }

  return copy.pendingReview;
}

function customerTypeLabel(
  value: CustomerType | string,
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"]
) {
  return (copy.customerTypeLabels as Record<string, string>)[value] ?? value;
}

function assignmentStatusLabel(
  value: AssignmentStatus | string,
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"]
) {
  return (copy.assignmentLabels as Record<string, string>)[value] ?? value;
}

function memberRoleLabel(
  value: CustomerMembership["memberRole"] | string,
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"]
) {
  return (copy.memberRoleLabels as Record<string, string>)[value] ?? value;
}

function memberStatusLabel(
  value: CustomerMembership["status"] | string,
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"]
) {
  return (copy.memberStatusLabels as Record<string, string>)[value] ?? value;
}

function accountTypeLabel(
  value: CustomerMembership["accountType"] | string,
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"]
) {
  return (copy.accountTypeLabels as Record<string, string>)[value] ?? value;
}

function roleTemplateLabel(
  value: EmployeeRoleTemplate | string,
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"]
) {
  return (copy.roleTemplateLabels as Record<string, string>)[value] ?? value;
}

function orderStatusLabel(
  value: string | null | undefined,
  text: ReturnType<typeof getAdminDictionary>["admin"]
) {
  if (!value) {
    return "";
  }

  const adminOrderStatus = text.enums.adminOrderStatus as Record<string, string>;
  const orderStatus = text.enums.orderStatus as Record<string, string>;
  const fulfillmentStatus = text.enums.fulfillmentStatus as Record<string, string>;

  return adminOrderStatus[value] ?? orderStatus[value] ?? fulfillmentStatus[value] ?? value;
}

function rmaStatusLabel(
  value: string | null | undefined,
  text: ReturnType<typeof getAdminDictionary>["admin"]
) {
  if (!value) {
    return "";
  }

  return (text.enums.rmaStatus as Record<string, string>)[value] ?? value;
}

function valueLabel(
  value: string | null | undefined,
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"]
) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return "";
  }

  return (copy.valueLabels as Record<string, string>)[trimmed] ?? trimmed;
}

function statusBadgeClass(status: CustomerStatus) {
  if (status === "active") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  }

  if (status === "suspended") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }

  return "border-amber-500/30 bg-amber-500/10 text-amber-700";
}

function amountTileClass(tone: "default" | "danger" | "success" | "warning", emphasis?: boolean) {
  if (tone === "danger") {
    return "border-red-200 bg-red-50/70 text-red-900";
  }

  if (tone === "success") {
    return "border-emerald-200 bg-emerald-50/70 text-emerald-900";
  }

  if (tone === "warning") {
    return "border-amber-200 bg-amber-50/70 text-amber-900";
  }

  return emphasis
    ? "border-blue-200 bg-blue-50/70 text-blue-950"
    : "border-slate-200 bg-white text-slate-950";
}

function buildCustomerAmountSummary(customer: AdminCustomer) {
  const recentOrders = customer.orders ?? [];
  const recentOrdersAmount = roundMoney(
    recentOrders.reduce((total, order) => total + safeMoney(order.total), 0)
  );
  const paidOrdersAmount = roundMoney(
    recentOrders
      .filter((order) => order.paymentStatus === "paid")
      .reduce((total, order) => total + safeMoney(order.total), 0)
  );
  const unpaidOrdersAmount = roundMoney(Math.max(recentOrdersAmount - paidOrdersAmount, 0));
  const receivables = Math.max(safeMoney(customer.receivables), unpaidOrdersAmount);
  const overdue = safeMoney(customer.overdue);
  const creditLimit = safeMoney(customer.creditLimit);
  const creditUsed = Math.max(receivables, overdue);
  const availableCredit = Math.max(creditLimit - creditUsed, 0);
  const totalSpend = safeMoney(customer.revenue);
  const averageOrderValue =
    customer.ordersCount > 0
      ? roundMoney(totalSpend / customer.ordersCount)
      : recentOrders.length > 0
        ? roundMoney(recentOrdersAmount / recentOrders.length)
        : 0;
  const usagePercent =
    creditLimit > 0 ? Math.min(Math.round((creditUsed / creditLimit) * 1000) / 10, 999) : 0;

  return {
    availableCredit,
    averageOrderValue,
    creditLimit,
    creditUsed,
    ordersCount: customer.ordersCount,
    overdue,
    paidOrdersAmount,
    recentOrders: recentOrders.slice(0, 5),
    recentOrdersAmount,
    receivables,
    totalSpend,
    unpaidOrdersAmount,
    usagePercent,
  };
}

function creditUsageBadgeClass(usagePercent: number) {
  if (usagePercent >= 90) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (usagePercent >= 70) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function paymentStatusBadgeClass(status: string) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "failed") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "bank_waiting") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function paymentStatusLabel(
  status: string,
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"]
) {
  if (status === "paid") {
    return copy.paymentPaid;
  }

  if (status === "bank_waiting") {
    return copy.paymentWaiting;
  }

  if (status === "failed") {
    return copy.paymentFailed;
  }

  return copy.paymentPending;
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
    minimumFractionDigits: 0,
  }).format(value)}%`;
}

function safeMoney(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function tierLabel(
  value: CustomerTier | string,
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"]
) {
  if (isCustomerTier(value)) {
    return copy.tierLabels[value];
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isCustomerTier(value: string): value is CustomerTier {
  return tiers.includes(value as CustomerTier);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}
