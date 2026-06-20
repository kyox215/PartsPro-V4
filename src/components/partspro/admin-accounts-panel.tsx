"use client";

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BadgeCheck,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FilePenLine,
  KeyRound,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Star,
  UserCog,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AddressDraftFields } from "@/components/partspro/address-draft-fields";
import {
  adminPermissionLabel,
  adminRoleTemplateLabel,
  getAdminDictionary,
  type AdminText,
} from "@/i18n/dictionaries/admin";
import { formatEuro } from "@/lib/partspro-data";
import { formatTierDiscount } from "@/lib/partspro-pricing";
import {
  type AddressDraft,
  type AddressDraftField,
  formatAddressDraft,
  isAddressDraftComplete,
  normalizeAddressText,
  parseAddressDraft,
} from "@/lib/partspro-address-draft";
import { cn } from "@/lib/utils";
import { AdminBusyRegion } from "./admin-feedback";
import { useI18n } from "./i18n-provider";

type AccountType = "customer" | "employee";
type ConversionKind = "role" | "to_customer" | "to_employee";
type CustomerActionKind = "customer_level" | "customer_status" | "customer_type";
type CustomerLevel = "bronze" | "silver" | "gold" | "emerald" | "diamond" | "master" | "king";
type CustomerStatus = "pending" | "active" | "suspended";
type CustomerType = "retail" | "wholesale";

const detailTabsListClassName =
  "!flex !h-auto !w-full min-w-0 gap-1 overflow-x-auto overflow-y-hidden rounded-md border border-slate-200 bg-white/80 p-0.5 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const detailTabsTriggerClassName =
  "!h-7 min-w-[72px] flex-1 whitespace-nowrap rounded px-2 text-[11px] font-bold leading-none text-slate-500 transition-colors data-active:!bg-primary data-active:!text-white data-active:!shadow-sm sm:!h-8 sm:min-w-0 sm:text-xs";

type AccountCustomer = {
  assignmentStatus: string;
  billingAddress: string | null;
  contactName: string | null;
  convertedToEmployeeAt: string | null;
  createdAt: string | null;
  customerType: string;
  email: string | null;
  fiscalCode: string | null;
  id: string | null;
  lastActivityAt: string | null;
  lastOrderAt: string | null;
  level: string;
  lifetimeSpendNet: number;
  promoLevel: string | null;
  promoLevelStartsAt: string | null;
  promoLevelExpiresAt: string | null;
  promoLevelReason: string | null;
  name: string | null;
  orders: AccountCustomerOrder[];
  ordersCount: number;
  pec: string | null;
  phone: string | null;
  profileCompletedAt: string | null;
  profileKind: string;
  recentActivity: AccountCustomerActivity[];
  revenue: number;
  sdi: string | null;
  shippingAddress: string | null;
  spendSummary: AccountSpendSummary;
  status: string;
  updatedAt: string | null;
  userId: string | null;
  vatNumber: string | null;
};

type AccountCustomerOrder = {
  createdAt: string | null;
  id: string;
  lineCount: number;
  orderNo: string;
  paymentStatus: string;
  shipping: number;
  status: string;
  total: number;
  totalNet: number;
  updatedAt: string | null;
  vat: number;
};

type AccountSpendSummary = {
  cancelledAmount: number;
  orderCount: number;
  paidAmount: number;
  pendingAmount: number;
  refundedAmount: number;
  shipping: number;
  total: number;
  totalNet: number;
  vat: number;
};

type AccountCustomerActivity = {
  brand: string | null;
  createdAt: string | null;
  eventType: string;
  id: string;
  model: string | null;
  modelSeries: string | null;
  productName: string | null;
  searchQuery: string | null;
  skuCode: string | null;
};

type Account = {
  accountType: AccountType;
  authProvider: string;
  avatarUrl: string | null;
  createdAt: string | null;
  customer: AccountCustomer | null;
  customerId: string | null;
  customerState: string;
  displayName: string | null;
  email: string | null;
  profileCustomer: AccountCustomer | null;
  profileState: AccountProfileState;
  role: string;
  roleTemplate: string | null;
  updatedAt: string | null;
  userId: string;
};

type AccountProfileState = {
  kind: "customer" | "employee_self";
  missingFields: string[];
  status: "complete" | "incomplete" | "missing";
};

type AccountMembership = {
  accountType: string;
  createdAt: string | null;
  customerId: string;
  displayName: string | null;
  email: string | null;
  memberRole: string;
  role: string | null;
  roleTemplate: string | null;
  status: string;
  userId: string;
};

type AccountAuditEvent = {
  action: string;
  actorEmail: string | null;
  actorRole: string | null;
  createdAt: string | null;
  entityType: string | null;
  id: string;
  reason: string | null;
  result: string;
};

type AccountDetail = {
  account: Account;
  auditEvents: AccountAuditEvent[];
  customer: AccountCustomer | null;
  memberships: AccountMembership[];
  permissions: string[];
  profileCustomer: AccountCustomer | null;
  profileState: AccountProfileState;
};

type AccountDetailInclude = "activity" | "audit" | "orders";
type AccountDetailTab = "activity" | "memberships" | "orders" | "permissions" | "profile" | "spend";

type RoleTemplate = {
  description: string | null;
  id: string;
  label: string;
  permissions: string[];
};

type Notice = {
  message: string;
  tone: "error" | "success" | "warning";
};

type ConversionState = {
  account: Account;
  kind: ConversionKind;
  reason: string;
  roleTemplate: string;
};

type CustomerActionState = {
  account: Account;
  customerType: CustomerType;
  kind: CustomerActionKind;
  level: CustomerLevel;
  reason: string;
  status: CustomerStatus;
  targetCustomer: AccountCustomer;
};

type AccountProfileEditorState = {
  account: Account;
  billingAddress: AddressDraft;
  billingSameAsShipping: boolean;
  companyName: string;
  contactName: string;
  email: string;
  fiscalCode: string;
  pec: string;
  phone: string;
  reason: string;
  shippingAddress: AddressDraft;
};

type AccountProfileEditorField =
  | "companyName"
  | "contactName"
  | "fiscalCode"
  | "pec"
  | "phone"
  | "reason";

type CurrentUser = {
  permissions: string[];
  userId: string | null;
};

type AdminAccountsPanelProps = {
  initialPermissions?: readonly string[];
  initialUserId?: string | null;
  permissionsLoaded?: boolean;
};

const accountDetailInlineMediaQuery = "(min-width: 1280px)";
const adminAccountReadTimeoutMs = 8000;
const adminAccountAuxiliaryReadTimeoutMs = 6000;
const pageSize = 12;
const customerLevels = [
  "bronze",
  "silver",
  "gold",
  "emerald",
  "diamond",
  "master",
  "king",
] as const satisfies readonly CustomerLevel[];
const customerStatuses = ["pending", "active", "suspended"] as const satisfies readonly CustomerStatus[];
const customerTypes = ["retail", "wholesale"] as const satisfies readonly CustomerType[];

function useAdminText() {
  const { locale } = useI18n();

  return getAdminDictionary(locale).admin;
}

export function AdminAccountsPanel({
  initialPermissions,
  initialUserId = null,
  permissionsLoaded: externalPermissionsLoaded = false,
}: AdminAccountsPanelProps = {}) {
  const text = useAdminText();
  const hasExternalPermissions = initialPermissions !== undefined;
  const [accountType, setAccountType] = React.useState<AccountType>("customer");
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [detail, setDetail] = React.useState<AccountDetail | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [usesInlineDetailPane, setUsesInlineDetailPane] = React.useState(false);
  const [roleTemplates, setRoleTemplates] = React.useState<RoleTemplate[]>([]);
  const [fetchedCurrentUserId, setFetchedCurrentUserId] =
    React.useState<string | null>(null);
  const [fetchedCurrentPermissions, setFetchedCurrentPermissions] =
    React.useState<string[]>([]);
  const [fetchedPermissionsLoaded, setFetchedPermissionsLoaded] =
    React.useState(false);
  const [query, setQuery] = React.useState("");
  const [appliedQuery, setAppliedQuery] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailTab, setDetailTab] = React.useState<AccountDetailTab>("profile");
  const [detailLoadedIncludes, setDetailLoadedIncludes] = React.useState<Set<AccountDetailInclude>>(
    () => new Set()
  );
  const [detailLoadingIncludes, setDetailLoadingIncludes] = React.useState<Set<AccountDetailInclude>>(
    () => new Set()
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [conversion, setConversion] = React.useState<ConversionState | null>(null);
  const [customerAction, setCustomerAction] = React.useState<CustomerActionState | null>(null);
  const [profileEditor, setProfileEditor] = React.useState<AccountProfileEditorState | null>(null);
  const detailCacheRef = React.useRef(new Map<string, AccountDetail>());
  const detailLoadedIncludesRef = React.useRef(new Map<string, Set<AccountDetailInclude>>());
  const detailEpochRef = React.useRef(0);
  const detailAbortRef = React.useRef<AbortController | null>(null);
  const currentUserId = hasExternalPermissions ? initialUserId : fetchedCurrentUserId;
  const currentPermissions = React.useMemo(
    () =>
      hasExternalPermissions
        ? [...(initialPermissions ?? [])]
        : fetchedCurrentPermissions,
    [fetchedCurrentPermissions, hasExternalPermissions, initialPermissions]
  );
  const permissionsLoaded = hasExternalPermissions
    ? externalPermissionsLoaded
    : fetchedPermissionsLoaded;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPermissionSet = React.useMemo(
    () => new Set(currentPermissions),
    [currentPermissions]
  );
  const canManageCustomerLevel = currentPermissionSet.has("customers.manage_level");
  const canManageCustomerStatus = currentPermissionSet.has("customers.classify");
  const canManageCustomerProfile = currentPermissionSet.has("customers.classify");
  const canManageCustomerType = currentPermissionSet.has("customers.classify");
  const canReadCustomerAccounts = currentPermissionSet.has("customers.read");
  const canReadEmployeeAccounts =
    currentPermissionSet.has("employees.read") ||
    currentPermissionSet.has("employees.manage_permissions");
  const canManageEmployeeAccounts = currentPermissionSet.has(
    "employees.manage_permissions"
  );
  const canReadSelectedAccountType =
    accountType === "employee" ? canReadEmployeeAccounts : canReadCustomerAccounts;
  const visibleAccountTabCount =
    (canReadCustomerAccounts ? 1 : 0) + (canReadEmployeeAccounts ? 1 : 0);

  const refreshAccounts = React.useCallback(
    async (signal?: AbortSignal) => {
      if (!permissionsLoaded || !canReadSelectedAccountType) {
        setAccounts([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const payload = await fetchAccounts(accountType, page, appliedQuery, signal);

        if (signal?.aborted) {
          return;
        }

        setAccounts(payload.data);
        setTotal(payload.total);
      } catch (error) {
        if (!signal?.aborted) {
          setNotice({ message: readableError(error), tone: "error" });
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [accountType, appliedQuery, canReadSelectedAccountType, page, permissionsLoaded]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void refreshAccounts(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [refreshAccounts]);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(accountDetailInlineMediaQuery);

    function handleMediaQueryChange() {
      const matches = mediaQuery.matches;

      setUsesInlineDetailPane(matches);

      if (matches) {
        setDetailOpen(false);
      }
    }

    handleMediaQueryChange();
    mediaQuery.addEventListener("change", handleMediaQueryChange);

    return () => {
      mediaQuery.removeEventListener("change", handleMediaQueryChange);
    };
  }, []);

  React.useEffect(() => () => detailAbortRef.current?.abort(), []);

  React.useEffect(() => {
    if (hasExternalPermissions) {
      return;
    }

    const controller = new AbortController();

    void fetchCurrentUser(controller.signal)
      .then((me) => {
        if (controller.signal.aborted) {
          return;
        }

        setFetchedCurrentUserId(me.userId);
        setFetchedCurrentPermissions(me.permissions);
        setFetchedPermissionsLoaded(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFetchedPermissionsLoaded(true);
        }
      });

    return () => controller.abort();
  }, [hasExternalPermissions]);

  React.useEffect(() => {
    if (!permissionsLoaded || !canReadEmployeeAccounts) {
      const timeoutId = window.setTimeout(() => {
        setRoleTemplates([]);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    const controller = new AbortController();

    void fetchRoleTemplates(controller.signal)
      .then((templates) => {
        if (!controller.signal.aborted) {
          setRoleTemplates(templates);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRoleTemplates([]);
        }
      });

    return () => controller.abort();
  }, [canReadEmployeeAccounts, permissionsLoaded]);

  React.useEffect(() => {
    if (!permissionsLoaded || canReadSelectedAccountType) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const nextType = canReadCustomerAccounts
        ? "customer"
        : canReadEmployeeAccounts
          ? "employee"
          : null;

      if (nextType && nextType !== accountType) {
        setAccountType(nextType);
      }

      setPage(0);
      detailEpochRef.current += 1;
      detailAbortRef.current?.abort();
      setDetail(null);
      setDetailOpen(false);
      setDetailLoading(false);
      setDetailLoadedIncludes(new Set());
      setDetailLoadingIncludes(new Set());
      setAccounts([]);
      setTotal(0);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [
    accountType,
    canReadCustomerAccounts,
    canReadEmployeeAccounts,
    canReadSelectedAccountType,
    permissionsLoaded,
  ]);

  function applySearch() {
    const value = query.trim();

    setPage(0);
    setAppliedQuery(value.length >= 2 ? value : "");
  }

  function openDetail(account: Account) {
    const shouldUseInlineDetailPane =
      usesInlineDetailPane || window.matchMedia(accountDetailInlineMediaQuery).matches;
    const userId = account.userId;
    const epoch = detailEpochRef.current + 1;
    const cached = detailCacheRef.current.get(userId);
    const initialDetail = cached ?? createLightweightAccountDetail(account);
    const loadedIncludes = detailLoadedIncludesRef.current.get(userId) ?? new Set();

    detailEpochRef.current = epoch;
    detailAbortRef.current?.abort();
    detailAbortRef.current = new AbortController();
    detailCacheRef.current.set(userId, initialDetail);
    setDetail(initialDetail);
        setDetailTab(defaultDetailTabForAccount());
    setDetailLoadedIncludes(new Set(loadedIncludes));
    setDetailLoadingIncludes(new Set());
    setDetailOpen(!shouldUseInlineDetailPane);

    if (account.accountType === "employee") {
      void loadDetail(userId, {
        epoch,
        silent: true,
        signal: detailAbortRef.current.signal,
      });
    }
  }

  function handleDetailTabChange(value: string) {
    const tab = normalizeDetailTab(value);

    setDetailTab(tab);

    if (!detail) {
      return;
    }

    const includes = includesForDetailTab(tab, detail).filter(
      (include) => !detailLoadedIncludes.has(include) && !detailLoadingIncludes.has(include)
    );

    if (includes.length > 0) {
      void loadDetail(detail.account.userId, { includes });
    }
  }

  async function loadDetail(
    userId: string,
    {
      epoch = detailEpochRef.current,
      includes = [],
      silent = false,
      signal,
    }: {
      epoch?: number;
      includes?: AccountDetailInclude[];
      silent?: boolean;
      signal?: AbortSignal;
    } = {}
  ) {
    const isCoreRefresh = includes.length === 0;
    const showCoreLoading = isCoreRefresh && !silent;

    if (showCoreLoading) {
      setDetailLoading(true);
    } else if (!isCoreRefresh) {
      setDetailLoadingIncludes((current) => {
        const next = new Set(current);

        for (const include of includes) {
          next.add(include);
        }

        return next;
      });
    }

    try {
      const nextDetail = await fetchAccountDetail(userId, { includes, signal });

      if (signal?.aborted || epoch !== detailEpochRef.current) {
        return;
      }

      const previousDetail = detailCacheRef.current.get(userId);
      const mergedDetail = previousDetail
        ? mergeAccountDetails(previousDetail, nextDetail, includes)
        : nextDetail;
      const loadedIncludes = new Set(detailLoadedIncludesRef.current.get(userId) ?? []);

      for (const include of includes) {
        loadedIncludes.add(include);
      }

      detailCacheRef.current.set(userId, mergedDetail);
      detailLoadedIncludesRef.current.set(userId, loadedIncludes);
      setDetail(mergedDetail);
      setDetailLoadedIncludes(new Set(loadedIncludes));
    } catch (error) {
      if (!signal?.aborted && epoch === detailEpochRef.current) {
        setNotice({ message: readableError(error), tone: "error" });
      }
    } finally {
      if (signal?.aborted || epoch !== detailEpochRef.current) {
        return;
      }

      if (showCoreLoading) {
        setDetailLoading(false);
      } else if (!isCoreRefresh) {
        setDetailLoadingIncludes((current) => {
          const next = new Set(current);

          for (const include of includes) {
            next.delete(include);
          }

          return next;
        });
      }
    }
  }

  function openConversion(kind: ConversionKind, account: Account) {
    const fallbackRole = account.roleTemplate ?? "sales_support";

    setConversion({
      account,
      kind,
      reason: "",
      roleTemplate: fallbackRole,
    });
  }

  function openCustomerAction(kind: CustomerActionKind, account: Account) {
    const customer = commerceCustomerForAccount(account);

    if (!customer) {
      return;
    }

    setCustomerAction({
      account,
      customerType: normalizeCustomerType(customer.customerType),
      kind,
      level: normalizeCustomerLevel(customer.level),
      reason: "",
      status: normalizeCustomerStatus(customer.status),
      targetCustomer: customer,
    });
  }

  function openProfileEditor(account: Account, profileCustomer?: AccountCustomer | null) {
    setProfileEditor(createAccountProfileEditor(account, profileCustomer ?? account.profileCustomer));
  }

  function updateProfileEditorField(field: AccountProfileEditorField, value: string) {
    setProfileEditor((current) => (current ? { ...current, [field]: value } : current));
  }

  const updateProfileEditorAddress = React.useCallback(
    (
      addressKey: "billingAddress" | "shippingAddress",
      field: AddressDraftField,
      value: string
    ) => {
      setProfileEditor((current) => {
        if (!current) {
          return current;
        }

        const nextAddress = {
          ...current[addressKey],
          [field]: value,
        };
        const nextEditor = {
          ...current,
          [addressKey]: nextAddress,
        };

        if (addressKey === "shippingAddress" && current.billingSameAsShipping) {
          return {
            ...nextEditor,
            billingAddress: nextAddress,
          };
        }

        return nextEditor;
      });
    },
    []
  );

  function updateProfileEditorBillingSameAsShipping(checked: boolean) {
    setProfileEditor((current) =>
      current
        ? {
            ...current,
            billingSameAsShipping: checked,
            billingAddress: checked ? current.shippingAddress : current.billingAddress,
          }
        : current
    );
  }

  async function submitConversion() {
    if (!conversion || conversion.reason.trim().length < 3) {
      return;
    }

    setSubmitting(true);

    try {
      let nextDetail: AccountDetail | null = null;

      if (conversion.kind === "role") {
        await patchAccountRole(
          conversion.account.userId,
          conversion.roleTemplate,
          conversion.reason
        );
      } else {
        nextDetail = await patchAccountType(conversion);
      }

      setNotice({ message: "账号变更已保存。", tone: "success" });
      setConversion(null);

      if (nextDetail) {
        const userId = nextDetail.account.userId;
        const nextLoadedIncludes = new Set<AccountDetailInclude>();

        detailEpochRef.current += 1;
        detailAbortRef.current?.abort();
        detailCacheRef.current.set(userId, nextDetail);
        detailLoadedIncludesRef.current.set(userId, nextLoadedIncludes);
        setDetail(nextDetail);
        setDetailLoadedIncludes(nextLoadedIncludes);
        setDetailLoadingIncludes(new Set());
        setDetailTab(defaultDetailTabForAccount());

        if (
          (nextDetail.account.accountType === "customer" && canReadCustomerAccounts) ||
          (nextDetail.account.accountType === "employee" && canReadEmployeeAccounts)
        ) {
          setAccountType(nextDetail.account.accountType);
          setPage(0);
          setLoading(true);

          try {
            const payload = await fetchAccounts(nextDetail.account.accountType, 0, appliedQuery);

            setAccounts(payload.data);
            setTotal(payload.total);
          } finally {
            setLoading(false);
          }
        } else {
          await refreshAccounts();
        }
      } else {
        await refreshAccounts();
        await loadDetail(conversion.account.userId);
      }
    } catch (error) {
      setNotice({ message: readableError(error), tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCustomerAction() {
    if (!customerAction || customerAction.reason.trim().length < 3) {
      return;
    }

    setSubmitting(true);

    try {
      const nextDetail = await submitCustomerAccountAction(customerAction);

      setNotice({
        message:
          customerAction.kind === "customer_level"
            ? "客户等级已保存。"
            : customerAction.kind === "customer_type"
              ? "价格类型已保存。"
              : "客户状态已保存。",
        tone: "success",
      });
      setCustomerAction(null);
      const cachedDetail = detailCacheRef.current.get(nextDetail.account.userId);
      const mergedDetail = cachedDetail
        ? mergeAccountDetails(cachedDetail, nextDetail, [])
        : nextDetail;

      detailCacheRef.current.set(nextDetail.account.userId, mergedDetail);
      setDetail(mergedDetail);
      await refreshAccounts();
    } catch (error) {
      setNotice({ message: readableError(error), tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitProfileEditor() {
    if (!profileEditor || profileEditor.reason.trim().length < 3) {
      return;
    }

    if (
      !isAddressDraftComplete(profileEditor.shippingAddress) ||
      (!profileEditor.billingSameAsShipping &&
        !isAddressDraftComplete(profileEditor.billingAddress))
    ) {
      setNotice({
        message: "请补全 CAP、Provincia、Citta、Via 和 Numero 后再保存。",
        tone: "error",
      });
      return;
    }

    const shippingAddress = formatAddressDraft(profileEditor.shippingAddress);
    const billingAddress = profileEditor.billingSameAsShipping
      ? shippingAddress
      : formatAddressDraft(profileEditor.billingAddress);

    setSubmitting(true);

    try {
      const nextDetail = await patchAccountCustomerProfile(profileEditor.account.userId, {
        billingAddress,
        companyName: profileEditor.companyName,
        contactName: profileEditor.contactName,
        fiscalCode: profileEditor.fiscalCode,
        pec: profileEditor.pec,
        phone: profileEditor.phone,
        reason: profileEditor.reason,
        shippingAddress,
      });
      const cachedDetail = detailCacheRef.current.get(nextDetail.account.userId);
      const mergedDetail = cachedDetail
        ? mergeAccountDetails(cachedDetail, nextDetail, [])
        : nextDetail;

      detailCacheRef.current.set(nextDetail.account.userId, mergedDetail);
      setDetail(mergedDetail);
      setProfileEditor(null);
      setNotice({ message: "账号资料已保存。", tone: "success" });
      await refreshAccounts();
    } catch (error) {
      setNotice({ message: readableError(error), tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="min-w-0 space-y-3">
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black tracking-normal text-slate-950">账号工作台</h3>
            <Badge className="border-slate-200 bg-slate-50 text-slate-600" variant="outline">
              {!permissionsLoaded || (loading && accounts.length === 0)
                ? "加载中"
                : `${total} 个账号`}
            </Badge>
            <Badge className="border-blue-200 bg-blue-50 text-blue-700" variant="outline">
              {accountType === "employee" ? "员工账号" : "客户账号"}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-500">
            管理已存在的客户账号和员工账号，不创建新的 Supabase Auth 用户。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 bg-white"
          disabled={loading || !permissionsLoaded || !canReadSelectedAccountType}
          onClick={() => void refreshAccounts()}
        >
          <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
          刷新
        </Button>
      </div>

      {notice ? <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} /> : null}

      <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="grid gap-2 xl:grid-cols-[minmax(360px,410px)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-2 rounded-md border border-slate-100 bg-slate-50/60 p-2">
            {permissionsLoaded && visibleAccountTabCount > 0 ? (
              <Tabs
                value={accountType}
                onValueChange={(value) => {
                  const nextType = value === "employee" ? "employee" : "customer";

                  if (
                    (nextType === "employee" && !canReadEmployeeAccounts) ||
                    (nextType === "customer" && !canReadCustomerAccounts)
                  ) {
                    return;
                  }

                  setAccountType(nextType);
                  setPage(0);
                  detailEpochRef.current += 1;
                  detailAbortRef.current?.abort();
                  setDetail(null);
                  setDetailOpen(false);
                  setDetailLoading(false);
                  setDetailLoadedIncludes(new Set());
                  setDetailLoadingIncludes(new Set());
                }}
              >
                <TabsList
                  className={cn(
                    "grid h-8 rounded-md bg-white p-1 shadow-sm",
                    visibleAccountTabCount > 1 ? "grid-cols-2" : "grid-cols-1"
                  )}
                >
                  {canReadCustomerAccounts ? (
                    <TabsTrigger value="customer" className="h-6 rounded text-xs font-bold">
                      客户账号
                    </TabsTrigger>
                  ) : null}
                  {canReadEmployeeAccounts ? (
                    <TabsTrigger value="employee" className="h-6 rounded text-xs font-bold">
                      员工账号
                    </TabsTrigger>
                  ) : null}
                </TabsList>
              </Tabs>
            ) : null}

            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      applySearch();
                    }
                  }}
                  disabled={!permissionsLoaded || !canReadSelectedAccountType}
                  className="h-8 bg-white pl-8 text-sm"
                  placeholder="搜索邮箱、姓名或角色"
                />
              </div>
              <Button
                size="sm"
                className="h-8 px-3"
                disabled={!permissionsLoaded || !canReadSelectedAccountType}
                onClick={applySearch}
              >
                搜索
              </Button>
            </div>

            <div className="max-h-[calc(100vh-280px)] min-h-[320px] overflow-y-auto pr-1">
              {!permissionsLoaded || (loading && accounts.length === 0) ? (
                <AccountListSkeleton />
              ) : !canReadSelectedAccountType ? (
                <div className="rounded-md border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">
                  当前账号没有读取{accountType === "employee" ? "员工" : "客户"}账号的权限。
                </div>
              ) : (
                <AdminBusyRegion
                  contentClassName="space-y-1.5"
                  label={text.common.refreshing}
                  pending={loading}
                  rows={4}
                >
                  {accounts.length > 0 ? (
                    accounts.map((account) => (
                      <AccountListItem
                        key={account.userId}
                        account={account}
                        active={detail?.account.userId === account.userId}
                        currentUserId={currentUserId}
                        onOpen={openDetail}
                      />
                    ))
                  ) : (
                    <div className="rounded-md border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">
                      没有匹配的账号。
                    </div>
                  )}
                </AdminBusyRegion>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 bg-white px-2"
                disabled={loading || !canReadSelectedAccountType || page <= 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                <ChevronLeft className="size-4" />
                上一页
              </Button>
              <span className="text-xs font-bold text-slate-500">
                {page + 1}/{totalPages} · {total}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 bg-white px-2"
                disabled={loading || !canReadSelectedAccountType || page + 1 >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                下一页
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="hidden min-w-0 xl:block">
            <AccountDetailPane
              canManageCustomerLevel={canManageCustomerLevel}
              canManageCustomerProfile={canManageCustomerProfile}
              canManageCustomerStatus={canManageCustomerStatus}
              canManageCustomerType={canManageCustomerType}
              canManageEmployeeAccounts={canManageEmployeeAccounts}
              currentUserId={currentUserId}
              detail={detail}
              loadedIncludes={detailLoadedIncludes}
              loading={detailLoading}
              loadingIncludes={detailLoadingIncludes}
              onAction={openConversion}
              onCustomerAction={openCustomerAction}
              onProfileEdit={openProfileEditor}
              onTabChange={handleDetailTabChange}
              tab={detailTab}
            />
          </div>
        </div>
      </div>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent
          side="right"
          className="!w-full !max-w-none overflow-y-auto p-0 sm:!w-[560px] sm:!max-w-[560px]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{detail?.account.email ?? "账号详情"}</SheetTitle>
            <SheetDescription>账号资料、权限和审计。</SheetDescription>
          </SheetHeader>
          <div className="p-1.5 sm:p-2">
            <AccountDetailPane
              canManageCustomerLevel={canManageCustomerLevel}
              canManageCustomerProfile={canManageCustomerProfile}
              canManageCustomerStatus={canManageCustomerStatus}
              canManageCustomerType={canManageCustomerType}
              canManageEmployeeAccounts={canManageEmployeeAccounts}
              currentUserId={currentUserId}
              detail={detail}
              loadedIncludes={detailLoadedIncludes}
              loading={detailLoading}
              loadingIncludes={detailLoadingIncludes}
              onAction={openConversion}
              onCustomerAction={openCustomerAction}
              onProfileEdit={openProfileEditor}
              onTabChange={handleDetailTabChange}
              tab={detailTab}
            />
          </div>
        </SheetContent>
      </Sheet>

      <AccountActionDialog
        conversion={conversion}
        onChange={setConversion}
        onClose={() => setConversion(null)}
        onSubmit={submitConversion}
        roleTemplates={roleTemplates}
        submitting={submitting}
      />
      <CustomerAccountActionDialog
        action={customerAction}
        onChange={setCustomerAction}
        onClose={() => setCustomerAction(null)}
        onSubmit={submitCustomerAction}
        submitting={submitting}
      />
      <AccountProfileEditorDialog
        editor={profileEditor}
        onAddressChange={updateProfileEditorAddress}
        onBillingSameAsShippingChange={updateProfileEditorBillingSameAsShipping}
        onChange={updateProfileEditorField}
        onClose={() => setProfileEditor(null)}
        onSubmit={submitProfileEditor}
        submitting={submitting}
      />
    </section>
  );
}

function createLightweightAccountDetail(account: Account): AccountDetail {
  const customer = account.customer
    ? {
        ...account.customer,
        orders: account.customer.orders ?? [],
        recentActivity: account.customer.recentActivity ?? [],
        spendSummary: account.customer.spendSummary ?? emptySpendSummary(),
      }
    : null;
  const profileCustomer = account.profileCustomer
    ? {
        ...account.profileCustomer,
        orders: account.profileCustomer.orders ?? [],
        recentActivity: account.profileCustomer.recentActivity ?? [],
        spendSummary: account.profileCustomer.spendSummary ?? emptySpendSummary(),
      }
    : null;

  return {
    account: {
      ...account,
      customer,
      profileCustomer,
    },
    auditEvents: [],
    customer,
    memberships: [],
    permissions: [],
    profileCustomer,
    profileState: account.profileState,
  };
}

function mergeAccountDetails(
  previous: AccountDetail,
  incoming: AccountDetail,
  includes: readonly AccountDetailInclude[]
): AccountDetail {
  const includeSet = new Set(includes);
  const previousCustomer = previous.customer ?? previous.account.customer;
  const incomingCustomer = incoming.customer ?? incoming.account.customer;
  const customer = incomingCustomer
    ? {
        ...incomingCustomer,
        orders: includeSet.has("orders")
          ? incomingCustomer.orders
          : previousCustomer?.orders ?? incomingCustomer.orders,
        recentActivity: includeSet.has("activity")
          ? incomingCustomer.recentActivity
          : previousCustomer?.recentActivity ?? incomingCustomer.recentActivity,
        spendSummary: includeSet.has("orders")
          ? incomingCustomer.spendSummary
          : previousCustomer?.spendSummary ?? incomingCustomer.spendSummary,
      }
    : null;
  const incomingProfileCustomer = incoming.profileCustomer ?? incoming.account.profileCustomer;
  const profileCustomer =
    incomingProfileCustomer?.id && incomingProfileCustomer.id === customer?.id
      ? customer
      : incomingProfileCustomer;
  const profileState = incoming.profileState ?? incoming.account.profileState;

  return {
    account: {
      ...incoming.account,
      customer,
      profileCustomer,
      profileState,
    },
    auditEvents: includeSet.has("audit") ? incoming.auditEvents : previous.auditEvents,
    customer,
    memberships: incoming.memberships,
    permissions: incoming.permissions,
    profileCustomer,
    profileState,
  };
}

function createAccountProfileEditor(
  account: Account,
  profileCustomer: AccountCustomer | null
): AccountProfileEditorState {
  const shippingAddress = parseAddressDraft(profileCustomer?.shippingAddress);
  const billingAddress = parseAddressDraft(profileCustomer?.billingAddress);
  const billingSameAsShipping =
    !normalizeAddressText(profileCustomer?.billingAddress) ||
    normalizeAddressText(profileCustomer?.billingAddress) ===
      normalizeAddressText(profileCustomer?.shippingAddress);

  return {
    account,
    billingAddress: billingSameAsShipping ? shippingAddress : billingAddress,
    billingSameAsShipping,
    companyName:
      profileCustomer?.name ??
      account.displayName ??
      account.email ??
      "",
    contactName: profileCustomer?.contactName ?? "",
    email: account.email ?? profileCustomer?.email ?? "",
    fiscalCode: profileCustomer?.fiscalCode ?? "",
    pec: profileCustomer?.pec ?? "",
    phone: profileCustomer?.phone ?? "",
    reason: "",
    shippingAddress,
  };
}

function includesForDetailTab(tab: AccountDetailTab, detail: AccountDetail): AccountDetailInclude[] {
  if (tab === "orders" || tab === "spend") {
    return detail.account.accountType === "customer" ? ["orders"] : [];
  }

  if (tab === "activity") {
    return detail.account.accountType === "customer" || detail.customer
      ? ["activity", "audit"]
      : ["audit"];
  }

  return [];
}

function normalizeDetailTab(value: string): AccountDetailTab {
  if (
    value === "activity" ||
    value === "memberships" ||
    value === "orders" ||
    value === "permissions" ||
    value === "profile" ||
    value === "spend"
  ) {
    return value;
  }

  return "profile";
}

function customerDetailTabValue(tab: AccountDetailTab) {
  return tab === "orders" || tab === "spend" || tab === "activity" ? tab : "profile";
}

function employeeDetailTabValue(tab: AccountDetailTab) {
  if (tab === "profile") {
    return "profile";
  }

  return tab === "memberships" || tab === "activity" ? tab : "permissions";
}

function defaultDetailTabForAccount(): AccountDetailTab {
  return "profile";
}

function commerceCustomerForAccount(
  account: Pick<Account, "accountType" | "customer" | "profileCustomer">
) {
  return account.accountType === "employee" ? account.profileCustomer : account.customer;
}

function AccountListItem({
  account,
  active,
  currentUserId,
  onOpen,
}: {
  account: Account;
  active: boolean;
  currentUserId: string | null;
  onOpen: (account: Account) => void;
}) {
  const isSelf = account.userId === currentUserId;
  const text = useAdminText();
  const commerceCustomer = commerceCustomerForAccount(account);

  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-md border px-2.5 py-2 text-left transition",
        active
          ? "border-primary/30 bg-primary/8"
          : "border-slate-200 bg-white hover:border-primary/30 hover:bg-primary/5"
      )}
      onClick={() => onOpen(account)}
    >
      <div className="flex min-w-0 items-start gap-2">
        <AccountAvatar account={account} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <div className="truncate text-[13px] font-black leading-5 text-slate-950">
              {account.displayName ?? account.email ?? account.userId}
            </div>
            {isSelf ? (
              <Badge className="h-5 border-blue-200 bg-blue-50 px-1.5 text-[10px] text-blue-700" variant="outline">
                当前账号
              </Badge>
            ) : null}
          </div>
          <div className="truncate text-[11px] font-semibold leading-4 text-slate-500">
            {account.email ?? account.userId}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Badge className={cn("h-5 px-1.5 text-[10px]", accountTypeBadgeClass(account.accountType))} variant="outline">
              {accountTypeLabel(account.accountType)}
            </Badge>
            <ProfileStateBadge state={account.profileState} />
            {account.accountType === "employee" ? (
              <Badge className="h-5 border-indigo-200 bg-indigo-50 px-1.5 text-[10px] text-indigo-700" variant="outline">
                {roleTemplateLabel(text, account.roleTemplate ?? account.role)}
              </Badge>
            ) : null}
            <CustomerAssignmentBadges customer={commerceCustomer} />
          </div>
        </div>
      </div>
    </button>
  );
}

function AccountDetailPane({
  canManageCustomerLevel,
  canManageCustomerProfile,
  canManageCustomerStatus,
  canManageCustomerType,
  canManageEmployeeAccounts,
  currentUserId,
  detail,
  loadedIncludes,
  loading,
  loadingIncludes,
  onAction,
  onCustomerAction,
  onProfileEdit,
  onTabChange,
  tab,
}: {
  canManageCustomerLevel: boolean;
  canManageCustomerProfile: boolean;
  canManageCustomerStatus: boolean;
  canManageCustomerType: boolean;
  canManageEmployeeAccounts: boolean;
  currentUserId: string | null;
  detail: AccountDetail | null;
  loadedIncludes: Set<AccountDetailInclude>;
  loading: boolean;
  loadingIncludes: Set<AccountDetailInclude>;
  onAction: (kind: ConversionKind, account: Account) => void;
  onCustomerAction: (kind: CustomerActionKind, account: Account) => void;
  onProfileEdit: (account: Account, profileCustomer?: AccountCustomer | null) => void;
  onTabChange: (value: string) => void;
  tab: AccountDetailTab;
}) {
  const text = useAdminText();

  if (loading && !detail) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-2 sm:p-3">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-100 sm:h-7 sm:w-48" />
        <div className="mt-2 grid grid-cols-3 gap-1 sm:mt-3 sm:gap-2">
          <div className="h-12 animate-pulse rounded bg-slate-100 sm:h-16" />
          <div className="h-12 animate-pulse rounded bg-slate-100 sm:h-16" />
          <div className="h-12 animate-pulse rounded bg-slate-100 sm:h-16" />
        </div>
        <div className="mt-2 h-28 animate-pulse rounded bg-slate-100 sm:mt-3 sm:h-36" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="grid min-h-[320px] place-items-center rounded-md border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center">
        <div>
          <UsersRound className="mx-auto size-8 text-slate-300" />
          <div className="mt-2 text-sm font-black text-slate-700">选择一个账号查看详情</div>
          <div className="mt-1 text-xs font-semibold text-slate-500">
            右侧会显示资料、权限、客户等级和最近操作。
          </div>
        </div>
      </div>
    );
  }

  const { account } = detail;
  const isSelf = currentUserId === account.userId;
  const canManageAccountProfile = canManageCustomerProfile;
  const commerceCustomer = commerceCustomerForAccount(account);
  const commerceSpend = commerceCustomer?.spendSummary ?? emptySpendSummary();

  return (
    <div
      aria-busy={loading}
      aria-live="polite"
      className="min-w-0"
    >
      {loading ? (
        <div className="mb-1.5 overflow-hidden rounded-md border border-primary/10 bg-white text-primary shadow-sm">
          <div className="h-0.5 w-full animate-pulse bg-primary/40" />
          <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold leading-4">
            <Loader2 className="size-3 animate-spin" />
            <span>{text.common.refreshing}</span>
          </div>
        </div>
      ) : null}
      <div className="min-w-0 space-y-1.5 rounded-md border border-slate-200 bg-slate-50/70 p-1.5 sm:space-y-2 sm:p-2">
        <div className="flex min-w-0 items-start gap-2 rounded-md border border-slate-200 bg-white p-2 sm:p-2.5">
          <AccountAvatar account={account} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
              <h3 className="min-w-0 break-words text-sm font-black leading-5 text-slate-950 sm:text-base sm:leading-6">
                {account.displayName ?? account.email ?? "账号详情"}
              </h3>
              {isSelf ? (
                <Badge className="border-blue-200 bg-blue-50 text-blue-700" variant="outline">
                  当前账号
                </Badge>
              ) : null}
            </div>
            <div className="break-words text-[11px] font-semibold leading-4 text-slate-500 sm:text-xs">
              {account.email ?? account.userId}
            </div>
            <div className="mt-1 flex flex-wrap gap-1 sm:mt-1.5">
              <Badge className={accountTypeBadgeClass(account.accountType)} variant="outline">
                {accountTypeLabel(account.accountType)}
              </Badge>
              <Badge className="border-slate-200 bg-slate-50 text-slate-600" variant="outline">
                {account.authProvider}
              </Badge>
              <Badge className="border-slate-200 bg-slate-50 text-slate-600" variant="outline">
                {formatDate(account.createdAt) ?? "无创建时间"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 sm:gap-1.5">
          <InfoTile
            icon={UsersRound}
            label={account.accountType === "customer" ? "客户资料" : "自购资料"}
            value={account.profileCustomer?.name ?? account.displayName ?? account.email ?? "资料未创建"}
          />
          <InfoTile
            icon={BadgeCheck}
            label="资料状态"
            value={profileStateLabel(account.profileState)}
          />
          <InfoTile
            icon={BriefcaseBusiness}
            label="账号角色"
            value={
              account.accountType === "employee"
                ? roleTemplateLabel(text, account.roleTemplate ?? account.role)
                : accountTypeLabel(account.accountType)
            }
          />
          <InfoTile icon={KeyRound} label="有效权限" value={detail.permissions.length} />
        </div>

      {commerceCustomer ? (
        <div className="grid grid-cols-3 gap-1 sm:gap-1.5 lg:grid-cols-6">
          <InfoTile
            icon={BadgeCheck}
            label="活跃状态"
            value={customerStatusLabel(commerceCustomer.status)}
          />
          <InfoTile
            icon={BriefcaseBusiness}
            label="价格类型"
            value={customerTypeLabel(commerceCustomer.customerType)}
          />
          <InfoTile
            icon={Star}
            label="客户等级"
            value={
              <span className="inline-flex min-w-0 items-center gap-1">
                <span className="truncate">{customerLevelLabel(commerceCustomer.level)}</span>
                <CustomerPromoBadge customer={commerceCustomer} compact />
              </span>
            }
          />
          <InfoTile
            icon={ShoppingBag}
            label="订单数量"
            value={commerceSpend.orderCount || commerceCustomer.ordersCount}
          />
          <InfoTile
            icon={CircleDollarSign}
            label="消费金额"
            value={formatEuro(commerceSpend.total || commerceCustomer.revenue)}
          />
          <InfoTile
            icon={Clock3}
            label="最近订单"
            value={formatDate(commerceCustomer.lastOrderAt) ?? "暂无"}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1">
        {account.accountType === "customer" && canManageEmployeeAccounts ? (
          <Button
            size="xs"
            disabled={isSelf}
            onClick={() => onAction("to_employee", account)}
          >
            <ArrowLeftRight className="size-3.5" />
            转为员工
          </Button>
        ) : account.accountType === "employee" && canManageEmployeeAccounts ? (
          <>
            <Button
              size="xs"
              variant="outline"
              className="bg-white"
              disabled={isSelf}
              onClick={() => onAction("role", account)}
            >
              <ShieldCheck className="size-3.5" />
              调整角色
            </Button>
            <Button
              size="xs"
              variant="outline"
              className="bg-white"
              disabled={isSelf}
              onClick={() => onAction("to_customer", account)}
            >
              <ArrowLeftRight className="size-3.5" />
              转为客户
            </Button>
          </>
        ) : account.accountType === "employee" ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-500">
            员工账号为只读
          </span>
        ) : null}
        {isSelf && canManageEmployeeAccounts ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
            <AlertTriangle className="size-3.5" />
            当前账号禁止自我降级
          </span>
        ) : null}
      </div>

      {account.accountType === "customer" ? (
        <Tabs value={customerDetailTabValue(tab)} onValueChange={onTabChange} className="space-y-2">
          <TabsList className={detailTabsListClassName}>
            <TabsTrigger value="profile" className={detailTabsTriggerClassName}>
              客户资料
            </TabsTrigger>
            <TabsTrigger value="orders" className={detailTabsTriggerClassName}>
              历史订单
            </TabsTrigger>
            <TabsTrigger value="spend" className={detailTabsTriggerClassName}>
              消费明细
            </TabsTrigger>
            <TabsTrigger value="activity" className={detailTabsTriggerClassName}>
              活动记录
            </TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="m-0">
            <CustomerProfileTab
              account={account}
              canManageCustomerLevel={canManageCustomerLevel}
              canManageProfile={canManageAccountProfile}
              canManageCustomerStatus={canManageCustomerStatus}
              canManageCustomerType={canManageCustomerType}
              customer={detail.customer}
              onCustomerAction={onCustomerAction}
              onProfileEdit={onProfileEdit}
              profileCustomer={detail.profileCustomer}
              profileState={detail.profileState}
            />
          </TabsContent>
          <TabsContent value="orders" className="m-0">
            <CustomerOrdersTab
              loaded={loadedIncludes.has("orders")}
              loading={loadingIncludes.has("orders")}
              orders={detail.customer?.orders ?? []}
            />
          </TabsContent>
          <TabsContent value="spend" className="m-0">
            <CustomerSpendTab
              customer={detail.customer}
              loaded={loadedIncludes.has("orders")}
              loading={loadingIncludes.has("orders")}
            />
          </TabsContent>
          <TabsContent value="activity" className="m-0">
            <AccountActivityTab
              detail={detail}
              loaded={loadedIncludes.has("activity") || loadedIncludes.has("audit")}
              loading={loadingIncludes.has("activity") || loadingIncludes.has("audit")}
              text={text}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <Tabs
          value={employeeDetailTabValue(tab)}
          onValueChange={onTabChange}
          className="space-y-2"
        >
          <TabsList className={detailTabsListClassName}>
            <TabsTrigger value="profile" className={detailTabsTriggerClassName}>
              自购资料
            </TabsTrigger>
            <TabsTrigger value="permissions" className={detailTabsTriggerClassName}>
              有效权限
            </TabsTrigger>
            <TabsTrigger value="memberships" className={detailTabsTriggerClassName}>
              客户关系
            </TabsTrigger>
            <TabsTrigger value="activity" className={detailTabsTriggerClassName}>
              活动记录
            </TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="m-0">
            <CustomerProfileTab
              account={account}
              canManageCustomerLevel={canManageCustomerLevel}
              canManageProfile={canManageAccountProfile}
              canManageCustomerStatus={canManageCustomerStatus}
              canManageCustomerType={canManageCustomerType}
              customer={detail.customer}
              onCustomerAction={onCustomerAction}
              onProfileEdit={onProfileEdit}
              profileCustomer={detail.profileCustomer}
              profileState={detail.profileState}
            />
          </TabsContent>
          <TabsContent value="permissions" className="m-0">
            <AccountPermissionsSection detail={detail} text={text} />
          </TabsContent>
          <TabsContent value="memberships" className="m-0">
            <EmployeeMembershipsSection detail={detail} text={text} />
          </TabsContent>
          <TabsContent value="activity" className="m-0">
            <AccountActivityTab
              detail={detail}
              loaded={loadedIncludes.has("audit")}
              loading={loadingIncludes.has("audit")}
              text={text}
            />
          </TabsContent>
        </Tabs>
      )}
      </div>
    </div>
  );
}

function CustomerProfileTab({
  account,
  canManageCustomerLevel,
  canManageProfile,
  canManageCustomerStatus,
  canManageCustomerType,
  customer,
  onCustomerAction,
  onProfileEdit,
  profileCustomer,
  profileState,
}: {
  account: Account;
  canManageCustomerLevel: boolean;
  canManageProfile: boolean;
  canManageCustomerStatus: boolean;
  canManageCustomerType: boolean;
  customer: AccountCustomer | null;
  onCustomerAction: (kind: CustomerActionKind, account: Account) => void;
  onProfileEdit: (account: Account, profileCustomer?: AccountCustomer | null) => void;
  profileCustomer: AccountCustomer | null;
  profileState: AccountProfileState;
}) {
  const commerceCustomer = account.accountType === "employee" ? profileCustomer : customer;
  const historyCustomer =
    account.accountType === "employee" && customer?.id && customer.id !== commerceCustomer?.id
      ? customer
      : null;
  const canShowCustomerActions = Boolean(commerceCustomer);
  const title = account.accountType === "employee" ? "员工自购资料" : "客户资料";

  return (
    <DetailSection title={title}>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <ProfileStateBadge state={profileState} />
        {profileState.missingFields.length > 0 ? (
          <span className="text-[11px] font-semibold leading-5 text-slate-500">
            缺少：{profileState.missingFields.map(profileMissingFieldLabel).join("、")}
          </span>
        ) : null}
        <Button
          size="xs"
          variant="outline"
          className="ml-auto bg-white"
          disabled={!canManageProfile}
          onClick={() => onProfileEdit(account, profileCustomer)}
        >
          <FilePenLine className="size-3.5" />
          编辑资料
        </Button>
      </div>
      {profileCustomer ? (
        <div className="space-y-1.5 sm:space-y-2">
          {canShowCustomerActions ? (
            <div className="grid grid-cols-3 gap-1 sm:flex sm:flex-wrap sm:gap-1.5">
            <Button
              size="xs"
              variant="outline"
              className="bg-white"
              disabled={!canManageCustomerLevel}
              onClick={() => onCustomerAction("customer_level", account)}
            >
              <Star className="size-3.5" />
              修改等级
            </Button>
            <Button
              size="xs"
              variant="outline"
              className="bg-white"
              disabled={!canManageCustomerStatus}
              onClick={() => onCustomerAction("customer_status", account)}
            >
              <BadgeCheck className="size-3.5" />
              修改状态
            </Button>
            <Button
              size="xs"
              variant="outline"
              className="bg-white"
              disabled={!canManageCustomerType}
              onClick={() => onCustomerAction("customer_type", account)}
            >
              <BriefcaseBusiness className="size-3.5" />
              修改价格类型
            </Button>
            {!canManageCustomerLevel || !canManageCustomerStatus || !canManageCustomerType ? (
              <span className="col-span-3 text-[11px] font-semibold leading-5 text-slate-500 sm:text-xs sm:leading-8">
                缺少权限的操作会被锁定。
              </span>
            ) : null}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-1 sm:gap-1.5 lg:grid-cols-3">
            <DetailLine label="名称" value={profileCustomer.name ?? "暂无"} />
            <DetailLine label="登录邮箱" value={account.email ?? profileCustomer.email ?? "暂无"} />
            <DetailLine label="电话" value={profileCustomer.phone ?? "暂无"} />
            <DetailLine label="税号" value={profileCustomer.fiscalCode ?? "暂无"} />
            <DetailLine label="微信/WhatsApp" value={profileCustomer.contactName ?? "可留空"} />
            <DetailLine label="PEC" value={profileCustomer.pec ?? "可留空"} />
            {commerceCustomer ? (
              <>
                <DetailLine label="活跃状态" value={customerStatusLabel(commerceCustomer.status)} />
                <DetailLine label="价格类型" value={customerTypeLabel(commerceCustomer.customerType)} />
                <DetailLine
                  label="客户等级"
                  value={
                    <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
                      <span>{customerLevelLabel(commerceCustomer.level)}</span>
                      <CustomerPromoBadge customer={commerceCustomer} />
                    </span>
                  }
                />
              </>
            ) : null}
            <DetailLine label="配送地址" multiline value={profileCustomer.shippingAddress ?? "暂无"} />
            <DetailLine label="账单地址" multiline value={profileCustomer.billingAddress ?? "暂无"} />
            <DetailLine label="资料完成时间" value={formatDateTime(profileCustomer.profileCompletedAt) ?? "未完成"} />
            <DetailLine label="更新时间" value={formatDateTime(profileCustomer.updatedAt) ?? "暂无"} />
          </div>
          {historyCustomer ? (
            <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600">
              <div className="mb-1 font-black text-slate-800">历史客户资料 / 已转员工</div>
              <div className="flex flex-wrap gap-1">
                <Badge className="border-amber-200 bg-amber-50 text-amber-800" variant="outline">
                  {assignmentStatusLabel(historyCustomer.assignmentStatus)}
                </Badge>
                <Badge className="border-sky-200 bg-sky-50 text-sky-700" variant="outline">
                  {customerTypeLabel(historyCustomer.customerType)}
                </Badge>
                <Badge className="border-violet-200 bg-violet-50 text-violet-700" variant="outline">
                  {customerLevelLabel(historyCustomer.level)}
                </Badge>
                <Badge className="border-slate-200 bg-slate-50 text-slate-500" variant="outline">
                  只读历史记录
                </Badge>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyText text={account.accountType === "employee" ? "员工自购资料未创建。" : "客户资料未初始化。"} />
      )}
    </DetailSection>
  );
}

function CustomerOrdersTab({
  loaded,
  loading,
  orders,
}: {
  loaded: boolean;
  loading: boolean;
  orders: AccountCustomerOrder[];
}) {
  return (
    <DetailSection title="历史订单">
      {loading || !loaded ? (
        <LoadingText text="正在加载历史订单..." />
      ) : orders.length > 0 ? (
        <div className="space-y-1.5">
          {orders.map((order) => (
            <div
              key={order.id}
              className="grid gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]"
            >
              <div className="min-w-0">
                <div className="break-words text-xs font-black text-slate-950">
                  {order.orderNo}
                </div>
                <div className="text-[11px] font-semibold text-slate-500">
                  {formatDateTime(order.createdAt) ?? "暂无日期"}
                </div>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-1">
                <Badge className={orderStatusBadgeClass(order.status)} variant="outline">
                  {orderStatusLabel(order.status)}
                </Badge>
                <Badge className={paymentStatusBadgeClass(order.paymentStatus)} variant="outline">
                  {paymentStatusLabel(order.paymentStatus)}
                </Badge>
              </div>
              <div className="text-[11px] font-semibold text-slate-500">
                {order.lineCount} 行商品
              </div>
              <div className="text-right text-sm font-black text-slate-950">
                {formatEuro(order.total)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyText text="暂无历史订单。" />
      )}
    </DetailSection>
  );
}

function CustomerSpendTab({
  customer,
  loaded,
  loading,
}: {
  customer: AccountCustomer | null;
  loaded: boolean;
  loading: boolean;
}) {
  const summary = customer?.spendSummary ?? emptySpendSummary();
  const orders = customer?.orders ?? [];

  return (
    <DetailSection title="消费金额明细">
      {loading || !loaded ? (
        <LoadingText text="正在加载消费明细..." />
      ) : (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-5 sm:gap-1.5">
          <SpendTile label="累计消费" value={formatEuro(summary.total)} />
          <SpendTile label="已付款" value={formatEuro(summary.paidAmount)} />
          <SpendTile label="待收款" value={formatEuro(summary.pendingAmount)} />
          <SpendTile label="退款/取消" value={formatEuro(summary.refundedAmount + summary.cancelledAmount)} />
          <SpendTile label="订单数" value={`${summary.orderCount} 单`} />
        </div>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 sm:gap-1.5">
          <DetailLine label="净额" value={formatEuro(summary.totalNet)} />
          <DetailLine label="VAT" value={formatEuro(summary.vat)} />
          <DetailLine label="运费" value={formatEuro(summary.shipping)} />
          <DetailLine label="退款金额" value={formatEuro(summary.refundedAmount)} />
        </div>
        {orders.length > 0 ? (
          <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
            <div className="min-w-[620px]">
              <div className="grid grid-cols-[1.3fr_0.9fr_0.8fr_0.8fr_0.8fr_0.9fr] border-b border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                <span>订单</span>
                <span>付款</span>
                <span className="text-right">净额</span>
                <span className="text-right">VAT</span>
                <span className="text-right">运费</span>
                <span className="text-right">总额</span>
              </div>
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="grid grid-cols-[1.3fr_0.9fr_0.8fr_0.8fr_0.8fr_0.9fr] border-b border-slate-100 px-2 py-1.5 text-xs last:border-b-0"
                >
                  <span className="min-w-0 truncate font-black text-slate-900">{order.orderNo}</span>
                  <span className="font-semibold text-slate-600">{paymentStatusLabel(order.paymentStatus)}</span>
                  <span className="text-right font-semibold text-slate-700">{formatEuro(order.totalNet)}</span>
                  <span className="text-right font-semibold text-slate-700">{formatEuro(order.vat)}</span>
                  <span className="text-right font-semibold text-slate-700">{formatEuro(order.shipping)}</span>
                  <span className="text-right font-black text-slate-950">{formatEuro(order.total)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyText text="暂无消费明细。" />
        )}
      </div>
      )}
    </DetailSection>
  );
}

function SpendTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
      <div className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-black text-slate-950">{value}</div>
    </div>
  );
}

function AccountPermissionsSection({
  detail,
  text,
}: {
  detail: AccountDetail;
  text: AdminText;
}) {
  return (
    <DetailSection title="有效权限">
      {detail.permissions.length > 0 ? (
        <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto pr-1">
          {detail.permissions.slice(0, 24).map((permission) => (
            <Badge key={permission} className="h-5 border-slate-200 bg-slate-50 px-1.5 text-[10px] text-slate-600" variant="outline">
              {adminPermissionLabel(text, permission, permission)}
            </Badge>
          ))}
          {detail.permissions.length > 24 ? (
            <Badge className="h-5 border-slate-200 bg-white px-1.5 text-[10px] text-slate-500" variant="outline">
              +{detail.permissions.length - 24}
            </Badge>
          ) : null}
        </div>
      ) : (
        <EmptyText text="暂无后台权限。" />
      )}
    </DetailSection>
  );
}

function EmployeeMembershipsSection({
  detail,
  text,
}: {
  detail: AccountDetail;
  text: AdminText;
}) {
  return (
    <DetailSection title="历史客户成员关系">
      {detail.memberships.length > 0 ? (
        <div className="space-y-1.5">
          {detail.memberships.map((membership) => (
            <div
              key={`${membership.customerId}:${membership.userId}`}
              className="rounded-md border border-slate-200 bg-slate-50/70 px-2 py-1.5"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="min-w-0 break-words text-xs font-black text-slate-900">
                  {membership.displayName ?? membership.email ?? membership.userId}
                </span>
                <Badge className={accountTypeBadgeClass(membership.accountType)} variant="outline">
                  {accountTypeLabel(membership.accountType)}
                </Badge>
                <Badge className={memberStatusBadgeClass(membership.status)} variant="outline">
                  {memberStatusLabel(membership.status)}
                </Badge>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-semibold text-slate-500">
                <span>{membership.email ?? membership.userId}</span>
                <span>成员角色：{memberRoleLabel(membership.memberRole)}</span>
                {membership.roleTemplate ? (
                  <span>员工角色：{roleTemplateLabel(text, membership.roleTemplate)}</span>
                ) : null}
                {membership.status === "disabled" ? (
                  <span>旧客户成员关系已停用，不代表员工登录被禁用</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyText text="暂无历史客户成员关系。" />
      )}
    </DetailSection>
  );
}

function AccountActivityTab({
  detail,
  loaded,
  loading,
  text,
}: {
  detail: AccountDetail;
  loaded: boolean;
  loading: boolean;
  text: AdminText;
}) {
  return (
    <DetailSection title="活动记录">
      {loading || !loaded ? (
        <LoadingText text="正在加载活动记录..." />
      ) : detail.auditEvents.length > 0 || (detail.customer?.recentActivity.length ?? 0) > 0 ? (
        <div className="grid gap-2 xl:grid-cols-2">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black text-slate-500">
              <ShieldCheck className="size-3.5" />
              后台审计
            </div>
            {detail.auditEvents.length > 0 ? (
              <ol className="space-y-1.5">
                {detail.auditEvents.slice(0, 8).map((event) => (
                  <li key={event.id} className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="break-words text-xs font-black text-slate-900">
                          {adminActionLabel(event.action)}
                        </div>
                        <div className="mt-0.5 break-words text-[11px] font-semibold leading-4 text-slate-500">
                          {[
                            event.actorEmail,
                            event.actorRole
                              ? roleTemplateLabel(text, event.actorRole, event.actorRole)
                              : null,
                            event.entityType,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "系统记录"}
                        </div>
                        {event.reason ? (
                          <div className="mt-0.5 break-words text-[11px] leading-4 text-slate-600">
                            {event.reason}
                          </div>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-slate-500">
                        {formatDateTime(event.createdAt) ?? "暂无"}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyText text="暂无后台审计记录。" />
            )}
          </div>
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black text-slate-500">
              <Activity className="size-3.5" />
              客户活动
            </div>
            {detail.customer?.recentActivity.length ? (
              <ol className="space-y-1.5">
                {detail.customer.recentActivity.slice(0, 8).map((event) => (
                  <li key={event.id} className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="break-words text-xs font-black text-slate-900">
                          {customerActivityLabel(event)}
                        </div>
                        <div className="mt-0.5 break-words text-[11px] font-semibold leading-4 text-slate-500">
                          {customerActivitySubject(event)}
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-slate-500">
                        {formatDateTime(event.createdAt) ?? "暂无"}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyText text="暂无客户活动记录。" />
            )}
          </div>
        </div>
      ) : (
        <EmptyText text="暂无最近操作记录。" />
      )}
    </DetailSection>
  );
}

function AccountActionDialog({
  conversion,
  onChange,
  onClose,
  onSubmit,
  roleTemplates,
  submitting,
}: {
  conversion: ConversionState | null;
  onChange: (conversion: ConversionState | null) => void;
  onClose: () => void;
  onSubmit: () => void;
  roleTemplates: RoleTemplate[];
  submitting: boolean;
}) {
  const text = useAdminText();
  const title =
    conversion?.kind === "to_employee"
      ? "客户转为员工"
      : conversion?.kind === "to_customer"
        ? "员工转为客户"
        : "调整员工角色";
  const description =
    conversion?.kind === "to_customer"
      ? "员工会恢复为客户账号并进入待处理状态；正式激活时会自动应用批发客户规则。"
      : conversion?.kind === "to_employee"
        ? "客户账号会转为员工，原客户资料会暂停并标记为已转员工。"
        : "角色模板会决定员工默认后台权限。";
  const canSubmit = Boolean(conversion && conversion.reason.trim().length >= 3);

  return (
    <Dialog open={Boolean(conversion)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {conversion ? (
          <div className="space-y-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="font-black text-slate-900">
                {conversion.account.displayName ?? conversion.account.email ?? conversion.account.userId}
              </div>
              <div className="mt-1 break-words text-xs text-slate-500">
                {conversion.account.email ?? conversion.account.userId}
              </div>
            </div>
            {conversion.kind !== "to_customer" ? (
              <div className="space-y-1.5">
                <Label>员工角色</Label>
                <Select
                  value={conversion.roleTemplate}
                  onValueChange={(value) =>
                    onChange({ ...conversion, roleTemplate: value })
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(roleTemplates.length > 0
                      ? roleTemplates
                      : [{ id: "sales_support", label: "销售支持", permissions: [], description: null }]
                    ).map((roleTemplate) => (
                      <SelectItem key={roleTemplate.id} value={roleTemplate.id}>
                        {roleTemplateLabel(text, roleTemplate.id, roleTemplate.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>变更原因</Label>
              <Textarea
                value={conversion.reason}
                onChange={(event) => onChange({ ...conversion, reason: event.target.value })}
                placeholder="说明业务原因，便于审计追踪"
                rows={4}
              />
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit || submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomerAccountActionDialog({
  action,
  onChange,
  onClose,
  onSubmit,
  submitting,
}: {
  action: CustomerActionState | null;
  onChange: (action: CustomerActionState | null) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const scopeLabel = action?.account.accountType === "employee" ? "员工自购资料" : "客户资料";
  const title =
    action?.kind === "customer_level"
      ? `修改${scopeLabel}等级`
      : action?.kind === "customer_type"
        ? `修改${scopeLabel}价格类型`
        : `修改${scopeLabel}活跃状态`;
  const description =
    action?.kind === "customer_level"
      ? "客户等级会按每件固定金额影响前台客户价和代客下单价格。"
      : action?.kind === "customer_type"
        ? "价格类型决定客户使用零售价还是批发价，和活跃状态独立。"
        : "活跃状态只控制账号是否可继续使用价格和 checkout，不会改变价格类型。";
  const canSubmit = Boolean(action && action.reason.trim().length >= 3);

  return (
    <Dialog open={Boolean(action)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {action ? (
          <div className="space-y-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="font-black text-slate-900">
                {action.targetCustomer.name ?? action.account.displayName ?? action.account.email ?? action.account.userId}
              </div>
              <div className="mt-1 break-words text-xs text-slate-500">
                {scopeLabel} · {action.targetCustomer.email ?? action.account.email ?? action.account.userId}
              </div>
            </div>
            {action.kind === "customer_level" ? (
              <div className="space-y-1.5">
                <Label>客户等级</Label>
                <Select
                  value={action.level}
                  onValueChange={(value) =>
                    onChange({ ...action, level: normalizeCustomerLevel(value) })
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {customerLevels.map((level) => (
                      <SelectItem key={level} value={level}>
                        {customerLevelOptionLabel(level)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs font-semibold text-slate-500">
                  当前等级减价：每件减 {customerLevelDiscountLabel(action.level)}
                </div>
              </div>
            ) : action.kind === "customer_type" ? (
              <div className="space-y-1.5">
                <Label>价格类型</Label>
                <Select
                  value={action.customerType}
                  onValueChange={(value) =>
                    onChange({ ...action, customerType: normalizeCustomerType(value) })
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {customerTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {customerTypeLabel(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>活跃状态</Label>
                <Select
                  value={action.status}
                  onValueChange={(value) =>
                    onChange({ ...action, status: normalizeCustomerStatus(value) })
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {customerStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {customerStatusLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>变更原因</Label>
              <Textarea
                value={action.reason}
                onChange={(event) => onChange({ ...action, reason: event.target.value })}
                placeholder="说明业务原因，便于审计追踪"
                rows={4}
              />
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit || submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccountProfileEditorDialog({
  editor,
  onAddressChange,
  onBillingSameAsShippingChange,
  onChange,
  onClose,
  onSubmit,
  submitting,
}: {
  editor: AccountProfileEditorState | null;
  onAddressChange: (
    addressKey: "billingAddress" | "shippingAddress",
    field: AddressDraftField,
    value: string
  ) => void;
  onBillingSameAsShippingChange: (checked: boolean) => void;
  onChange: (field: AccountProfileEditorField, value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const canSubmit = Boolean(
    editor &&
      editor.companyName.trim() &&
      editor.phone.trim() &&
      editor.fiscalCode.trim() &&
      editor.reason.trim().length >= 3 &&
      isAddressDraftComplete(editor.shippingAddress) &&
      (editor.billingSameAsShipping || isAddressDraftComplete(editor.billingAddress))
  );

  return (
    <Dialog open={Boolean(editor)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {editor?.account.accountType === "employee" ? "编辑员工自购资料" : "编辑客户个人中心资料"}
          </DialogTitle>
          <DialogDescription>
            这些资料用于账号、订单、发票和配送；邮箱来自登录账号，不能在这里修改。
          </DialogDescription>
        </DialogHeader>
        {editor ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <ProfileEditorInput field="companyName" label="客户名称" required value={editor.companyName} onChange={onChange} />
              <ProfileEditorInput field="contactName" label="微信号码 / WhatsApp 号码" value={editor.contactName} onChange={onChange} />
              <div className="space-y-1.5">
                <Label htmlFor="admin-profile-editor-email" className="text-xs font-black text-slate-500">
                  邮箱 *
                </Label>
                <Input id="admin-profile-editor-email" disabled type="email" value={editor.email} />
              </div>
              <ProfileEditorInput field="phone" label="电话" required value={editor.phone} onChange={onChange} />
              <ProfileEditorInput field="fiscalCode" label="税号" required value={editor.fiscalCode} onChange={onChange} />
              <ProfileEditorInput field="pec" label="PEC" value={editor.pec} onChange={onChange} />
            </div>

            <AddressDraftFields
              addressKey="shippingAddress"
              idPrefix="admin-profile-editor"
              title="配送地址"
              value={editor.shippingAddress}
              onChange={onAddressChange}
            />
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
              <Checkbox
                className="mt-0.5"
                checked={editor.billingSameAsShipping}
                onCheckedChange={(checked) => onBillingSameAsShippingChange(Boolean(checked))}
              />
              <span>账单地址跟配送地址一样</span>
            </label>
            {!editor.billingSameAsShipping ? (
              <AddressDraftFields
                addressKey="billingAddress"
                idPrefix="admin-profile-editor"
                title="账单地址"
                value={editor.billingAddress}
                onChange={onAddressChange}
              />
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="admin-profile-editor-reason" className="text-xs font-black text-slate-500">
                变更原因 *
              </Label>
              <Textarea
                id="admin-profile-editor-reason"
                value={editor.reason}
                onChange={(event) => onChange("reason", event.target.value)}
                placeholder="说明业务原因，便于审计追踪"
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                取消
              </Button>
              <Button type="submit" disabled={!canSubmit || submitting}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />}
                保存资料
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ProfileEditorInput({
  field,
  label,
  onChange,
  required,
  value,
}: {
  field: Exclude<AccountProfileEditorField, "reason">;
  label: string;
  onChange: (field: AccountProfileEditorField, value: string) => void;
  required?: boolean;
  value: string;
}) {
  const id = `admin-profile-editor-${field}`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-black text-slate-500">
        {label}
        {required ? " *" : null}
      </Label>
      <Input
        id={id}
        required={required}
        value={value}
        onChange={(event) => onChange(field, event.currentTarget.value)}
      />
    </div>
  );
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {}
) {
  const { signal, timeoutMs = adminAccountReadTimeoutMs, ...requestInit } = init;
  const controller = new AbortController();
  let timedOut = false;

  function abortFromParent() {
    controller.abort(signal?.reason);
  }

  if (signal?.aborted) {
    abortFromParent();
  } else {
    signal?.addEventListener("abort", abortFromParent, { once: true });
  }

  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...requestInit,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new Error("账号数据加载超时，请检查网络后重试。");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromParent);
  }
}

async function fetchCurrentUser(signal?: AbortSignal): Promise<CurrentUser> {
  const response = await fetchWithTimeout("/api/me", {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
    timeoutMs: adminAccountAuxiliaryReadTimeoutMs,
  });

  if (!response.ok) {
    throw new Error(`GET /api/me 返回 ${response.status}`);
  }

  const payload = (await response.json()) as unknown;

  return {
    permissions: isRecord(payload)
      ? readArray(payload.permissions).map(readString).filter(isDefined)
      : [],
    userId: isRecord(payload) ? readString(payload.userId) : null,
  };
}

async function fetchRoleTemplates(signal?: AbortSignal): Promise<RoleTemplate[]> {
  const response = await fetchWithTimeout("/api/admin/permissions/catalog", {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
    timeoutMs: adminAccountAuxiliaryReadTimeoutMs,
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as unknown;
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : {};

  return readArray(data.roleTemplates).map(normalizeRoleTemplate).filter(isDefined);
}

function submitCustomerAccountAction(action: CustomerActionState): Promise<AccountDetail> {
  if (action.kind === "customer_level") {
    return patchCustomerLevel(action.account.userId, action.level, action.reason);
  }

  if (action.kind === "customer_type") {
    return patchCustomerType(action.account.userId, action.customerType, action.reason);
  }

  return patchCustomerStatus(action.account.userId, action.status, action.reason);
}

async function fetchAccounts(
  accountType: AccountType,
  page: number,
  query: string,
  signal?: AbortSignal
) {
  const params = new URLSearchParams({
    accountType,
    limit: String(pageSize),
    offset: String(page * pageSize),
  });

  if (query.trim().length >= 2) {
    params.set("q", query.trim());
  }

  const response = await fetchWithTimeout(`/api/admin/accounts?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
    timeoutMs: adminAccountReadTimeoutMs,
  });

  if (!response.ok) {
    throw new Error(`GET /api/admin/accounts 返回 ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  const meta = isRecord(payload) && isRecord(payload.meta) ? payload.meta : {};

  return {
    data: isRecord(payload)
      ? readArray(payload.data).map(normalizeAccount).filter(isDefined)
      : [],
    total: readNumber(meta.total) ?? 0,
  };
}

async function fetchAccountDetail(
  userId: string,
  {
    includes = [],
    signal,
  }: {
    includes?: AccountDetailInclude[];
    signal?: AbortSignal;
  } = {}
): Promise<AccountDetail> {
  const params = new URLSearchParams();

  if (includes.length > 0) {
    params.set("include", includes.join(","));
  }

  const query = params.toString();
  const response = await fetchWithTimeout(`/api/admin/accounts/${encodeURIComponent(userId)}${query ? `?${query}` : ""}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
    timeoutMs: adminAccountReadTimeoutMs,
  });

  if (!response.ok) {
    throw new Error(`GET /api/admin/accounts/${userId} 返回 ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null;
  const detail = normalizeAccountDetail(data);

  if (!detail) {
    throw new Error("账号详情返回格式不完整");
  }

  return detail;
}

async function patchAccountType(conversion: ConversionState): Promise<AccountDetail> {
  const body =
    conversion.kind === "to_employee"
      ? {
          accountType: "employee",
          reason: conversion.reason,
          roleTemplate: conversion.roleTemplate,
          userId: conversion.account.userId,
        }
      : {
          accountType: "customer",
          assignmentStatus: "needs_review",
          customerType: "retail",
          reason: conversion.reason,
          userId: conversion.account.userId,
        };

  const response = await fetch("/api/admin/accounts", {
    body: JSON.stringify(body),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error(`PATCH /api/admin/accounts 返回 ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null;
  const detail = normalizeAccountDetail(data);

  if (!detail) {
    throw new Error("账号变更返回格式不完整");
  }

  return detail;
}

async function patchAccountRole(userId: string, roleTemplate: string, reason: string) {
  const response = await fetch(`/api/admin/accounts/${encodeURIComponent(userId)}/role`, {
    body: JSON.stringify({ reason, roleTemplate }),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error(`PATCH /api/admin/accounts/${userId}/role 返回 ${response.status}`);
  }
}

async function patchCustomerLevel(
  userId: string,
  level: CustomerLevel,
  reason: string
): Promise<AccountDetail> {
  const response = await fetch(`/api/admin/accounts/${encodeURIComponent(userId)}/customer-level`, {
    body: JSON.stringify({ level, reason }),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error(`PATCH /api/admin/accounts/${userId}/customer-level 返回 ${response.status}`);
  }

  return accountDetailFromResponse(await response.json(), "客户等级更新返回格式不完整");
}

async function patchCustomerStatus(
  userId: string,
  status: CustomerStatus,
  reason: string
): Promise<AccountDetail> {
  const response = await fetch(`/api/admin/accounts/${encodeURIComponent(userId)}/customer-status`, {
    body: JSON.stringify({ reason, status }),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error(`PATCH /api/admin/accounts/${userId}/customer-status 返回 ${response.status}`);
  }

  return accountDetailFromResponse(await response.json(), "客户状态更新返回格式不完整");
}

async function patchCustomerType(
  userId: string,
  customerType: CustomerType,
  reason: string
): Promise<AccountDetail> {
  const response = await fetch(`/api/admin/accounts/${encodeURIComponent(userId)}/customer-type`, {
    body: JSON.stringify({ customerType, reason }),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error(`PATCH /api/admin/accounts/${userId}/customer-type 返回 ${response.status}`);
  }

  return accountDetailFromResponse(await response.json(), "价格类型更新返回格式不完整");
}

async function patchAccountCustomerProfile(
  userId: string,
  profile: {
    billingAddress: string;
    companyName: string;
    contactName: string;
    fiscalCode: string;
    pec: string;
    phone: string;
    reason: string;
    shippingAddress: string;
  }
): Promise<AccountDetail> {
  const response = await fetch(`/api/admin/accounts/${encodeURIComponent(userId)}/customer-profile`, {
    body: JSON.stringify(profile),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error(`PATCH /api/admin/accounts/${userId}/customer-profile 返回 ${response.status}`);
  }

  return accountDetailFromResponse(await response.json(), "账号资料更新返回格式不完整");
}

function accountDetailFromResponse(payload: unknown, message: string): AccountDetail {
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null;
  const detail = normalizeAccountDetail(data);

  if (!detail) {
    throw new Error(message);
  }

  return detail;
}

function AccountAvatar({
  account,
  size = "default",
}: {
  account: Pick<Account, "accountType" | "displayName" | "email">;
  size?: "default" | "lg";
}) {
  const Icon = account.accountType === "employee" ? UserCog : UsersRound;

  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-full text-white shadow-sm",
        account.accountType === "employee" ? "bg-indigo-600" : "bg-blue-600",
        size === "lg" ? "size-10" : "size-8"
      )}
      aria-hidden="true"
    >
      {size === "lg" ? (
        <Icon className="size-5" />
      ) : (
        <span className="text-xs font-black">{initials(account)}</span>
      )}
    </div>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-h-[46px] min-w-0 rounded-md border border-slate-200 bg-white px-1.5 py-1 sm:min-h-[56px] sm:px-2 sm:py-1.5">
      <div className="flex min-w-0 items-center gap-1 text-[10px] font-bold leading-3 text-slate-500 sm:text-[11px]">
        <Icon className="size-3 shrink-0 sm:size-3.5" />
        <span className="min-w-0 truncate">{label}</span>
      </div>
      <div className="mt-0.5 truncate text-[12px] font-black leading-4 text-slate-900 sm:text-[13px] sm:leading-5">
        {value}
      </div>
    </div>
  );
}

function DetailSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-2 sm:p-2.5">
      <h4 className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-slate-500 sm:mb-2 sm:text-xs">{title}</h4>
      {children}
    </section>
  );
}

function DetailLine({
  label,
  multiline = false,
  value,
}: {
  label: string;
  multiline?: boolean;
  value: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0 rounded-md bg-slate-50 px-1.5 py-1 sm:px-2", multiline && "sm:col-span-2 lg:col-span-3")}>
      <div className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div
        className={cn(
          "text-[11px] font-bold leading-4 text-slate-900 sm:text-xs sm:leading-5",
          multiline ? "break-words" : "truncate sm:break-words"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function CustomerAssignmentBadges({ customer }: { customer: AccountCustomer | null }) {
  const badgeClass = "h-5 px-1.5 text-[10px]";

  if (!customer) {
    return (
      <Badge className={cn(badgeClass, "border-slate-200 bg-slate-50 text-slate-500")} variant="outline">
        客户资料未初始化
      </Badge>
    );
  }

  return (
    <>
      <Badge className={cn(badgeClass, customerStatusBadgeClass(customer.status))} variant="outline">
        {customerStatusLabel(customer.status)}
      </Badge>
      <Badge className={cn(badgeClass, "border-sky-200 bg-sky-50 text-sky-700")} variant="outline">
        {customerTypeLabel(customer.customerType)}
      </Badge>
      <Badge className={cn(badgeClass, "border-violet-200 bg-violet-50 text-violet-700")} variant="outline">
        {customerLevelLabel(customer.level)}
      </Badge>
      <CustomerPromoBadge customer={customer} compact />
      <Badge className={cn(badgeClass, "border-slate-200 bg-slate-50 text-slate-500")} variant="outline">
        {customer.ordersCount} 单
      </Badge>
    </>
  );
}

function ProfileStateBadge({ state }: { state: AccountProfileState }) {
  return (
    <Badge
      className={cn("h-5 px-1.5 text-[10px]", profileStateBadgeClass(state.status))}
      variant="outline"
    >
      {profileStateLabel(state)}
    </Badge>
  );
}

function CustomerPromoBadge({
  compact = false,
  customer,
}: {
  compact?: boolean;
  customer: AccountCustomer;
}) {
  const expiresAt = activePromoExpiresAt(customer);

  if (!expiresAt) {
    return null;
  }

  return (
    <Badge
      className={cn(
        "h-5 shrink-0 border-emerald-200 bg-emerald-50 px-1.5 text-[10px] font-black text-emerald-700",
        compact && "max-w-[92px] truncate"
      )}
      variant="outline"
    >
      活动至 {formatDate(expiresAt)}
    </Badge>
  );
}

function NoticeBanner({
  notice,
  onDismiss,
}: {
  notice: Notice;
  onDismiss: () => void;
}) {
  const isSuccess = notice.tone === "success";

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold",
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : notice.tone === "warning"
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-red-200 bg-red-50 text-red-800"
      )}
    >
      {isSuccess ? <BadgeCheck className="size-4" /> : <AlertTriangle className="size-4" />}
      <span className="min-w-0 flex-1 break-words">{notice.message}</span>
      <Button variant="ghost" size="xs" className="text-current" onClick={onDismiss}>
        OK
      </Button>
    </div>
  );
}

function AccountListSkeleton() {
  return (
    <div className="space-y-2">
      <LoadingText text="正在加载账号..." />
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="grid h-[76px] animate-pulse grid-cols-[minmax(0,1fr)_68px] gap-3 rounded-md border border-slate-200 bg-white p-2"
        >
          <div className="min-w-0 space-y-2">
            <div className="h-4 w-2/3 rounded bg-slate-200" />
            <div className="h-3 w-5/6 rounded bg-slate-100" />
            <div className="h-5 w-24 rounded-full bg-slate-100" />
          </div>
          <div className="h-7 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function LoadingText({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 rounded-md border border-primary/10 bg-primary/5 p-4 text-sm font-semibold text-primary">
      <Loader2 className="size-4 animate-spin" />
      {text}
    </div>
  );
}

function normalizeAccountDetail(value: unknown): AccountDetail | null {
  if (!isRecord(value)) {
    return null;
  }

  const account = normalizeAccount(value.account);

  if (!account) {
    return null;
  }
  const customer = normalizeCustomer(value.customer) ?? account.customer;
  const profileCustomer = normalizeCustomer(value.profileCustomer) ?? account.profileCustomer;
  const profileState = normalizeProfileState(
    value.profileState,
    account.accountType,
    profileCustomer
  );
  const normalizedAccount = {
    ...account,
    customer,
    profileCustomer,
    profileState,
  };

  return {
    account: normalizedAccount,
    customer,
    memberships: readArray(value.memberships).map(normalizeMembership).filter(isDefined),
    permissions: readArray(value.permissions).map(readString).filter(isDefined),
    auditEvents: readArray(value.auditEvents).map(normalizeAuditEvent).filter(isDefined),
    profileCustomer,
    profileState,
  };
}

function normalizeAccount(value: unknown): Account | null {
  if (!isRecord(value)) {
    return null;
  }

  const userId = readString(value.userId);

  if (!userId) {
    return null;
  }
  const accountType: AccountType =
    readString(value.accountType) === "employee" ? "employee" : "customer";
  const customer = normalizeCustomer(value.customer);
  const rawProfileCustomer = normalizeCustomer(value.profileCustomer);
  const profileCustomer = rawProfileCustomer ?? (accountType === "employee" ? null : customer);
  const profileState = normalizeProfileState(value.profileState, accountType, profileCustomer);

  return {
    userId,
    email: readString(value.email),
    displayName: readString(value.displayName),
    avatarUrl: readString(value.avatarUrl),
    authProvider: readString(value.authProvider) ?? "password",
    accountType,
    role: readString(value.role) ?? "customer",
    roleTemplate: readString(value.roleTemplate),
    customerId: readString(value.customerId),
    customerState: readString(value.customerState) ?? "profiles_only",
    customer,
    profileCustomer,
    profileState,
    createdAt: readString(value.createdAt),
    updatedAt: readString(value.updatedAt),
  };
}

function normalizeCustomer(value: unknown): AccountCustomer | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    id: readString(value.id),
    userId: readString(value.userId),
    name: readString(value.name),
    contactName: readString(value.contactName),
    email: readString(value.email),
    phone: readString(value.phone),
    vatNumber: readString(value.vatNumber),
    fiscalCode: readString(value.fiscalCode),
    sdi: readString(value.sdi),
    pec: readString(value.pec),
    billingAddress: readString(value.billingAddress),
    shippingAddress: readString(value.shippingAddress),
    status: readString(value.status) ?? "pending",
    customerType: readString(value.customerType) ?? "retail",
    assignmentStatus: readString(value.assignmentStatus) ?? "needs_review",
    profileKind: readString(value.profileKind) ?? "customer",
    level: readString(value.level) ?? "bronze",
    lifetimeSpendNet: readNumber(value.lifetimeSpendNet) ?? 0,
    promoLevel: readString(value.promoLevel),
    promoLevelStartsAt: readString(value.promoLevelStartsAt),
    promoLevelExpiresAt: readString(value.promoLevelExpiresAt),
    promoLevelReason: readString(value.promoLevelReason),
    orders: readArray(value.orders).map(normalizeCustomerOrder).filter(isDefined),
    ordersCount: readNumber(value.ordersCount) ?? 0,
    revenue: readNumber(value.revenue) ?? readNumber(value.lifetimeSpendNet) ?? 0,
    lastOrderAt: readString(value.lastOrderAt),
    lastActivityAt: readString(value.lastActivityAt),
    recentActivity: readArray(value.recentActivity).map(normalizeCustomerActivity).filter(isDefined),
    spendSummary: normalizeSpendSummary(value.spendSummary),
    profileCompletedAt: readString(value.profileCompletedAt),
    convertedToEmployeeAt: readString(value.convertedToEmployeeAt),
    createdAt: readString(value.createdAt),
    updatedAt: readString(value.updatedAt),
  };
}

function normalizeProfileState(
  value: unknown,
  accountType: AccountType,
  profileCustomer: AccountCustomer | null
): AccountProfileState {
  if (isRecord(value)) {
    const statusValue = readString(value.status);
    const status =
      statusValue === "complete" || statusValue === "missing"
        ? statusValue
        : statusValue === "incomplete"
          ? "incomplete"
          : null;
    const kind = readString(value.kind) === "employee_self" ? "employee_self" : "customer";

    if (status) {
      return {
        kind,
        missingFields: readArray(value.missingFields).map(readString).filter(isDefined),
        status,
      };
    }
  }

  if (!profileCustomer) {
    return {
      kind: accountType === "employee" ? "employee_self" : "customer",
      missingFields: ["profile"],
      status: "missing",
    };
  }

  const missingFields = profileMissingFields(profileCustomer);

  return {
    kind: accountType === "employee" ? "employee_self" : "customer",
    missingFields,
    status: missingFields.length > 0 ? "incomplete" : "complete",
  };
}

function profileMissingFields(profileCustomer: AccountCustomer) {
  const missingFields: string[] = [];

  for (const [field, value] of [
    ["name", profileCustomer.name],
    ["email", profileCustomer.email],
    ["phone", profileCustomer.phone],
    ["fiscalCode", profileCustomer.fiscalCode],
    ["billingAddress", profileCustomer.billingAddress],
    ["shippingAddress", profileCustomer.shippingAddress],
  ] as const) {
    if (!value) {
      missingFields.push(field);
    }
  }

  return missingFields;
}

function normalizeCustomerOrder(value: unknown): AccountCustomerOrder | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);
  const orderNo = readString(value.orderNo);

  if (!id || !orderNo) {
    return null;
  }

  return {
    id,
    orderNo,
    status: readString(value.status) ?? "submitted",
    paymentStatus: readString(value.paymentStatus) ?? "unpaid",
    totalNet: readNumber(value.totalNet) ?? 0,
    vat: readNumber(value.vat) ?? 0,
    shipping: readNumber(value.shipping) ?? 0,
    total: readNumber(value.total) ?? 0,
    lineCount: readNumber(value.lineCount) ?? 0,
    createdAt: readString(value.createdAt),
    updatedAt: readString(value.updatedAt),
  };
}

function normalizeSpendSummary(value: unknown): AccountSpendSummary {
  if (!isRecord(value)) {
    return emptySpendSummary();
  }

  return {
    cancelledAmount: readNumber(value.cancelledAmount) ?? 0,
    orderCount: readNumber(value.orderCount) ?? 0,
    paidAmount: readNumber(value.paidAmount) ?? 0,
    pendingAmount: readNumber(value.pendingAmount) ?? 0,
    refundedAmount: readNumber(value.refundedAmount) ?? 0,
    shipping: readNumber(value.shipping) ?? 0,
    total: readNumber(value.total) ?? 0,
    totalNet: readNumber(value.totalNet) ?? 0,
    vat: readNumber(value.vat) ?? 0,
  };
}

function emptySpendSummary(): AccountSpendSummary {
  return {
    cancelledAmount: 0,
    orderCount: 0,
    paidAmount: 0,
    pendingAmount: 0,
    refundedAmount: 0,
    shipping: 0,
    total: 0,
    totalNet: 0,
    vat: 0,
  };
}

function normalizeCustomerActivity(value: unknown): AccountCustomerActivity | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);

  if (!id) {
    return null;
  }

  return {
    id,
    eventType: readString(value.eventType) ?? "activity",
    skuCode: readString(value.skuCode),
    productName: readString(value.productName),
    brand: readString(value.brand),
    model: readString(value.model),
    modelSeries: readString(value.modelSeries),
    searchQuery: readString(value.searchQuery),
    createdAt: readString(value.createdAt),
  };
}

function normalizeMembership(value: unknown): AccountMembership | null {
  if (!isRecord(value)) {
    return null;
  }

  const customerId = readString(value.customerId);
  const userId = readString(value.userId);

  if (!customerId || !userId) {
    return null;
  }

  return {
    customerId,
    userId,
    email: readString(value.email),
    displayName: readString(value.displayName),
    accountType: readString(value.accountType) ?? "customer",
    role: readString(value.role),
    roleTemplate: readString(value.roleTemplate),
    memberRole: readString(value.memberRole) ?? "owner",
    status: readString(value.status) ?? "active",
    createdAt: readString(value.createdAt),
  };
}

function normalizeAuditEvent(value: unknown): AccountAuditEvent | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);

  if (!id) {
    return null;
  }

  return {
    id,
    action: readString(value.action) ?? "admin.audit",
    actorEmail: readString(value.actorEmail),
    actorRole: readString(value.actorRole),
    entityType: readString(value.entityType),
    reason: readString(value.reason),
    result: readString(value.result) ?? "ok",
    createdAt: readString(value.createdAt),
  };
}

function normalizeRoleTemplate(value: unknown): RoleTemplate | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);

  if (!id) {
    return null;
  }

  return {
    id,
    label: readString(value.label) ?? id,
    description: readString(value.description),
    permissions: readArray(value.permissions).map(readString).filter(isDefined),
  };
}

function accountTypeLabel(value: string) {
  return value === "employee" ? "员工账号" : "客户账号";
}

function profileStateLabel(state: AccountProfileState) {
  if (state.status === "complete") {
    return "资料完整";
  }

  if (state.status === "missing") {
    return "资料未创建";
  }

  return "资料待补全";
}

function profileMissingFieldLabel(value: string) {
  const labels: Record<string, string> = {
    billingAddress: "账单地址",
    email: "邮箱",
    fiscalCode: "税号",
    name: "名称",
    phone: "电话",
    profile: "资料",
    shippingAddress: "配送地址",
  };

  return labels[value] ?? value;
}

function customerStatusLabel(value: string) {
  if (value === "active") {
    return "活跃";
  }

  if (value === "suspended") {
    return "已暂停";
  }

  return "待处理";
}

function customerTypeLabel(value: string) {
  return value === "wholesale" ? "批发客户" : "零售价客户";
}

function assignmentStatusLabel(value: string) {
  const labels: Record<string, string> = {
    archived: "已归档",
    assigned: "已启用",
    converted_to_employee: "已转员工",
    needs_review: "待审核",
  };

  return labels[value] ?? value;
}

function orderStatusLabel(value: string) {
  const labels: Record<string, string> = {
    accepted: "已接单",
    cancelled: "已取消",
    completed: "已完成",
    packed: "已打包",
    picking: "拣货中",
    shipped: "已发货",
    submitted: "新订单",
  };

  return labels[value] ?? value;
}

function paymentStatusLabel(value: string) {
  const labels: Record<string, string> = {
    authorized: "待核查",
    paid: "已付款",
    refunded: "已退款",
    unpaid: "待收款",
  };

  return labels[value] ?? value;
}

function customerLevelLabel(value: string) {
  return `${customerLevelName(value)} · 每件减 ${customerLevelDiscountLabel(value)}`;
}

function customerLevelOptionLabel(value: string) {
  return `${customerLevelName(value)} · 每件减 ${customerLevelDiscountLabel(value)}`;
}

function customerLevelDiscountLabel(value: string) {
  return formatTierDiscount(normalizeCustomerLevel(value));
}

function customerLevelName(value: string) {
  const labels: Record<CustomerLevel, string> = {
    bronze: "青铜 Bronze",
    silver: "白银 Silver",
    gold: "黄金 Gold",
    emerald: "翡翠 Emerald",
    diamond: "钻石 Diamond",
    master: "大师 Master",
    king: "王者 King",
  };

  return labels[normalizeCustomerLevel(value)];
}

function activePromoExpiresAt(customer: AccountCustomer) {
  if (!customer.promoLevel || !customer.promoLevelStartsAt || !customer.promoLevelExpiresAt) {
    return null;
  }

  const now = Date.now();
  const startsAt = new Date(customer.promoLevelStartsAt).getTime();
  const expiresAt = new Date(customer.promoLevelExpiresAt).getTime();

  if (!Number.isFinite(startsAt) || !Number.isFinite(expiresAt)) {
    return null;
  }

  return now >= startsAt && now < expiresAt ? customer.promoLevelExpiresAt : null;
}

function normalizeCustomerLevel(value: string): CustomerLevel {
  return customerLevels.includes(value as CustomerLevel)
    ? (value as CustomerLevel)
    : "bronze";
}

function normalizeCustomerStatus(value: string): CustomerStatus {
  return customerStatuses.includes(value as CustomerStatus)
    ? (value as CustomerStatus)
    : "pending";
}

function normalizeCustomerType(value: string): CustomerType {
  return customerTypes.includes(value as CustomerType)
    ? (value as CustomerType)
    : "retail";
}

function customerActivityLabel(event: AccountCustomerActivity) {
  const labels: Record<string, string> = {
    catalog_filter: "筛选目录",
    catalog_search: "搜索目录",
    model_view: "查看机型",
    order_detail_view: "查看订单",
    product_view: "查看商品",
  };

  return labels[event.eventType] ?? event.eventType;
}

function customerActivitySubject(event: AccountCustomerActivity) {
  return [
    event.searchQuery ? `搜索：${event.searchQuery}` : null,
    event.productName,
    event.skuCode,
    event.brand,
    event.modelSeries ?? event.model,
  ]
    .filter(Boolean)
    .join(" · ") || "客户前台操作";
}

function memberRoleLabel(value: string) {
  const labels: Record<string, string> = {
    buyer: "采购",
    finance: "财务",
    owner: "所有者",
    support: "售后",
  };

  return labels[value] ?? value;
}

function memberStatusLabel(value: string) {
  if (value === "disabled") {
    return "已停用成员关系";
  }

  if (value === "invited") {
    return "已邀请";
  }

  return "活跃";
}

function roleTemplateLabel(
  text: AdminText,
  value: string | null | undefined,
  fallback?: string | null
) {
  return adminRoleTemplateLabel(text, value, fallback);
}

function adminActionLabel(value: string) {
  const labels: Record<string, string> = {
    "account.role_update": "员工角色更新",
    "account.type_update": "账号类型更新",
    "customer.classification_update": "客户分类更新",
    "customer.profile_ensure": "客户资料创建",
    "customer.level_update": "客户等级更新",
    "customer.profile_update": "客户档案更新",
    "customer.terms_update": "商业条款更新",
    "employee.self_customer_ensure": "员工自购资料创建",
    "permissions.update": "权限覆盖更新",
  };

  return labels[value] ?? value;
}

function accountTypeBadgeClass(value: string) {
  return value === "employee"
    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
    : "border-blue-200 bg-blue-50 text-blue-700";
}

function profileStateBadgeClass(value: AccountProfileState["status"]) {
  if (value === "complete") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value === "missing") {
    return "border-slate-200 bg-slate-50 text-slate-500";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function customerStatusBadgeClass(value: string) {
  if (value === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value === "suspended") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function orderStatusBadgeClass(value: string) {
  if (value === "completed" || value === "shipped") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value === "cancelled") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (value === "packed" || value === "picking") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function paymentStatusBadgeClass(value: string) {
  if (value === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value === "refunded") {
    return "border-slate-200 bg-slate-50 text-slate-600";
  }

  if (value === "authorized") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function memberStatusBadgeClass(value: string) {
  if (value === "disabled") {
    return "border-slate-200 bg-slate-50 text-slate-500";
  }

  if (value === "invited") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function initials(account: Pick<Account, "displayName" | "email">) {
  const value = account.displayName ?? account.email ?? "A";

  return value.slice(0, 2).toUpperCase();
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(value));
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请稍后重试。";
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
