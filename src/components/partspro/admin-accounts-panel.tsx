"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  BadgeCheck,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
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
import { cn } from "@/lib/utils";
import { useI18n } from "./i18n-provider";

type AccountType = "customer" | "employee";
type ConversionKind = "role" | "to_customer" | "to_employee";

type AccountCustomer = {
  assignmentStatus: string;
  customerType: string;
  id: string | null;
  level: string;
  name: string | null;
  status: string;
  updatedAt: string | null;
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

const pageSize = 12;

function useAdminText() {
  const { locale } = useI18n();

  return getAdminDictionary(locale).admin;
}

export function AdminAccountsPanel() {
  const [accountType, setAccountType] = React.useState<AccountType>("customer");
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [detail, setDetail] = React.useState<AccountDetail | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [roleTemplates, setRoleTemplates] = React.useState<RoleTemplate[]>([]);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [appliedQuery, setAppliedQuery] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [conversion, setConversion] = React.useState<ConversionState | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const refreshAccounts = React.useCallback(
    async (signal?: AbortSignal) => {
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
    [accountType, appliedQuery, page]
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
    const controller = new AbortController();

    void Promise.all([fetchCurrentUser(controller.signal), fetchRoleTemplates(controller.signal)])
      .then(([me, templates]) => {
        if (!controller.signal.aborted) {
          setCurrentUserId(me);
          setRoleTemplates(templates);
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  function applySearch() {
    const value = query.trim();

    setPage(0);
    setAppliedQuery(value.length >= 2 ? value : "");
  }

  function openDetail(account: Account) {
    setDetailOpen(true);
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

  return (
    <section className="min-w-0 space-y-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <h3 className="text-xl font-black tracking-normal">账号工作台</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            管理已存在的客户账号和员工账号，不创建新的 Supabase Auth 用户。
          </p>
        </div>
        <Button
          variant="outline"
          className="bg-white"
          disabled={loading}
          onClick={() => void refreshAccounts()}
        >
          <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
          刷新
        </Button>
      </div>

      {notice ? <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} /> : null}

      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="grid gap-3 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="min-w-0 space-y-3">
            <Tabs
              value={accountType}
              onValueChange={(value) => {
                setAccountType(value === "employee" ? "employee" : "customer");
                setPage(0);
                setDetail(null);
              }}
            >
              <TabsList className="grid h-9 grid-cols-2 rounded-md bg-slate-100 p-1">
                <TabsTrigger value="customer" className="h-7 rounded text-xs font-bold">
                  客户账号
                </TabsTrigger>
                <TabsTrigger value="employee" className="h-7 rounded text-xs font-bold">
                  员工账号
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      applySearch();
                    }
                  }}
                  className="h-9 bg-white pl-9"
                  placeholder="搜索邮箱、姓名或角色"
                />
              </div>
              <Button size="sm" className="h-9" onClick={applySearch}>
                搜索
              </Button>
            </div>

            <div className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
              {loading ? (
                <AccountListSkeleton />
              ) : accounts.length > 0 ? (
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
                <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  没有匹配的账号。
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-white"
                disabled={loading || page <= 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                <ChevronLeft className="size-4" />
                上一页
              </Button>
              <span className="text-xs font-semibold text-slate-500">
                {page + 1}/{totalPages} · {total}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="bg-white"
                disabled={loading || page + 1 >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                下一页
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="hidden min-w-0 xl:block">
            <AccountDetailPane
              currentUserId={currentUserId}
              detail={detail}
              loading={detailLoading}
              onAction={openConversion}
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
            <SheetDescription>账号、客户绑定、权限和审计。</SheetDescription>
          </SheetHeader>
          <div className="p-3">
            <AccountDetailPane
              currentUserId={currentUserId}
              detail={detail}
              loading={detailLoading}
              onAction={openConversion}
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
        "w-full rounded-md border p-3 text-left transition",
        active
          ? "border-primary/30 bg-primary/8"
          : "border-slate-200 bg-white hover:border-primary/30 hover:bg-primary/5"
      )}
      onClick={() => onOpen(account)}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <AccountAvatar account={account} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <div className="truncate text-sm font-black text-slate-950">
              {account.displayName ?? account.email ?? account.userId}
            </div>
            {isSelf ? (
              <Badge className="border-blue-200 bg-blue-50 text-blue-700" variant="outline">
                当前账号
              </Badge>
            ) : null}
          </div>
          <div className="mt-0.5 truncate text-xs font-medium text-slate-500">
            {account.email ?? account.userId}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge className={accountTypeBadgeClass(account.accountType)} variant="outline">
              {accountTypeLabel(account.accountType)}
            </Badge>
            {account.accountType === "employee" ? (
              <Badge className="border-indigo-200 bg-indigo-50 text-indigo-700" variant="outline">
                {roleTemplateLabel(text, account.roleTemplate ?? account.role)}
              </Badge>
            ) : (
              <CustomerAssignmentBadges customer={account.customer} />
            )}
            <Badge className="border-slate-200 bg-slate-50 text-slate-500" variant="outline">
              {account.customerState === "linked" ? "已绑定客户" : "仅账号"}
            </Badge>
          </div>
        </div>
      </div>
    </button>
  );
}

function AccountDetailPane({
  currentUserId,
  detail,
  loading,
  onAction,
}: {
  currentUserId: string | null;
  detail: AccountDetail | null;
  loading: boolean;
  onAction: (kind: ConversionKind, account: Account) => void;
}) {
  const text = useAdminText();

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-100" />
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="h-20 animate-pulse rounded bg-slate-100" />
          <div className="h-20 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="mt-3 h-48 animate-pulse rounded bg-slate-100" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="grid min-h-[420px] place-items-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        选择一个账号查看详情。
      </div>
    );
  }

  const { account } = detail;
  const isSelf = currentUserId === account.userId;

  return (
    <div className="min-w-0 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex min-w-0 items-start gap-3">
        <AccountAvatar account={account} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words text-lg font-black text-slate-950">
              {account.displayName ?? account.email ?? "账号详情"}
            </h3>
            {isSelf ? (
              <Badge className="border-blue-200 bg-blue-50 text-blue-700" variant="outline">
                当前账号
              </Badge>
            ) : null}
          </div>
          <div className="mt-1 break-words text-sm text-slate-500">
            {account.email ?? account.userId}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
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

      <div className="grid gap-2 sm:grid-cols-3">
        <InfoTile
          icon={UsersRound}
          label="客户绑定"
          value={account.customer?.name ?? (account.customerState === "linked" ? "已绑定" : "未绑定")}
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

      <div className="flex flex-wrap gap-2">
        {account.accountType === "customer" ? (
          <Button
            size="sm"
            disabled={isSelf}
            onClick={() => onAction("to_employee", account)}
          >
            <ArrowLeftRight className="size-4" />
            转为员工
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              className="bg-white"
              disabled={isSelf}
              onClick={() => onAction("role", account)}
            >
              <ShieldCheck className="size-4" />
              调整角色
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-white"
              disabled={isSelf}
              onClick={() => onAction("to_customer", account)}
            >
              <ArrowLeftRight className="size-4" />
              转为客户
            </Button>
          </>
        )}
        {isSelf ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
            <AlertTriangle className="size-3.5" />
            当前账号禁止自我降级
          </span>
        ) : null}
      </div>

      <DetailSection title="客户资料">
        {detail.customer ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <DetailLine label="公司/名称" value={detail.customer.name ?? "暂无"} />
            <DetailLine label="状态" value={customerStatusLabel(detail.customer.status)} />
            <DetailLine label="客户类型" value={customerTypeLabel(detail.customer.customerType)} />
            <DetailLine label="归属状态" value={assignmentStatusLabel(detail.customer.assignmentStatus)} />
            <DetailLine label="客户等级" value={detail.customer.level} />
            <DetailLine label="更新时间" value={formatDateTime(detail.customer.updatedAt) ?? "暂无"} />
          </div>
        ) : (
          <EmptyText text="此账号尚未绑定客户资料。" />
        )}
      </DetailSection>

      <DetailSection title="账号成员">
        {detail.memberships.length > 0 ? (
          <div className="space-y-2">
            {detail.memberships.map((membership) => (
              <div
                key={`${membership.customerId}:${membership.userId}`}
                className="rounded-md border border-slate-200 bg-slate-50/70 p-2"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="min-w-0 break-words text-sm font-black text-slate-900">
                    {membership.displayName ?? membership.email ?? membership.userId}
                  </span>
                  <Badge className={accountTypeBadgeClass(membership.accountType)} variant="outline">
                    {accountTypeLabel(membership.accountType)}
                  </Badge>
                  <Badge className={memberStatusBadgeClass(membership.status)} variant="outline">
                    {memberStatusLabel(membership.status)}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>{membership.email ?? membership.userId}</span>
                  <span>成员角色：{memberRoleLabel(membership.memberRole)}</span>
                  {membership.roleTemplate ? (
                    <span>员工角色：{roleTemplateLabel(text, membership.roleTemplate)}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyText text="暂无账号成员。" />
        )}
      </DetailSection>

      <DetailSection title="有效权限">
        {detail.permissions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {detail.permissions.slice(0, 24).map((permission) => (
              <Badge key={permission} className="border-slate-200 bg-slate-50 text-slate-600" variant="outline">
                {adminPermissionLabel(text, permission, permission)}
              </Badge>
            ))}
            {detail.permissions.length > 24 ? (
              <Badge className="border-slate-200 bg-white text-slate-500" variant="outline">
                +{detail.permissions.length - 24}
              </Badge>
            ) : null}
          </div>
        ) : (
          <EmptyText text="暂无后台权限。" />
        )}
      </DetailSection>

      <DetailSection title="管理审计">
        {detail.auditEvents.length > 0 ? (
          <ol className="space-y-2">
            {detail.auditEvents.map((event) => (
              <li key={event.id} className="rounded-md border border-slate-200 bg-white p-2 text-sm">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="break-words font-black text-slate-900">
                      {adminActionLabel(event.action)}
                    </div>
                    <div className="mt-1 break-words text-xs leading-5 text-slate-500">
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
                      <div className="mt-1 break-words text-xs leading-5 text-slate-600">
                        {event.reason}
                      </div>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs font-medium text-slate-500">
                    {formatDateTime(event.createdAt) ?? "暂无"}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyText text="暂无管理审计记录。" />
        )}
      </DetailSection>
    </div>
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
      ? "员工会恢复为客户账号，默认零售客户且进入待审核状态。"
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

async function fetchCurrentUser(signal?: AbortSignal) {
  const response = await fetch("/api/me", {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const payload = (await response.json()) as unknown;

  return isRecord(payload) ? readString(payload.userId) : null;
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
        size === "lg" ? "size-12" : "size-9"
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
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50/70 p-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-black text-slate-900">{value}</div>
    </div>
  );
}

function DetailSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-3">
      <h4 className="mb-2 text-sm font-black text-slate-950">{title}</h4>
      {children}
    </section>
  );
}

function DetailLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-md bg-slate-50 px-2 py-1.5">
      <div className="truncate text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="mt-0.5 break-words text-sm font-bold text-slate-900">{value}</div>
    </div>
  );
}

function CustomerAssignmentBadges({ customer }: { customer: AccountCustomer | null }) {
  if (!customer) {
    return (
      <Badge className="border-slate-200 bg-slate-50 text-slate-500" variant="outline">
        未建客户资料
      </Badge>
    );
  }

  return (
    <>
      <Badge className={customerStatusBadgeClass(customer.status)} variant="outline">
        {customerStatusLabel(customer.status)}
      </Badge>
      <Badge className={assignmentStatusBadgeClass(customer.assignmentStatus)} variant="outline">
        {assignmentStatusLabel(customer.assignmentStatus)}
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
        <div key={index} className="h-[94px] animate-pulse rounded-md bg-slate-100" />
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
    updatedAt: readString(value.updatedAt),
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
  return value === "wholesale" ? "批发客户" : "零售客户";
}

function assignmentStatusLabel(value: string) {
  if (value === "assigned") {
    return "已分配";
  }

  if (value === "converted_to_employee") {
    return "已转员工";
  }

  if (value === "archived") {
    return "已归档";
  }

  return "待审核";
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
    return "已禁用";
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

function assignmentStatusBadgeClass(value: string) {
  if (value === "assigned") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value === "converted_to_employee") {
    return "border-indigo-200 bg-indigo-50 text-indigo-700";
  }

  if (value === "archived") {
    return "border-slate-200 bg-slate-50 text-slate-500";
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
