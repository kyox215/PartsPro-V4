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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  adminPermissionLabel,
  adminRoleTemplateLabel,
  getAdminDictionary,
  type AdminText,
} from "@/i18n/dictionaries/admin";
import { formatEuro } from "@/lib/partspro-data";
import { cn } from "@/lib/utils";
import { AdminBusyRegion } from "./admin-feedback";
import { useI18n } from "./i18n-provider";

type AccountType = "customer" | "employee";
type ConversionKind = "role" | "to_customer" | "to_employee";
type CustomerActionKind = "customer_level" | "customer_status" | "customer_type";
type CustomerLevel = "bronze" | "silver" | "gold" | "emerald" | "diamond" | "master" | "king";
type CustomerStatus = "pending" | "active" | "suspended";
type CustomerType = "retail" | "wholesale";

type AccountCustomer = {
  assignmentStatus: string;
  customerType: string;
  id: string | null;
  lastActivityAt: string | null;
  lastOrderAt: string | null;
  level: string;
  lifetimeSpendNet: number;
  name: string | null;
  ordersCount: number;
  recentActivity: AccountCustomerActivity[];
  revenue: number;
  status: string;
  updatedAt: string | null;
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
  role: string;
  roleTemplate: string | null;
  updatedAt: string | null;
  userId: string;
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
};

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
};

type CurrentUser = {
  permissions: string[];
  userId: string | null;
};

const accountDetailInlineMediaQuery = "(min-width: 1280px)";
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

export function AdminAccountsPanel() {
  const text = useAdminText();
  const [accountType, setAccountType] = React.useState<AccountType>("customer");
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [detail, setDetail] = React.useState<AccountDetail | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [usesInlineDetailPane, setUsesInlineDetailPane] = React.useState(false);
  const [roleTemplates, setRoleTemplates] = React.useState<RoleTemplate[]>([]);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [currentPermissions, setCurrentPermissions] = React.useState<string[]>([]);
  const [permissionsLoaded, setPermissionsLoaded] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [appliedQuery, setAppliedQuery] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [conversion, setConversion] = React.useState<ConversionState | null>(null);
  const [customerAction, setCustomerAction] = React.useState<CustomerActionState | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPermissionSet = React.useMemo(
    () => new Set(currentPermissions),
    [currentPermissions]
  );
  const canManageCustomerLevel = currentPermissionSet.has("customers.manage_level");
  const canManageCustomerStatus = currentPermissionSet.has("customers.classify");
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

  React.useEffect(() => {
    const controller = new AbortController();

    void fetchCurrentUser(controller.signal)
      .then(async (me) => {
        const canReadEmployees =
          me.permissions.includes("employees.read") ||
          me.permissions.includes("employees.manage_permissions");
        const templates = canReadEmployees
          ? await fetchRoleTemplates(controller.signal)
          : [];

        if (!controller.signal.aborted) {
          setCurrentUserId(me.userId);
          setCurrentPermissions(me.permissions);
          setRoleTemplates(templates);
          setPermissionsLoaded(true);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPermissionsLoaded(true);
        }
      });

    return () => controller.abort();
  }, []);

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
      setDetail(null);
      setDetailOpen(false);
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

    setDetailOpen(!shouldUseInlineDetailPane);
    void loadDetail(account.userId);
  }

  async function loadDetail(userId: string) {
    setDetailLoading(true);

    try {
      setDetail(await fetchAccountDetail(userId));
    } catch (error) {
      setNotice({ message: readableError(error), tone: "error" });
    } finally {
      setDetailLoading(false);
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
    const customer = account.customer;

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
    });
  }

  async function submitConversion() {
    if (!conversion || conversion.reason.trim().length < 3) {
      return;
    }

    setSubmitting(true);

    try {
      if (conversion.kind === "role") {
        await patchAccountRole(
          conversion.account.userId,
          conversion.roleTemplate,
          conversion.reason
        );
      } else {
        await patchAccountType(conversion);
      }

      setNotice({ message: "账号变更已保存。", tone: "success" });
      setConversion(null);
      await refreshAccounts();
      await loadDetail(conversion.account.userId);
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
      setDetail(nextDetail);
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
              {total} 个账号
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
                  setDetail(null);
                  setDetailOpen(false);
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
              canManageCustomerStatus={canManageCustomerStatus}
              canManageCustomerType={canManageCustomerType}
              canManageEmployeeAccounts={canManageEmployeeAccounts}
              currentUserId={currentUserId}
              detail={detail}
              loading={detailLoading}
              onAction={openConversion}
              onCustomerAction={openCustomerAction}
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
          <div className="p-2">
            <AccountDetailPane
              canManageCustomerLevel={canManageCustomerLevel}
              canManageCustomerStatus={canManageCustomerStatus}
              canManageCustomerType={canManageCustomerType}
              canManageEmployeeAccounts={canManageEmployeeAccounts}
              currentUserId={currentUserId}
              detail={detail}
              loading={detailLoading}
              onAction={openConversion}
              onCustomerAction={openCustomerAction}
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
    </section>
  );
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
            {account.accountType === "employee" ? (
              <Badge className="h-5 border-indigo-200 bg-indigo-50 px-1.5 text-[10px] text-indigo-700" variant="outline">
                {roleTemplateLabel(text, account.roleTemplate ?? account.role)}
              </Badge>
            ) : (
              <CustomerAssignmentBadges customer={account.customer} />
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function AccountDetailPane({
  canManageCustomerLevel,
  canManageCustomerStatus,
  canManageCustomerType,
  canManageEmployeeAccounts,
  currentUserId,
  detail,
  loading,
  onAction,
  onCustomerAction,
}: {
  canManageCustomerLevel: boolean;
  canManageCustomerStatus: boolean;
  canManageCustomerType: boolean;
  canManageEmployeeAccounts: boolean;
  currentUserId: string | null;
  detail: AccountDetail | null;
  loading: boolean;
  onAction: (kind: ConversionKind, account: Account) => void;
  onCustomerAction: (kind: CustomerActionKind, account: Account) => void;
}) {
  const text = useAdminText();

  if (loading && !detail) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-3">
        <div className="h-7 w-48 animate-pulse rounded bg-slate-100" />
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="h-16 animate-pulse rounded bg-slate-100" />
          <div className="h-16 animate-pulse rounded bg-slate-100" />
          <div className="h-16 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="mt-3 h-36 animate-pulse rounded bg-slate-100" />
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

  return (
    <AdminBusyRegion
      className="min-w-0"
      label={text.common.refreshing}
      overlayClassName="rounded-md"
      pending={loading}
      rows={3}
    >
      <div className="min-w-0 space-y-2 rounded-md border border-slate-200 bg-slate-50/70 p-2">
      <div className="flex min-w-0 items-start gap-2 rounded-md border border-slate-200 bg-white p-2.5">
        <AccountAvatar account={account} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words text-base font-black leading-6 text-slate-950">
              {account.displayName ?? account.email ?? "账号详情"}
            </h3>
            {isSelf ? (
              <Badge className="border-blue-200 bg-blue-50 text-blue-700" variant="outline">
                当前账号
              </Badge>
            ) : null}
          </div>
          <div className="break-words text-xs font-semibold text-slate-500">
            {account.email ?? account.userId}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
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

      <div className="grid gap-1.5 sm:grid-cols-3">
        <InfoTile
          icon={UsersRound}
          label={account.accountType === "customer" ? "客户资料" : "账号资料"}
          value={account.customer?.name ?? account.displayName ?? account.email ?? "客户资料未初始化"}
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

      {account.accountType === "customer" && detail.customer ? (
        <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
          <InfoTile
            icon={BadgeCheck}
            label="活跃状态"
            value={customerStatusLabel(detail.customer.status)}
          />
          <InfoTile
            icon={BriefcaseBusiness}
            label="价格类型"
            value={customerTypeLabel(detail.customer.customerType)}
          />
          <InfoTile
            icon={Star}
            label="客户等级"
            value={customerLevelLabel(detail.customer.level)}
          />
          <InfoTile
            icon={ShoppingBag}
            label="订单数量"
            value={detail.customer.ordersCount}
          />
          <InfoTile
            icon={CircleDollarSign}
            label="消费金额"
            value={formatEuro(detail.customer.revenue)}
          />
          <InfoTile
            icon={Clock3}
            label="最近订单"
            value={formatDate(detail.customer.lastOrderAt) ?? "暂无"}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {account.accountType === "customer" && canManageEmployeeAccounts ? (
          <Button
            size="sm"
            className="h-8"
            disabled={isSelf}
            onClick={() => onAction("to_employee", account)}
          >
            <ArrowLeftRight className="size-4" />
            转为员工
          </Button>
        ) : account.accountType === "employee" && canManageEmployeeAccounts ? (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 bg-white"
              disabled={isSelf}
              onClick={() => onAction("role", account)}
            >
              <ShieldCheck className="size-4" />
              调整角色
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 bg-white"
              disabled={isSelf}
              onClick={() => onAction("to_customer", account)}
            >
              <ArrowLeftRight className="size-4" />
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

      <DetailSection title="客户资料">
        {detail.customer ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-8 bg-white"
                disabled={!canManageCustomerLevel}
                onClick={() => onCustomerAction("customer_level", account)}
              >
                <Star className="size-4" />
                修改等级
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 bg-white"
                disabled={!canManageCustomerStatus}
                onClick={() => onCustomerAction("customer_status", account)}
              >
                <BadgeCheck className="size-4" />
                修改状态
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 bg-white"
                disabled={!canManageCustomerType}
                onClick={() => onCustomerAction("customer_type", account)}
              >
                <BriefcaseBusiness className="size-4" />
                修改价格类型
              </Button>
              {!canManageCustomerLevel || !canManageCustomerStatus || !canManageCustomerType ? (
                <span className="text-xs font-semibold leading-8 text-slate-500">
                  缺少权限的操作会被锁定。
                </span>
              ) : null}
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              <DetailLine label="公司/名称" value={detail.customer.name ?? "暂无"} />
              <DetailLine label="活跃状态" value={customerStatusLabel(detail.customer.status)} />
              <DetailLine label="价格类型" value={customerTypeLabel(detail.customer.customerType)} />
              <DetailLine label="客户等级" value={customerLevelLabel(detail.customer.level)} />
              <DetailLine label="最近活动" value={formatDateTime(detail.customer.lastActivityAt) ?? "暂无"} />
              <DetailLine label="更新时间" value={formatDateTime(detail.customer.updatedAt) ?? "暂无"} />
            </div>
          </div>
        ) : (
          <EmptyText text="客户资料未初始化。" />
        )}
      </DetailSection>

      {account.accountType === "employee" ? (
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
      ) : null}

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

      <DetailSection title="最近操作">
        {detail.auditEvents.length > 0 || (detail.customer?.recentActivity.length ?? 0) > 0 ? (
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
      </div>
    </AdminBusyRegion>
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
  const title =
    action?.kind === "customer_level"
      ? "修改客户等级"
      : action?.kind === "customer_type"
        ? "修改价格类型"
        : "修改活跃状态";
  const description =
    action?.kind === "customer_level"
      ? "客户等级会影响前台客户价和代客下单价格。"
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
                {action.account.customer?.name ?? action.account.displayName ?? action.account.email ?? action.account.userId}
              </div>
              <div className="mt-1 break-words text-xs text-slate-500">
                {action.account.email ?? action.account.userId}
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
                        {customerLevelLabel(level)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

async function fetchCurrentUser(signal?: AbortSignal): Promise<CurrentUser> {
  const response = await fetch("/api/me", {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const payload = (await response.json()) as unknown;

  return {
    permissions: isRecord(payload)
      ? readArray(payload.permissions).map(readString).filter(isDefined)
      : [],
    userId: isRecord(payload) ? readString(payload.userId) : null,
  };
}

async function fetchRoleTemplates(signal?: AbortSignal): Promise<RoleTemplate[]> {
  const response = await fetch("/api/admin/permissions/catalog", {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
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

  const response = await fetch(`/api/admin/accounts?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
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

async function fetchAccountDetail(userId: string): Promise<AccountDetail> {
  const response = await fetch(`/api/admin/accounts/${encodeURIComponent(userId)}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
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

async function patchAccountType(conversion: ConversionState) {
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
    <div className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5">
      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-0.5 truncate text-[13px] font-black leading-5 text-slate-900">{value}</div>
    </div>
  );
}

function DetailSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-2.5">
      <h4 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">{title}</h4>
      {children}
    </section>
  );
}

function DetailLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-md bg-slate-50 px-2 py-1">
      <div className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="break-words text-xs font-bold leading-5 text-slate-900">{value}</div>
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
      <Badge className={cn(badgeClass, "border-slate-200 bg-slate-50 text-slate-500")} variant="outline">
        {customer.ordersCount} 单
      </Badge>
    </>
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
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-[76px] animate-pulse rounded-md bg-white" />
      ))}
    </>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
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

  return {
    account,
    customer: normalizeCustomer(value.customer),
    memberships: readArray(value.memberships).map(normalizeMembership).filter(isDefined),
    permissions: readArray(value.permissions).map(readString).filter(isDefined),
    auditEvents: readArray(value.auditEvents).map(normalizeAuditEvent).filter(isDefined),
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

  return {
    userId,
    email: readString(value.email),
    displayName: readString(value.displayName),
    avatarUrl: readString(value.avatarUrl),
    authProvider: readString(value.authProvider) ?? "password",
    accountType: readString(value.accountType) === "employee" ? "employee" : "customer",
    role: readString(value.role) ?? "customer",
    roleTemplate: readString(value.roleTemplate),
    customerId: readString(value.customerId),
    customerState: readString(value.customerState) ?? "profiles_only",
    customer: normalizeCustomer(value.customer),
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
    name: readString(value.name),
    status: readString(value.status) ?? "pending",
    customerType: readString(value.customerType) ?? "retail",
    assignmentStatus: readString(value.assignmentStatus) ?? "needs_review",
    level: readString(value.level) ?? "bronze",
    lifetimeSpendNet: readNumber(value.lifetimeSpendNet) ?? 0,
    ordersCount: readNumber(value.ordersCount) ?? 0,
    revenue: readNumber(value.revenue) ?? readNumber(value.lifetimeSpendNet) ?? 0,
    lastOrderAt: readString(value.lastOrderAt),
    lastActivityAt: readString(value.lastActivityAt),
    recentActivity: readArray(value.recentActivity).map(normalizeCustomerActivity).filter(isDefined),
    updatedAt: readString(value.updatedAt),
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

function customerLevelLabel(value: string) {
  const labels: Record<string, string> = {
    bronze: "Bronze",
    diamond: "Diamond",
    emerald: "Emerald",
    gold: "Gold",
    king: "King",
    master: "Master",
    silver: "Silver",
  };

  return labels[value] ?? value;
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
    "customer.level_update": "客户等级更新",
    "customer.profile_update": "客户档案更新",
    "customer.terms_update": "商业条款更新",
    "permissions.update": "权限覆盖更新",
  };

  return labels[value] ?? value;
}

function accountTypeBadgeClass(value: string) {
  return value === "employee"
    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
    : "border-blue-200 bg-blue-50 text-blue-700";
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
