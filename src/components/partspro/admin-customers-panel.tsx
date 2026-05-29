"use client";

import * as React from "react";
import Image from "next/image";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  ExternalLink,
  ListFilter,
  Loader2,
  MoreVertical,
  Package,
  Pencil,
  RefreshCcw,
  Save,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Store,
  Users,
  X,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getAdminDictionary } from "@/i18n/dictionaries/admin";
import { formatEuro } from "@/lib/partspro-data";
import { CUSTOMER_MANAGE_LEVEL_PERMISSION } from "@/lib/partspro-permissions";
import { cn } from "@/lib/utils";
import { useI18n } from "./i18n-provider";

type CustomerStatus = "pending" | "active" | "suspended";
type CustomerType = "retail" | "wholesale";
type AssignmentStatus = "needs_review" | "assigned" | "converted_to_employee" | "archived";
type CustomerTier = "bronze" | "silver" | "gold" | "emerald" | "diamond" | "master" | "king";

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
  actor?: {
    email?: string | null;
    id?: string | null;
    label?: string | null;
    name?: string | null;
    role?: string | null;
  };
  createdAt: string;
  eventType?: string;
  fromStatus?: string | null;
  id: string;
  metadata?: Record<string, unknown>;
  note?: string;
  toStatus?: string | null;
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

type CustomerAuditEvent = {
  action: string;
  actorEmail: string | null;
  actorRole: string | null;
  createdAt: string;
  entityId?: string | null;
  entityType?: string | null;
  id: string;
  reason: string | null;
  result: string;
};

type CustomerMembership = {
  accountType: "customer" | "employee" | string;
  avatarUrl: string | null;
  createdAt: string;
  customerId: string;
  displayName: string | null;
  email: string | null;
  memberRole: "owner" | "buyer" | "finance" | "support" | string;
  role: string | null;
  roleTemplate: string | null;
  status: "active" | "invited" | "disabled" | string;
  updatedAt: string;
  userId: string;
};

type CustomerRecentActivity = {
  brand?: string | null;
  createdAt: string;
  event_type?: string;
  eventType?: string;
  id: string;
  metadata?: Record<string, unknown>;
  model?: string | null;
  model_series?: string | null;
  modelSeries?: string | null;
  productName?: string | null;
  product_name?: string | null;
  searchQuery?: string | null;
  search_query?: string | null;
  skuCode?: string | null;
  sku_code?: string | null;
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
  monthlyPurchase: string;
  memberships?: CustomerMembership[];
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
  recentActivity?: CustomerRecentActivity[];
  receivables: number;
  revenue: number;
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

type CurrentAccountResponse = {
  permissions?: unknown;
};

type PendingAction = {
  endpoint: "classification";
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
  sdi: string;
  shippingAddress: string;
  vatNumber: string;
};

type CustomerLevelDraft = {
  tier: CustomerTier;
};

type CustomerTermsDraft = {
  creditLimit: string;
  monthlyPurchase: string;
  paymentTerms: string;
  priceGroupId: string;
};

type CustomerClassificationDraft = {
  assignmentStatus: AssignmentStatus;
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
      draft: CustomerLevelDraft;
      kind: "level";
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

const pageSize = 8;
const allValue = "all";
const customerManageTermsPermission = "customers.manage_terms";
const tiers: CustomerTier[] = ["bronze", "silver", "gold", "emerald", "diamond", "master", "king"];
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
  const [currentPermissions, setCurrentPermissions] = React.useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [facets, setFacets] = React.useState<CustomerFacets>(emptyFacets);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<CustomerStatus | typeof allValue>(allValue);
  const [customerType, setCustomerType] = React.useState<CustomerType | typeof allValue>(allValue);
  const [tier, setTier] = React.useState<CustomerTier | typeof allValue>(allValue);
  const [sort, setSort] = React.useState("last_order_desc");
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailSheetOpen, setDetailSheetOpen] = React.useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [pendingAction, setPendingAction] = React.useState<PendingAction | null>(null);
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [editState, setEditState] = React.useState<CustomerEditState | null>(null);
  const [editReason, setEditReason] = React.useState("");
  const [editSubmitting, setEditSubmitting] = React.useState(false);
  const [orderDetailOpen, setOrderDetailOpen] = React.useState(false);
  const [orderDetail, setOrderDetail] = React.useState<CustomerOrderDetail | null>(null);
  const [orderDetailLoading, setOrderDetailLoading] = React.useState(false);
  const [orderDetailError, setOrderDetailError] = React.useState<string | null>(null);

  const offset = page * pageSize;
  const canManageCustomerLevel = currentPermissions.has(CUSTOMER_MANAGE_LEVEL_PERMISSION);
  const canManageCustomerTerms = currentPermissions.has(customerManageTermsPermission);
  const activeFilterCount = [
    status !== allValue,
    customerType !== allValue,
    tier !== allValue,
  ].filter(Boolean).length;
  const statusOptions = [
    [allValue, copy.allStatuses],
    ["pending", copy.pendingReview],
    ["active", statusLabel("active", copy, text.enums.companyStatus.suspended, text.customers.labels.active)],
    ["suspended", text.enums.companyStatus.suspended],
  ] as const;
  const customerTypeOptions = [
    [allValue, copy.allCustomerTypes],
    ["retail", customerTypeLabel("retail", copy)],
    ["wholesale", customerTypeLabel("wholesale", copy)],
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

    async function loadCurrentPermissions() {
      try {
        const payload = await fetchJson<CurrentAccountResponse>("/api/me", {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const permissions = Array.isArray(payload.permissions)
          ? payload.permissions.filter((permission): permission is string => typeof permission === "string")
          : [];

        setCurrentPermissions(new Set(permissions));
      } catch {
        if (!controller.signal.aborted) {
          setCurrentPermissions(new Set());
        }
      }
    }

    void loadCurrentPermissions();

    return () => controller.abort();
  }, []);

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

        if (tier !== allValue) {
          params.set("tier", tier);
        }

        const payload = await fetchJson<CustomerListResponse>(
          `/api/admin/customers?${params.toString()}`,
          { signal: controller.signal }
        );

        setCustomers(payload.data);
        setFacets(payload.meta.facets ?? emptyFacets);
        setTotal(payload.meta.total);
        if (payload.data.length === 0) {
          setDetail(null);
          setDetailSheetOpen(false);
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
  }, [copy.error, customerType, offset, query, refreshKey, sort, status, tier]);

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
    setDetailSheetOpen(true);
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
      setOrderDetail(normalizeCustomerOrderLogistics(payload.data));
    } catch (error) {
      setOrderDetailError(error instanceof Error ? error.message : text.orders.detailError);
      setOrderDetail(normalizeCustomerOrderLogistics({
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
      }));
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
            : kind === "terms"
              ? {
                  customer,
                  draft: termsDraftFromCustomer(customer),
                  kind,
                }
              : {
                  customer,
                  draft: levelDraftFromCustomer(customer),
                  kind,
                }
    );
    setEditReason("");
  }

  function updateProfileDraft(field: keyof CustomerProfileDraft, value: string) {
    setEditState((current) =>
      current?.kind === "profile"
        ? { ...current, draft: { ...current.draft, [field]: value } }
        : current
    );
  }

  function updateLevelDraft(field: keyof CustomerLevelDraft, value: string) {
    setEditState((current) =>
      current?.kind === "level"
        ? { ...current, draft: { ...current.draft, [field]: value as CustomerTier } }
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
        ? {
            ...current,
            draft: {
              ...current.draft,
              [field]:
                field === "assignmentStatus"
                  ? (value as AssignmentStatus)
                  : (value as CustomerType),
            },
          }
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
          : editState.kind === "level"
            ? "level"
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
            : editState.kind === "level"
              ? copy.levelSaved
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

  const shownStart = total === 0 ? 0 : offset + 1;
  const shownEnd = Math.min(offset + customers.length, total);

  return (
    <section className="min-w-0 space-y-3 text-slate-950" aria-labelledby="customers-workbench-title">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id="customers-workbench-title" className="text-xl font-black tracking-normal text-slate-950 sm:text-2xl">
            {copy.title}
          </h2>
          <p className="mt-0.5 line-clamp-1 max-w-3xl text-xs leading-5 text-slate-500 sm:text-sm">
            {text.customers.description}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0 rounded-md bg-white px-2.5 text-xs font-bold shadow-sm"
          onClick={() => setRefreshKey((value) => value + 1)}
        >
          <RefreshCcw className="size-3.5" />
          {copy.refresh}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
        <Kpi icon={Users} label={copy.activeCustomers} tone="blue" value={facets.active} />
        <Kpi icon={Clock} label={copy.pendingReview} tone="amber" value={facets.needsReview} />
        <Kpi icon={BriefcaseBusiness} label={copy.retailCustomers} tone="green" value={facets.retail} />
        <Kpi icon={Store} label={copy.wholesaleCustomers} tone="purple" value={facets.wholesale} />
        <Kpi icon={ShieldAlert} label={text.enums.companyStatus.suspended} tone="red" value={facets.suspended} />
      </div>

      {notice ? (
        <div
          className={cn(
            "flex min-w-0 items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm font-semibold leading-5",
            notice.tone === "error"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          )}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          <span className="flex min-w-0 items-start gap-2">
            {notice.tone === "error" ? (
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            ) : (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            )}
            <span className="min-w-0 break-words">{notice.message}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 shrink-0"
            onClick={() => setNotice(null)}
          >
            <span className="sr-only">{copy.close}</span>
            <X className="size-4" />
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.04)]">
        <div className="grid grid-cols-[minmax(0,1fr)_40px] gap-2 border-b border-slate-200 p-2.5 xl:grid-cols-[minmax(260px,1fr)_auto] xl:items-center">
          <div className="relative min-w-0">
            <Label htmlFor="customer-search" className="sr-only">
              {copy.search}
            </Label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="customer-search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                resetPage();
              }}
              placeholder={copy.searchPlaceholder}
              className="h-9 rounded-md border-slate-200 bg-white pl-9 text-sm shadow-none"
            />
          </div>

          <div className="flex justify-end sm:grid sm:grid-cols-[repeat(4,minmax(108px,128px))] sm:gap-2 xl:grid-cols-[112px_112px_112px_124px] xl:justify-end">
            <div className="hidden sm:block">
              <FilterSelect
                ariaLabel={copy.status}
                value={status}
                onValueChange={(value) => {
                  setStatus(value as CustomerStatus | typeof allValue);
                  resetPage();
                }}
                options={statusOptions}
              />
            </div>
            <div className="hidden sm:block">
              <FilterSelect
                ariaLabel={copy.customerType}
                value={customerType}
                onValueChange={(value) => {
                  setCustomerType(value as CustomerType | typeof allValue);
                  resetPage();
                }}
                options={customerTypeOptions}
              />
            </div>
            <div className="hidden sm:block">
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
            <div className="hidden sm:block">
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
            <Button
              type="button"
              variant={mobileFiltersOpen || activeFilterCount > 0 ? "default" : "outline"}
              size="icon"
              className="size-9 rounded-md sm:hidden"
              onClick={() => setMobileFiltersOpen((open) => !open)}
              aria-label={copy.filters}
            >
              <SlidersHorizontal className="size-4" />
            </Button>
          </div>

          {mobileFiltersOpen ? (
            <div className="col-span-2 grid grid-cols-2 gap-2 sm:hidden">
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
          ) : null}
        </div>

        <div className="hidden min-w-0 overflow-x-auto md:block">
          <Table className="min-w-[860px] table-fixed text-xs">
            <caption className="sr-only">{copy.title}</caption>
            <colgroup>
              <col className="w-[280px]" />
              <col className="w-[86px]" />
              <col className="w-[104px]" />
              <col className="w-[96px]" />
              <col className="w-[68px]" />
              <col className="w-[112px]" />
              <col className="w-[126px]" />
              <col className="w-[44px]" />
            </colgroup>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead scope="col" className="px-3 py-2">{text.customers.title}</TableHead>
                <TableHead scope="col" className="px-2 py-2">{copy.status}</TableHead>
                <TableHead scope="col" className="px-2 py-2">{copy.customerType}</TableHead>
                <TableHead scope="col" className="px-2 py-2">{text.customers.currentTier}</TableHead>
                <TableHead scope="col" className="px-2 py-2 text-right">{text.customers.labels.orderCount}</TableHead>
                <TableHead scope="col" className="px-2 py-2 text-right">{text.customers.labels.spent}</TableHead>
                <TableHead scope="col" className="px-2 py-2 text-right">{copy.recentActivity}</TableHead>
                <TableHead scope="col" className="px-2 py-2 text-right">{text.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: pageSize }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={8} className="p-3">
                      <div className="h-11 animate-pulse rounded-md bg-slate-100" />
                    </TableCell>
                  </TableRow>
                ))
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-44 text-center text-sm text-muted-foreground">
                    <div className="space-y-3">
                      <p>{copy.empty}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setQuery("");
                          setStatus(allValue);
                          setCustomerType(allValue);
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
                  <CustomerDesktopRow
                    key={customer.id}
                    active={activeId === customer.id}
                    copy={copy}
                    customer={customer}
                    onOpen={openCustomerDetail}
                    suspended={text.enums.companyStatus.suspended}
                    text={text}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-2 p-2.5 md:hidden">
          <div className="hidden text-xs font-medium text-slate-500 sm:block">
            {shownStart}-{shownEnd} / {total}
          </div>
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-lg bg-slate-100" />
            ))
          ) : customers.length === 0 ? (
            <EmptyState label={copy.empty} />
          ) : (
            customers.map((customer) => (
              <CustomerMobileCard
                key={customer.id}
                active={detailSheetOpen && activeId === customer.id}
                copy={copy}
                customer={customer}
                onOpen={openCustomerDetail}
                suspended={text.enums.companyStatus.suspended}
                text={text}
              />
            ))
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 p-2.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {shownStart}-{shownEnd} / {total}
          </span>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-md px-2 text-xs"
              onClick={() => setPage((value) => Math.max(value - 1, 0))}
              disabled={page === 0 || loading}
            >
              <ChevronLeft className="size-4" />
              {copy.previousPage}
            </Button>
            <Badge variant="outline" className="h-8 rounded-md px-3 text-xs">
              {page + 1}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-md px-2 text-xs"
              onClick={() => setPage((value) => value + 1)}
              disabled={offset + customers.length >= total || loading}
            >
              {copy.nextPage}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent
          side="right"
          className="!w-full !max-w-none gap-0 overflow-hidden p-0 sm:!w-[560px] sm:!max-w-[560px] xl:!w-[620px] xl:!max-w-[620px]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{detail?.companyName ?? copy.detailsEmpty}</SheetTitle>
            <SheetDescription>
              {detail?.email || detail?.vatNumber || text.customers.description}
            </SheetDescription>
          </SheetHeader>
          <CustomerDetail
            canManageCustomerLevel={canManageCustomerLevel}
            canManageCustomerTerms={canManageCustomerTerms}
            copy={copy}
            customer={detail}
            detailLoading={detailLoading}
            onAction={openSingleAction}
            onEdit={openCustomerEdit}
            onOpenOrder={openCustomerOrderDetail}
            suspended={text.enums.companyStatus.suspended}
            text={text}
          />
        </SheetContent>
      </Sheet>

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
        canManageCustomerLevel={canManageCustomerLevel}
        canManageCustomerTerms={canManageCustomerTerms}
        copy={copy}
        editState={editState}
        onClose={() => {
          setEditState(null);
          setEditReason("");
        }}
        onClassificationChange={updateClassificationDraft}
        onLevelChange={updateLevelDraft}
        onProfileChange={updateProfileDraft}
        onTermsChange={updateTermsDraft}
        onReasonChange={setEditReason}
        onSubmit={submitCustomerEdit}
        reason={editReason}
        submitting={editSubmitting}
        text={text}
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

function CustomerDesktopRow({
  active,
  copy,
  customer,
  onOpen,
  suspended,
  text,
}: {
  active: boolean;
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"];
  customer: AdminCustomer;
  onOpen: (customerId: string) => void;
  suspended: string;
  text: ReturnType<typeof getAdminDictionary>["admin"];
}) {
  return (
    <TableRow
      className={cn(
        "group cursor-pointer border-b border-slate-100 transition-colors hover:bg-blue-50/40",
        active && "bg-blue-50/70 ring-1 ring-inset ring-blue-200"
      )}
      onClick={() => onOpen(customer.id)}
    >
      <TableCell className="px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <CustomerAvatar customer={customer} />
          <div className="min-w-0">
            <div className="truncate font-bold text-slate-950">{customer.companyName}</div>
            <div className="mt-0.5 truncate text-xs text-slate-500">
              {[customer.email, customer.phone].filter(Boolean).join(" · ") || customer.vatNumber || copy.noData}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="px-2 py-2">
        <StatusBadge
          active={text.customers.labels.active}
          status={customer.customerStatus}
          copy={copy}
          suspended={suspended}
        />
      </TableCell>
      <TableCell className="px-2 py-2">
        <Badge className={customerTypeBadgeClass(customer.customerType)} variant="outline">
          {customerTypeLabel(customer.customerType, copy)}
        </Badge>
      </TableCell>
      <TableCell className="px-2 py-2">
        <Badge className={tierBadgeClass(customer.tier)} variant="outline">
          {tierLabel(customer.tier, copy)}
        </Badge>
      </TableCell>
      <TableCell className="px-2 py-2 text-right font-semibold tabular-nums">{customer.ordersCount}</TableCell>
      <TableCell className="whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums">{formatEuro(customer.revenue)}</TableCell>
      <TableCell className="whitespace-nowrap px-2 py-2 text-right text-xs tabular-nums text-slate-500">
        {formatDateTime(customer.lastContact) ?? formatDate(customer.updatedAt) ?? copy.noData}
      </TableCell>
      <TableCell className="px-2 py-2 text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7 rounded-md"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(customer.id);
          }}
          aria-label={text.common.open}
        >
          <MoreVertical className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function CustomerMobileCard({
  active,
  copy,
  customer,
  onOpen,
  suspended,
  text,
}: {
  active: boolean;
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"];
  customer: AdminCustomer;
  onOpen: (customerId: string) => void;
  suspended: string;
  text: ReturnType<typeof getAdminDictionary>["admin"];
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-md border border-slate-200 bg-white p-2.5 text-left shadow-[0_8px_20px_rgba(15,23,42,0.035)] transition hover:border-blue-300 hover:bg-blue-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300",
        active && "border-blue-300 bg-blue-50/50"
      )}
      onClick={() => onOpen(customer.id)}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <CustomerAvatar customer={customer} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-slate-950">{customer.companyName}</div>
              <div className="mt-0.5 truncate text-xs text-slate-500">{customer.email || copy.noData}</div>
            </div>
            <MoreVertical className="size-4 shrink-0 text-slate-400" />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusBadge
              active={text.customers.labels.active}
              status={customer.customerStatus}
              copy={copy}
              suspended={suspended}
            />
            <Badge className={customerTypeBadgeClass(customer.customerType)} variant="outline">
              {customerTypeLabel(customer.customerType, copy)}
            </Badge>
            <Badge className={tierBadgeClass(customer.tier)} variant="outline">
              {tierLabel(customer.tier, copy)}
            </Badge>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <CustomerMobileFact label={text.customers.labels.orderCount} value={customer.ordersCount} />
            <CustomerMobileFact label={text.customers.labels.spent} value={formatEuro(customer.revenue)} emphasis />
            <CustomerMobileFact
              label={text.customers.labels.last}
              value={formatDate(customer.lastContact) ?? formatDate(customer.updatedAt) ?? copy.noData}
            />
          </div>
        </div>
      </div>
    </button>
  );
}

function CustomerDetail({
  canManageCustomerLevel,
  canManageCustomerTerms,
  copy,
  customer,
  detailLoading,
  onAction,
  onEdit,
  onOpenOrder,
  suspended,
  text,
}: {
  canManageCustomerLevel: boolean;
  canManageCustomerTerms: boolean;
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"];
  customer: AdminCustomer | null;
  detailLoading: boolean;
  onAction: (action: Omit<PendingAction, "ids">, id: string) => void;
  onEdit: (kind: CustomerEditState["kind"], customer: AdminCustomer) => void;
  onOpenOrder: (order: CustomerOrderSummary) => void;
  suspended: string;
  text: ReturnType<typeof getAdminDictionary>["admin"];
}) {
  const [tabState, setTabState] = React.useState<{ customerId: string | null; value: string }>({
    customerId: null,
    value: "profile",
  });
  const [orderFilterState, setOrderFilterState] = React.useState<{
    customerId: string | null;
    query: string;
    status: string;
  }>({
    customerId: null,
    query: "",
    status: allValue,
  });
  const activeTab = tabState.customerId === customer?.id ? tabState.value : "profile";
  const orderFilterCustomerId = customer?.id ?? null;
  const orderQuery =
    orderFilterState.customerId === orderFilterCustomerId ? orderFilterState.query : "";
  const orderStatusFilter =
    orderFilterState.customerId === orderFilterCustomerId ? orderFilterState.status : allValue;

  function updateOrderQuery(query: string) {
    setOrderFilterState({
      customerId: orderFilterCustomerId,
      query,
      status: orderStatusFilter,
    });
  }

  function updateOrderStatusFilter(status: string) {
    setOrderFilterState({
      customerId: orderFilterCustomerId,
      query: orderQuery,
      status,
    });
  }

  if (detailLoading) {
    return (
      <div className="h-full min-h-0 bg-white p-5">
        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
          </div>
          <div className="h-72 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="grid h-full min-h-0 place-items-center bg-white p-6 text-center text-sm text-muted-foreground">
        {copy.detailsEmpty}
      </div>
    );
  }

  const customerStatusChoices: CustomerStatus[] = ["pending", "active", "suspended"];
  const statusCopy = (status: CustomerStatus) =>
    statusLabel(status, copy, suspended, text.customers.labels.active);

  function handleStatusChange(nextStatus: string) {
    if (!customer || nextStatus === customer.customerStatus) {
      return;
    }

    const status = nextStatus as CustomerStatus;
    const label = statusCopy(status);
    const payload =
      status === "active"
        ? { assignmentStatus: "assigned", customerType: "wholesale", status }
        : { status };

    onAction(
      {
        endpoint: "classification",
        payload,
        summary: label,
        title: `${copy.status}: ${label}`,
      },
      customer.id
    );
  }

  const sortedOrders = [...(customer.orders ?? [])].sort(compareCreatedAtDesc);
  const sortedMemberships = [...(customer.memberships ?? [])].sort(compareCreatedAtDesc);
  const sortedAdminAudit = [...(customer.auditEvents ?? [])].sort(compareCreatedAtDesc);
  const orderStatusOptions: readonly (readonly [string, string])[] = [
    [allValue, copy.allStatuses],
    ...Array.from(new Set(sortedOrders.map((order) => order.status).filter(Boolean))).map(
      (value) => [value, orderStatusLabel(value, text)] as const
    ),
  ];
  const filteredOrders = sortedOrders.filter((order) => {
    const query = orderQuery.trim().toLowerCase();
    const matchesStatus = orderStatusFilter === allValue || order.status === orderStatusFilter;

    if (!matchesStatus) {
      return false;
    }

    if (!query) {
      return true;
    }

    return [order.orderNo, order.status, order.paymentStatus]
      .some((value) => value.toLowerCase().includes(query));
  });
  const sortedActivity = [...(customer.recentActivity ?? [])].sort(compareCreatedAtDesc);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-slate-950">
      <header className="border-b border-slate-200 px-3 py-3 sm:px-4">
        <div className="flex items-start gap-2.5 pr-9 sm:gap-3">
          <CustomerAvatar customer={customer} size="lg" />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <h3 className="line-clamp-2 min-w-0 text-base font-black leading-5 text-slate-950 [overflow-wrap:anywhere] sm:text-lg sm:leading-6">
                {customer.companyName}
              </h3>
              <StatusBadge
                active={text.customers.labels.active}
                status={customer.customerStatus}
                copy={copy}
                suspended={suspended}
              />
            </div>
            <p className="mt-1 break-words text-xs leading-4 text-slate-500 sm:text-sm sm:leading-5">
              {[customer.email, customer.phone].filter(Boolean).join(" · ") || customer.vatNumber || copy.noData}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge className={customerTypeBadgeClass(customer.customerType)} variant="outline">
                {customerTypeLabel(customer.customerType, copy)}
              </Badge>
              <Badge className={tierBadgeClass(customer.tier)} variant="outline">
                {tierLabel(customer.tier, copy)}
              </Badge>
              <Badge className="border-slate-200 bg-slate-50 text-slate-600" variant="outline">
                {formatDate(customer.createdAt) ?? copy.noData}
              </Badge>
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 divide-x divide-slate-200 rounded-md border border-slate-200 bg-white">
          <SheetMetric label={text.customers.labels.orderCount} value={customer.ordersCount} />
          <SheetMetric label={copy.totalSpend} value={formatEuro(customer.revenue)} />
          <SheetMetric label={copy.customerLevel} value={tierLabel(customer.tier, copy)} />
        </div>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setTabState({ customerId: customer.id, value })}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="grid h-9 rounded-none border-b border-slate-200 bg-white p-0 text-xs font-bold [grid-template-columns:repeat(5,minmax(0,1fr))]">
          <TabsTrigger className="h-9 min-w-0 truncate rounded-none border-b-2 border-transparent px-1 data-[state=active]:border-blue-600 data-[state=active]:bg-white data-[state=active]:text-blue-600" value="profile">{copy.profile}</TabsTrigger>
          <TabsTrigger className="h-9 min-w-0 truncate rounded-none border-b-2 border-transparent px-1 data-[state=active]:border-blue-600 data-[state=active]:bg-white data-[state=active]:text-blue-600" value="orders">{copy.orders}</TabsTrigger>
          <TabsTrigger className="h-9 min-w-0 truncate rounded-none border-b-2 border-transparent px-1 data-[state=active]:border-blue-600 data-[state=active]:bg-white data-[state=active]:text-blue-600" value="members">{copy.contacts}</TabsTrigger>
          <TabsTrigger className="h-9 min-w-0 truncate rounded-none border-b-2 border-transparent px-1 data-[state=active]:border-blue-600 data-[state=active]:bg-white data-[state=active]:text-blue-600" value="adminAudit">{copy.managementAudit}</TabsTrigger>
          <TabsTrigger className="h-9 min-w-0 truncate rounded-none border-b-2 border-transparent px-1 data-[state=active]:border-blue-600 data-[state=active]:bg-white data-[state=active]:text-blue-600" value="activity">{copy.recentActivity}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-0 min-h-0 flex-1 overflow-y-auto p-3">
          <div className="space-y-2.5">
            <DetailSectionCard
              title={copy.customerLevel}
              actionLabel={canManageCustomerLevel ? copy.editLevel : undefined}
              onAction={canManageCustomerLevel ? () => onEdit("level", customer) : undefined}
            >
              <div className="space-y-2.5">
                <CustomerTierRoadmap currentTier={customer.tier} copy={copy} />
                {!canManageCustomerLevel ? (
                  <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold leading-5 text-blue-800">
                    {copy.levelReadonly}
                  </div>
                ) : null}
              </div>
            </DetailSectionCard>

            <DetailSectionCard
              title={copy.commercialTerms}
              actionLabel={canManageCustomerTerms ? copy.editTerms : undefined}
              onAction={canManageCustomerTerms ? () => onEdit("terms", customer) : undefined}
            >
              <DetailGrid
                items={[
                  [copy.priceGroupId, customer.priceGroupId || copy.noData],
                  [text.customers.labels.creditLimit, formatEuro(customer.creditLimit)],
                  [text.customers.labels.paymentTerms, customer.paymentTerms || copy.noData],
                  [copy.monthlyPurchase, customer.monthlyPurchase || copy.noData],
                ]}
              />
            </DetailSectionCard>

            <DetailSectionCard title={copy.profile} actionLabel={text.common.edit} onAction={() => onEdit("profile", customer)}>
              <DetailGrid
                items={[
                  [copy.companyName, customer.companyName || copy.noData],
                  [copy.fieldLabels.phone, customer.phone || copy.noData],
                  [copy.fieldLabels.email, customer.email || copy.noData],
                  [text.customers.labels.reference, customer.contactName || copy.noData],
                  [copy.fieldLabels.vat, customer.vatNumber || customer.partitaIva || copy.noData],
                  [copy.fiscalCode, customer.codiceFiscale || copy.noData],
                ]}
              />
            </DetailSectionCard>

            <DetailSectionCard title={text.common.address} actionLabel={text.common.edit} onAction={() => onEdit("profile", customer)}>
              <div className="grid gap-2 sm:grid-cols-2">
                <AddressBlock label={copy.billingAddress} value={customer.billingAddress} fallback={copy.noData} />
                <AddressBlock label={copy.shippingAddress} value={customer.shippingAddress} fallback={copy.noData} />
              </div>
            </DetailSectionCard>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <DetailSectionCard title={copy.customerType} actionLabel={text.common.edit} onAction={() => onEdit("classification", customer)}>
                <div className="flex flex-wrap gap-1.5">
                  <Badge className={customerTypeBadgeClass(customer.customerType)} variant="outline">
                    {customerTypeLabel(customer.customerType, copy)}
                  </Badge>
                  <Badge className={assignmentStatusBadgeClass(customer.assignmentStatus)} variant="outline">
                    {assignmentStatusLabel(customer.assignmentStatus, copy)}
                  </Badge>
                </div>
              </DetailSectionCard>
              <DetailSectionCard title={copy.status}>
                <StatusChangeSelect
                  label={copy.status}
                  options={customerStatusChoices.map((status) => [status, statusCopy(status)] as const)}
                  value={customer.customerStatus}
                  onValueChange={handleStatusChange}
                />
              </DetailSectionCard>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="mt-0 min-h-0 flex-1 overflow-y-auto p-3">
          <div className="space-y-2.5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={orderQuery}
                  onChange={(event) => updateOrderQuery(event.target.value)}
                  placeholder={text.orders.searchPlaceholder}
                  className="h-9 rounded-md pl-9 text-sm"
                />
              </div>
              <div className="min-w-[132px]">
                <FilterSelect
                  ariaLabel={copy.filters}
                  value={orderStatusFilter}
                  onValueChange={updateOrderStatusFilter}
                  options={orderStatusOptions}
                />
              </div>
            </div>
            {filteredOrders.length === 0 ? (
              <EmptyState label={text.customers.historyEmpty} />
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                {filteredOrders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-slate-100 bg-white px-2.5 py-2 text-left text-sm transition last:border-b-0 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                    onClick={() => onOpenOrder(order)}
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate font-bold text-blue-700">{order.orderNo}</span>
                        <Badge variant="outline" className={customerOrderStatusBadgeClass(order.status)}>
                          {orderStatusLabel(order.status, text)}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatDate(order.createdAt) ?? copy.noData} · {paymentStatusLabel(order.paymentStatus, copy)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <div>
                        <div className="font-bold text-slate-950">{formatEuro(order.total)}</div>
                        <div className="text-xs text-slate-500">{order.lineCount}</div>
                      </div>
                      <ChevronRight className="size-4 text-slate-400" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="members" className="mt-0 min-h-0 flex-1 overflow-y-auto p-3">
          {sortedMemberships.length === 0 ? (
            <div className="space-y-1.5">
              <EmptyState label={copy.accountMembersEmptyTitle} />
              <p className="text-xs leading-5 text-slate-500">{copy.accountMembersEmptyDescription}</p>
            </div>
          ) : (
            <CustomerMembershipList memberships={sortedMemberships} copy={copy} />
          )}
        </TabsContent>

        <TabsContent value="adminAudit" className="mt-0 min-h-0 flex-1 overflow-y-auto p-3">
          {sortedAdminAudit.length === 0 ? (
            <EmptyState label={copy.auditEmpty} />
          ) : (
            <CustomerAdminAuditTimeline events={sortedAdminAudit} copy={copy} />
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-0 min-h-0 flex-1 overflow-y-auto p-3">
          {sortedActivity.length === 0 ? (
            <EmptyState label={copy.recentActivityEmpty} />
          ) : (
            <CustomerActivityTimeline activities={sortedActivity} copy={copy} />
          )}
        </TabsContent>
      </Tabs>
    </div>
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
  const operationHistory = React.useMemo(
    () => [...(order?.operationHistory ?? [])].sort(compareCreatedAtDesc),
    [order?.operationHistory]
  );
  const logistics = order ? customerOrderLogistics(order, copy, text) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-md bg-white p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-slate-200 px-3 py-2 pr-10 text-left">
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
                    tone={customerOrderStatusTone(order.fulfillmentStatus || order.status)}
                  />
                  <AmountTile label={text.customers.labels.orderCount} value={`${order.items}`} />
                </div>
              </section>

              <section className="rounded-md border border-slate-200 bg-white p-2">
                <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold">{text.orders.details.logistics}</h4>
                  {logistics?.status ? (
                    <Badge
                      className={customerOrderStatusBadgeClass(order.fulfillmentStatus || order.status)}
                      variant="outline"
                    >
                      {logistics.status}
                    </Badge>
                  ) : null}
                </div>
                <DetailGrid
                  items={[
                    [text.common.carrier, logistics?.carrier || text.common.none],
                    {
                      label: copy.fieldLabels.tracking,
                      value: logistics ? (
                        <CustomerTrackingValue
                          fallback={text.common.none}
                          tracking={logistics.tracking}
                          trackingUrl={logistics.trackingUrl}
                        />
                      ) : (
                        text.common.none
                      ),
                    },
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
                          <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-slate-600">
                            <span className="rounded bg-slate-50 px-1.5 py-0.5">{text.orders.print.quantity}: {line.quantity}</span>
                            <span className="rounded bg-slate-50 px-1.5 py-0.5">{text.orders.details.fulfillment}: {line.fulfilledQty ?? 0}</span>
                            <span className="rounded bg-slate-50 px-1.5 py-0.5">{text.common.price}: {formatEuro(line.unitPrice)}</span>
                          </div>
                        </div>
                        <div className="w-20 whitespace-nowrap text-right font-semibold tabular-nums">{formatEuro(line.lineTotal)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-md border border-slate-200 bg-white p-2">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold">{text.orders.details.operationHistory}</h4>
                  <span className="text-[11px] text-muted-foreground">{operationHistory.length}</span>
                </div>
                {operationHistory.length === 0 ? (
                  <EmptyState label={copy.noData} />
                ) : (
                  <ol className="space-y-1.5">
                    {operationHistory.map((event) => {
                      const actor = orderOperationActorLabel(event);
                      const statusChange = orderOperationStatusChange(event, text);

                      return (
                        <li
                          key={event.id}
                          className="rounded-md border border-slate-200 bg-slate-50/70 px-2 py-1.5 text-xs"
                        >
                          <div className="flex min-w-0 items-center justify-between gap-2">
                            <span className="truncate font-semibold">
                              {orderOperationActionLabel(event, text)}
                            </span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {formatDateTime(event.createdAt) ?? copy.noData}
                            </span>
                          </div>
                          {actor || statusChange || event.note ? (
                            <div className="mt-1 space-y-0.5 text-[11px] leading-4 text-muted-foreground">
                              {actor || statusChange ? (
                                <div className="break-words">
                                  {[actor, statusChange].filter(Boolean).join(" · ")}
                                </div>
                              ) : null}
                              {event.note ? <div className="break-words">{event.note}</div> : null}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
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
  canManageCustomerLevel,
  canManageCustomerTerms,
  copy,
  editState,
  onClose,
  onClassificationChange,
  onLevelChange,
  onProfileChange,
  onTermsChange,
  onReasonChange,
  onSubmit,
  reason,
  submitting,
  text,
}: {
  canManageCustomerLevel: boolean;
  canManageCustomerTerms: boolean;
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"];
  editState: CustomerEditState | null;
  onClose: () => void;
  onClassificationChange: (field: keyof CustomerClassificationDraft, value: string) => void;
  onLevelChange: (field: keyof CustomerLevelDraft, value: string) => void;
  onProfileChange: (field: keyof CustomerProfileDraft, value: string) => void;
  onTermsChange: (field: keyof CustomerTermsDraft, value: string) => void;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
  reason: string;
  submitting: boolean;
  text: ReturnType<typeof getAdminDictionary>["admin"];
}) {
  const title =
    editState?.kind === "profile"
      ? copy.editProfile
      : editState?.kind === "level"
        ? copy.editLevel
        : editState?.kind === "terms"
          ? copy.editTerms
        : editState?.kind === "classification"
          ? copy.customerType
          : copy.confirm;
  const saveLabel =
    editState?.kind === "profile"
      ? copy.saveProfile
      : editState?.kind === "level"
        ? copy.saveLevel
        : editState?.kind === "terms"
          ? copy.saveTerms
        : editState?.kind === "classification"
          ? copy.saveClassification
        : copy.submit;
  const hasValidTermsDraft =
    editState?.kind === "terms"
      ? canManageCustomerTerms && isValidCreditLimitDraft(editState.draft.creditLimit)
      : true;
  const canSubmit =
    Boolean(editState) &&
    reason.trim().length >= 3 &&
    (editState?.kind !== "level" || canManageCustomerLevel) &&
    hasValidTermsDraft &&
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

        {editState?.kind === "level" ? (
          <div className="grid gap-2">
            {!canManageCustomerLevel ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {copy.levelReadonly}
              </div>
            ) : null}
            <EditField label={text.customers.currentTier}>
              <Select
                value={editState.draft.tier}
                onValueChange={(value) => onLevelChange("tier", value)}
                disabled={!canManageCustomerLevel}
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
          </div>
        ) : null}

        {editState?.kind === "terms" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <EditField label={copy.priceGroupId}>
              <Input
                className="h-8"
                value={editState.draft.priceGroupId}
                onChange={(event) => onTermsChange("priceGroupId", event.target.value)}
                disabled={!canManageCustomerTerms}
              />
            </EditField>
            <EditField label={text.customers.labels.creditLimit}>
              <Input
                className="h-8"
                inputMode="decimal"
                min="0"
                step="0.01"
                type="number"
                value={editState.draft.creditLimit}
                onChange={(event) => onTermsChange("creditLimit", event.target.value)}
                disabled={!canManageCustomerTerms}
              />
            </EditField>
            <EditField label={text.customers.labels.paymentTerms}>
              <Input
                className="h-8"
                value={editState.draft.paymentTerms}
                onChange={(event) => onTermsChange("paymentTerms", event.target.value)}
                disabled={!canManageCustomerTerms}
              />
            </EditField>
            <EditField label={copy.monthlyPurchase}>
              <Input
                className="h-8"
                value={editState.draft.monthlyPurchase}
                onChange={(event) => onTermsChange("monthlyPurchase", event.target.value)}
                disabled={!canManageCustomerTerms}
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
            <EditField label={copy.fieldLabels.assignment}>
              <Select
                value={editState.draft.assignmentStatus}
                onValueChange={(value) => onClassificationChange("assignmentStatus", value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignmentStatuses.map((value) => (
                    <SelectItem key={value} value={value}>
                      {assignmentStatusLabel(value, copy)}
                    </SelectItem>
                  ))}
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

function CustomerAvatar({
  customer,
  size = "default",
}: {
  customer: Pick<AdminCustomer, "companyName" | "email">;
  size?: "default" | "lg";
}) {
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-blue-600 font-black text-white shadow-[0_10px_22px_rgba(37,99,235,0.24)]",
        size === "lg" ? "size-12 text-lg sm:size-14 sm:text-xl" : "size-9 text-xs sm:size-10 sm:text-sm"
      )}
      aria-hidden="true"
    >
      {customerInitials(customer)}
    </div>
  );
}

function SheetMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 px-1.5 py-2 text-center">
      <div className="truncate text-[11px] font-medium leading-3 text-slate-500">{label}</div>
      <div className="mt-1 truncate text-base font-black leading-5 text-slate-950 sm:text-lg">{value}</div>
    </div>
  );
}

function CustomerTierRoadmap({
  copy,
  currentTier,
}: {
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"];
  currentTier: CustomerTier;
}) {
  const currentIndex = Math.max(tiers.indexOf(currentTier), 0);

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/70 px-2.5 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Badge className={cn("h-6 bg-white px-2 text-xs font-black", tierBadgeClass(currentTier))} variant="outline">
          {tierLabel(currentTier, copy)}
        </Badge>
        <span className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">
          {currentIndex + 1}/{tiers.length}
        </span>
      </div>

      <div className="relative pt-0.5" aria-label={copy.customerLevel}>
        <div
          className="absolute left-3 right-3 top-3 grid grid-cols-6 gap-1"
          aria-hidden="true"
        >
          {tiers.slice(0, -1).map((tier, index) => (
            <span
              key={tier}
              className={cn(
                "h-1 rounded-full transition-colors",
                index < currentIndex ? "bg-blue-600" : "bg-slate-200"
              )}
            />
          ))}
        </div>

        <ol className="relative grid grid-cols-7 gap-1">
          {tiers.map((tier, index) => {
            const isComplete = index < currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <li key={tier} className="min-w-0 text-center" aria-current={isCurrent ? "step" : undefined}>
                <div
                  className={cn(
                    "mx-auto grid size-6 place-items-center rounded-full border text-[10px] font-black leading-none shadow-sm transition-colors",
                    isCurrent
                      ? "border-blue-600 bg-white text-blue-700 ring-4 ring-blue-100"
                      : isComplete
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-200 bg-white text-slate-400"
                  )}
                >
                  {index + 1}
                </div>
                <div
                  className={cn(
                    "mt-1 truncate text-[10px] font-black leading-3",
                    isCurrent ? "text-blue-700" : isComplete ? "text-slate-700" : "text-slate-400"
                  )}
                >
                  {tierLabel(tier, copy)}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function DetailSectionCard({
  actionLabel,
  children,
  onAction,
  title,
}: {
  actionLabel?: string;
  children: React.ReactNode;
  onAction?: () => void;
  title: string;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="min-w-0 truncate text-sm font-black text-slate-950">{title}</h4>
        {onAction && actionLabel ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 rounded-md px-2 text-xs font-bold"
            onClick={onAction}
          >
            <Pencil className="size-3.5" />
            {actionLabel}
          </Button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function CustomerMembershipList({
  copy,
  memberships,
}: {
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"];
  memberships: CustomerMembership[];
}) {
  return (
    <div className="space-y-2">
      {memberships.map((membership) => {
        const display = membership.displayName || membership.email || membership.userId;

        return (
          <div
            key={`${membership.customerId}:${membership.userId}`}
            className="rounded-md border border-slate-200 bg-white p-3 text-sm shadow-[0_8px_20px_rgba(15,23,42,0.03)]"
          >
            <div className="flex min-w-0 items-start gap-2.5">
              <div
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full text-xs font-black text-white",
                  membership.accountType === "employee" ? "bg-indigo-600" : "bg-blue-600"
                )}
                aria-hidden="true"
              >
                {initialsFromText(display)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="min-w-0 break-words font-black text-slate-950">
                    {display}
                  </span>
                  <Badge className={membershipAccountTypeBadgeClass(membership.accountType)} variant="outline">
                    {customerAccountTypeLabel(membership.accountType, copy)}
                  </Badge>
                  <Badge className={membershipStatusBadgeClass(membership.status)} variant="outline">
                    {customerMemberStatusLabel(membership.status, copy)}
                  </Badge>
                </div>
                <div className="mt-1 break-words text-xs leading-5 text-slate-500">
                  {membership.email || membership.userId}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge className="border-slate-200 bg-slate-50 text-slate-600" variant="outline">
                    {customerMemberRoleLabel(membership.memberRole, copy)}
                  </Badge>
                  {membership.accountType === "employee" ? (
                    <Badge className="border-indigo-200 bg-indigo-50 text-indigo-700" variant="outline">
                      {customerRoleTemplateLabel(membership.roleTemplate || membership.role, copy)}
                    </Badge>
                  ) : null}
                  <Badge className="border-slate-200 bg-slate-50 text-slate-500" variant="outline">
                    {formatDate(membership.createdAt) ?? copy.noData}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CustomerAdminAuditTimeline({
  copy,
  events,
}: {
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"];
  events: CustomerAuditEvent[];
}) {
  return (
    <ol className="relative space-y-0 before:absolute before:bottom-5 before:left-4 before:top-4 before:w-px before:bg-slate-200 sm:before:left-5">
      {events.map((event) => (
        <li key={event.id} className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-2.5 pb-4 last:pb-0 sm:grid-cols-[40px_minmax(0,1fr)] sm:gap-3">
          <div
            className="relative z-10 grid size-8 place-items-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 shadow-sm sm:size-10"
            aria-hidden="true"
          >
            <ShieldAlert className="size-3.5 sm:size-4" />
          </div>
          <div className="min-w-0 border-b border-slate-100 pb-3 last:border-b-0">
            <div className="min-w-0 sm:flex sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <div className="break-words text-sm font-black text-slate-950">
                  {customerAdminAuditLabel(event.action)}
                </div>
                <div className="mt-0.5 break-words text-xs leading-5 text-slate-500 sm:text-sm">
                  {[event.actorEmail, event.actorRole, event.entityType]
                    .filter(Boolean)
                    .join(" · ") || copy.noData}
                </div>
              </div>
              <span className="mt-0.5 block text-[11px] font-medium text-slate-500 sm:mt-0 sm:shrink-0 sm:whitespace-nowrap sm:text-xs">
                {formatDateTime(event.createdAt) ?? copy.noData}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge className="border-slate-200 bg-slate-50 text-slate-600" variant="outline">
                {event.result || "ok"}
              </Badge>
              {event.reason ? (
                <span className="min-w-0 break-words text-xs leading-5 text-slate-600">
                  {event.reason}
                </span>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function CustomerActivityTimeline({
  activities,
  copy,
}: {
  activities: CustomerRecentActivity[];
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"];
}) {
  return (
    <ol className="relative space-y-0 before:absolute before:bottom-5 before:left-4 before:top-4 before:w-px before:bg-slate-200 sm:before:left-5">
      {activities.map((event) => {
        const visual = activityVisual(event);
        const Icon = visual.icon;

        return (
          <li key={event.id} className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-2.5 pb-4 last:pb-0 sm:grid-cols-[40px_minmax(0,1fr)] sm:gap-3">
            <div
              className={cn(
                "relative z-10 grid size-8 place-items-center rounded-full border bg-white shadow-sm sm:size-10",
                visual.className
              )}
              aria-hidden="true"
            >
              <Icon className="size-3.5 sm:size-4" />
            </div>
            <div className="min-w-0 border-b border-slate-100 pb-3 last:border-b-0">
              <div className="min-w-0 sm:flex sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-slate-950">
                    {customerActivityLabel(event, copy)}
                  </div>
                  <div className="mt-0.5 break-words text-xs leading-5 text-slate-500 sm:text-sm">
                    {customerActivityDescription(event, copy)}
                  </div>
                </div>
                <span className="mt-0.5 block text-[11px] font-medium text-slate-500 sm:mt-0 sm:shrink-0 sm:whitespace-nowrap sm:text-xs">
                  {formatDateTime(event.createdAt) ?? copy.noData}
                </span>
              </div>
              <ActivityMetadata event={event} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ActivityMetadata({ event }: { event: CustomerRecentActivity }) {
  const eventType = event.eventType || event.event_type || "";
  const metadata = event.metadata ?? {};
  const sku =
    event.skuCode ||
    event.sku_code ||
    (typeof metadata.sku === "string" ? metadata.sku : "") ||
    (typeof metadata.skuCode === "string" ? metadata.skuCode : "");
  const brand = event.brand || (typeof metadata.brand === "string" ? metadata.brand : "");
  const model =
    event.model ||
    event.modelSeries ||
    event.model_series ||
    (typeof metadata.model === "string" ? metadata.model : "");
  const query =
    event.searchQuery ||
    event.search_query ||
    (typeof metadata.query === "string" ? metadata.query : "") ||
    (typeof metadata.searchQuery === "string" ? metadata.searchQuery : "");
  const orderNo =
    typeof metadata.orderNo === "string"
      ? metadata.orderNo
      : typeof metadata.order_no === "string"
        ? metadata.order_no
        : "";
  const parts = [
    sku ? `SKU: ${sku}` : null,
    brand ? `Brand: ${brand}` : null,
    model ? `Model: ${model}` : null,
    query ? `Keywords: ${query}` : null,
    orderNo ? `Order: ${orderNo}` : null,
  ].filter((value): value is string => Boolean(value));

  if (parts.length === 0 || eventType === "catalog_filter") {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs leading-4 text-slate-500">
      {parts.map((part) => (
        <span key={part}>{part}</span>
      ))}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "amber" | "blue" | "green" | "purple" | "red";
  value: number;
}) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-white p-2.5 shadow-[0_10px_26px_rgba(15,23,42,0.035)]">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className={cn("grid size-9 shrink-0 place-items-center rounded-full text-white shadow-sm", kpiToneClass(tone))}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xl font-black leading-6 text-slate-950">{value}</div>
          <div className="mt-0.5 truncate text-xs font-medium leading-4 text-slate-500">{label}</div>
        </div>
      </div>
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
    <div className="min-h-[38px] min-w-0 rounded bg-slate-50 px-1.5 py-1">
      <div className="truncate text-[10px] font-semibold leading-3 text-slate-400">{label}</div>
      <div
        className={cn(
          "mt-0.5 truncate text-[11px] font-black leading-4 text-slate-800",
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
      <SelectTrigger size="sm" className="h-9 w-full rounded-md px-2 text-xs" aria-label={ariaLabel}>
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
  tone?: "default" | "danger" | "success" | "warning" | "info";
  value: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0 rounded-md border px-1.5 py-1.5", amountTileClass(tone, emphasis))}>
      <div className="truncate text-[11px] leading-3 text-muted-foreground lg:text-xs">{label}</div>
      <div className="mt-0.5 truncate text-[13px] font-semibold leading-4 lg:text-sm lg:leading-5">{value}</div>
    </div>
  );
}

function CustomerTrackingValue({
  fallback,
  tracking,
  trackingUrl,
}: {
  fallback: string;
  tracking: string;
  trackingUrl: string | null;
}) {
  if (!tracking) {
    return fallback;
  }

  if (!trackingUrl) {
    return <span className="font-black text-slate-900">{tracking}</span>;
  }

  return (
    <a
      href={trackingUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-w-0 items-center gap-1 font-black text-blue-700 underline-offset-2 hover:underline"
      aria-label={tracking}
    >
      <span className="min-w-0 truncate">{tracking}</span>
      <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
    </a>
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
    <div className="grid grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-1 text-xs sm:gap-1.5 sm:text-sm">
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
            <div className="mt-0.5 break-words text-[13px] font-semibold leading-4 [overflow-wrap:anywhere] lg:text-sm lg:leading-5">{normalized.value}</div>
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
      <div className="mt-0.5 break-words text-[13px] font-medium leading-4 [overflow-wrap:anywhere] lg:text-sm lg:leading-5">{value || fallback}</div>
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
    sdi: customer.sdi || customer.codiceDestinatario || "",
    shippingAddress: customer.shippingAddress ?? "",
    vatNumber: customer.vatNumber || customer.partitaIva || "",
  };
}

function levelDraftFromCustomer(customer: AdminCustomer): CustomerLevelDraft {
  return {
    tier: customer.tier,
  };
}

function termsDraftFromCustomer(customer: AdminCustomer): CustomerTermsDraft {
  return {
    creditLimit: Number.isFinite(customer.creditLimit) ? String(customer.creditLimit) : "0",
    monthlyPurchase: customer.monthlyPurchase ?? "",
    paymentTerms: customer.paymentTerms ?? "",
    priceGroupId: customer.priceGroupId ?? "",
  };
}

function classificationDraftFromCustomer(customer: AdminCustomer): CustomerClassificationDraft {
  return {
    assignmentStatus: customer.assignmentStatus,
    customerType: customer.customerType,
  };
}

function buildCustomerEditPayload(
  editState: CustomerEditState,
  reason: string,
  invalidCreditLimitMessage: string
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
        assignmentStatus: editState.draft.assignmentStatus,
        customerType: editState.draft.customerType,
        reason,
      },
    };
  }

  if (editState.kind === "terms") {
    const creditLimit = normalizeCreditLimitDraft(editState.draft.creditLimit);

    if (creditLimit === null) {
      return { ok: false, message: invalidCreditLimitMessage };
    }

    return {
      ok: true,
      payload: {
        creditLimit,
        monthlyPurchase: nullableDraftText(editState.draft.monthlyPurchase),
        paymentTerms: nullableDraftText(editState.draft.paymentTerms),
        priceGroupId: nullableDraftText(editState.draft.priceGroupId),
        reason,
      },
    };
  }

  return {
    ok: true,
    payload: {
      level: editState.draft.tier,
      reason,
    },
  };
}

function nullableDraftText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidCreditLimitDraft(value: string) {
  return normalizeCreditLimitDraft(value) !== null;
}

function normalizeCreditLimitDraft(value: string) {
  const trimmed = value.trim().replace(",", ".");
  const amount = Number(trimmed);

  return trimmed.length > 0 && Number.isFinite(amount) && amount >= 0 && amount <= 999999999
    ? amount
    : null;
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

function statusLabel(
  status: CustomerStatus,
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"],
  suspended: string,
  active: string
) {
  if (status === "pending") {
    return copy.pendingReview;
  }

  if (status === "active") {
    return active;
  }

  if (status === "suspended") {
    return suspended;
  }

  return active;
}

function customerTypeLabel(
  value: CustomerType | string,
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"]
) {
  return (copy.customerTypeLabels as Record<string, string>)[value] ?? value;
}

const assignmentStatuses: AssignmentStatus[] = [
  "needs_review",
  "assigned",
  "converted_to_employee",
  "archived",
];

function assignmentStatusLabel(
  value: AssignmentStatus | string,
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"]
) {
  return (copy.assignmentLabels as Record<string, string>)[value] ?? value;
}

function customerAccountTypeLabel(
  value: string,
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"]
) {
  return (copy.accountTypeLabels as Record<string, string>)[value] ?? value;
}

function customerMemberRoleLabel(
  value: string,
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"]
) {
  return (copy.memberRoleLabels as Record<string, string>)[value] ?? value;
}

function customerMemberStatusLabel(
  value: string,
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"]
) {
  return (copy.memberStatusLabels as Record<string, string>)[value] ?? value;
}

function customerRoleTemplateLabel(
  value: string | null | undefined,
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"]
) {
  return value ? (copy.roleTemplateLabels as Record<string, string>)[value] ?? value : copy.noData;
}

function customerAdminAuditLabel(value: string) {
  const labels: Record<string, string> = {
    "account.role_update": "员工角色更新",
    "account.type_update": "账号类型更新",
    "customer.classification_update": "客户分类更新",
    "customer.level_update": "客户等级更新",
    "customer.profile_update": "客户档案更新",
    "customer.terms_update": "商业条款更新",
    "permissions.update": "权限覆盖更新",
  };

  return labels[value] ?? value;
}

function customerActivityLabel(
  event: CustomerRecentActivity,
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"]
) {
  const eventType = event.eventType || event.event_type || "";

  return (copy.recentActivityLabels as Record<string, string>)[eventType] ?? eventType;
}

function customerActivityDescription(
  event: CustomerRecentActivity,
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"]
) {
  const primary =
    event.productName ||
    event.product_name ||
    event.skuCode ||
    event.sku_code ||
    event.searchQuery ||
    event.search_query ||
    event.model ||
    event.modelSeries ||
    event.model_series ||
    event.brand;
  const context = [event.brand, event.modelSeries || event.model_series, event.model]
    .filter((value): value is string => Boolean(value))
    .join(" / ");
  const metadataDescription = customerActivityMetadataDescription(event.metadata);

  if (primary && context && primary !== context) {
    return `${primary} · ${context}`;
  }

  return primary || context || metadataDescription || copy.noData;
}

function customerActivityMetadataDescription(metadata: Record<string, unknown> | undefined) {
  if (!metadata) {
    return "";
  }

  const category = typeof metadata.category === "string" ? metadata.category.trim() : "";
  const inStockOnly = metadata.inStockOnly === true;
  const parts = [
    category ? `Categoria: ${category}` : null,
    inStockOnly ? "Solo disponibili" : null,
  ].filter((value): value is string => Boolean(value));

  return parts.join(" · ");
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

function normalizeCustomerOrderLogistics(order: CustomerOrderDetail): CustomerOrderDetail {
  const parsed = parseCarrierTrackingFromService(order.service);
  const carrier = cleanLogisticsText(order.carrier) || parsed.carrier;
  const tracking = cleanLogisticsText(order.tracking) || parsed.tracking;

  return {
    ...order,
    carrier,
    tracking,
  };
}

function customerOrderLogistics(
  order: CustomerOrderDetail,
  copy: ReturnType<typeof getAdminDictionary>["admin"]["customers"]["workbench"],
  text: ReturnType<typeof getAdminDictionary>["admin"]
) {
  const normalizedOrder = normalizeCustomerOrderLogistics(order);
  const carrier = cleanLogisticsText(normalizedOrder.carrier);
  const tracking = cleanLogisticsText(normalizedOrder.tracking);
  const status =
    valueLabel(order.eta, copy) ||
    orderStatusLabel(order.fulfillmentStatus || order.status, text);

  return {
    carrier,
    status,
    tracking,
    trackingUrl: buildCustomerCarrierTrackingUrl(carrier, tracking),
  };
}

function parseCarrierTrackingFromService(service: string | null | undefined) {
  const normalized = cleanLogisticsText(service);

  if (!normalized) {
    return { carrier: "", tracking: "" };
  }

  const match = normalized.match(/^(.+?)\s*(?:\/|\||·)\s*([A-Z0-9][A-Z0-9-]{4,})$/i);

  if (!match) {
    return { carrier: "", tracking: "" };
  }

  const carrier = cleanLogisticsText(match[1]);
  const tracking = cleanLogisticsText(match[2]);

  if (!carrier || !isTrackingCandidate(tracking)) {
    return { carrier: "", tracking: "" };
  }

  return { carrier, tracking };
}

function isTrackingCandidate(value: string) {
  return /^[A-Z0-9][A-Z0-9-]{4,}$/i.test(value) && /\d/.test(value);
}

function cleanLogisticsText(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";

  if (!normalized || /^(none|n\/a|null|undefined|无|暂无数据)$/i.test(normalized)) {
    return "";
  }

  return normalized;
}

function buildCustomerCarrierTrackingUrl(carrier: string, tracking: string) {
  const normalizedCarrier = carrier.toLowerCase();
  const encodedTracking = encodeURIComponent(tracking.trim());

  if (!encodedTracking || normalizedCarrier.includes("ritiro")) {
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

function customerOrderStatusBadgeClass(status: string | null | undefined) {
  const normalized = (status ?? "").toLowerCase();

  if (normalized === "cancelled" || normalized === "canceled" || normalized === "failed") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (normalized === "submitted" || normalized === "draft" || normalized === "pending") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (normalized === "completed" || normalized === "delivered") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalized === "accepted" || normalized === "paid") {
    return "border-teal-200 bg-teal-50 text-teal-700";
  }

  if (normalized === "picking" || normalized === "packed") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (normalized === "shipped") {
    return "border-cyan-200 bg-cyan-50 text-cyan-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function customerOrderStatusTone(
  status: string | null | undefined
): "default" | "danger" | "success" | "warning" | "info" {
  const normalized = (status ?? "").toLowerCase();

  if (normalized === "cancelled" || normalized === "canceled" || normalized === "failed") {
    return "danger";
  }

  if (normalized === "completed" || normalized === "delivered" || normalized === "accepted") {
    return "success";
  }

  if (normalized === "picking" || normalized === "packed") {
    return "warning";
  }

  if (normalized === "submitted" || normalized === "draft" || normalized === "pending" || normalized === "shipped") {
    return "info";
  }

  return "default";
}

function orderOperationActionLabel(
  event: CustomerOrderDetailEvent,
  text: ReturnType<typeof getAdminDictionary>["admin"]
) {
  const value = event.action || event.eventType;

  if (!value) {
    return "Evento";
  }

  const activityLabels = text.orders.activity as Record<string, string>;

  if (activityLabels[value]) {
    return activityLabels[value];
  }

  return value
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function orderOperationActorLabel(event: CustomerOrderDetailEvent) {
  return (
    event.actor?.label ||
    event.actor?.name ||
    event.actor?.email ||
    event.actor?.role ||
    event.actor?.id ||
    ""
  );
}

function orderOperationStatusChange(
  event: CustomerOrderDetailEvent,
  text: ReturnType<typeof getAdminDictionary>["admin"]
) {
  if (!event.fromStatus || !event.toStatus || event.fromStatus === event.toStatus) {
    return "";
  }

  return `${orderStatusLabel(event.fromStatus, text)} -> ${orderStatusLabel(event.toStatus, text)}`;
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

function customerInitials(customer: Pick<AdminCustomer, "companyName" | "email">) {
  const source = customer.companyName || customer.email || "?";
  const parts = source
    .replace(/[^\p{L}\p{N}@._ -]/gu, " ")
    .split(/[\s@._-]+/)
    .filter(Boolean);
  const initials = `${parts[0]?.[0] ?? "?"}${parts[1]?.[0] ?? ""}`;

  return initials.toUpperCase().slice(0, 2);
}

function kpiToneClass(tone: "amber" | "blue" | "green" | "purple" | "red") {
  if (tone === "amber") {
    return "bg-amber-500";
  }

  if (tone === "green") {
    return "bg-emerald-600";
  }

  if (tone === "purple") {
    return "bg-violet-600";
  }

  if (tone === "red") {
    return "bg-red-600";
  }

  return "bg-blue-600";
}

function customerTypeBadgeClass(value: CustomerType) {
  if (value === "wholesale") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function assignmentStatusBadgeClass(value: AssignmentStatus) {
  if (value === "assigned") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value === "needs_review") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (value === "converted_to_employee") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function membershipAccountTypeBadgeClass(value: string) {
  return value === "employee"
    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
    : "border-blue-200 bg-blue-50 text-blue-700";
}

function membershipStatusBadgeClass(value: string) {
  if (value === "disabled") {
    return "border-slate-200 bg-slate-50 text-slate-500";
  }

  if (value === "invited") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function tierBadgeClass(value: CustomerTier | string) {
  if (value === "bronze") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (value === "silver") {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  if (value === "gold") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (value === "emerald") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value === "diamond") {
    return "border-cyan-200 bg-cyan-50 text-cyan-700";
  }

  if (value === "master") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  if (value === "king") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function initialsFromText(value: string | null | undefined) {
  return (value || "A").slice(0, 2).toUpperCase();
}

function activityVisual(event: CustomerRecentActivity): {
  className: string;
  icon: React.ComponentType<{ className?: string }>;
} {
  const eventType = event.eventType || event.event_type || "";

  if (eventType === "product_view") {
    return { className: "border-blue-100 bg-blue-50 text-blue-600", icon: Eye };
  }

  if (eventType === "model_view") {
    return { className: "border-emerald-100 bg-emerald-50 text-emerald-600", icon: Package };
  }

  if (eventType === "catalog_search") {
    return { className: "border-violet-100 bg-violet-50 text-violet-600", icon: Search };
  }

  if (eventType === "catalog_filter") {
    return { className: "border-amber-100 bg-amber-50 text-amber-600", icon: ListFilter };
  }

  if (eventType === "order_detail_view") {
    return { className: "border-orange-100 bg-orange-50 text-orange-600", icon: BriefcaseBusiness };
  }

  if (eventType === "account_created" || eventType === "profile_updated") {
    return { className: "border-emerald-100 bg-emerald-50 text-emerald-600", icon: BadgeCheck };
  }

  return { className: "border-slate-200 bg-slate-50 text-slate-500", icon: BadgeCheck };
}

function statusBadgeClass(status: CustomerStatus) {
  if (status === "pending") {
    return "border-amber-300 bg-amber-50 text-amber-800";
  }

  if (status === "active") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  }

  if (status === "suspended") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }

  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
}

function amountTileClass(
  tone: "default" | "danger" | "success" | "warning" | "info",
  emphasis?: boolean
) {
  if (tone === "danger") {
    return "border-red-200 bg-red-50/70 text-red-900";
  }

  if (tone === "info") {
    return "border-blue-200 bg-blue-50/70 text-blue-950";
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

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}
