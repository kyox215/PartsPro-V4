"use client";

import * as React from "react";
import Image from "next/image";
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
  WalletCards,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { AccountCustomerProfile, CustomerWallet } from "@/lib/partspro-repository";
import type { ItalyCapLookupResult } from "@/lib/italy-cap-lookup";
import { StoreHeader } from "./store-header";

type AccountPageProps = {
  accountType?: "customer" | "employee" | null;
  company?: CompanyProfile | null;
  customerProfile?: AccountCustomerProfile | null;
  dataWarning?: string;
  forceSetup?: boolean;
  orderSummaries?: OrderSummary[];
  rmaRequests?: RmaRequest[];
  wallet?: CustomerWallet;
  userEmail?: string;
};

type AccountOrderDetailLine = {
  billableQty?: number;
  cancelledQty?: number;
  imageAlt?: string;
  imageUrl?: string;
  id: string;
  lineTotal: number;
  lineStatus?: string;
  name?: string;
  pickedQty?: number;
  productName?: string;
  quantity: number;
  shortageQty?: number;
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
  paymentOverpaidAmount?: number;
  status: string;
  total: number;
  uiStatus?: string;
  walletAppliedAmount?: number;
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
  shippingAddress: string;
};

type AccountProfileField =
  | "companyName"
  | "contactName"
  | "email"
  | "fiscalCode"
  | "pec"
  | "phone";

type AddressDraft = {
  city: string;
  extra: string;
  postalCode: string;
  province: string;
  street: string;
  streetNumber: string;
};

type AccountProfileForm = Pick<AccountProfilePayload, AccountProfileField> & {
  billingAddress: AddressDraft;
  billingSameAsShipping: boolean;
  shippingAddress: AddressDraft;
};

type AddressDraftField = keyof AddressDraft;

type OrderFilterId = "all" | "open" | "pending_payment" | "shipped" | "completed";
type AccountSectionId = "overview" | "wallet" | "orders" | "service";

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
  wallet = { balance: 0, currency: "EUR", transactions: [] },
  userEmail,
}: AccountPageProps) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = React.useState<OrderFilterId>("all");
  const [orderDetail, setOrderDetail] = React.useState<AccountOrderDetail | null>(null);
  const [orderDetailError, setOrderDetailError] = React.useState<string | null>(null);
  const [orderDetailLoading, setOrderDetailLoading] = React.useState(false);
  const [orderDetailOpen, setOrderDetailOpen] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState<AccountSectionId>("overview");
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
      <div className="mx-auto max-w-[1180px] space-y-2 px-2 py-2 md:px-3 lg:space-y-3">
        <AccountSectionNav
          activeSection={activeSection}
          orderSummaries={orderSummaries}
          rmaRequests={rmaRequests}
          onSectionChange={setActiveSection}
        />

        {shouldShowProfileNotice && profile ? (
          <AccountProfileNotice
            forceSetup={forceSetup}
            profile={profile}
            onOpen={() => setProfileDialogOpen(true)}
          />
        ) : null}

        {dataWarning ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
            {accountDataWarningLabel(dataWarning, isEmployeeAccount)}
          </div>
        ) : null}

        <section className="min-w-0">
          {activeSection === "overview" ? (
            <AccountSummaryPanel
              company={company}
              isEmployeeAccount={isEmployeeAccount}
              orderSummaries={orderSummaries}
              profile={profile}
              rmaRequests={rmaRequests}
              userEmail={userEmail}
              wallet={wallet}
              onOpenProfile={() => setProfileDialogOpen(true)}
            />
          ) : null}

          {activeSection === "wallet" ? (
            <WalletSection wallet={wallet} />
          ) : null}

          {activeSection === "orders" ? (
            <OrdersSection
              activeFilter={activeFilter}
              filteredOrders={filteredOrders}
              onFilterChange={setActiveFilter}
              onOpenOrder={openOrderDetail}
              orderSummaries={orderSummaries}
            />
          ) : null}

          {activeSection === "service" ? (
            <ServiceSection rmaRequests={rmaRequests} />
          ) : null}
        </section>

        <Dialog open={orderDetailOpen} onOpenChange={setOrderDetailOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto rounded-lg sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {orderDetail?.number ?? orderDetail?.id ?? "订单详情"}
              </DialogTitle>
              <DialogDescription>
                {orderDetail?.createdAt
                  ? formatAccountOrderDateTime(orderDetail.createdAt)
                  : "订单行、状态和操作记录摘要。"}
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
      {(detail.walletAppliedAmount ?? 0) > 0 || (detail.paymentOverpaidAmount ?? 0) > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {(detail.walletAppliedAmount ?? 0) > 0 ? (
            <DetailTile label="钱包抵扣" value={formatEuro(detail.walletAppliedAmount ?? 0)} />
          ) : null}
          {(detail.paymentOverpaidAmount ?? 0) > 0 ? (
            <DetailTile label="差价入钱包" value={formatEuro(detail.paymentOverpaidAmount ?? 0)} />
          ) : null}
        </div>
      ) : null}

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
              <div
                key={line.id}
                className="grid grid-cols-[56px_minmax(0,1fr)] gap-2.5 px-3 py-2.5 text-sm sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:items-center"
              >
                <AccountOrderLineImage line={line} />
                <div className="min-w-0 self-center">
                  <div className="line-clamp-2 break-words font-black leading-5">
                    {line.productName ?? line.name ?? line.sku}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-500">
                    <span className="font-mono">{line.sku}</span>
                    <span>{line.quantity} × {formatEuro(line.unitPrice)}</span>
                    {(line.shortageQty ?? line.cancelledQty ?? 0) > 0 ? (
                      <span className="text-amber-700">
                        缺货 {line.shortageQty ?? line.cancelledQty} 件
                      </span>
                    ) : line.pickedQty !== undefined ? (
                      <span>实给 {line.pickedQty} 件</span>
                    ) : null}
                  </div>
                </div>
                <div className="col-start-2 flex items-center justify-between gap-2 text-right sm:col-start-auto sm:block">
                  <span className="text-xs font-bold text-slate-400 sm:hidden">小计</span>
                  <div>
                    <div className="font-black">{formatEuro(line.lineTotal)}</div>
                    <div className="hidden text-xs font-semibold text-slate-500 sm:block">
                      {line.quantity} × {formatEuro(line.unitPrice)}
                    </div>
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
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="font-black">{orderEventLabel(event)}</span>
                  <span className="text-xs font-semibold text-slate-500">
                    {formatAccountOrderDateTime(event.createdAt)}
                  </span>
                </div>
                {event.note ? (
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                    {formatOrderEventNote(event.note)}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function AccountOrderLineImage({ line }: { line: AccountOrderDetailLine }) {
  const imageAlt = line.imageAlt || line.productName || line.name || line.sku;
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
    <div className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-md border border-slate-200 bg-white sm:size-16">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={imageAlt}
          fill
          sizes="(min-width: 640px) 64px, 56px"
          quality={55}
          loading="lazy"
          decoding="async"
          className="object-contain p-1"
          onError={handleImageError}
        />
      ) : (
        <Package className="size-5 text-slate-300" />
      )}
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

function walletTransactionLabel(direction: "credit" | "debit") {
  return direction === "credit" ? "钱包入账" : "钱包抵扣";
}

function AccountSectionNav({
  activeSection,
  onSectionChange,
  orderSummaries,
  rmaRequests,
}: {
  activeSection: AccountSectionId;
  onSectionChange: (section: AccountSectionId) => void;
  orderSummaries: OrderSummary[];
  rmaRequests: RmaRequest[];
}) {
  const openOrderCount = orderSummaries.filter((order) => !isTerminalOrderStatus(order.status)).length;
  const sections: Array<{
    badge?: string;
    id: AccountSectionId;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }> = [
    {
      id: "overview",
      icon: Building2,
      label: "概览",
    },
    {
      id: "wallet",
      icon: WalletCards,
      label: "钱包",
    },
    {
      badge: openOrderCount > 0 ? String(openOrderCount) : undefined,
      id: "orders",
      icon: Package,
      label: "订单",
    },
    {
      badge: rmaRequests.length > 0 ? String(rmaRequests.length) : undefined,
      id: "service",
      icon: RotateCcw,
      label: "售后",
    },
  ];

  return (
    <nav className="rounded-lg border border-slate-200 bg-white p-1 shadow-sm" aria-label="个人中心分组">
      <div className="grid grid-cols-4 gap-1">
        {sections.map((section) => {
          const Icon = section.icon;
          const active = section.id === activeSection;

          return (
            <button
              key={section.id}
              type="button"
              className={cn(
                "relative flex h-10 min-w-0 items-center justify-center gap-1 rounded-md px-1 text-xs font-black transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                active
                  ? "bg-primary text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
              aria-pressed={active}
              onClick={() => onSectionChange(section.id)}
            >
              <Icon className={cn("size-4 shrink-0", active ? "text-white" : "text-primary")} />
              <span className="truncate">{section.label}</span>
              {section.badge ? (
                <span
                  className={cn(
                    "absolute right-1 top-1 grid min-w-4 place-items-center rounded-full px-1 text-[10px] leading-4",
                    active ? "bg-white text-primary" : "bg-red-500 text-white"
                  )}
                >
                  {section.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function WalletSection({ wallet }: { wallet: CustomerWallet }) {
  const recentTransactions = wallet.transactions.slice(0, 8);

  return (
    <Card size="sm" className="rounded-lg border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-black">
            <WalletCards className="size-4 text-primary" />
            钱包 / 自动抵扣
          </CardTitle>
          <Badge className="border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
            下单自动使用
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3">
          <div className="text-xs font-bold text-blue-700">可用余额</div>
          <div className="mt-1 text-3xl font-black leading-none text-slate-950">
            {formatEuro(wallet.balance)}
          </div>
          <div className="mt-2 text-xs font-semibold leading-5 text-slate-500">
            银行转账订单缺货差价会进入钱包，下次下单自动抵扣。
          </div>
        </div>

        <div className="min-w-0 space-y-1.5">
          <div className="text-xs font-black text-slate-500">最近流水</div>
          {recentTransactions.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">
              暂无钱包流水。
            </div>
          ) : (
            recentTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-md border border-slate-200 bg-slate-50/70 px-2.5 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="truncate font-black text-slate-800">
                    {transaction.reason || walletTransactionLabel(transaction.direction)}
                  </div>
                  <div className="mt-0.5 truncate font-semibold text-slate-500">
                    {formatAccountOrderDateTime(transaction.createdAt)}
                  </div>
                </div>
                <div
                  className={cn(
                    "text-right font-black",
                    transaction.direction === "credit" ? "text-emerald-700" : "text-blue-700"
                  )}
                >
                  {transaction.direction === "credit" ? "+" : "-"}
                  {formatEuro(transaction.amount)}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function OrdersSection({
  activeFilter,
  filteredOrders,
  onFilterChange,
  onOpenOrder,
  orderSummaries,
}: {
  activeFilter: OrderFilterId;
  filteredOrders: OrderSummary[];
  onFilterChange: (filter: OrderFilterId) => void;
  onOpenOrder: (order: OrderSummary) => void;
  orderSummaries: OrderSummary[];
}) {
  return (
    <Card size="sm" className="rounded-lg border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-black">
            <Filter className="size-4 text-primary" />
            订单历史
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
                onClick={() => onFilterChange(filter.id)}
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
                onClick={() => onOpenOrder(order)}
              >
                <FileText className="size-3.5" />
                详情
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ServiceSection({ rmaRequests }: { rmaRequests: RmaRequest[] }) {
  return (
    <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_360px]">
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
    </div>
  );
}

function AccountSummaryPanel({
  company,
  isEmployeeAccount,
  onOpenProfile,
  orderSummaries,
  profile,
  rmaRequests,
  userEmail,
  wallet,
}: {
  company: CompanyProfile | null;
  isEmployeeAccount: boolean;
  onOpenProfile: () => void;
  orderSummaries: OrderSummary[];
  profile: AccountCustomerProfile | null;
  rmaRequests: RmaRequest[];
  userEmail?: string;
  wallet: CustomerWallet;
}) {
  const level = normalizeCustomerTier(profile?.level ?? company?.level ?? company?.priceList);
  const openOrderCount = orderSummaries.filter((order) => !isTerminalOrderStatus(order.status)).length;
  const shippedOrderCount = orderSummaries.filter((order) => order.status === "shipped").length;
  const displayName =
    company?.name ||
    profile?.companyName ||
    (isEmployeeAccount ? "员工自购资料待创建" : "客户档案正在关联");
  const profileStatus = company
    ? companyStatusLabel(company.status)
    : profile?.profileCompletedAt
      ? "资料已保存"
      : profile
        ? "资料待补全"
        : "资料待创建";
  const profileDescription = profile?.companyName
    ? isEmployeeAccount
      ? "员工可使用这份自购资料下单。"
      : "资料已保存，等待客户档案关联。"
    : isEmployeeAccount
      ? "补全后可使用自己的资料下单。"
      : "登录已验证，等待客户档案关联。";
  const primaryAddress =
    company?.shippingAddress ||
    profile?.shippingAddress ||
    company?.billingAddress ||
    profile?.billingAddress ||
    "";
  const summaryRows = [
    { label: "账号", value: userEmail ?? profile?.email ?? company?.email ?? "-" },
    { label: "电话", value: profile?.phone ?? company?.phone ?? "-" },
    { label: "税号", value: profile?.fiscalCode ?? company?.codiceFiscale ?? "-" },
    { label: "配送", value: primaryAddress || "-", wide: true },
  ] as const;

  return (
    <Card size="sm" className="rounded-lg border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-2 p-2.5 sm:p-3">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <div
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-lg",
                profile ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"
              )}
            >
              <Building2 className="size-4" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-black leading-5">{displayName}</h1>
              <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-4 text-slate-500">
                {profileDescription}
              </p>
            </div>
          </div>
          <Badge className="shrink-0 border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">
            <CheckCircle2 className="size-3" />
            已验证
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <SummaryMetric label="资料" value={profileStatus} />
          <SummaryMetric label="等级" value={customerLevelLabel(level)} helper={`每件减 ${formatTierDiscount(level)}`} />
          <SummaryMetric label="钱包" value={formatEuro(wallet.balance)} accent />
          <SummaryMetric label="未完单" value={openOrderCount} />
          <SummaryMetric label="配送" value={shippedOrderCount} />
          <SummaryMetric label="RMA" value={rmaRequests.length} />
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {summaryRows.map((row) => (
            <Info
              key={row.label}
              label={row.label}
              value={row.value}
              className={"wide" in row && row.wide ? "col-span-2" : undefined}
            />
          ))}
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          <Button size="xs" className="h-8 px-1 text-[11px]" asChild>
            <Link href="/catalogo">
              <Plus className="size-3.5" />
              下单
            </Link>
          </Button>
          <Button size="xs" variant="outline" className="h-8 bg-white px-1 text-[11px]" asChild>
            <Link href="/rma">
              <RotateCcw className="size-3.5" />
              RMA
            </Link>
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="h-8 bg-white px-1 text-[11px]"
            onClick={onOpenProfile}
          >
            <Pencil className="size-3.5" />
            资料
          </Button>
          <form action={signOut} className="min-w-0">
            <Button size="xs" variant="outline" className="h-8 w-full bg-white px-1 text-[11px]" type="submit">
              <LogOut className="size-3.5" />
              退出
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryMetric({
  accent = false,
  helper,
  label,
  value,
}: {
  accent?: boolean;
  helper?: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-md border px-2 py-1.5",
        accent ? "border-primary/15 bg-primary/10" : "border-slate-100 bg-slate-50"
      )}
    >
      <div className="truncate text-[10px] font-bold text-slate-400">{label}</div>
      <div className={cn("mt-0.5 truncate text-xs font-black", accent ? "text-primary" : "text-slate-800")}>
        {value}
      </div>
      {helper ? (
        <div className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">
          {helper}
        </div>
      ) : null}
    </div>
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
    profile.email ? null : "邮箱",
    profile.phone ? null : "电话",
    profile.billingAddress ? null : "账单地址",
    profile.shippingAddress ? null : "配送地址",
    profile.fiscalCode ? null : "税号",
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
  const [form, setForm] = React.useState<AccountProfileForm>(() =>
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

  function updateField(field: AccountProfileField, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  const updateAddressField = React.useCallback((
    addressKey: "billingAddress" | "shippingAddress",
    field: AddressDraftField,
    value: string
  ) => {
    setForm((current) => {
      const nextAddress = {
        ...current[addressKey],
        [field]: value,
      };

      const nextForm = {
        ...current,
        [addressKey]: nextAddress,
      };

      if (addressKey === "shippingAddress" && current.billingSameAsShipping) {
        return {
          ...nextForm,
          billingAddress: nextAddress,
        };
      }

      return nextForm;
    });
  }, []);

  function updateBillingSameAsShipping(checked: boolean) {
    setForm((current) => ({
      ...current,
      billingSameAsShipping: checked,
      billingAddress: checked ? current.shippingAddress : current.billingAddress,
    }));
  }

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (
      !isAddressDraftComplete(form.shippingAddress) ||
      (!form.billingSameAsShipping && !isAddressDraftComplete(form.billingAddress))
    ) {
      setError("请补全地址里的 Provincia、Citta、CAP、Via 和 Numero。");
      return;
    }

    const shippingAddress = formatAddressDraft(form.shippingAddress);
    const billingAddress = form.billingSameAsShipping
      ? shippingAddress
      : formatAddressDraft(form.billingAddress);
    const payload: AccountProfilePayload = {
      billingAddress,
      companyName: form.companyName,
      contactName: form.contactName,
      email: form.email,
      fiscalCode: form.fiscalCode,
      pec: form.pec,
      phone: form.phone,
      shippingAddress,
    };

    setSaving(true);

    try {
      const response = await fetchJson<{ data: AccountCustomerProfile }>("/api/account/profile", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });

      onSaved(response.data);
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
        className="fixed left-1/2 top-1/2 grid max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 gap-3 overflow-y-auto rounded-lg bg-white p-4 text-sm text-slate-950 shadow-2xl ring-1 ring-slate-200"
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
            这些资料用于账户、订单、税务和配送。
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
              label="微信号码 / WhatsApp 号码"
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
              field="fiscalCode"
              label="税号"
              required
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
          </div>

          <div className="space-y-3">
            <AddressFields
              title="配送地址"
              addressKey="shippingAddress"
              value={form.shippingAddress}
              onChange={updateAddressField}
            />
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
              <Checkbox
                className="mt-0.5"
                checked={form.billingSameAsShipping}
                onCheckedChange={(checked) => updateBillingSameAsShipping(Boolean(checked))}
              />
              <span>账单地址跟配送地址一样</span>
            </label>
            {!form.billingSameAsShipping ? (
              <AddressFields
                title="账单地址"
                addressKey="billingAddress"
                value={form.billingAddress}
                onChange={updateAddressField}
              />
            ) : null}
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs font-semibold leading-5 text-blue-800">
            税号、电话和详细地址用于订单与配送；微信或 WhatsApp 可留空。保存后资料会保持审核状态，直到管理员分配客户类型和等级。
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

function AddressFields({
  addressKey,
  onChange,
  title,
  value,
}: {
  addressKey: "billingAddress" | "shippingAddress";
  onChange: (
    addressKey: "billingAddress" | "shippingAddress",
    field: AddressDraftField,
    value: string
  ) => void;
  title: string;
  value: AddressDraft;
}) {
  const [capMatches, setCapMatches] = React.useState<ItalyCapLookupResult[]>([]);
  const candidateSelectId = `account-profile-${addressKey}-cap-candidate`;
  const postalCode = normalizeItalianPostalCode(value.postalCode);
  const visibleCapMatches = postalCode.length === 5 ? capMatches : [];
  const selectedCapMatchValue = getSelectedCapMatchValue(visibleCapMatches, value);

  const applyCapMatch = React.useCallback(
    (match: ItalyCapLookupResult) => {
      onChange(addressKey, "province", match.provinceCode);
      onChange(addressKey, "city", match.city);
    },
    [addressKey, onChange]
  );

  React.useEffect(() => {
    let active = true;

    if (postalCode.length !== 5) {
      return () => {
        active = false;
      };
    }

    import("@/lib/italy-cap-lookup")
      .then(({ lookupItalyCap }) => {
        if (!active) {
          return;
        }

        const matches = lookupItalyCap(postalCode);
        setCapMatches(matches);

        if (matches.length === 1) {
          applyCapMatch(matches[0]);
        }
      })
      .catch(() => {
        if (active) {
          setCapMatches([]);
        }
      });

    return () => {
      active = false;
    };
  }, [applyCapMatch, postalCode]);

  function updateField(field: AddressDraftField, nextValue: string) {
    onChange(
      addressKey,
      field,
      field === "postalCode" ? normalizeItalianPostalCode(nextValue) : nextValue
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-3 text-sm font-black text-slate-700">{title}</div>
      <div className="grid gap-3 sm:grid-cols-3">
        <ProfileInput
          id={`account-profile-${addressKey}-postalCode`}
          field="postalCode"
          label="CAP"
          inputMode="numeric"
          maxLength={5}
          required
          value={value.postalCode}
          onChange={updateField}
        />
        <ProfileInput
          id={`account-profile-${addressKey}-province`}
          field="province"
          label="省 / Provincia"
          required
          value={value.province}
          onChange={updateField}
        />
        <ProfileInput
          id={`account-profile-${addressKey}-city`}
          field="city"
          label="城市 / Citta"
          required
          value={value.city}
          onChange={updateField}
        />
        {visibleCapMatches.length > 1 ? (
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor={candidateSelectId} className="text-xs font-black text-slate-500">
              CAP 匹配城市
            </Label>
            <Select
              value={selectedCapMatchValue}
              onValueChange={(matchValue) => {
                const nextMatch = visibleCapMatches.find(
                  (match) => getCapMatchValue(match) === matchValue
                );

                if (nextMatch) {
                  applyCapMatch(nextMatch);
                }
              }}
            >
              <SelectTrigger id={candidateSelectId} className="w-full bg-white">
                <SelectValue placeholder="请选择城市 / Provincia" />
              </SelectTrigger>
              <SelectContent>
                {visibleCapMatches.map((match) => (
                  <SelectItem key={getCapMatchValue(match)} value={getCapMatchValue(match)}>
                    {match.city} ({match.provinceCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <ProfileInput
          id={`account-profile-${addressKey}-street`}
          field="street"
          label="街道 / Via"
          required
          value={value.street}
          onChange={updateField}
        />
        <ProfileInput
          id={`account-profile-${addressKey}-streetNumber`}
          field="streetNumber"
          label="门牌 / Numero"
          required
          value={value.streetNumber}
          onChange={updateField}
        />
        <ProfileInput
          id={`account-profile-${addressKey}-extra`}
          field="extra"
          label="补充信息"
          value={value.extra}
          onChange={updateField}
        />
      </div>
    </section>
  );
}

type ProfileInputProps<Field extends string> = {
  autoComplete?: string;
  disabled?: boolean;
  field: Field;
  id?: string;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
  label: string;
  maxLength?: number;
  onChange: (field: Field, value: string) => void;
  required?: boolean;
  type?: React.HTMLInputTypeAttribute;
  value: string;
};

function ProfileInput<Field extends string>({
  autoComplete,
  field,
  id: idProp,
  disabled,
  inputMode,
  label,
  maxLength,
  onChange,
  required,
  type = "text",
  value,
}: ProfileInputProps<Field>) {
  const id = idProp ?? `account-profile-${field}`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-black text-slate-500">
        {label}
        {required ? " *" : null}
      </Label>
      <Input
        autoComplete={autoComplete}
        disabled={disabled}
        id={id}
        inputMode={inputMode}
        maxLength={maxLength}
        required={required}
        type={type}
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
): AccountProfileForm {
  const shippingAddress = parseAddressDraft(profile.shippingAddress);
  const billingAddress = parseAddressDraft(profile.billingAddress);
  const billingSameAsShipping =
    !normalizeAddressText(profile.billingAddress) ||
    normalizeAddressText(profile.billingAddress) === normalizeAddressText(profile.shippingAddress);

  return {
    billingAddress,
    billingSameAsShipping,
    companyName: profile.companyName,
    contactName: profile.contactName,
    email: userEmail || profile.email || "",
    fiscalCode: profile.fiscalCode,
    pec: profile.pec,
    phone: profile.phone,
    shippingAddress,
  };
}

function emptyAddressDraft(): AddressDraft {
  return {
    city: "",
    extra: "",
    postalCode: "",
    province: "",
    street: "",
    streetNumber: "",
  };
}

function parseAddressDraft(address: string): AddressDraft {
  const normalized = normalizeAddressText(address);

  if (!normalized) {
    return emptyAddressDraft();
  }

  const match = normalized.match(/^(.+)\s+([^,\s]+),\s*([0-9A-Za-z-]+)\s+(.+)\s+\(([^)]+)\)(?:\s+-\s*(.+))?$/);

  if (!match) {
    return {
      ...emptyAddressDraft(),
      street: normalized,
    };
  }

  return {
    city: match[4]?.trim() ?? "",
    extra: match[6]?.trim() ?? "",
    postalCode: normalizeItalianPostalCode(match[3]?.trim() ?? ""),
    province: match[5]?.trim() ?? "",
    street: match[1]?.trim() ?? "",
    streetNumber: match[2]?.trim() ?? "",
  };
}

function formatAddressDraft(address: AddressDraft) {
  const street = address.street.trim();
  const streetNumber = address.streetNumber.trim();
  const postalCode = normalizeItalianPostalCode(address.postalCode);
  const city = address.city.trim();
  const province = address.province.trim();
  const extra = address.extra.trim();
  const base = `${street} ${streetNumber}, ${postalCode} ${city} (${province})`;

  return extra ? `${base} - ${extra}` : base;
}

function isAddressDraftComplete(address: AddressDraft) {
  return Boolean(
    address.province.trim() &&
      address.city.trim() &&
      normalizeItalianPostalCode(address.postalCode).length === 5 &&
      address.street.trim() &&
      address.streetNumber.trim()
  );
}

function normalizeAddressText(address: string | null | undefined) {
  return (address ?? "").trim().replace(/\s+/g, " ");
}

function normalizeItalianPostalCode(postalCode: string) {
  return postalCode.replace(/\D/g, "").slice(0, 5);
}

function getCapMatchValue(match: ItalyCapLookupResult) {
  return `${match.cap}:${match.provinceCode}:${match.city}`;
}

function getSelectedCapMatchValue(
  matches: ItalyCapLookupResult[],
  address: AddressDraft
) {
  const city = address.city.trim();
  const province = address.province.trim().toUpperCase();
  const selectedMatch = matches.find(
    (match) => match.city === city && match.provinceCode === province
  );

  return selectedMatch ? getCapMatchValue(selectedMatch) : "";
}

function Info({
  className,
  label,
  value,
}: {
  className?: string;
  label: string;
  value: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5", className)}>
      <div className="truncate text-[11px] font-bold text-slate-400">{label}</div>
      <div
        className="mt-0.5 truncate text-xs font-semibold text-slate-700"
        title={value || "-"}
      >
        {value || "-"}
      </div>
    </div>
  );
}

function accountDataWarningLabel(warning: string, isEmployeeAccount: boolean) {
  const normalized = warning.toLowerCase();

  if (normalized.includes("employee self company")) {
    return isEmployeeAccount
      ? "员工自购资料待补全，点击“资料”完善。"
      : "账户资料暂时无法读取，请刷新或联系管理员。";
  }

  if (normalized.includes("employee self profile")) {
    return "员工自购资料暂时无法读取，请刷新或联系管理员。";
  }

  if (normalized.includes("orders")) {
    return "订单数据暂时无法读取。请刷新页面或稍后再试。";
  }

  if (normalized.includes("rma")) {
    return "RMA / 退换货数据暂时无法读取。请刷新页面或稍后再试。";
  }

  if (normalized.startsWith("supabase")) {
    return "部分账户数据暂时无法读取，请刷新或联系管理员。";
  }

  return warning;
}

function companyStatusLabel(status: CompanyProfile["status"]) {
  const labels: Record<CompanyProfile["status"], string> = {
    approved: "活跃",
    pending: "待处理",
    rejected: "资料已拒绝",
    suspended: "客户已暂停",
  };

  return labels[status] ?? status;
}

function customerLevelLabel(level: CompanyProfile["priceList"]) {
  const labels: Record<CompanyProfile["priceList"], string> = {
    bronze: "青铜 Bronze",
    silver: "白银 Silver",
    gold: "黄金 Gold",
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
    authorized: "已授权",
    bank_waiting: "等待银行",
    failed: "失败",
    paid: "已付款",
    pending: "待付款",
    refunded: "已退款",
    unpaid: "待收款",
    waiting_bank: "等待银行",
  };

  return labels[status] ?? status;
}

function orderEventLabel(event: AccountOrderDetailEvent) {
  const value = event.action || event.eventType || "";
  const labels: Record<string, string> = {
    inventory_reserved: "库存已锁定",
    inventory_released: "库存已释放",
    order_cancelled: "订单已取消",
    order_completed: "订单已完成",
    order_created: "订单已创建",
    order_submitted: "订单已提交",
    operations_updated: "订单状态已更新",
    payment_updated: "付款状态已更新",
    rma_created: "RMA 已创建",
    shipment_updated: "配送状态已更新",
    status_updated: "订单状态已更新",
  };

  return labels[value] ?? "订单动态";
}

function formatAccountOrderDateTime(value: string) {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(timestamp));
}

function formatOrderEventNote(note: string) {
  return note
    .replace(/\bConsegna:\s*/gi, "配送：")
    .replace(/\bDelivery:\s*/gi, "配送：")
    .replace(/\bFascia:\s*/gi, "配送时段：")
    .replace(/\bNote:\s*/gi, "备注：")
    .replace(/\border_created\b/g, "订单已创建")
    .replace(/\boperations_updated\b/g, "订单状态已更新")
    .replace(/\bunpaid\b/g, "待收款")
    .replace(/\bauthorized\b/g, "已授权")
    .replace(/\brefunded\b/g, "已退款");
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
