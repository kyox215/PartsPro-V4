"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  FileText,
  Filter,
  Loader2,
  LogOut,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Truck,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  formatEuro,
  type CompanyProfile,
  type OrderSummary,
  type RmaRequest,
} from "@/lib/partspro-data";
import {
  formatTierDiscount,
  normalizeCustomerTier,
} from "@/lib/partspro-pricing";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/login/actions";
import type { AccountCustomerProfile } from "@/lib/partspro-repository";
import { StoreHeader } from "./store-header";

type AccountPageProps = {
  accountType?: "customer" | "employee" | null;
  company?: CompanyProfile | null;
  customerProfile?: AccountCustomerProfile | null;
  dataWarning?: string;
  forceSetup?: boolean;
  orderSummaries?: OrderSummary[];
  rmaRequests?: RmaRequest[];
  userEmail?: string;
};

type AccountOrderDetailLine = {
  id: string;
  lineTotal: number;
  name?: string;
  productName?: string;
  quantity: number;
  sku: string;
  unitPrice: number;
};

type AccountOrderDetailEvent = {
  action?: string;
  createdAt: string;
  eventType?: string;
  id: string;
  note?: string;
};

type AccountOrderDetail = {
  createdAt: string;
  id: string;
  items: number;
  lines?: AccountOrderDetailLine[];
  number: string;
  operationHistory?: AccountOrderDetailEvent[];
  paymentStatus: string;
  status: string;
  total: number;
  uiStatus?: string;
};

type AccountOrderDetailResponse = {
  data: AccountOrderDetail;
};

type AccountProfilePayload = {
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

type OrderFilterId = "all" | "open" | "pending_payment" | "shipped" | "completed";

const orderFilters: Array<{
  id: OrderFilterId;
  label: string;
  description: string;
  predicate: (order: OrderSummary) => boolean;
}> = [
  {
    id: "all",
    label: "全部",
    description: "完整视图",
    predicate: () => true,
  },
  {
    id: "open",
    label: "处理中",
    description: "待处理",
    predicate: (order) => !isTerminalOrderStatus(order.status),
  },
  {
    id: "pending_payment",
    label: "待付款",
    description: "付款状态",
    predicate: (order) => order.status === "pending_payment",
  },
  {
    id: "shipped",
    label: "已发货",
    description: "物流追踪",
    predicate: (order) => order.status === "shipped",
  },
  {
    id: "completed",
    label: "已完成",
    description: "历史订单",
    predicate: (order) => isCompletedOrderStatus(order.status),
  },
];

export function AccountPage({
  accountType = "customer",
  company = null,
  customerProfile = null,
  dataWarning,
  forceSetup = false,
  orderSummaries = [],
  rmaRequests = [],
  userEmail,
}: AccountPageProps) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = React.useState<OrderFilterId>("all");
  const [orderDetail, setOrderDetail] = React.useState<AccountOrderDetail | null>(null);
  const [orderDetailError, setOrderDetailError] = React.useState<string | null>(null);
  const [orderDetailLoading, setOrderDetailLoading] = React.useState(false);
  const [orderDetailOpen, setOrderDetailOpen] = React.useState(false);
  const [savedProfile, setSavedProfile] = React.useState<AccountCustomerProfile | null>(null);
  const profile =
    savedProfile && (!customerProfile || savedProfile.id === customerProfile.id)
      ? savedProfile
      : customerProfile;
  const isEmployeeAccount = accountType === "employee";
  const editableProfile =
    profile ?? createEmptyAccountProfile(userEmail, isEmployeeAccount);
  const [profileDialogOpen, setProfileDialogOpen] = React.useState(() =>
    Boolean(forceSetup || (customerProfile && !customerProfile.profileCompletedAt))
  );

  const selectedFilter =
    orderFilters.find((filter) => filter.id === activeFilter) ?? orderFilters[0];
  const filteredOrders = orderSummaries.filter(selectedFilter.predicate);
  const shouldShowProfileNotice = Boolean(profile && !profile.profileCompletedAt);
  const metrics = [
    [
      "未完单",
      String(orderSummaries.filter((order) => !isTerminalOrderStatus(order.status)).length),
      Package,
    ],
    ["配送", String(orderSummaries.filter((order) => order.status === "shipped").length), Truck],
    ["RMA", String(rmaRequests.length), RotateCcw],
  ] as const;

  async function openOrderDetail(order: OrderSummary) {
    setOrderDetailOpen(true);
    setOrderDetail(null);
    setOrderDetailError(null);
    setOrderDetailLoading(true);

    try {
      const payload = await fetchJson<AccountOrderDetailResponse>(
        `/api/account/orders/${encodeURIComponent(order.id)}`
      );

      setOrderDetail(payload.data);
    } catch (error) {
      setOrderDetailError(
        error instanceof Error ? error.message : "订单详情暂不可用。"
      );
    } finally {
      setOrderDetailLoading(false);
    }
  }

  function handleProfileSaved(nextProfile: AccountCustomerProfile) {
    setSavedProfile(nextProfile);
    router.refresh();
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-100 text-slate-950">
      <StoreHeader />
      <div className="mx-auto grid max-w-[1500px] gap-3 px-3 py-3 md:px-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_320px]">
        <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <AccountRuntimeCard userEmail={userEmail} />
          <Card size="sm" className="rounded-lg border-slate-200 bg-white shadow-sm">
            <CardContent className="p-3">
              {company ? (
                <>
                  <div className="flex items-start gap-2.5">
                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <h1 className="truncate text-base font-black">{company.name}</h1>
                      <div className="mt-0.5 text-xs font-semibold text-slate-500">
                        {company.city} · {company.province}
                      </div>
                      <Badge className="mt-2 border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                        <CheckCircle2 className="size-3" />
                        {companyStatusLabel(company.status)}
                      </Badge>
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <div className="grid grid-cols-2 gap-2">
                    <Info label="增值税号" value={company.partitaIva} />
                    <Info label="税号" value={company.codiceFiscale} />
                    <Info label="PEC" value={company.pec} />
                    <Info label="收件代码" value={company.codiceDestinatario} />
                    <Info label="价目表" value={company.priceList} />
                    {userEmail && <Info label="登录账号" value={userEmail} />}
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-2.5">
                  <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700">
                    <Building2 className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-base font-black">
                      {profile?.companyName || (isEmployeeAccount ? "员工自购资料待创建" : "客户档案正在关联")}
                    </h1>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                      {profile?.companyName
                        ? isEmployeeAccount
                          ? "员工可使用这份资料自己下单。"
                          : "资料已保存，等待客户档案关联。"
                        : isEmployeeAccount
                          ? "请先补全员工自购资料，然后可用自己的资料下单。"
                          : "已检测到登录账号，但客户档案还未完成关联。请刷新页面，或联系管理员在账号管理中补齐客户资料。"}
                    </p>
                    {userEmail && <Info label="登录账号" value={userEmail} />}
                    {!profile ? (
                      <Button
                        type="button"
                        size="sm"
                        className="mt-3"
                        onClick={() => setProfileDialogOpen(true)}
                      >
                        <Pencil className="size-4" />
                        补全资料
                      </Button>
                    ) : null}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <CustomerLevelCard company={company} profile={profile} />
          <Card size="sm" className="rounded-lg border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm font-black">快捷操作</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              <Button size="sm" asChild>
                <Link href="/catalogo">
                  <Plus className="size-4" />
                  新订单
                </Link>
              </Button>
              <Button size="sm" variant="outline" className="bg-white" asChild>
                <Link href="/rma">
                  <RotateCcw className="size-4" />
                  提交 RMA
                </Link>
              </Button>
              {profile ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="bg-white"
                  onClick={() => setProfileDialogOpen(true)}
                >
                  <Pencil className="size-4" />
                  {isEmployeeAccount ? "编辑自购资料" : "编辑资料"}
                </Button>
              ) : null}
              <form action={signOut} className="min-w-0">
                <Button size="sm" variant="outline" className="w-full bg-white" type="submit">
                  <LogOut className="size-4" />
                  退出
                </Button>
              </form>
            </CardContent>
          </Card>
        </aside>

        <section className="min-w-0 space-y-3">
          {shouldShowProfileNotice && profile ? (
            <AccountProfileNotice
              forceSetup={forceSetup}
              profile={profile}
              onOpen={() => setProfileDialogOpen(true)}
            />
          ) : null}

          {dataWarning ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
              {dataWarning}
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-2">
            {metrics.map(([label, value, Icon]) => (
              <Card key={label as string} size="sm" className="rounded-lg border-slate-200 bg-white shadow-sm">
                <CardContent className="flex min-w-0 items-center gap-2 p-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-bold text-slate-500">{label as string}</div>
                    <div className="text-xl font-black leading-none">{value as string}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card size="sm" className="rounded-lg border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-black">
                  <Filter className="size-4 text-primary" />
                  最近订单
                </CardTitle>
                <div className="text-right text-xs font-semibold text-slate-500">
                  {filteredOrders.length} / {orderSummaries.length} 单
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-1.5" aria-label="按状态筛选订单">
                {orderFilters.map((filter) => {
                  const count = orderSummaries.filter(filter.predicate).length;
                  const isActive = filter.id === activeFilter;

                  return (
                    <Button
                      key={filter.id}
                      type="button"
                      size="xs"
                      variant={isActive ? "default" : "outline"}
                      className={cn("h-7 gap-1 px-2", !isActive && "bg-white")}
                      aria-pressed={isActive}
                      title={filter.description}
                      onClick={() => setActiveFilter(filter.id)}
                    >
                      {filter.label}
                      <span className="font-mono text-xs">{count}</span>
                    </Button>
                  );
                })}
              </div>

              {filteredOrders.length === 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                  当前筛选下没有订单。切换状态可查看其他记录。
                </div>
              )}

              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-sm md:grid-cols-[minmax(160px,1fr)_110px_minmax(120px,.8fr)_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="font-mono text-sm font-black">{order.id}</span>
                      <Badge className={cn("border px-2 py-0.5 text-[11px]", orderBadgeClass(order.status))}>
                        {orderStatusLabel(order.status)}
                      </Badge>
                    </div>
                    <div className="mt-1 truncate text-xs font-semibold text-slate-500 md:hidden">
                      {order.date} · {order.items} 件 · {order.company}
                    </div>
                  </div>
                  <div className="hidden text-xs font-semibold text-slate-500 md:block">
                    {order.date} · {order.items} 件
                  </div>
                  <div className="hidden truncate text-xs font-semibold text-slate-500 md:block">
                    {order.company}
                  </div>
                  <div className="flex items-center justify-between gap-2 md:justify-end">
                    <div className="text-sm font-black">{formatEuro(order.total)}</div>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      className="h-7 bg-white px-2"
                      onClick={() => void openOrderDetail(order)}
                    >
                      <FileText className="size-3.5" />
                      详情
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-3 lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 xl:sticky xl:top-20 xl:col-span-1 xl:block xl:self-start xl:space-y-3">
          <Card size="sm" className="rounded-lg border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2 text-sm font-black">
                <RotateCcw className="size-4 text-primary" />
                RMA / 退换货
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {rmaRequests.length === 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                  当前账户暂无 RMA 申请。
                </div>
              )}
              {rmaRequests.map((request) => (
                <div
                  key={request.id}
                  className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-sm font-black">{request.id}</span>
                      <Badge className={cn("border px-2 py-0.5 text-[11px]", rmaBadgeClass(request.status))}>
                        {rmaStatusLabel(request.status)}
                      </Badge>
                    </div>
                    <div className="mt-1 break-words text-sm font-bold">
                      {request.productName}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {request.orderId} · {request.sku} · {request.createdAt}
                    </div>
                  </div>
                  <Button asChild variant="outline" size="xs" className="h-7 bg-white px-2">
                    <Link href="/rma">打开</Link>
                  </Button>
                </div>
              ))}
              <Button asChild size="sm" className="w-full">
                <Link href="/rma">
                  <RotateCcw className="size-4" />
                  新建 RMA
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card size="sm" className="rounded-lg border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2 text-sm font-black">
                <FileText className="size-4 text-primary" />
                单据 / 发票
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                暂无可下载单据。
              </div>
            </CardContent>
          </Card>
        </aside>

        <Dialog open={orderDetailOpen} onOpenChange={setOrderDetailOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto rounded-lg sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {orderDetail?.number ?? orderDetail?.id ?? "订单详情"}
              </DialogTitle>
              <DialogDescription>
                {orderDetail?.createdAt ?? "订单行、状态和操作记录摘要。"}
              </DialogDescription>
            </DialogHeader>
            <AccountOrderDetailPanel
              detail={orderDetail}
              error={orderDetailError}
              loading={orderDetailLoading}
            />
          </DialogContent>
        </Dialog>

        <AccountProfileDialog
          open={profileDialogOpen}
          profile={editableProfile}
          userEmail={userEmail}
          onOpenChange={setProfileDialogOpen}
          onSaved={handleProfileSaved}
        />
      </div>
    </main>
  );
}

function AccountOrderDetailPanel({
  detail,
  error,
  loading,
}: {
  detail: AccountOrderDetail | null;
  error: string | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center gap-2 text-sm font-semibold text-slate-500">
        <Loader2 className="size-4 animate-spin" />
        正在加载订单详情...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
        {error}
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
        暂无订单详情。
      </div>
    );
  }

  const lines = detail.lines ?? [];
  const events = detail.operationHistory ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <DetailTile label="状态" value={orderStatusLabel(detail.uiStatus ?? detail.status)} />
        <DetailTile label="付款" value={paymentStatusLabel(detail.paymentStatus)} />
        <DetailTile label="合计" value={formatEuro(detail.total)} />
      </div>

      <section className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-100 px-3 py-2 text-sm font-black">
          订单明细
        </div>
        {lines.length === 0 ? (
          <div className="p-3 text-sm font-semibold text-slate-500">
            暂无明细行。
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {lines.map((line) => (
              <div key={line.id} className="grid gap-2 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <div className="truncate font-black">{line.productName ?? line.name ?? line.sku}</div>
                  <div className="mt-1 font-mono text-xs text-slate-500">{line.sku}</div>
                </div>
                <div className="text-right">
                  <div className="font-black">{formatEuro(line.lineTotal)}</div>
                  <div className="text-xs font-semibold text-slate-500">
                    {line.quantity} × {formatEuro(line.unitPrice)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-100 px-3 py-2 text-sm font-black">
          订单动态
        </div>
        {events.length === 0 ? (
          <div className="p-3 text-sm font-semibold text-slate-500">
            暂无操作记录。
          </div>
        ) : (
          <ol className="divide-y divide-slate-100">
            {events.map((event) => (
              <li key={event.id} className="px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-black">{event.action ?? event.eventType ?? "事件"}</span>
                  <span className="text-xs text-slate-500">{event.createdAt}</span>
                </div>
                {event.note ? (
                  <p className="mt-1 text-xs font-semibold text-slate-500">{event.note}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-bold uppercase text-slate-400">{label}</div>
      <div className="mt-1 truncate text-sm font-black text-slate-800">{value}</div>
    </div>
  );
}

function AccountRuntimeCard({
  userEmail,
}: {
  userEmail?: string;
}) {
  return (
    <Card size="sm" className="rounded-lg border-emerald-200 bg-emerald-50 shadow-sm">
      <CardContent className="flex gap-2.5 p-3 text-sm text-emerald-900">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <div className="text-sm font-black">Supabase 会话已验证</div>
          <p className="mt-1 text-xs font-semibold leading-5">
            业务数据来自已连接后端。
          </p>
          {userEmail && <div className="mt-2 break-words text-xs font-bold">{userEmail}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function CustomerLevelCard({
  company,
  profile,
}: {
  company: CompanyProfile | null;
  profile: AccountCustomerProfile | null;
}) {
  const level = normalizeCustomerTier(profile?.level ?? company?.level ?? company?.priceList);

  return (
    <Card size="sm" className="rounded-lg border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-black">客户等级</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/15 bg-primary/8 px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-lg font-black text-primary">
              {customerLevelLabel(level)}
            </div>
            <div className="truncate text-xs font-semibold text-slate-500">
              等级折扣 {formatTierDiscount(level)}
            </div>
          </div>
          <Badge className="shrink-0 border border-emerald-200 bg-emerald-50 text-emerald-700">
            {formatTierDiscount(level)}
          </Badge>
        </div>
        <div className="text-xs font-semibold leading-5 text-slate-500">
          目录价格会显示原价和当前等级折扣后的价格。
        </div>
      </CardContent>
    </Card>
  );
}

function AccountProfileNotice({
  forceSetup,
  onOpen,
  profile,
}: {
  forceSetup: boolean;
  onOpen: () => void;
  profile: AccountCustomerProfile;
}) {
  const missingFields = [
    profile.companyName ? null : "公司",
    profile.contactName ? null : "联系人",
    profile.email ? null : "邮箱",
    profile.phone ? null : "电话",
    profile.billingAddress ? null : "账单地址",
    profile.shippingAddress ? null : "配送地址",
    profile.vatNumber || profile.fiscalCode ? null : "增值税号或税号",
  ].filter(Boolean);
  const isPending = profile.status === "pending";

  return (
    <Card size="sm" className="rounded-lg border-amber-200 bg-amber-50 shadow-sm">
      <CardContent className="flex flex-col gap-3 p-3 text-sm text-amber-950 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-black">
            {forceSetup ? "请补全账户资料" : "客户资料待补全"}
          </div>
          <p className="mt-1 text-xs font-semibold leading-5">
            {isPending
              ? "补全后系统会启用零售价客户，可查看零售价并下单；批发价由后台升级。"
              : "补全客户资料后可使用结账、单据和订单管理。"}
          </p>
          {missingFields.length > 0 ? (
            <div className="mt-2 text-xs font-bold">
              待补全：{missingFields.join("、")}
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 border-amber-300 bg-white"
          onClick={onOpen}
        >
          查看资料
        </Button>
      </CardContent>
    </Card>
  );
}

function AccountProfileDialog({
  onOpenChange,
  onSaved,
  open,
  profile,
  userEmail,
}: {
  onOpenChange: (open: boolean) => void;
  onSaved: (profile: AccountCustomerProfile) => void;
  open: boolean;
  profile: AccountCustomerProfile;
  userEmail?: string;
}) {
  const [form, setForm] = React.useState<AccountProfilePayload>(() =>
    accountProfileToForm(profile, userEmail)
  );
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const wasOpenRef = React.useRef(open);

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      setForm(accountProfileToForm(profile, userEmail));
      setError(null);
    }

    wasOpenRef.current = open;
  }, [open, profile, userEmail]);

  function updateField(field: keyof AccountProfilePayload, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const payload = await fetchJson<{ data: AccountCustomerProfile }>("/api/account/profile", {
        body: JSON.stringify(form),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });

      onSaved(payload.data);
      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "无法保存资料。"
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="关闭"
        className="absolute inset-0 bg-black/10 backdrop-blur-xs"
        onClick={() => onOpenChange(false)}
      />
      <div
        aria-labelledby="account-profile-title"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 grid max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 gap-3 overflow-y-auto rounded-lg bg-white p-4 text-sm text-slate-950 shadow-2xl ring-1 ring-slate-200"
        role="dialog"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-2 top-2"
          aria-label="关闭"
          onClick={() => onOpenChange(false)}
        >
          <X className="size-4" />
        </Button>
        <div className="flex flex-col gap-2 pr-10">
          <h2 id="account-profile-title" className="text-base font-black">
            完善个人中心资料
          </h2>
          <p className="text-sm text-slate-500">
            这些资料用于账户、订单、发票和配送。
          </p>
        </div>
        <form className="space-y-3" onSubmit={submitProfile}>
          <div className="grid gap-3 sm:grid-cols-2">
            <ProfileInput
              field="companyName"
              label="客户名称"
              required
              value={form.companyName}
              onChange={updateField}
            />
            <ProfileInput
              field="contactName"
              label="联系人"
              required
              value={form.contactName}
              onChange={updateField}
            />
            <ProfileInput
              field="email"
              label="邮箱"
              disabled
              required
              type="email"
              value={form.email}
              onChange={updateField}
            />
            <ProfileInput
              field="phone"
              label="电话"
              required
              value={form.phone}
              onChange={updateField}
            />
            <ProfileInput
              field="vatNumber"
              label="增值税号"
              value={form.vatNumber}
              onChange={updateField}
            />
            <ProfileInput
              field="fiscalCode"
              label="税号"
              value={form.fiscalCode}
              onChange={updateField}
            />
            <ProfileInput
              field="pec"
              label="PEC"
              type="email"
              value={form.pec}
              onChange={updateField}
            />
            <ProfileInput
              field="sdi"
              label="SDI 代码"
              value={form.sdi}
              onChange={updateField}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ProfileTextarea
              field="billingAddress"
              label="账单地址"
              required
              value={form.billingAddress}
              onChange={updateField}
            />
            <ProfileTextarea
              field="shippingAddress"
              label="配送地址"
              required
              value={form.shippingAddress}
              onChange={updateField}
            />
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs font-semibold leading-5 text-blue-800">
            至少需要填写增值税号或税号。保存后资料会保持审核状态，直到管理员分配客户类型和等级。
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="bg-white"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  保存中
                </>
              ) : (
                "保存资料"
              )}
            </Button>
          </DialogFooter>
        </form>
      </div>
    </div>
  );
}

function ProfileInput({
  field,
  disabled,
  label,
  onChange,
  required,
  type = "text",
  value,
}: {
  disabled?: boolean;
  field: keyof AccountProfilePayload;
  label: string;
  onChange: (field: keyof AccountProfilePayload, value: string) => void;
  required?: boolean;
  type?: React.HTMLInputTypeAttribute;
  value: string;
}) {
  const id = `account-profile-${field}`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-black text-slate-500">
        {label}
        {required ? " *" : null}
      </Label>
      <Input
        disabled={disabled}
        id={id}
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(field, event.currentTarget.value)}
      />
    </div>
  );
}

function ProfileTextarea({
  field,
  label,
  onChange,
  required,
  value,
}: {
  field: keyof AccountProfilePayload;
  label: string;
  onChange: (field: keyof AccountProfilePayload, value: string) => void;
  required?: boolean;
  value: string;
}) {
  const id = `account-profile-${field}`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-black text-slate-500">
        {label}
        {required ? " *" : null}
      </Label>
      <Textarea
        id={id}
        className="min-h-24 resize-y"
        required={required}
        value={value}
        onChange={(event) => onChange(field, event.currentTarget.value)}
      />
    </div>
  );
}

function createEmptyAccountProfile(
  userEmail: string | undefined,
  isEmployeeAccount: boolean
): AccountCustomerProfile {
  return {
    assignmentStatus: isEmployeeAccount ? "assigned" : "needs_review",
    billingAddress: "",
    companyName: "",
    contactName: "",
    customerType: isEmployeeAccount ? "wholesale" : "retail",
    email: userEmail ?? "",
    fiscalCode: "",
    id: "new",
    level: "bronze",
    pec: "",
    phone: "",
    profileCompletedAt: null,
    profileKind: isEmployeeAccount ? "employee_self" : "customer",
    sdi: "",
    shippingAddress: "",
    status: isEmployeeAccount ? "active" : "pending",
    vatNumber: "",
  };
}

function accountProfileToForm(
  profile: AccountCustomerProfile,
  userEmail?: string
): AccountProfilePayload {
  return {
    billingAddress: profile.billingAddress,
    companyName: profile.companyName,
    contactName: profile.contactName,
    email: userEmail || profile.email || "",
    fiscalCode: profile.fiscalCode,
    pec: profile.pec,
    phone: profile.phone,
    sdi: profile.sdi,
    shippingAddress: profile.shippingAddress,
    vatNumber: profile.vatNumber,
  };
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
      <div className="truncate text-[11px] font-bold text-slate-400">{label}</div>
      <div className="mt-0.5 break-words text-xs font-semibold text-slate-700">
        {value || "-"}
      </div>
    </div>
  );
}

function companyStatusLabel(status: CompanyProfile["status"]) {
  const labels: Record<CompanyProfile["status"], string> = {
    approved: "客户已批准",
    pending: "资料审核中",
    rejected: "资料已拒绝",
    suspended: "客户已暂停",
  };

  return labels[status] ?? status;
}

function customerLevelLabel(level: CompanyProfile["priceList"]) {
  const labels: Record<CompanyProfile["priceList"], string> = {
    bronze: "铜牌 Bronze",
    silver: "银牌 Silver",
    gold: "金牌 Gold",
    emerald: "翡翠 Emerald",
    diamond: "钻石 Diamond",
    master: "大师 Master",
    king: "王者 King",
  };

  return labels[level] ?? level;
}

function orderBadgeClass(status: string) {
  if (status === "shipped" || status === "delivered" || status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "cancelled") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "pending_payment") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-primary/20 bg-primary/8 text-primary";
}

function orderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "草稿",
    pending_payment: "待付款",
    paid: "已付款",
    submitted: "待付款",
    accepted: "已接受",
    picking: "备货中",
    packed: "已打包",
    shipped: "已发货",
    completed: "已送达",
    delivered: "已送达",
    cancelled: "已取消",
  };

  return labels[status] ?? status;
}

function isCompletedOrderStatus(status: string) {
  return status === "completed" || status === "delivered";
}

function isTerminalOrderStatus(status: string) {
  return isCompletedOrderStatus(status) || status === "cancelled";
}

function paymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    bank_waiting: "等待银行",
    failed: "失败",
    paid: "已付款",
    pending: "待付款",
    waiting_bank: "等待银行",
  };

  return labels[status] ?? status;
}

function rmaBadgeClass(status: string) {
  if (status === "replaced" || status === "refunded") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "rejected") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-primary/20 bg-primary/8 text-primary";
}

function rmaStatusLabel(status: string) {
  const labels: Record<string, string> = {
    requested: "已提交",
    approved: "已批准",
    rejected: "已拒绝",
    received: "已收到",
    replaced: "已更换",
    refunded: "已退款",
  };

  return labels[status] ?? status;
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
