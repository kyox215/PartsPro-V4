"use client";
import * as React from "react";
import { usePricingSession } from "./use-pricing-session";
import { useAccountCopy } from "./use-account-copy";
import { AsyncFeedback } from "./async-feedback";
import { useUnsavedChanges } from "./use-unsaved-changes";
import { cleanAuthRedirect } from "@/lib/partspro-auth-redirect";
import Image from "./optimized-image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, CheckCircle2, FileText, Filter, Loader2, LogOut, Package, Pencil, Plus, RotateCcw, WalletCards, } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { formatEuro, type CompanyProfile, type OrderSummary, type RmaRequest, } from "@/lib/partspro-data";
import { formatTierDiscount, normalizeCustomerTier, } from "@/lib/partspro-pricing";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/login/actions";
import type { AccountCustomerProfile, CustomerWallet } from "@/lib/partspro-repository";
import type { ItalyCapLookupResult } from "@/lib/italy-cap-lookup";
import { NotificationCenter } from "./notification-center";
import { StoreHeader } from "./store-header";
import { useT, useI18n } from "./i18n-provider";
import type { StoreHeaderAccountAccess } from "@/lib/partspro-header-access";
type AccountPageProps = {
    loadedSection?: AccountSectionId;
    initialAccountAccess?: StoreHeaderAccountAccess;
    accountType?: "customer" | "employee" | null;
    company?: CompanyProfile | null;
    customerProfile?: AccountCustomerProfile | null;
    dataWarning?: string;
    forceSetup?: boolean;
    orderSummaries?: OrderSummary[];
    rmaRequests?: RmaRequest[];
    wallet?: CustomerWallet;
    historyHasMore?: boolean;
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
    carrier?: string;
    tracking?: string;
    service?: string;
    shippingAddress?: string;
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
type AccountProfileField = "companyName" | "contactName" | "email" | "fiscalCode" | "pec" | "phone";
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
export function AccountPage(props: AccountPageProps) {
    const session = usePricingSession(props.initialAccountAccess?.userId);
    const c = useAccountCopy();
    if (!session.ready) return <AsyncFeedback state="loading" title={c("正在更新账户资料…")} />;
    return <AccountPageScoped key={`${session.key}:${props.customerProfile?.id ?? "none"}`} {...props} />;
}

function AccountPageScoped({ loadedSection = "overview", initialAccountAccess, accountType = "customer", company = null, customerProfile = null, dataWarning, forceSetup = false, historyHasMore = false, orderSummaries = [], rmaRequests = [], wallet = { balance: 0, currency: "EUR", transactions: [] }, userEmail, }: AccountPageProps) {
    const c = useAccountCopy();
    const accountDate = useAccountDateTime();
    const t = useT();
    const router = useRouter();
    const [sectionPending, startSectionTransition] = React.useTransition();
    const searchParams = useSearchParams();
    const [activeFilter, setActiveFilter] = React.useState<OrderFilterId>("all");
    const [orderDetail, setOrderDetail] = React.useState<AccountOrderDetail | null>(null);
    const [orderDetailError, setOrderDetailError] = React.useState<string | null>(null);
    const [orderDetailLoading, setOrderDetailLoading] = React.useState(false);
    const detailRequestRef = React.useRef<{
        version: number;
        controller: AbortController | null;
    }>({ version: 0, controller: null });
    const selectedDetailOrderRef = React.useRef<OrderSummary | null>(null);
    const [orderDetailOpen, setOrderDetailOpen] = React.useState(false);
    const [activeSection, setActiveSection] = React.useState<AccountSectionId>(loadedSection);
    const [savedProfile, setSavedProfile] = React.useState<AccountCustomerProfile | null>(null);
    const profile = savedProfile && (!customerProfile || savedProfile.id === customerProfile.id)
        ? savedProfile
        : customerProfile;
    const isEmployeeAccount = accountType === "employee";
    const editableProfile = profile ?? createEmptyAccountProfile(userEmail, isEmployeeAccount);
    const [profileDialogOpen, setProfileDialogOpen] = React.useState(() => Boolean(forceSetup || (customerProfile && !customerProfile.profileCompletedAt)));
    const selectedFilter = orderFilters.find((filter) => filter.id === activeFilter) ?? orderFilters[0];
    const filteredOrders = orderSummaries.filter(selectedFilter.predicate);
    const shouldShowProfileNotice = Boolean(profile && !profile.profileCompletedAt);
    const openOrderDetail = React.useCallback(async (order: OrderSummary) => {
        detailRequestRef.current.controller?.abort();
        const version = ++detailRequestRef.current.version;
        const controller = new AbortController();
        detailRequestRef.current.controller = controller;
        selectedDetailOrderRef.current = order;
        setOrderDetailOpen(true);
        setOrderDetail(null);
        setOrderDetailError(null);
        setOrderDetailLoading(true);
        try {
            const payload = await fetchJson<AccountOrderDetailResponse>(`/api/account/orders/${encodeURIComponent(order.id)}`, { signal: controller.signal });
            if (version === detailRequestRef.current.version)
                setOrderDetail(payload.data);
        }
        catch {
            if (controller.signal.aborted || version !== detailRequestRef.current.version)
                return;
            setOrderDetailError(c("订单详情暂不可用。"));
        }
        finally {
            if (version === detailRequestRef.current.version)
                setOrderDetailLoading(false);
        }
    }, [c]);
    React.useEffect(() => {
        const requestedOrderId = searchParams.get("orderId");
        const timeoutId = window.setTimeout(() => {
            setActiveSection(loadedSection);
            if (!requestedOrderId) {
                return;
            }
            const order = orderSummaries.find((item) => item.id === requestedOrderId) ?? ({ id: requestedOrderId } as OrderSummary);
            if (order) {
                setActiveSection("orders");
                void openOrderDetail(order);
            }
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, [loadedSection, openOrderDetail, orderSummaries, searchParams]);
    function changeSection(section: AccountSectionId) {
        setActiveSection(section);
        const params = new URLSearchParams(searchParams.toString());
        params.set("section", section);
        params.delete("orderId");
        params.delete("page");
        params.delete("q");
        startSectionTransition(() => router.replace(`/account?${params}`, { scroll: false }));
    }
    function handleProfileSaved(nextProfile: AccountCustomerProfile) {
        setSavedProfile(nextProfile);
        const returnTo = cleanAuthRedirect(searchParams.get("returnTo"), "");
        if (returnTo && !returnTo.startsWith("/account") && !returnTo.startsWith("/login"))
            router.replace(returnTo);
        else
            router.refresh();
    }
    React.useEffect(() => () => { detailRequestRef.current.version++; detailRequestRef.current.controller?.abort(); }, []);
    return (<main className="pp-account-page min-h-screen overflow-x-hidden bg-slate-100 text-slate-950">
      <StoreHeader initialAccountAccess={initialAccountAccess}/>
      <div className="pp-account-content mx-auto max-w-[1180px] space-y-2 px-2 py-2 md:px-3 lg:space-y-3">
        <header className="pp-account-heading">
          <div><span className="pp-account-eyebrow">PARTSPRO ACCOUNT</span><h1>{t("nav.account")}</h1><p>{c("这些资料用于账户、订单、税务和配送。")}</p></div>
          <Button type="button" variant="outline" onClick={() => setProfileDialogOpen(true)}><Pencil className="size-4"/>{c("查看资料")}</Button>
        </header>
        <div className="pp-account-workspace">
        <div className="pp-account-navigation grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <AccountSectionNav activeSection={activeSection} orderSummaries={orderSummaries} rmaRequests={rmaRequests} onSectionChange={changeSection}/>
          <div className="pp-account-notifications"><span>{t("storefront.home.notifications")}</span><NotificationCenter audience={isEmployeeAccount ? "staff" : "customer"} className="h-full min-h-12 w-12" portalClassName="pp-storefront-portal"/></div>
        </div>
        <div className="pp-account-main">
        {shouldShowProfileNotice && profile ? (<AccountProfileNotice forceSetup={forceSetup} profile={profile} onOpen={() => setProfileDialogOpen(true)}/>) : null}

        {dataWarning ? (<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
            <AsyncFeedback state="error" title={c(accountDataWarningLabel(dataWarning, isEmployeeAccount))} actions={<Button variant="outline" onClick={() => router.refresh()}>{c("重试")}</Button>}/>
          </div>) : null}

        <section className="pp-account-section min-w-0" aria-busy={sectionPending || loadedSection !== activeSection}>
          {sectionPending || loadedSection !== activeSection ? (<div role="status" className="flex min-h-48 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin"/>{t("common.loading")}
            </div>) : <>
          {activeSection === "overview" ? (<AccountSummaryPanel company={company} isEmployeeAccount={isEmployeeAccount} orderSummaries={orderSummaries} profile={profile} rmaRequests={rmaRequests} userEmail={userEmail} wallet={wallet} onOpenProfile={() => setProfileDialogOpen(true)}/>) : null}

          {activeSection === "wallet" || activeSection === "orders" ? <AccountHistoryControls section={activeSection} hasMore={historyHasMore} pending={sectionPending}/> : null}
          {activeSection === "wallet" ? (<WalletSection wallet={wallet}/>) : null}

          {activeSection === "orders" ? (<OrdersSection activeFilter={activeFilter} filteredOrders={filteredOrders} onFilterChange={setActiveFilter} onOpenOrder={openOrderDetail} orderSummaries={orderSummaries}/>) : null}

          {activeSection === "service" ? (<ServiceSection orderSummaries={orderSummaries} rmaRequests={rmaRequests}/>) : null}
          </>}
        </section>
        </div>
        </div>
        <Dialog open={orderDetailOpen} onOpenChange={(open) => { if (!open) {
        detailRequestRef.current.version++;
        detailRequestRef.current.controller?.abort();
    } setOrderDetailOpen(open); }}>
          <DialogContent className="pp-storefront-portal pp-account-dialog pp-order-dialog rounded-lg sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {orderDetail?.number ?? orderDetail?.id ?? c("订单详情")}
              </DialogTitle>
              <DialogDescription>
                {orderDetail?.createdAt
            ? accountDate(orderDetail.createdAt)
            : c("订单行、状态和操作记录摘要。")}
              </DialogDescription>
            </DialogHeader>
            <AccountOrderDetailPanel key={orderDetail?.id ?? "loading"} detail={orderDetail} error={orderDetailError} loading={orderDetailLoading}/>
            {orderDetailError ? <Button variant="outline" onClick={() => { if (selectedDetailOrderRef.current)
        void openOrderDetail(selectedDetailOrderRef.current); }}>{c("重试")}</Button> : null}
          </DialogContent>
        </Dialog>

        <AccountProfileDialog open={profileDialogOpen} profile={editableProfile} userEmail={userEmail} onOpenChange={setProfileDialogOpen} onSaved={handleProfileSaved}/>
      </div>
    </main>);
}
function AccountOrderDetailPanel({ detail, error, loading, }: {
    detail: AccountOrderDetail | null;
    error: string | null;
    loading: boolean;
}) {
    const c = useAccountCopy();
    const accountDate = useAccountDateTime();
    const [copyState,setCopyState]=React.useState<"idle"|"success"|"error">("idle");
    if (loading) {
        return (<div className="flex min-h-40 items-center justify-center gap-2 text-sm font-semibold text-slate-500">
        <Loader2 className="size-4 animate-spin"/>{c("正在加载订单详情...")}</div>);
    }
    if (error) {
        return (<div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
        {error}
      </div>);
    }
    if (!detail) {
        return (<div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">{c("暂无订单详情。")}</div>);
    }
    const lines = detail.lines ?? [];
    const events = detail.operationHistory ?? [];
    return (<div className="pp-order-detail space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <DetailTile label={c("状态")} value={c(orderStatusLabel(detail.uiStatus ?? detail.status))}/>
        <DetailTile label={c("付款")} value={c(paymentStatusLabel(detail.paymentStatus))}/>
        <DetailTile label={c("合计")} value={formatEuro(detail.total)}/>
      </div>
      <section className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2"><DetailTile label={c("承运商")} value={detail.carrier || c("待安排")}/><DetailTile label={c("追踪号")} value={detail.tracking || c("待安排")}/><DetailTile label={c("配送方式")} value={detail.service || c("待安排")}/><DetailTile label={c("配送地址")} value={detail.shippingAddress || c("待安排")}/>{detail.tracking ? <Button variant="outline" onClick={async()=>{try{if(!navigator.clipboard)throw new Error("Clipboard unavailable");await navigator.clipboard.writeText(detail.tracking!);setCopyState("success");}catch{setCopyState("error");}}}>{c(copyState==="success"?"已复制":"复制追踪号")}</Button> : null}{copyState==="error"?<AsyncFeedback state="error" title={c("无法复制，请选中追踪号复制。")} />:null}</section>
      {(detail.walletAppliedAmount ?? 0) > 0 || (detail.paymentOverpaidAmount ?? 0) > 0 ? (<div className="grid gap-2 sm:grid-cols-2">
          {(detail.walletAppliedAmount ?? 0) > 0 ? (<DetailTile label={c("钱包抵扣")} value={formatEuro(detail.walletAppliedAmount ?? 0)}/>) : null}
          {(detail.paymentOverpaidAmount ?? 0) > 0 ? (<DetailTile label={c("差价入钱包")} value={formatEuro(detail.paymentOverpaidAmount ?? 0)}/>) : null}
        </div>) : null}

      <section className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-100 px-3 py-2 text-sm font-black">{c("订单明细")}</div>
        {lines.length === 0 ? (<div className="p-3 text-sm font-semibold text-slate-500">{c("暂无明细行。")}</div>) : (<div className="divide-y divide-slate-100">
            {lines.map((line) => (<div key={line.id} className="grid grid-cols-[56px_minmax(0,1fr)] gap-2.5 px-3 py-2.5 text-sm sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:items-center">
                <AccountOrderLineImage line={line}/>
                <div className="min-w-0 self-center">
                  <div className="line-clamp-2 break-words font-black leading-5">
                    {line.productName ?? line.name ?? line.sku}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-500">
                    <span className="font-mono">{line.sku}</span>
                    <span>{line.quantity} × {formatEuro(line.unitPrice)}</span>
                    {(line.shortageQty ?? line.cancelledQty ?? 0) > 0 ? (<span className="text-amber-700">{c("缺货")}{line.shortageQty ?? line.cancelledQty}{c("件")}</span>) : line.pickedQty !== undefined ? (<span>{c("实给")}{line.pickedQty}{c("件")}</span>) : null}
                  </div>
                </div>
                <div className="col-start-2 flex items-center justify-between gap-2 text-right sm:col-start-auto sm:block">
                  <span className="text-xs font-bold text-slate-400 sm:hidden">{c("小计")}</span>
                  <div>
                    <div className="font-black">{formatEuro(line.lineTotal)}</div>
                    <div className="hidden text-xs font-semibold text-slate-500 sm:block">
                      {line.quantity} × {formatEuro(line.unitPrice)}
                    </div>
                  </div>
                </div>
              </div>))}
          </div>)}
      </section>

      <section className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-100 px-3 py-2 text-sm font-black">{c("订单动态")}</div>
        {events.length === 0 ? (<div className="p-3 text-sm font-semibold text-slate-500">{c("暂无操作记录。")}</div>) : (<ol className="divide-y divide-slate-100">
            {events.map((event) => (<li key={event.id} className="px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="font-black">{c(orderEventLabel(event))}</span>
                  <span className="text-xs font-semibold text-slate-500">
                    {accountDate(event.createdAt)}
                  </span>
                </div>
                {event.note ? (<p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                    {event.note}
                  </p>) : null}
              </li>))}
          </ol>)}
      </section>
    </div>);
}
function AccountOrderLineImage({ line }: {
    line: AccountOrderDetailLine;
}) {
    const imageAlt = line.imageAlt || line.productName || line.name || line.sku;
    const fallbackImageUrl = React.useMemo(() => getExternalOrderLineImageFallbackUrl(line.imageUrl), [line.imageUrl]);
    const [failedImageUrls, setFailedImageUrls] = React.useState<string[]>([]);
    const primaryImageUrl = line.imageUrl ?? "";
    const imageUrl = primaryImageUrl && !failedImageUrls.includes(primaryImageUrl)
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
    return (<div className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-md border border-slate-200 bg-white sm:size-16">
      {imageUrl ? (<Image src={imageUrl} alt={imageAlt} fill sizes="(min-width: 640px) 64px, 56px" quality={55} loading="lazy" decoding="async" className="object-contain p-1" onError={handleImageError}/>) : (<Package className="size-5 text-slate-300"/>)}
    </div>);
}
function DetailTile({ label, value }: {
    label: string;
    value: string;
}) {
    return (<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-bold uppercase text-slate-400">{label}</div>
      <div className="mt-1 truncate text-sm font-black text-slate-800">{value}</div>
    </div>);
}
function walletTransactionLabel(direction: "credit" | "debit") {
    return direction === "credit" ? "钱包入账" : "钱包抵扣";
}
function walletTransactionReasonLabel(reason: string, direction: "credit" | "debit") {
    if (reason === "钱包余额自动抵扣订单") {
        return "钱包余额抵扣订单";
    }
    return reason || walletTransactionLabel(direction);
}
function AccountSectionNav({ activeSection, onSectionChange, orderSummaries, rmaRequests, }: {
    activeSection: AccountSectionId;
    onSectionChange: (section: AccountSectionId) => void;
    orderSummaries: OrderSummary[];
    rmaRequests: RmaRequest[];
}) {
    const c = useAccountCopy();
    const openOrderCount = orderSummaries.filter((order) => !isTerminalOrderStatus(order.status)).length;
    const sections: Array<{
        badge?: string;
        id: AccountSectionId;
        icon: React.ComponentType<{
            className?: string;
        }>;
        label: string;
    }> = [
        {
            id: "overview",
            icon: Building2,
            label: c("概览"),
        },
        {
            id: "wallet",
            icon: WalletCards,
            label: c("钱包"),
        },
        {
            badge: openOrderCount > 0 ? String(openOrderCount) : undefined,
            id: "orders",
            icon: Package,
            label: c("订单"),
        },
        {
            badge: rmaRequests.length > 0 ? String(rmaRequests.length) : undefined,
            id: "service",
            icon: RotateCcw,
            label: c("售后"),
        },
    ];
    return (<nav className="pp-account-section-nav rounded-lg border border-slate-200 bg-white p-1 shadow-sm" aria-label={c("个人中心分组")}>
      <div className="grid grid-cols-4 gap-1">
        {sections.map((section) => {
            const Icon = section.icon;
            const active = section.id === activeSection;
            return (<button key={section.id} type="button" className={cn("relative flex h-10 min-w-0 items-center justify-center gap-1 rounded-md px-1 text-xs font-black transition", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40", active
                    ? "bg-primary text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900")} aria-pressed={active} aria-current={active ? "page" : undefined} onClick={() => onSectionChange(section.id)}>
              <Icon className={cn("size-4 shrink-0", active ? "text-white" : "text-primary")}/>
              <span className="truncate">{section.label}</span>
              {section.badge ? (<span className={cn("absolute right-1 top-1 grid min-w-4 place-items-center rounded-full px-1 text-[10px] leading-4", active ? "bg-white text-primary" : "bg-red-500 text-white")}>
                  {section.badge}
                </span>) : null}
            </button>);
        })}
      </div>
    </nav>);
}
function WalletSection({ wallet }: {
    wallet: CustomerWallet;
}) {
    const c = useAccountCopy();
    const accountDate = useAccountDateTime();
    const recentTransactions = wallet.transactions;
    return (<Card size="sm" className="pp-wallet-section rounded-lg border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-black">
            <WalletCards className="size-4 text-primary"/>{c("钱包 / 结算抵扣")}</CardTitle>
          <Badge className="border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">{c("下单时选择")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="pp-wallet-balance rounded-lg border border-blue-100 bg-blue-50/70 p-3">
          <div className="text-xs font-bold text-blue-700">{c("可用余额")}</div>
          <div className="mt-1 text-3xl font-black leading-none text-slate-950">
            {formatEuro(wallet.balance)}
          </div>
          <div className="mt-2 text-xs font-semibold leading-5 text-slate-500">{c("银行转账订单缺货差价会进入钱包；结算时可勾选使用余额抵扣。")}</div>
        </div>

        <div className="pp-wallet-transactions min-w-0 space-y-1.5">
          <div className="text-xs font-black text-slate-500">{c("最近流水")}</div>
          {recentTransactions.length === 0 ? (<div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">{c("暂无钱包流水。")}</div>) : (recentTransactions.map((transaction) => (<div key={transaction.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-md border border-slate-200 bg-slate-50/70 px-2.5 py-2 text-xs">
                <div className="min-w-0">
                  <div className="truncate font-black text-slate-800">
                    {c(walletTransactionReasonLabel(transaction.reason, transaction.direction))}
                  </div>
                  <div className="mt-0.5 truncate font-semibold text-slate-500">
                    {accountDate(transaction.createdAt)}
                  </div>
                  {transaction.orderId ? <Link className="mt-1 inline-block min-h-8 py-1 font-semibold text-primary underline" href={`/account?section=orders&orderId=${encodeURIComponent(transaction.orderId)}`}>{c("查看关联订单")}</Link> : null}
                </div>
                <div className={cn("text-right font-black", transaction.direction === "credit" ? "text-emerald-700" : "text-blue-700")}>
                  {transaction.direction === "credit" ? "+" : "-"}
                  {formatEuro(transaction.amount)}
                </div>
              </div>)))}
        </div>
      </CardContent>
    </Card>);
}
function OrdersSection({ activeFilter, filteredOrders, onFilterChange, onOpenOrder, orderSummaries, }: {
    activeFilter: OrderFilterId;
    filteredOrders: OrderSummary[];
    onFilterChange: (filter: OrderFilterId) => void;
    onOpenOrder: (order: OrderSummary) => void;
    orderSummaries: OrderSummary[];
}) {
    const c = useAccountCopy();
    return (<Card size="sm" className="pp-orders-section rounded-lg border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-black">
            <Filter className="size-4 text-primary"/>{c("订单历史")}</CardTitle>
          <div className="text-right text-xs font-semibold text-slate-500">
            {filteredOrders.length} / {orderSummaries.length}{c("单")}</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="pp-order-filters flex flex-wrap gap-1.5" aria-label={c("按状态筛选订单")}>
          {orderFilters.map((filter) => {
            const count = orderSummaries.filter(filter.predicate).length;
            const isActive = filter.id === activeFilter;
            return (<Button key={filter.id} type="button" size="xs" variant={isActive ? "default" : "outline"} className={cn("h-7 gap-1 px-2", !isActive && "bg-white")} aria-pressed={isActive} title={c(filter.description)} onClick={() => onFilterChange(filter.id)}>
                {c(filter.label)}
                <span className="font-mono text-xs">{count}</span>
              </Button>);
        })}
        </div>

        {filteredOrders.length === 0 && (<div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">{c("当前筛选下没有订单。切换状态可查看其他记录。")}</div>)}

        {filteredOrders.map((order) => (<div key={order.id} className="pp-order-row grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-sm md:grid-cols-[minmax(160px,1fr)_110px_minmax(120px,.8fr)_auto] md:items-center">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="font-mono text-sm font-black">{order.id}</span>
                <Badge className={cn("border px-2 py-0.5 text-[11px]", orderBadgeClass(order.status))}>
                  {c(orderStatusLabel(order.status))}
                </Badge>
              </div>
              <div className="mt-1 truncate text-xs font-semibold text-slate-500 md:hidden">
                {order.date} · {order.items}{c("件 ·")}{order.company}
              </div>
            </div>
            <div className="hidden text-xs font-semibold text-slate-500 md:block">
              {order.date} · {order.items}{c("件")}</div>
            <div className="hidden truncate text-xs font-semibold text-slate-500 md:block">
              {order.company}
            </div>
            <div className="flex items-center justify-between gap-2 md:justify-end">
              <div className="text-sm font-black">{formatEuro(order.total)}</div>
              <Button type="button" variant="outline" size="xs" className="h-7 bg-white px-2" onClick={() => onOpenOrder(order)}>
                <FileText className="size-3.5"/>{c("详情")}</Button>
            </div>
          </div>))}
      </CardContent>
    </Card>);
}
function ServiceSection({ orderSummaries, rmaRequests, }: {
    orderSummaries: OrderSummary[];
    rmaRequests: RmaRequest[];
}) {
    const c = useAccountCopy();
    const rmaStartableOrders = orderSummaries.filter(isRmaStartableOrder).slice(0, 6);
    return (<div className="pp-account-service grid gap-2 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card size="sm" className="rounded-lg border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-sm font-black">
            <RotateCcw className="size-4 text-primary"/>{c("售后中心")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-black text-slate-900">{c("新建售后申请")}</div>
                <div className="mt-0.5 text-xs font-semibold leading-5 text-slate-600">{c("先选择订单，再选择商品和问题类型，避免手填订单号或 SKU。")}</div>
              </div>
              <Button asChild size="sm" className="w-full sm:w-auto">
                <Link href="/rma">
                  <Plus className="size-4"/>{c("新建售后")}</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-lg border border-primary/15 bg-primary/5 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs font-black text-slate-700">{c("从最近订单直接发起")}</div>
              <Badge className="border border-primary/20 bg-white text-[11px] text-primary" variant="outline">{c("选择订单")}</Badge>
            </div>
            {rmaStartableOrders.length === 0 ? (<div className="text-xs font-semibold leading-5 text-slate-500">{c("暂无已发货或已完成的订单可申请售后。")}</div>) : (<div className="space-y-1.5">
                {rmaStartableOrders.map((order) => (<div key={order.id} className="grid gap-2 rounded-md border border-slate-200 bg-white p-2 text-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="truncate font-mono font-black">{order.id}</span>
                        <Badge className={cn("border px-1.5 py-0 text-[10px]", orderBadgeClass(order.status))}>
                          {c(orderStatusLabel(order.status))}
                        </Badge>
                      </div>
                      <div className="mt-0.5 truncate font-semibold text-slate-500">
                        {order.date} · {order.items}{c("件 ·")}{formatEuro(order.total)}
                      </div>
                    </div>
                    <Button asChild variant="outline" size="xs" className="h-7 bg-white px-2">
                      <Link href={`/rma?order=${encodeURIComponent(order.id)}`}>
                        <RotateCcw className="size-3.5"/>{c("选择")}</Link>
                    </Button>
                  </div>))}
              </div>)}
          </div>

          {rmaRequests.length === 0 && (<div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">{c("当前账户暂无售后申请。")}</div>)}
          {rmaRequests.map((request) => (<div key={request.id} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-sm font-black">{request.id}</span>
                  <Badge className={cn("border px-2 py-0.5 text-[11px]", rmaBadgeClass(request.status))}>
                    {c(rmaStatusLabel(request.status))}
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
                <Link href={`/rma?requestId=${encodeURIComponent(request.id)}`}>{c("打开")}</Link>
              </Button>
            </div>))}
        </CardContent>
      </Card>

      <Card size="sm" className="rounded-lg border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-sm font-black">
            <FileText className="size-4 text-primary"/>{c("单据 / 发票")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">{c("暂无可下载单据。")}</div>
        </CardContent>
      </Card>
    </div>);
}
function AccountSummaryPanel({ company, isEmployeeAccount, onOpenProfile, orderSummaries, profile, rmaRequests, userEmail, wallet, }: {
    company: CompanyProfile | null;
    isEmployeeAccount: boolean;
    onOpenProfile: () => void;
    orderSummaries: OrderSummary[];
    profile: AccountCustomerProfile | null;
    rmaRequests: RmaRequest[];
    userEmail?: string;
    wallet: CustomerWallet;
}) {
    const c = useAccountCopy();
    const level = normalizeCustomerTier(profile?.level ?? company?.level ?? company?.priceList);
    const openOrderCount = orderSummaries.filter((order) => !isTerminalOrderStatus(order.status)).length;
    const shippedOrderCount = orderSummaries.filter((order) => order.status === "shipped").length;
    const displayName = company?.name ||
        profile?.companyName ||
        (isEmployeeAccount ? c("员工自购资料待创建") : c("客户档案正在关联"));
    const profileStatus = company
        ? c(companyStatusLabel(company.status))
        : profile?.profileCompletedAt
            ? c("资料已保存") : profile
            ? c("资料待补全") : c("资料待创建");
    const profileDescription = profile?.companyName
        ? isEmployeeAccount
            ? c("员工可使用这份自购资料下单。") : c("资料已保存，等待客户档案关联。")
        : isEmployeeAccount
            ? c("补全后可使用自己的资料下单。") : c("登录已验证，等待客户档案关联。");
    const primaryAddress = company?.shippingAddress ||
        profile?.shippingAddress ||
        company?.billingAddress ||
        profile?.billingAddress ||
        "";
    const summaryRows = [
        { label: c("账号"), value: userEmail ?? profile?.email ?? company?.email ?? "-" },
        { label: c("电话"), value: profile?.phone ?? company?.phone ?? "-" },
        { label: c("税号"), value: profile?.fiscalCode ?? company?.codiceFiscale ?? "-" },
        { label: c("配送"), value: primaryAddress || "-", wide: true },
    ] as const;
    return (<Card size="sm" className="pp-account-overview rounded-lg border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-2 p-2.5 sm:p-3">
        <div className="pp-account-identity flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <div className={cn("grid size-9 shrink-0 place-items-center rounded-lg", profile ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700")}>
              <Building2 className="size-4"/>
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-black leading-5">{displayName}</h2>
              <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-4 text-slate-500">
                {profileDescription}
              </p>
            </div>
          </div>
          <Badge className="shrink-0 border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">
            <CheckCircle2 className="size-3"/>{c("已验证")}</Badge>
        </div>

        <div className="pp-account-metrics grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <SummaryMetric label={c("资料")} value={profileStatus}/>
          <SummaryMetric label={c("价格类型")} value={(profile?.customerType ?? company?.customerType) === "wholesale" ? c("批发价") : c("零售价")} helper={c("价格类型与会员等级独立")}/>
          <SummaryMetric label={c("基础等级")} value={c(customerLevelLabel(profile?.baseLevel ?? company?.baseLevel ?? level))} helper={(profile?.levelSource ?? company?.levelSource) === "manual" ? c("人工设置") : c("消费累计 / 自购")}/>
          <SummaryMetric label={c("等级")} value={c(customerLevelLabel(level))} helper={c(customerPromoHelper(profile, company) ?? `普通商品每件最多减 ${formatTierDiscount(level)}；REMAX/保护膜除外`)}/>
          <SummaryMetric label={c("钱包")} value={formatEuro(wallet.balance)} accent/>
          <SummaryMetric label={c("未完单")} value={openOrderCount}/>
          <SummaryMetric label={c("配送")} value={shippedOrderCount}/>
          <SummaryMetric label={c("售后")} value={rmaRequests.length}/>
        </div>

        <p className="text-[11px] text-slate-500">{c("有效等级为基础等级与有效促销中较高者。售后退款不额外扣回升级累计，钱包再次购买按订单规则累计。")}</p>
        <div className="pp-account-profile-facts grid grid-cols-2 gap-1.5">
          {summaryRows.map((row) => (<Info key={row.label} label={row.label} value={row.value} className={"wide" in row && row.wide ? "col-span-2" : undefined}/>))}
        </div>

        <div className="pp-account-quick-actions grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <Button size="xs" className="h-8 px-1 text-[11px]" asChild>
            <Link href="/catalogo">
              <Plus className="size-3.5"/>{c("下单")}</Link>
          </Button>
          <Button size="xs" variant="outline" className="h-8 bg-white px-1 text-[11px]" asChild>
            <Link href="/rma">
              <RotateCcw className="size-3.5"/>{c("售后")}</Link>
          </Button>
          <Button type="button" size="xs" variant="outline" className="h-8 bg-white px-1 text-[11px]" onClick={onOpenProfile}>
            <Pencil className="size-3.5"/>{c("资料")}</Button>
          <form action={signOut} className="min-w-0">
            <Button size="xs" variant="outline" className="h-8 w-full bg-white px-1 text-[11px]" type="submit">
              <LogOut className="size-3.5"/>{c("退出")}</Button>
          </form>
        </div>
      </CardContent>
    </Card>);
}
function SummaryMetric({ accent = false, helper, label, value, }: {
    accent?: boolean;
    helper?: string;
    label: string;
    value: React.ReactNode;
}) {
    return (<div className={cn("pp-account-metric min-w-0 rounded-md border px-2 py-1.5", accent ? "border-primary/15 bg-primary/10" : "border-slate-100 bg-slate-50")}>
      <div className="truncate text-[10px] font-bold text-slate-400">{label}</div>
      <div className={cn("mt-0.5 truncate text-xs font-black", accent ? "text-primary" : "text-slate-800")}>
        {value}
      </div>
      {helper ? (<div className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">
          {helper}
        </div>) : null}
    </div>);
}
function AccountProfileNotice({ forceSetup, onOpen, profile, }: {
    forceSetup: boolean;
    onOpen: () => void;
    profile: AccountCustomerProfile;
}) {
    const c = useAccountCopy();
    const missingFields = [
        profile.companyName ? null : c("公司"),
        profile.email ? null : c("邮箱"),
        profile.phone ? null : c("电话"),
        profile.billingAddress ? null : c("账单地址"),
        profile.shippingAddress ? null : c("配送地址"),
        profile.fiscalCode ? null : c("税号"),
    ].filter(Boolean);
    const isPending = profile.status === "pending";
    return (<Card size="sm" className="pp-account-profile-notice rounded-lg border-amber-200 bg-amber-50 shadow-sm">
      <CardContent className="flex flex-col gap-3 p-3 text-sm text-amber-950 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-black">
            {forceSetup ? c("请补全账户资料") : c("客户资料待补全")}
          </div>
          <p className="mt-1 text-xs font-semibold leading-5">
            {isPending
            ? c("补全后系统会启用零售价客户，可查看零售价并下单；批发价由后台升级。") : c("补全客户资料后可使用结账、单据和订单管理。")}
          </p>
          {missingFields.length > 0 ? (<div className="mt-2 text-xs font-bold">{c("待补全：")}{missingFields.join("、")}
            </div>) : null}
        </div>
        <Button type="button" variant="outline" className="shrink-0 border-amber-300 bg-white" onClick={onOpen}>{c("查看资料")}</Button>
      </CardContent>
    </Card>);
}
function AccountProfileDialog({ onOpenChange, onSaved, open, profile, userEmail, }: {
    onOpenChange: (open: boolean) => void;
    onSaved: (profile: AccountCustomerProfile) => void;
    open: boolean;
    profile: AccountCustomerProfile;
    userEmail?: string;
}) {
    const c = useAccountCopy();
    const activeRef=React.useRef(true);React.useEffect(()=>{activeRef.current=true;return()=>{activeRef.current=false;};},[]);
    const [form, setForm] = React.useState<AccountProfileForm>(() => accountProfileToForm(profile, userEmail));
    const [error, setError] = React.useState<string | null>(null);
    const [saving, setSaving] = React.useState(false);
    const dirty = JSON.stringify(form) !== JSON.stringify(accountProfileToForm(profile, userEmail));
    useUnsavedChanges(open && (dirty || saving), c("资料尚未保存。确定离开并丢弃修改？"));
    function requestProfileOpenChange(next: boolean) {
        if (!next && (saving || (dirty && !window.confirm(c("资料尚未保存。确定丢弃修改？")))))
            return;
        onOpenChange(next);
    }
    const wasOpenRef = React.useRef(open);
    const openerRef = React.useRef<HTMLElement | null>(null);
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
    const updateAddressField = React.useCallback((addressKey: "billingAddress" | "shippingAddress", field: AddressDraftField, value: string) => {
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
        if (!isAddressDraftComplete(form.shippingAddress) ||
            (!form.billingSameAsShipping && !isAddressDraftComplete(form.billingAddress))) {
            setError(c("请补全地址里的 Provincia、Citta、CAP、Via 和 Numero。"));
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
            const response = await fetchJson<{
                data: AccountCustomerProfile;
            }>("/api/account/profile", {
                body: JSON.stringify(payload),
                headers: { "Content-Type": "application/json" },
                method: "PATCH",
            });
            if(!activeRef.current)return;
            onSaved(response.data);
            onOpenChange(false);
        }
        catch {
            setError(c("无法保存资料。"));
        }
        finally {
            setSaving(false);
        }
    }
    if (!open) {
        return null;
    }
    return (<Dialog open={open} onOpenChange={requestProfileOpenChange}>
      <DialogContent showCloseButton={!saving} onEscapeKeyDown={(event) => { if (saving)
        event.preventDefault(); }} onInteractOutside={(event) => { if (saving)
        event.preventDefault(); }} scrollLayout="body" className="pp-storefront-portal pp-account-dialog pp-profile-dialog rounded-lg sm:max-w-3xl" onOpenAutoFocus={() => {
            openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }} onCloseAutoFocus={(event) => {
            if (openerRef.current?.isConnected) {
                event.preventDefault();
                openerRef.current.focus();
            }
        }}>
        <DialogHeader>
          <DialogTitle>{c("完善个人中心资料")}</DialogTitle>
          <DialogDescription>{c("这些资料用于账户、订单、税务和配送。")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="account-profile-form" className="space-y-3" onSubmit={submitProfile}>
            <div className="grid gap-3 sm:grid-cols-2">
              <ProfileInput field="companyName" label={c("客户名称")} required value={form.companyName} onChange={updateField}/>
              <ProfileInput field="contactName" label={c("微信号码 / WhatsApp 号码")} value={form.contactName} onChange={updateField}/>
              <ProfileInput field="email" label={c("邮箱")} disabled required type="email" value={form.email} onChange={updateField}/>
              <ProfileInput field="phone" label={c("电话")} required value={form.phone} onChange={updateField}/>
              <ProfileInput field="fiscalCode" label={c("税号")} required value={form.fiscalCode} onChange={updateField}/>
              <ProfileInput field="pec" label="PEC" type="email" value={form.pec} onChange={updateField}/>
            </div>

            <div className="space-y-3">
              <AddressFields title={c("配送地址")} addressKey="shippingAddress" value={form.shippingAddress} onChange={updateAddressField}/>
              <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                <Checkbox className="mt-0.5" checked={form.billingSameAsShipping} onCheckedChange={(checked) => updateBillingSameAsShipping(Boolean(checked))}/>
                <span>{c("账单地址跟配送地址一样")}</span>
              </label>
              {!form.billingSameAsShipping ? (<AddressFields title={c("账单地址")} addressKey="billingAddress" value={form.billingAddress} onChange={updateAddressField}/>) : null}
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs font-semibold leading-5 text-blue-800">{c("税号、电话和详细地址用于订单与配送；微信或 WhatsApp 可留空。补全后系统会启用零售价客户；批发价由后台升级，资料异常时请联系客服。")}</div>

            {error ? (<div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                {error}
              </div>) : null}
          </form>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" className="bg-white" disabled={saving} onClick={() => requestProfileOpenChange(false)}>{c("取消")}</Button>
          <Button type="submit" form="account-profile-form" disabled={saving}>
            {saving ? (<>
                <Loader2 className="size-4 animate-spin"/>{c("保存中")}</>) : (c("保存资料"))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);
}
function AddressFields({ addressKey, onChange, title, value, }: {
    addressKey: "billingAddress" | "shippingAddress";
    onChange: (addressKey: "billingAddress" | "shippingAddress", field: AddressDraftField, value: string) => void;
    title: string;
    value: AddressDraft;
}) {
    const c = useAccountCopy();
    const [capMatches, setCapMatches] = React.useState<ItalyCapLookupResult[]>([]);
    const candidateSelectId = `account-profile-${addressKey}-cap-candidate`;
    const postalCode = normalizeItalianPostalCode(value.postalCode);
    const visibleCapMatches = postalCode.length === 5 ? capMatches : [];
    const selectedCapMatchValue = getSelectedCapMatchValue(visibleCapMatches, value);
    const applyCapMatch = React.useCallback((match: ItalyCapLookupResult) => {
        onChange(addressKey, "province", match.provinceCode);
        onChange(addressKey, "city", match.city);
    }, [addressKey, onChange]);
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
        onChange(addressKey, field, field === "postalCode" ? normalizeItalianPostalCode(nextValue) : nextValue);
    }
    return (<section className="pp-address-fields rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-3 text-sm font-black text-slate-700">{title}</div>
      <div className="grid gap-3 sm:grid-cols-3">
        <ProfileInput id={`account-profile-${addressKey}-postalCode`} field="postalCode" label="CAP" inputMode="numeric" maxLength={5} required value={value.postalCode} onChange={updateField}/>
        <ProfileInput id={`account-profile-${addressKey}-province`} field="province" label={c("省 / Provincia")} required value={value.province} onChange={updateField}/>
        <ProfileInput id={`account-profile-${addressKey}-city`} field="city" label={c("城市 / Citta")} required value={value.city} onChange={updateField}/>
        {visibleCapMatches.length > 1 ? (<div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor={candidateSelectId} className="text-xs font-black text-slate-500">{c("CAP 匹配城市")}</Label>
            <Select value={selectedCapMatchValue} onValueChange={(matchValue) => {
                const nextMatch = visibleCapMatches.find((match) => getCapMatchValue(match) === matchValue);
                if (nextMatch) {
                    applyCapMatch(nextMatch);
                }
            }}>
              <SelectTrigger id={candidateSelectId} className="w-full bg-white">
                <SelectValue placeholder={c("请选择城市 / Provincia")}/>
              </SelectTrigger>
              <SelectContent className="pp-storefront-portal">
                {visibleCapMatches.map((match) => (<SelectItem key={getCapMatchValue(match)} value={getCapMatchValue(match)}>
                    {match.city} ({match.provinceCode})
                  </SelectItem>))}
              </SelectContent>
            </Select>
          </div>) : null}
        <ProfileInput id={`account-profile-${addressKey}-street`} field="street" label={c("街道 / Via")} required value={value.street} onChange={updateField}/>
        <ProfileInput id={`account-profile-${addressKey}-streetNumber`} field="streetNumber" label={c("门牌 / Numero")} required value={value.streetNumber} onChange={updateField}/>
        <ProfileInput id={`account-profile-${addressKey}-extra`} field="extra" label={c("补充信息")} value={value.extra} onChange={updateField}/>
      </div>
    </section>);
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
function ProfileInput<Field extends string>({ autoComplete, field, id: idProp, disabled, inputMode, label, maxLength, onChange, required, type = "text", value, }: ProfileInputProps<Field>) {
    const id = idProp ?? `account-profile-${field}`;
    return (<div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-black text-slate-500">
        {label}
        {required ? " *" : null}
      </Label>
      <Input autoComplete={autoComplete} disabled={disabled} id={id} inputMode={inputMode} maxLength={maxLength} required={required} type={type} value={value} onChange={(event) => onChange(field, event.currentTarget.value)}/>
    </div>);
}
function createEmptyAccountProfile(userEmail: string | undefined, isEmployeeAccount: boolean): AccountCustomerProfile {
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
        promoLevel: null,
        promoLevelStartsAt: null,
        promoLevelExpiresAt: null,
        promoLevelReason: null,
        profileCompletedAt: null,
        profileKind: isEmployeeAccount ? "employee_self" : "customer",
        sdi: "",
        shippingAddress: "",
        status: isEmployeeAccount ? "active" : "pending",
        vatNumber: "",
    };
}
function accountProfileToForm(profile: AccountCustomerProfile, userEmail?: string): AccountProfileForm {
    const shippingAddress = parseAddressDraft(profile.shippingAddress);
    const billingAddress = parseAddressDraft(profile.billingAddress);
    const billingSameAsShipping = !normalizeAddressText(profile.billingAddress) ||
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
    return Boolean(address.province.trim() &&
        address.city.trim() &&
        normalizeItalianPostalCode(address.postalCode).length === 5 &&
        address.street.trim() &&
        address.streetNumber.trim());
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
function getSelectedCapMatchValue(matches: ItalyCapLookupResult[], address: AddressDraft) {
    const city = address.city.trim();
    const province = address.province.trim().toUpperCase();
    const selectedMatch = matches.find((match) => match.city === city && match.provinceCode === province);
    return selectedMatch ? getCapMatchValue(selectedMatch) : "";
}
function Info({ className, label, value, }: {
    className?: string;
    label: string;
    value: string;
}) {
    return (<div className={cn("pp-account-info min-w-0 rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5", className)}>
      <div className="truncate text-[11px] font-bold text-slate-400">{label}</div>
      <div className="mt-0.5 truncate text-xs font-semibold text-slate-700" title={value || "-"}>
        {value || "-"}
      </div>
    </div>);
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
        return "售后申请数据暂时无法读取。请刷新页面或稍后再试。";
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
function customerPromoHelper(profile: AccountCustomerProfile | null, company: CompanyProfile | null) {
    const promoLevel = profile?.promoLevel ?? company?.promoLevel;
    const startsAtValue = profile?.promoLevelStartsAt ?? company?.promoLevelStartsAt;
    const expiresAtValue = profile?.promoLevelExpiresAt ?? company?.promoLevelExpiresAt;
    if (!promoLevel || !startsAtValue || !expiresAtValue) {
        return null;
    }
    const startsAt = new Date(startsAtValue).getTime();
    const expiresAt = new Date(expiresAtValue).getTime();
    const now = Date.now();
    if (!Number.isFinite(startsAt) || !Number.isFinite(expiresAt) || now < startsAt || now >= expiresAt) {
        return null;
    }
    return `活动至 ${new Intl.DateTimeFormat("zh-CN", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
    }).format(new Date(expiresAtValue))}`;
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
function isRmaStartableOrder(order: OrderSummary) {
    return order.status === "shipped" || isCompletedOrderStatus(order.status);
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
        rma_created: "售后申请已创建",
        shipment_updated: "配送状态已更新",
        status_updated: "订单状态已更新",
    };
    return labels[value] ?? "订单动态";
}
function useAccountDateTime() {
    const {locale} = useI18n();
    return (value: string) => formatAccountOrderDateTime(value, locale);
}
function formatAccountOrderDateTime(value: string, locale: string) {
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) {
        return value;
    }
    return new Intl.DateTimeFormat(locale, {
        timeZone: "Europe/Rome",
        day: "2-digit",
        hour: "2-digit",
        hour12: false,
        minute: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(new Date(timestamp));
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
    const error = (payload as {
        error?: {
            message?: unknown;
        };
    }).error;
    return typeof error?.message === "string" ? error.message : null;
}
function AccountHistoryControls({ section, hasMore, pending }: {
    section: "orders" | "wallet";
    hasMore: boolean;
    pending: boolean;
}) {
    const c = useAccountCopy();
    const params = useSearchParams();
    const router = useRouter();
    const page = Math.max(0, Number(params.get("page")) || 0);
    function navigate(nextPage: number, q = params.get("q") ?? "") {
        const next = new URLSearchParams(params.toString());
        next.set("section", section);
        next.set("page", String(nextPage));
        next.delete("orderId");
        if (q.trim())
            next.set("q", q.trim());
        else
            next.delete("q");
        router.replace(`/account?${next}`, { scroll: false });
    }
    return <div className="pp-account-history-controls flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3">
    {section === "orders" ? <form key={params.get("q")} className="flex min-w-0 flex-1 gap-2" onSubmit={(event) => { event.preventDefault(); navigate(0, String(new FormData(event.currentTarget).get("q") ?? "")); }}><Input name="q" defaultValue={params.get("q") ?? ""} aria-label={c("按订单号搜索")} placeholder={c("订单号")} maxLength={80}/><Button type="submit" disabled={pending}>{c("搜索")}</Button>{params.get("q") ? <Button variant="ghost" type="button" onClick={() => navigate(0, "")}>{c("清除")}</Button> : null}</form> : null}
    <span className="text-xs text-slate-500">{c(`第 ${page+1} 页 · 状态筛选限本页`)}</span><Button variant="outline" disabled={pending || page === 0} onClick={() => navigate(page - 1)}>{c("上一页")}</Button><Button variant="outline" disabled={pending || !hasMore} onClick={() => navigate(page + 1)}>{c("下一页")}</Button>
  </div>;
}
