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
import { ArrowRight, Bell, Building2, CheckCircle2, ChevronRight, CircleHelp, FileText, Headphones, Home, Loader2, LogOut, Mail, MapPin, Package, Pencil, Plus, RotateCcw, Settings2, ShieldCheck, Truck, WalletCards, } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

const accountReferenceCopy = {
    "it-IT": {
        title: "Area personale", overview: "Panoramica", orders: "I miei ordini", wallet: "Il mio portafoglio", service: "Assistenza", welcome: "Bentornato",
        overviewDescription: "Ordini, saldo e assistenza. Tutto sotto controllo.", ordersDescription: "Consulta i tuoi acquisti e segui lo stato degli ordini.", walletDescription: "Controlla il saldo disponibile e i movimenti recenti.", serviceDescription: "Apri una richiesta da un ordine e segui gli aggiornamenti.",
        companyAddress: "Azienda e indirizzi", notifications: "Notifiche", help: "Centro assistenza", shop: "Acquista nel catalogo", business: "Cliente professionale", customer: "Account cliente", staff: "Acquisti personali staff",
        manageCompany: "Gestisci i dati", complete: "Dati completi", incomplete: "Dati da completare", effectiveLevel: "Livello effettivo", baseLevel: "Livello base", balance: "Saldo disponibile", walletUse: "Scegli se usarlo al checkout", movements: "Vedi movimenti", recentOrders: "Ordini recenti", seeAll: "Vedi tutti", attention: "Da tenere d’occhio", openOrders: "Ordini aperti", pendingPayment: "Da pagare", processing: "In lavorazione", shipped: "Spediti", afterSales: "Richieste aperte", availableData: "Conteggi sulle informazioni caricate", noRecentOrders: "Non hai ancora ordini da mostrare.", address: "Indirizzo di consegna", billingAddress: "Indirizzo di fatturazione", manageAddress: "Gestisci indirizzi", noAddress: "Completa l’indirizzo prima del prossimo acquisto.",
        order: "Ordine", date: "Data ordine", quantity: "Articoli", status: "Stato ordine", amount: "Importo", action: "Dettaglio", walletHow: "Come si usa il saldo?", walletRefund: "Rimborsi e differenze vengono registrati", walletChoose: "Seleziona il saldo al checkout", walletRecord: "Ogni movimento resta consultabile", walletExplanation: "Il saldo segue i movimenti del tuo account. Il totale e l’eventuale utilizzo vengono confermati al checkout.", typeDescription: "Tipo e descrizione", linkedOrder: "Ordine collegato", serviceSteps: "Parti da un ordine spedito o completato", stepOrder: "Seleziona l’ordine", stepProduct: "Scegli l’articolo", stepProblem: "Descrivi il problema", myRequests: "Le mie richieste", requestDetails: "Dettaglio richiesta", searchRequests: "Cerca richiesta o prodotto", openRequest: "Apri richiesta e aggiornamenti", requestDate: "Data richiesta", noRequests: "Non ci sono richieste assistenza da mostrare.", chooseRequest: "Seleziona una richiesta per consultarne i dati.", currentStage: "Stato attuale", accountIdentity: "Profilo cliente", companyInfo: "Dati azienda", editProfile: "Modifica dati", profileDescription: "Gestisci i dati usati per account, ordini e consegne.", sameAddress: "Uguale alla consegna", profileCompany: "Dati azienda", profileDelivery: "Consegna e fatturazione", emailLocked: "L’email di accesso non si modifica da qui.", noDocuments: "Non ci sono documenti scaricabili.", payment: "Stato pagamento", detailSummary: "Riepilogo ordine", details: "Dettagli", timeline: "Cronologia ordine", deliveryDetails: "Dati di consegna", walletApplied: "Credito utilizzato", latestData: "La disponibilità e gli importi seguono i dati del tuo account.",
    },
    "zh-CN": {
        title: "个人中心", overview: "概览", orders: "我的订单", wallet: "我的钱包", service: "售后服务", welcome: "欢迎回来",
        overviewDescription: "订单、余额与售后，一目了然。", ordersDescription: "查看采购记录与订单状态。", walletDescription: "查看可用余额与最近收支。", serviceDescription: "从订单发起申请，随时查看处理进度。",
        companyAddress: "公司与地址", notifications: "通知消息", help: "帮助中心", shop: "前往商城采购", business: "专业客户", customer: "客户账户", staff: "员工自购账户",
        manageCompany: "管理公司资料", complete: "资料已完善", incomplete: "资料待补全", effectiveLevel: "有效等级", baseLevel: "基础等级", balance: "可用钱包余额", walletUse: "结算时可选择抵扣", movements: "查看流水", recentOrders: "最近订单", seeAll: "查看全部", attention: "需要关注", openOrders: "未完成订单", pendingPayment: "待付款", processing: "处理中", shipped: "已发货", afterSales: "售后处理中", availableData: "统计基于当前已加载资料", noRecentOrders: "暂无可展示的采购订单。", address: "配送地址", billingAddress: "账单地址", manageAddress: "管理地址", noAddress: "请在下次采购前补全配送地址。",
        order: "订单", date: "下单日期", quantity: "商品数量", status: "订单状态", amount: "订单金额", action: "查看详情", walletHow: "余额如何使用？", walletRefund: "退款或差价会记录入账", walletChoose: "结算时选择抵扣", walletRecord: "每笔变化均有记录", walletExplanation: "余额跟随账户真实流水更新，结算时会确认总额与可抵扣金额。", typeDescription: "类型与说明", linkedOrder: "关联订单", serviceSteps: "从已发货 / 已完成订单发起", stepOrder: "选择订单", stepProduct: "选择商品", stepProblem: "填写问题", myRequests: "我的申请", requestDetails: "申请详情", searchRequests: "搜索申请单号或商品", openRequest: "查看申请与进度", requestDate: "申请日期", noRequests: "当前账户暂无可展示的售后申请。", chooseRequest: "选择申请后查看对应资料。", currentStage: "当前状态", accountIdentity: "账户身份", companyInfo: "公司资料", editProfile: "编辑资料", profileDescription: "管理用于账户、订单与配送的资料。", sameAddress: "与配送地址一致", profileCompany: "公司资料", profileDelivery: "配送与账单", emailLocked: "登录邮箱不可在此修改。", noDocuments: "暂无可下载单据。", payment: "付款状态", detailSummary: "结算摘要", details: "商品明细", timeline: "订单动态", deliveryDetails: "配送资料", walletApplied: "钱包抵扣", latestData: "可用状态与金额以账户真实记录为准。",
    },
} as const;

function useAccountReferenceCopy() {
    const { locale } = useI18n();
    return accountReferenceCopy[locale === "zh-CN" ? "zh-CN" : "it-IT"];
}
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
    const ui = useAccountReferenceCopy();
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
    const [profileSummaryOpen, setProfileSummaryOpen] = React.useState(false);
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
      <div className="pp-account-content">
        <div className="pp-account-workspace">
        <aside className="pp-account-navigation">
          <div className="pp-account-sidebar-title"><h2>{ui.title}</h2><span>ACCOUNT</span></div>
          <button type="button" className="pp-account-sidebar-company" onClick={() => setProfileSummaryOpen(true)}><span className="pp-account-company-avatar"><Building2 aria-hidden="true"/></span><span><strong>{company?.name || profile?.companyName || userEmail || ui.title}</strong><small>{isEmployeeAccount ? ui.staff : (profile?.customerType ?? company?.customerType) === "wholesale" ? ui.business : ui.customer}</small></span></button>
          <AccountSectionNav activeSection={activeSection} orderSummaries={orderSummaries} rmaRequests={rmaRequests} onSectionChange={changeSection}/>
          <div className="pp-account-sidebar-secondary"><button type="button" className="pp-account-sidebar-link" onClick={() => setProfileSummaryOpen(true)}><Building2 aria-hidden="true"/><span>{ui.companyAddress}</span></button><div className="pp-account-notifications"><Bell aria-hidden="true"/><span>{ui.notifications}</span><NotificationCenter audience={isEmployeeAccount ? "staff" : "customer"} className="pp-account-notification-button" portalClassName="pp-storefront-portal"/></div></div>
          <div className="pp-account-sidebar-footer"><Link className="pp-account-sidebar-link" href="/help"><CircleHelp aria-hidden="true"/><span>{ui.help}</span></Link><form action={signOut}><button type="submit" className="pp-account-sidebar-link"><LogOut aria-hidden="true"/><span>{c("退出")}</span></button></form></div>
        </aside>
        <div className="pp-account-main">
        <header className="pp-account-heading"><div><p className="pp-account-breadcrumb">{ui.title}<span>/</span>{ui[activeSection]}</p><h1>{activeSection === "overview" ? ui.welcome : ui[activeSection]}</h1><p>{ui[`${activeSection}Description`]}</p></div><Button asChild className="pp-account-primary-action"><Link href={activeSection === "service" ? "/rma" : "/catalogo"}>{activeSection === "service" ? <Plus aria-hidden="true"/> : null}{activeSection === "service" ? c("新建售后申请") : ui.shop}<ArrowRight aria-hidden="true"/></Link></Button></header>
        {shouldShowProfileNotice && profile ? (<AccountProfileNotice forceSetup={forceSetup} profile={profile} onOpen={() => setProfileDialogOpen(true)}/>) : null}

        {dataWarning ? (<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
            <AsyncFeedback state="error" title={c(accountDataWarningLabel(dataWarning, isEmployeeAccount))} actions={<Button variant="outline" onClick={() => router.refresh()}>{c("重试")}</Button>}/>
          </div>) : null}

        <section className="pp-account-section min-w-0" aria-busy={sectionPending || loadedSection !== activeSection}>
          {sectionPending || loadedSection !== activeSection ? (<div role="status" className="flex min-h-48 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin"/>{t("common.loading")}
            </div>) : <>
          {activeSection === "overview" ? (<AccountSummaryPanel company={company} isEmployeeAccount={isEmployeeAccount} orderSummaries={orderSummaries} profile={profile} rmaRequests={rmaRequests} userEmail={userEmail} wallet={wallet} onOpenProfile={() => setProfileSummaryOpen(true)} onOpenOrder={openOrderDetail} onSectionChange={(section, filter) => { if (filter) setActiveFilter(filter); changeSection(section); }}/>) : null}

          {activeSection === "orders" ? <AccountHistoryControls section={activeSection} hasMore={historyHasMore} pending={sectionPending}/> : null}
          {activeSection === "wallet" ? (<WalletSection wallet={wallet}/>) : null}
          {activeSection === "wallet" ? <AccountHistoryControls section={activeSection} hasMore={historyHasMore} pending={sectionPending}/> : null}

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
        <AccountProfileSummaryDialog open={profileSummaryOpen} onOpenChange={setProfileSummaryOpen} company={company} profile={profile} userEmail={userEmail} onEdit={() => { setProfileSummaryOpen(false); setProfileDialogOpen(true); }}/>
      </div>
    </main>);
}
function AccountOrderDetailPanel({ detail, error, loading }: { detail: AccountOrderDetail | null; error: string | null; loading: boolean }) {
    const c = useAccountCopy();
    const ui = useAccountReferenceCopy();
    const accountDate = useAccountDateTime();
    const [copyState, setCopyState] = React.useState<"idle" | "success" | "error">("idle");
    if (loading) return <div className="pp-account-empty" role="status"><Loader2 className="animate-spin" aria-hidden="true"/><strong>{c("正在加载订单详情...")}</strong></div>;
    if (error) return <div className="pp-account-info-banner is-error" role="alert">{error}</div>;
    if (!detail) return <div className="pp-account-empty">{c("暂无订单详情。")}</div>;
    const lines = detail.lines ?? [];
    const events = detail.operationHistory ?? [];
    return <div className="pp-order-detail">
        <div className="pp-order-detail-status"><Badge className={cn("pp-account-status", orderBadgeClass(detail.uiStatus ?? detail.status))}>{c(orderStatusLabel(detail.uiStatus ?? detail.status))}</Badge><span>{ui.payment}: <strong>{c(paymentStatusLabel(detail.paymentStatus))}</strong></span></div>
        <div className="pp-order-detail-grid"><div className="pp-order-detail-main"><section className="pp-account-panel"><header className="pp-account-panel-header"><h2>{ui.details}</h2><span>{lines.length} · {detail.items}{c("件")}</span></header>{lines.length === 0 ? <p className="pp-account-empty">{c("暂无明细行。")}</p> : <div className="pp-order-lines-table"><div className="pp-order-line-table-head"><span>{ui.details}</span><span>{c("小计")}</span></div>{lines.map((line) => <div className="pp-order-detail-line" key={line.id}><AccountOrderLineImage line={line}/><div><strong>{line.productName ?? line.name ?? line.sku}</strong><p>{line.sku}</p><small>{line.quantity} × {formatEuro(line.unitPrice)}{(line.shortageQty ?? line.cancelledQty ?? 0) > 0 ? <em>{c("缺货")} {line.shortageQty ?? line.cancelledQty}{c("件")}</em> : line.pickedQty !== undefined ? <em>{c("实给")} {line.pickedQty}{c("件")}</em> : null}</small></div><b>{formatEuro(line.lineTotal)}</b></div>)}</div>}</section><section className="pp-order-event-panel pp-account-panel"><header className="pp-account-panel-header"><h2>{ui.timeline}</h2></header>{events.length === 0 ? <p className="pp-account-empty">{c("暂无操作记录。")}</p> : <ol className="pp-order-events">{events.map((event) => <li key={event.id}><span aria-hidden="true"/><div><strong>{c(orderEventLabel(event))}</strong><time>{accountDate(event.createdAt)}</time>{event.note ? <p>{event.note}</p> : null}</div></li>)}</ol>}</section></div>
        <aside className="pp-order-detail-aside"><section className="pp-order-detail-summary pp-account-panel"><header className="pp-account-panel-header"><h2>{ui.detailSummary}</h2></header><dl>{lines.length ? <div><dt>{ui.quantity}</dt><dd>{lines.reduce((count, line) => count + line.quantity, 0)}</dd></div> : null}{(detail.walletAppliedAmount ?? 0) > 0 ? <div><dt>{ui.walletApplied}</dt><dd>−{formatEuro(detail.walletAppliedAmount ?? 0)}</dd></div> : null}<div className="is-total"><dt>{c("合计")}</dt><dd>{formatEuro(detail.total)}</dd></div></dl><div className="pp-order-payment-state"><span>{ui.payment}</span><strong>{c(paymentStatusLabel(detail.paymentStatus))}</strong></div>{(detail.paymentOverpaidAmount ?? 0) > 0 ? <DetailTile label={c("差价入钱包")} value={formatEuro(detail.paymentOverpaidAmount ?? 0)}/> : null}</section>
        <section className="pp-account-panel pp-order-delivery"><header className="pp-account-panel-header"><h2>{ui.deliveryDetails}</h2></header><DetailTile label={c("承运商")} value={detail.carrier || c("待安排")}/><DetailTile label={c("配送方式")} value={detail.service || c("待安排")}/><DetailTile label={c("追踪号")} value={detail.tracking || c("待安排")}/><DetailTile label={c("配送地址")} value={detail.shippingAddress || c("待安排")}/>{detail.tracking ? <Button variant="outline" onClick={async () => { try { if (!navigator.clipboard) throw new Error("Clipboard unavailable"); await navigator.clipboard.writeText(detail.tracking!); setCopyState("success"); } catch { setCopyState("error"); } }}>{c(copyState === "success" ? "已复制" : "复制追踪号")}</Button> : null}{copyState === "error" ? <AsyncFeedback state="error" title={c("无法复制，请选中追踪号复制。")}/> : null}</section></aside></div>
        <p className="pp-account-rule-note">{ui.latestData}</p>
    </div>;
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
function AccountSectionNav({ activeSection, onSectionChange, orderSummaries, rmaRequests }: {
    activeSection: AccountSectionId;
    onSectionChange: (section: AccountSectionId) => void;
    orderSummaries: OrderSummary[];
    rmaRequests: RmaRequest[];
}) {
    const ui = useAccountReferenceCopy();
    const openOrderCount = orderSummaries.filter((order) => !isTerminalOrderStatus(order.status)).length;
    const sections = [
        { id: "overview" as const, icon: Home, label: ui.overview },
        { id: "orders" as const, icon: FileText, label: ui.orders, badge: openOrderCount },
        { id: "wallet" as const, icon: WalletCards, label: ui.wallet },
        { id: "service" as const, icon: Headphones, label: ui.service, badge: rmaRequests.length },
    ];
    return <nav className="pp-account-section-nav" aria-label={ui.title}>
        {sections.map(({ id, icon: Icon, label, badge }) => <button key={id} type="button" aria-current={activeSection === id ? "page" : undefined} aria-pressed={activeSection === id} onClick={() => onSectionChange(id)}><Icon aria-hidden="true"/><span>{label}</span>{Boolean(badge) && <b>{badge}</b>}</button>)}
    </nav>;
}
function WalletSection({ wallet }: { wallet: CustomerWallet }) {
    const c = useAccountCopy();
    const ui = useAccountReferenceCopy();
    const accountDate = useAccountDateTime();
    return <div className="pp-wallet-section">
        <div className="pp-wallet-top-grid">
            <section className="pp-wallet-hero" aria-label={ui.balance}><WalletCards className="pp-wallet-watermark" aria-hidden="true"/><span><WalletCards aria-hidden="true"/>{ui.balance}</span><strong>{formatEuro(wallet.balance)}</strong><p>{ui.walletUse}</p></section>
            <section className="pp-wallet-guide pp-account-panel"><h2>{ui.walletHow}</h2><div><span><RotateCcw aria-hidden="true"/></span><p><strong>{ui.walletRefund}</strong><small>{c("银行转账订单缺货差价会进入钱包；结算时可勾选使用余额抵扣。")}</small></p></div><div><span><WalletCards aria-hidden="true"/></span><p><strong>{ui.walletChoose}</strong><small>{ui.walletExplanation}</small></p></div><div><span><FileText aria-hidden="true"/></span><p><strong>{ui.walletRecord}</strong><small>{ui.latestData}</small></p></div></section>
        </div>
        <section className="pp-wallet-ledger pp-account-panel"><header className="pp-account-panel-header"><h2>{c("最近流水")}</h2><span>{wallet.transactions.length}</span></header>
            {wallet.transactions.length === 0 ? <div className="pp-account-empty"><WalletCards aria-hidden="true"/><strong>{c("暂无钱包流水。")}</strong><p>{ui.walletExplanation}</p></div> : <div className="pp-account-table-scroll"><table className="pp-wallet-table"><thead><tr><th>{ui.typeDescription}</th><th>{ui.linkedOrder}</th><th>{ui.date}</th><th>{ui.amount}</th></tr></thead><tbody>{wallet.transactions.map((transaction) => <tr key={transaction.id}><td><span className={cn("pp-wallet-movement-icon", transaction.direction === "credit" && "is-credit")}>{transaction.direction === "credit" ? <RotateCcw aria-hidden="true"/> : <WalletCards aria-hidden="true"/>}</span><span><strong>{c(walletTransactionReasonLabel(transaction.reason, transaction.direction))}</strong><small>{transaction.direction === "credit" ? c("可用余额") : c("钱包抵扣")}</small></span></td><td>{transaction.orderId ? <Link href={`/account?section=orders&orderId=${encodeURIComponent(transaction.orderId)}`}>{transaction.orderId}</Link> : "—"}</td><td>{accountDate(transaction.createdAt)}</td><td className={transaction.direction === "credit" ? "is-credit" : "is-debit"}>{transaction.direction === "credit" ? "+" : "−"}{formatEuro(transaction.amount)}</td></tr>)}</tbody></table></div>}
        </section>
    </div>;
}
function OrdersSection({ activeFilter, filteredOrders, onFilterChange, onOpenOrder, orderSummaries }: {
    activeFilter: OrderFilterId; filteredOrders: OrderSummary[]; onFilterChange: (filter: OrderFilterId) => void; onOpenOrder: (order: OrderSummary) => void; orderSummaries: OrderSummary[];
}) {
    const c = useAccountCopy();
    const ui = useAccountReferenceCopy();
    return <section className="pp-orders-section pp-account-panel">
        <div className="pp-order-filters" aria-label={c("按状态筛选订单")}>{orderFilters.map((filter) => <button key={filter.id} type="button" aria-pressed={filter.id === activeFilter} title={c(filter.description)} onClick={() => onFilterChange(filter.id)}><span>{c(filter.label)}</span><b>{orderSummaries.filter(filter.predicate).length}</b></button>)}</div>
        {filteredOrders.length ? <AccountOrderRows orders={filteredOrders} onOpenOrder={onOpenOrder}/> : <div className="pp-account-empty"><Package aria-hidden="true"/><strong>{c("当前筛选下没有订单。切换状态可查看其他记录。")}</strong><Link className="pp-inline-action" href="/catalogo">{ui.shop}<ArrowRight aria-hidden="true"/></Link></div>}
        <p className="pp-account-data-note">{ui.availableData} · {filteredOrders.length} / {orderSummaries.length}</p>
    </section>;
}
function AccountOrderRows({ orders, onOpenOrder, compact = false }: { orders: OrderSummary[]; onOpenOrder: (order: OrderSummary) => void; compact?: boolean }) {
    const c = useAccountCopy();
    const ui = useAccountReferenceCopy();
    return <div className="pp-account-table-scroll"><table className={cn("pp-account-orders-table", compact && "is-compact")}><thead><tr><th>{ui.order}</th><th>{ui.date}</th><th>{ui.quantity}</th><th>{ui.status}</th><th>{ui.amount}</th><th>{ui.action}</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td className="pp-order-identity-cell"><span className="pp-order-document"><FileText aria-hidden="true"/></span><span><strong>{order.id}</strong><small>{order.company}</small><span className="pp-order-mobile-meta">{order.date} · {order.items}{c("件")}</span></span></td><td className="pp-order-date-cell">{order.date}</td><td className="pp-order-quantity-cell">{order.items}{c("件")}</td><td className="pp-order-status-cell"><Badge className={cn("pp-account-status", orderBadgeClass(order.status))}><i aria-hidden="true"/>{c(orderStatusLabel(order.status))}</Badge></td><td className="pp-order-amount-cell">{formatEuro(order.total)}</td><td className="pp-order-action-cell"><button type="button" className="pp-inline-action" aria-label={`${ui.action} ${order.id}`} onClick={() => onOpenOrder(order)}><span>{ui.action}</span><ArrowRight aria-hidden="true"/></button></td></tr>)}</tbody></table></div>;
}
function ServiceSection({ orderSummaries, rmaRequests }: { orderSummaries: OrderSummary[]; rmaRequests: RmaRequest[] }) {
    const c = useAccountCopy();
    const ui = useAccountReferenceCopy();
    const [query, setQuery] = React.useState("");
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const selected = rmaRequests.find((request) => request.id === selectedId) ?? rmaRequests[0];
    const visibleRequests = rmaRequests.filter((request) => [request.rmaNo, request.id, request.productName, request.sku].join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
    const startableOrders = orderSummaries.filter(isRmaStartableOrder).slice(0, 6);
    return <div className="pp-account-service">
        <section className="pp-service-steps pp-account-panel"><strong>{ui.serviceSteps}</strong>{[{ icon: FileText, label: ui.stepOrder }, { icon: Package, label: ui.stepProduct }, { icon: Pencil, label: ui.stepProblem }].map(({ icon: Icon, label }, index) => <div key={label}><span><Icon aria-hidden="true"/></span><p><b>{index + 1}. {label}</b></p>{index < 2 && <ArrowRight aria-hidden="true"/>}</div>)}</section>
        <div className="pp-service-master-detail"><section className="pp-service-request-list pp-account-panel"><header className="pp-account-panel-header"><h2>{ui.myRequests}</h2><Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label={ui.searchRequests} placeholder={ui.searchRequests}/></header>
            {visibleRequests.length === 0 ? <div className="pp-account-empty"><Headphones aria-hidden="true"/><strong>{ui.noRequests}</strong></div> : visibleRequests.map((request) => <button key={request.id} type="button" className="pp-service-request-option" aria-pressed={selected?.id === request.id} onClick={() => setSelectedId(request.id)}><span className="pp-service-request-icon"><Package aria-hidden="true"/></span><span><strong>{request.rmaNo || request.id}</strong><b>{request.productName}</b><small>{ui.linkedOrder} · {request.orderNumber || request.orderId}</small><small>{request.createdAt}</small></span><Badge className={cn("pp-account-status", rmaBadgeClass(request.status))}>{c(rmaStatusLabel(request.status))}</Badge><ChevronRight aria-hidden="true"/></button>)}
        </section><section className="pp-service-detail pp-account-panel"><header className="pp-account-panel-header"><h2>{ui.requestDetails}</h2></header>{selected ? <><div className="pp-service-selected-heading"><div><h3>{selected.rmaNo || selected.id}</h3><p>{ui.linkedOrder} · {selected.orderNumber || selected.orderId}</p></div><Badge className={cn("pp-account-status", rmaBadgeClass(selected.status))}>{c(rmaStatusLabel(selected.status))}</Badge></div><div className="pp-service-selected-product"><span className="pp-service-request-icon"><Package aria-hidden="true"/></span><div><strong>{selected.productName}</strong><p>{selected.sku}</p></div></div><dl className="pp-service-facts"><div><dt>{ui.requestDate}</dt><dd>{selected.createdAt}</dd></div><div><dt>{ui.currentStage}</dt><dd>{c(rmaStatusLabel(selected.status))}</dd></div>{selected.quantity ? <div><dt>{ui.quantity}</dt><dd>{selected.quantity}</dd></div> : null}</dl><div className="pp-account-info-banner"><ShieldCheck aria-hidden="true"/><p>{c("先选择订单，再选择商品和问题类型，避免手填订单号或 SKU。")}</p></div><Link className="pp-inline-action" href={`/rma?requestId=${encodeURIComponent(selected.id)}`}>{ui.openRequest}<ArrowRight aria-hidden="true"/></Link></> : <div className="pp-account-empty"><Headphones aria-hidden="true"/><strong>{ui.chooseRequest}</strong><Link className="pp-inline-action" href="/rma">{c("新建售后")}<ArrowRight aria-hidden="true"/></Link></div>}</section></div>
        <section className="pp-service-eligible pp-account-panel"><header className="pp-account-panel-header"><h2>{c("从最近订单直接发起")}</h2></header>{startableOrders.length ? <div className="pp-service-order-links">{startableOrders.map((order) => <Link key={order.id} href={`/rma?order=${encodeURIComponent(order.id)}`}><FileText aria-hidden="true"/><span><strong>{order.id}</strong><small>{order.date} · {formatEuro(order.total)}</small></span><ArrowRight aria-hidden="true"/></Link>)}</div> : <p>{c("暂无已发货或已完成的订单可申请售后。")}</p>}</section>
        <div className="pp-account-info-banner"><CircleHelp aria-hidden="true"/><p>{ui.noDocuments}</p><Link className="pp-inline-action" href="/help">{ui.help}<ArrowRight aria-hidden="true"/></Link></div>
    </div>;
}
function AccountSummaryPanel({ company, isEmployeeAccount, onOpenProfile, onOpenOrder, onSectionChange, orderSummaries, profile, rmaRequests, userEmail, wallet }: {
    company: CompanyProfile | null; isEmployeeAccount: boolean; onOpenProfile: () => void; onOpenOrder: (order: OrderSummary) => void; onSectionChange: (section: AccountSectionId, filter?: OrderFilterId) => void; orderSummaries: OrderSummary[]; profile: AccountCustomerProfile | null; rmaRequests: RmaRequest[]; userEmail?: string; wallet: CustomerWallet;
}) {
    const c = useAccountCopy();
    const ui = useAccountReferenceCopy();
    const level = normalizeCustomerTier(profile?.level ?? company?.level ?? company?.priceList);
    const baseLevel = normalizeCustomerTier(profile?.baseLevel ?? company?.baseLevel ?? level);
    const displayName = company?.name || profile?.companyName || (isEmployeeAccount ? c("员工自购资料待创建") : c("客户档案正在关联"));
    const complete = Boolean(profile?.profileCompletedAt || company?.profileCompletedAt);
    const pendingCount = orderSummaries.filter((order) => order.status === "pending_payment").length;
    const openCount = orderSummaries.filter((order) => !isTerminalOrderStatus(order.status)).length;
    const shippedCount = orderSummaries.filter((order) => order.status === "shipped").length;
    const rmaCount = rmaRequests.filter((request) => !["rejected", "replaced", "refunded", "closed"].includes(request.status)).length;
    const primaryAddress = company?.shippingAddress || profile?.shippingAddress || company?.billingAddress || profile?.billingAddress;
    const stats = [
        { label: ui.pendingPayment, count: pendingCount, icon: FileText, section: "orders" as const, filter: "pending_payment" as const },
        { label: ui.openOrders, count: openCount, icon: Settings2, section: "orders" as const, filter: "open" as const },
        { label: ui.shipped, count: shippedCount, icon: Truck, section: "orders" as const, filter: "shipped" as const },
        { label: ui.afterSales, count: rmaCount, icon: Headphones, section: "service" as const, filter: undefined },
    ];
    return <div className="pp-account-overview">
        <div className="pp-overview-top-grid"><section className="pp-overview-company pp-account-panel"><div className="pp-overview-company-heading"><span className="pp-account-company-avatar"><Building2 aria-hidden="true"/></span><div><h2>{displayName}</h2><p><Mail aria-hidden="true"/>{userEmail || profile?.email || company?.email || "—"}</p></div><Badge className={cn("pp-profile-completeness", complete ? "is-complete" : "is-incomplete")}>{complete && <CheckCircle2 aria-hidden="true"/>}{complete ? ui.complete : ui.incomplete}</Badge><button className="pp-inline-action" type="button" onClick={onOpenProfile}>{ui.manageCompany}<ArrowRight aria-hidden="true"/></button></div><dl className="pp-overview-company-levels"><div><dt>{c("价格类型")}</dt><dd>{(profile?.customerType ?? company?.customerType) === "wholesale" ? c("批发价") : c("零售价")}</dd></div><div><dt>{ui.effectiveLevel}</dt><dd>{c(customerLevelLabel(level))}</dd></div><div><dt>{ui.baseLevel}</dt><dd>{c(customerLevelLabel(baseLevel))}</dd></div></dl><p className="pp-account-rule-note">{c("价格类型与会员等级独立")} · {c(customerPromoHelper(profile, company) ?? `普通商品每件最多减 ${formatTierDiscount(level)}；REMAX/保护膜除外`)}</p></section>
        <section className="pp-wallet-hero pp-overview-wallet"><WalletCards className="pp-wallet-watermark" aria-hidden="true"/><span><WalletCards aria-hidden="true"/>{ui.balance}</span><strong>{formatEuro(wallet.balance)}</strong><p>{ui.walletUse}</p><button type="button" onClick={() => onSectionChange("wallet")}>{ui.movements}<ArrowRight aria-hidden="true"/></button></section></div>
        <div className="pp-overview-stats">{stats.map(({ label, count, icon: Icon, section, filter }) => <button key={label} type="button" onClick={() => onSectionChange(section, filter)}><span><Icon aria-hidden="true"/></span><div><small>{label}</small><strong>{count}</strong></div><ChevronRight aria-hidden="true"/></button>)}</div><p className="pp-account-data-note">{ui.availableData}</p>
        <div className="pp-overview-middle-grid"><section className="pp-overview-recent pp-account-panel"><header className="pp-account-panel-header"><h2>{ui.recentOrders}</h2><button className="pp-inline-action" type="button" onClick={() => onSectionChange("orders", "all")}>{ui.seeAll}<ArrowRight aria-hidden="true"/></button></header>{orderSummaries.length ? <AccountOrderRows orders={orderSummaries.slice(0, 3)} compact onOpenOrder={onOpenOrder}/> : <div className="pp-account-empty"><Package aria-hidden="true"/><strong>{ui.noRecentOrders}</strong><Link className="pp-inline-action" href="/catalogo">{ui.shop}<ArrowRight aria-hidden="true"/></Link></div>}</section>
        <section className="pp-overview-attention pp-account-panel"><header className="pp-account-panel-header"><h2>{ui.attention}</h2></header><button type="button" onClick={() => onSectionChange("orders", "pending_payment")}><span className="pp-attention-dot is-warning"/><span><strong>{pendingCount} · {ui.pendingPayment}</strong><small>{ui.ordersDescription}</small></span><ArrowRight aria-hidden="true"/></button><button type="button" onClick={() => onSectionChange("service")}><span className="pp-attention-dot"/><span><strong>{rmaCount} · {ui.afterSales}</strong><small>{ui.serviceDescription}</small></span><ArrowRight aria-hidden="true"/></button><Link href="/help"><CircleHelp aria-hidden="true"/><span><strong>{ui.help}</strong><small>{c("这些资料用于账户、订单、税务和配送。")}</small></span><ArrowRight aria-hidden="true"/></Link></section></div>
        <section className="pp-overview-address pp-account-panel"><span><MapPin aria-hidden="true"/></span><div><h2>{ui.address}</h2><p>{primaryAddress || ui.noAddress}</p></div><button className="pp-inline-action" type="button" onClick={onOpenProfile}>{ui.manageAddress}<ArrowRight aria-hidden="true"/></button></section>
        <p className="pp-account-rule-note pp-overview-tier-note">{c("有效等级为基础等级与有效促销中较高者。售后退款不额外扣回升级累计，钱包再次购买按订单规则累计。")}</p>
    </div>;
}
function AccountProfileSummaryDialog({ company, profile, userEmail, open, onOpenChange, onEdit }: { company: CompanyProfile | null; profile: AccountCustomerProfile | null; userEmail?: string; open: boolean; onOpenChange: (open: boolean) => void; onEdit: () => void }) {
    const c = useAccountCopy();
    const ui = useAccountReferenceCopy();
    const level = normalizeCustomerTier(profile?.level ?? company?.level ?? company?.priceList);
    const rows = [
        [c("客户名称"), company?.name || profile?.companyName || "—"], [c("微信号码 / WhatsApp 号码"), profile?.contactName || company?.contactName || "—"], [c("邮箱"), userEmail || profile?.email || company?.email || "—"], [c("电话"), profile?.phone || company?.phone || "—"], [c("税号"), profile?.fiscalCode || company?.codiceFiscale || "—"], ["PEC", profile?.pec || company?.pec || "—"],
    ];
    const shipping = profile?.shippingAddress || company?.shippingAddress || "";
    const billing = profile?.billingAddress || company?.billingAddress || "";
    return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent scrollLayout="body" className="pp-storefront-portal pp-account-dialog pp-profile-summary-dialog"><DialogHeader><DialogTitle>{ui.companyAddress}</DialogTitle><DialogDescription>{ui.profileDescription}</DialogDescription></DialogHeader><DialogBody><div className="pp-profile-summary-grid"><section className="pp-account-panel"><header className="pp-account-panel-header"><h2><Building2 aria-hidden="true"/>{ui.companyInfo}</h2></header><div className="pp-profile-facts">{rows.map(([label, value]) => <Info key={label} label={label} value={value}/>)}</div><p className="pp-account-rule-note">{ui.emailLocked}</p></section><section className="pp-account-panel"><header className="pp-account-panel-header"><h2><ShieldCheck aria-hidden="true"/>{ui.accountIdentity}</h2></header><dl className="pp-profile-identity"><div><dt>{c("价格类型")}</dt><dd>{(profile?.customerType ?? company?.customerType) === "wholesale" ? c("批发价") : c("零售价")}</dd></div><div><dt>{ui.baseLevel}</dt><dd>{c(customerLevelLabel(profile?.baseLevel ?? company?.baseLevel ?? level))}</dd></div><div><dt>{ui.effectiveLevel}</dt><dd>{c(customerLevelLabel(level))}</dd></div><div><dt>{c("资料")}</dt><dd>{company ? c(companyStatusLabel(company.status)) : profile?.profileCompletedAt ? ui.complete : ui.incomplete}</dd></div></dl></section><section className="pp-account-panel"><header className="pp-account-panel-header"><h2><MapPin aria-hidden="true"/>{ui.address}</h2></header><p className="pp-profile-address-text">{shipping || ui.noAddress}</p></section><section className="pp-account-panel"><header className="pp-account-panel-header"><h2><FileText aria-hidden="true"/>{ui.billingAddress}</h2>{billing && billing === shipping ? <Badge>{ui.sameAddress}</Badge> : null}</header><p className="pp-profile-address-text">{billing || ui.noAddress}</p></section></div></DialogBody><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{c("取消")}</Button><Button type="button" onClick={() => { onOpenChange(false); window.requestAnimationFrame(onEdit); }}><Pencil aria-hidden="true"/>{ui.editProfile}</Button></DialogFooter></DialogContent></Dialog>;
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
    const ui = useAccountReferenceCopy();
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
            <nav className="pp-profile-editor-nav" aria-label={ui.editProfile}><button type="button" onClick={() => document.getElementById("account-company-fields")?.scrollIntoView({ block: "start" })}>{ui.profileCompany}</button><button type="button" onClick={() => document.getElementById("account-delivery-fields")?.scrollIntoView({ block: "start" })}>{ui.profileDelivery}</button></nav>
            <section id="account-company-fields" className="pp-profile-editor-section"><h3><Building2 aria-hidden="true"/>{ui.companyInfo}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <ProfileInput field="companyName" label={c("客户名称")} required value={form.companyName} onChange={updateField}/>
              <ProfileInput field="contactName" label={c("微信号码 / WhatsApp 号码")} value={form.contactName} onChange={updateField}/>
              <ProfileInput field="email" label={c("邮箱")} disabled required type="email" value={form.email} onChange={updateField}/>
              <ProfileInput field="phone" label={c("电话")} required value={form.phone} onChange={updateField}/>
              <ProfileInput field="fiscalCode" label={c("税号")} required value={form.fiscalCode} onChange={updateField}/>
              <ProfileInput field="pec" label="PEC" type="email" value={form.pec} onChange={updateField}/>
            </div>
            <p className="pp-account-rule-note">{ui.emailLocked}</p></section>
            <section id="account-delivery-fields" className="pp-profile-editor-section space-y-3">
              <AddressFields title={c("配送地址")} addressKey="shippingAddress" value={form.shippingAddress} onChange={updateAddressField}/>
              <label className="pp-profile-same-address flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                <Checkbox className="mt-0.5" checked={form.billingSameAsShipping} onCheckedChange={(checked) => updateBillingSameAsShipping(Boolean(checked))}/>
                <span>{c("账单地址跟配送地址一样")}</span>
              </label>
              {!form.billingSameAsShipping ? (<AddressFields title={c("账单地址")} addressKey="billingAddress" value={form.billingAddress} onChange={updateAddressField}/>) : null}
            </section>

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
      <h3 className="pp-address-fields-title"><MapPin aria-hidden="true"/>{title}</h3>
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
