"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  CreditCard,
  FileText,
  Loader2,
  MapPin,
  RefreshCcw,
  Send,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
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
import { Textarea } from "@/components/ui/textarea";
import {
  orderStatusLabel,
  tx,
  txFormat,
  type StorefrontTranslator,
} from "@/i18n/dictionaries/storefront";
import { formatMoney } from "@/i18n/format";
import {
  clearAssistedCompanyId,
  hrefWithAssistedCompanyId,
  rememberAssistedCompanyId,
  replaceCurrentUrlAssistedCompanyId,
} from "@/lib/partspro-assisted-order";
import { type CompanyProfile, type PartProduct } from "@/lib/partspro-data";
import type { StoreHeaderAccountAccess } from "@/lib/partspro-header-access";
import { type AccountCustomerProfile } from "@/lib/partspro-repository";
import { publicStockLevelMeta } from "@/lib/partspro-stock-availability";
import { cn } from "@/lib/utils";
import {
  CartCatalogProvider,
  serializeCartItems,
  type CartLine,
  type CartTotals,
  useCart,
} from "./cart-state";
import { useI18n, useT } from "./i18n-provider";
import { OrderSummaryCard } from "./order-summary-card";
import { StoreHeader } from "./store-header";
import { StorefrontProductImage } from "./storefront-product-image";

export type CheckoutRuntimeView = {
  canSubmit: boolean;
  description: string;
  disabledReason?: string;
  mode: "ready" | "needs-login" | "needs-profile" | "error";
  title: string;
  userEmail?: string;
};

type CheckoutClientProps = {
  catalogProducts: readonly PartProduct[];
  companies?: readonly CompanyProfile[];
  company: CompanyProfile | null;
  customerProfile: AccountCustomerProfile | null;
  delegatedCheckout?: boolean;
  initialAccountAccess?: StoreHeaderAccountAccess;
  initialSelectedCompanyId?: string | null;
  runtime: CheckoutRuntimeView;
};

type CheckoutFormState = {
  deliveryWindow: string;
  notes: string;
  paymentMethod: "bank_transfer" | "cash" | "agreed_terms";
};

type SubmitState =
  | { status: "idle"; message?: string }
  | { status: "loading"; message: string }
  | { status: "success"; message: string; order: OrderResult }
  | { status: "error"; message: string };

type MoneyDto = {
  amount: string;
  cents: number;
  currency: "EUR";
};

type OrderResult = {
  id: string;
  orderNo?: string;
  status: string;
  totals: {
    subtotal: MoneyDto;
    shipping: MoneyDto;
    vat: MoneyDto;
    total: MoneyDto;
  };
  lines: Array<{
    sku: string;
    quantity: number;
    lineGross: MoneyDto;
  }>;
};

type PreviewIssue = {
  code?: string;
  message: string;
  missingFields?: string[];
  moq?: number;
  sku: string;
  stock?: number;
};

type CartCatalogRejection = {
  reason?: string;
  sku: string;
};

type PendingItemsReason = "account" | "customer" | "customer-context";

type PreviewState =
  | { status: "idle"; canSubmit?: boolean; issues: PreviewIssue[] }
  | { status: "loading"; canSubmit?: boolean; issues: PreviewIssue[] }
  | { status: "ready"; canSubmit?: boolean; issues: PreviewIssue[] }
  | { status: "error"; canSubmit?: boolean; issues: PreviewIssue[]; message: string };

type Blocker = {
  actionHref?: string;
  actionLabel?: string;
  message: string;
  title: string;
  tone: "warning" | "error" | "neutral";
};

const fixedShippingMethod = "GLS/BRT 24-48h";
const idlePreviewState: PreviewState = { status: "idle", issues: [] };
const previewDebounceMs = 180;
const orderSubmitTimeoutMs = 25_000;

export function CheckoutClient(props: CheckoutClientProps) {
  const initialScope =
    props.delegatedCheckout ? "" : props.company?.id ?? "";
  const [catalogState, setCatalogState] = React.useState<{
    products: readonly PartProduct[];
    scope: string;
  }>(() => ({
    products: props.delegatedCheckout ? [] : props.catalogProducts,
    scope: initialScope,
  }));
  const handleCatalogScopeChange = React.useCallback(
    (scope: string) => {
      setCatalogState((current) =>
        current.scope === scope
          ? current
          : {
              products:
                !props.delegatedCheckout && scope === initialScope
                  ? props.catalogProducts
                  : [],
              scope,
            }
      );
    },
    [initialScope, props.catalogProducts, props.delegatedCheckout]
  );
  const handleCatalogProductsLoaded = React.useCallback(
    (products: readonly PartProduct[]) => {
      setCatalogState((current) => ({
        ...current,
        products: mergeCatalogProducts(current.products, products),
      }));
    },
    []
  );

  return (
    <CartCatalogProvider products={catalogState.products}>
      <CheckoutClientContent
        {...props}
        catalogProducts={catalogState.products}
        onCatalogProductsLoaded={handleCatalogProductsLoaded}
        onCatalogScopeChange={handleCatalogScopeChange}
      />
    </CartCatalogProvider>
  );
}

function CheckoutClientContent({
  catalogProducts,
  companies = [],
  company,
  customerProfile,
  delegatedCheckout = false,
  initialAccountAccess,
  initialSelectedCompanyId = null,
  onCatalogProductsLoaded,
  onCatalogScopeChange,
  runtime,
}: CheckoutClientProps & {
  onCatalogProductsLoaded: (products: readonly PartProduct[]) => void;
  onCatalogScopeChange: (scope: string) => void;
}) {
  const t = useT();
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  const initialDelegatedCompanyId =
    delegatedCheckout &&
    initialSelectedCompanyId &&
    companies.some((item) => item.id === initialSelectedCompanyId)
      ? initialSelectedCompanyId
      : "";
  const [selectedCompanyId, setSelectedCompanyId] = React.useState(
    delegatedCheckout ? initialDelegatedCompanyId : company?.id ?? ""
  );
  const selectedCompany =
    delegatedCheckout
      ? companies.find((item) => item.id === selectedCompanyId) ?? null
      : company;
  const selectedCustomerProfile = delegatedCheckout
    ? customerProfileFromCompany(selectedCompany)
    : customerProfile;
  const selectedShippingAddress = selectedCustomerProfile?.shippingAddress.trim() ?? "";
  const targetCustomerBlocker = customerOrderBlocker(
    t,
    selectedCompany,
    selectedCustomerProfile,
    delegatedCheckout
  );
  const cart = useCart({ preserveUnknown: true });
  const [form, setForm] = React.useState<CheckoutFormState>(() =>
    initialFormState()
  );
  const [catalogLoadState, setCatalogLoadState] = React.useState<"idle" | "loading" | "ready" | "error">("idle");
  const [catalogRejections, setCatalogRejections] = React.useState<Record<string, CartCatalogRejection>>({});
  const requestedCatalogKeys = React.useRef(new Set<string>());
  const [confirmed, setConfirmed] = React.useState(false);
  const [submitAttempted, setSubmitAttempted] = React.useState(false);
  const [submitState, setSubmitState] = React.useState<SubmitState>({ status: "idle" });
  const [successDialogOpen, setSuccessDialogOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<PreviewState>({
    status: "idle",
    issues: [],
  });
  const cartSignature = React.useMemo(
    () => serializeCartItems(cart.items),
    [cart.items]
  );
  const catalogSkuSet = React.useMemo(
    () => new Set(catalogProducts.map((product) => product.sku)),
    [catalogProducts]
  );
  const catalogRejectionBySku = React.useMemo(
    () => new Map(Object.values(catalogRejections).map((rejection) => [rejection.sku, rejection])),
    [catalogRejections]
  );
  const selectedCatalogScope = selectedCompany?.id ?? "";
  const canResolveCartCatalog = Boolean(selectedCompany?.id && !targetCustomerBlocker);
  const needsCustomerSelection = delegatedCheckout && !selectedCompany;
  const basePendingItemsReason: PendingItemsReason | null =
    needsCustomerSelection
      ? "customer"
      : cart.isHydrated && cart.items.length > 0 && !canResolveCartCatalog
        ? "customer-context"
        : null;
  const customerContextPendingSkuSet = React.useMemo(() => {
    const blockedSkus = new Set<string>();

    for (const item of cart.items) {
      if (isCustomerContextCatalogRejection(catalogRejectionBySku.get(item.sku)?.reason)) {
        blockedSkus.add(item.sku);
      }
    }

    return blockedSkus;
  }, [cart.items, catalogRejectionBySku]);
  const pendingItemsReason: PendingItemsReason | null =
    basePendingItemsReason ??
    (customerContextPendingSkuSet.size > 0 ? "customer-context" : null);
  const pendingCustomerItems = basePendingItemsReason
    ? cart.items
    : cart.items.filter((item) => customerContextPendingSkuSet.has(item.sku));
  const checkoutContextCompanyId = delegatedCheckout
    ? selectedCompany?.id ?? initialDelegatedCompanyId
    : null;
  const checkoutHref = hrefWithAssistedCompanyId("/checkout", checkoutContextCompanyId);
  const cartHref = hrefWithAssistedCompanyId("/carrello", checkoutContextCompanyId);
  const catalogHref = hrefWithAssistedCompanyId("/catalogo", checkoutContextCompanyId);
  const loginHref = loginHrefForNext(checkoutHref);
  const summaryNote = needsCustomerSelection
    ? tx(t, "storefront.checkout.summary.needsCustomer", "选择客户后计算客户价、库存和 MOQ。")
    : tx(t, "storefront.checkout.summary.note", "Prezzi IVA inclusa; viene aggiunta solo la spedizione.");
  const shouldLoadPreview =
    cart.isHydrated && cart.items.length > 0 && Boolean(selectedCompany?.id) && !targetCustomerBlocker;
  const previewForUi = shouldLoadPreview ? preview : idlePreviewState;
  const unresolvedSkus = React.useMemo(() => {
    const resolvedSkus = new Set(cart.lines.map((line) => line.sku));

    return cart.items
      .map((item) => item.sku)
      .filter((sku) => !resolvedSkus.has(sku) && !customerContextPendingSkuSet.has(sku));
  }, [cart.items, cart.lines, customerContextPendingSkuSet]);
  const unresolvedCatalogSkus = React.useMemo(
    () =>
      cart.items
        .map((item) => item.sku)
        .filter((sku) => !catalogSkuSet.has(sku) && !catalogRejectionBySku.has(sku)),
    [cart.items, catalogRejectionBySku, catalogSkuSet]
  );
  const reviewUnresolvedSkus =
    needsCustomerSelection || !canResolveCartCatalog ? [] : unresolvedSkus;
  const catalogResolutionPending =
    canResolveCartCatalog &&
    cart.isHydrated &&
    cart.items.length > 0 &&
    unresolvedCatalogSkus.length > 0 &&
    (catalogLoadState === "idle" || catalogLoadState === "loading");
  const lineIssues = React.useMemo(
    () => previewForUi.issues.filter((issue) => issue.sku !== "customer"),
    [previewForUi.issues]
  );
  const customerIssues = React.useMemo(
    () => previewForUi.issues.filter((issue) => issue.sku === "customer"),
    [previewForUi.issues]
  );
  const formErrors = validateForm(t, confirmed, selectedShippingAddress);
  const blockers = buildCheckoutBlockers({
    cartHref,
    catalogHref,
    catalogLoadState,
    cart,
    company: selectedCompany,
    customerIssues,
    delegatedCheckout,
    formErrors,
    isCatalogLoading: catalogResolutionPending,
    lineIssues,
    loginHref,
    needsCustomerSelection,
    pendingCustomerItems,
    pendingItemsReason,
    preview: previewForUi,
    runtime,
    submitAttempted,
    targetCustomerBlocker,
    unresolvedSkus: reviewUnresolvedSkus,
    t,
  });
  const disabledReason = blockers[0]?.message;
  const canSubmit =
    blockers.length === 0 &&
    submitState.status !== "loading" &&
    submitState.status !== "success";

  function handleSelectedCompanyIdChange(value: string) {
    const nextCompany = companies.find((item) => item.id === value) ?? null;

    setSelectedCompanyId(value);
    setForm(initialFormState());
    setConfirmed(false);
    setPreview(idlePreviewState);
    setSubmitState({ status: "idle" });
    setSuccessDialogOpen(false);
    setCatalogLoadState("idle");
    setCatalogRejections({});
    rememberAssistedCompanyId(nextCompany?.id ?? null);
    replaceCurrentUrlAssistedCompanyId(nextCompany?.id ?? null);
  }

  React.useEffect(() => {
    onCatalogScopeChange(selectedCatalogScope);
    requestedCatalogKeys.current.clear();
  }, [onCatalogScopeChange, selectedCatalogScope]);

  React.useEffect(() => {
    rememberAssistedCompanyId(checkoutContextCompanyId || null);
  }, [checkoutContextCompanyId]);

  React.useEffect(() => {
    if (!cart.isHydrated || cart.items.length === 0 || !selectedCompany?.id || targetCustomerBlocker) {
      return;
    }

    const missingSkus = cart.items
      .map((item) => item.sku)
      .filter((sku) => !catalogSkuSet.has(sku) && !catalogRejectionBySku.has(sku));
    const requestKey = `${selectedCompany.id}:${missingSkus.join(",")}`;

    if (missingSkus.length === 0) {
      return;
    }

    const requestedKeys = requestedCatalogKeys.current;

    if (requestedKeys.has(requestKey)) {
      return;
    }

    const controller = new AbortController();
    let completed = false;
    requestedKeys.add(requestKey);

    async function loadCartCatalogProducts() {
      setCatalogLoadState("loading");

      try {
        const params = new URLSearchParams({
          companyId: selectedCompany?.id ?? "",
          skus: missingSkus.join(","),
        });
        const response = await fetch(`/api/cart/catalog?${params.toString()}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to load cart catalog products");
        }

        const payload = (await response.json()) as {
          data?: PartProduct[];
          meta?: { rejected?: CartCatalogRejection[] };
        };
        const products = Array.isArray(payload.data) ? payload.data : [];
        const rejections = Array.isArray(payload.meta?.rejected)
          ? payload.meta.rejected.filter((rejection) => rejection?.sku)
          : [];

        completed = true;
        onCatalogProductsLoaded(products);
        setCatalogRejections((current) => {
          const next = { ...current };

          for (const sku of missingSkus) {
            delete next[sku];
          }

          for (const rejection of rejections) {
            next[rejection.sku] = {
              reason: rejection.reason,
              sku: rejection.sku,
            };
          }

          return next;
        });
        setCatalogLoadState("ready");
      } catch {
        if (!controller.signal.aborted) {
          requestedKeys.delete(requestKey);
          setCatalogLoadState("error");
        }
      }
    }

    void loadCartCatalogProducts();

    return () => {
      controller.abort();
      if (!completed) {
        requestedKeys.delete(requestKey);
      }
    };
  }, [
    cart.isHydrated,
    cart.items,
    cartSignature,
    catalogRejectionBySku,
    catalogSkuSet,
    onCatalogProductsLoaded,
    selectedCompany?.id,
    targetCustomerBlocker,
  ]);

  React.useEffect(() => {
    if (!shouldLoadPreview) {
      return;
    }

    const controller = new AbortController();
    const previewCompanyId = selectedCompany?.id;
    const previewItems = cart.items;

    async function loadPreview() {
      setPreview((current) => ({
        status: "loading",
        canSubmit: current.canSubmit,
        issues: current.status === "ready" || current.status === "loading"
          ? current.issues
          : [],
      }));

      try {
        const response = await fetch("/api/orders/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: previewCompanyId,
            items: previewItems,
          }),
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as {
          data?: { canSubmit?: boolean; issues?: PreviewIssue[] };
          error?: { code?: string; message?: string };
        } | null;

        if (!response.ok) {
          throw new Error(friendlyCheckoutError(t, payload?.error?.code, payload?.error?.message));
        }

        if (!controller.signal.aborted) {
          setPreview({
            status: "ready",
            canSubmit: Boolean(payload?.data?.canSubmit),
            issues: Array.isArray(payload?.data?.issues) ? payload.data.issues : [],
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setPreview({
            status: "error",
            issues: [],
            message:
              error instanceof Error
                ? error.message
                : tx(t, "storefront.checkout.preview.error", "Impossibile aggiornare i controlli ordine."),
          });
        }
      }
    }

    const timeout = window.setTimeout(() => {
      void loadPreview();
    }, previewDebounceMs);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [cart.items, cartSignature, selectedCompany?.id, shouldLoadPreview, t]);

  async function submitOrder() {
    setSubmitAttempted(true);

    if (Object.keys(formErrors).length > 0) {
      setSubmitState({
        status: "error",
        message: tx(t, "storefront.checkout.formInvalid", "Completa indirizzo e conferme prima di inviare l'ordine."),
      });
      return;
    }

    if (!canSubmit) {
      setSubmitState({
        status: "error",
        message:
          disabledReason ??
          tx(t, "storefront.checkout.submit.defaultDisabled", "Checkout non disponibile in questo momento."),
      });
      return;
    }

    setSubmitState({
      status: "loading",
      message: tx(t, "storefront.checkout.submit.sending", "Creazione ordine in corso..."),
    });

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, orderSubmitTimeoutMs);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          companyId: selectedCompany?.id,
          paymentMethod: form.paymentMethod,
          deliveryAddress: selectedShippingAddress,
          notes: buildOrderNotes(form.notes, form.deliveryWindow),
          items: cart.items,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: OrderResult;
        error?: { code?: string; message?: string };
      } | null;

      if (!response.ok) {
        throw new Error(friendlyCheckoutError(t, payload?.error?.code, payload?.error?.message));
      }

      if (!payload?.data?.id || !payload.data.totals?.total) {
        throw new Error(tx(t, "storefront.checkout.submit.orderIncomplete", "Risposta ordine incompleta."));
      }

      const orderReference = payload.data.orderNo ?? payload.data.id;

      setSubmitState({
        status: "success",
        message: txFormat(t, "storefront.checkout.submit.orderAccepted", "Ordine {id} creato correttamente.", {
          id: orderReference,
        }),
        order: payload.data,
      });
      setSuccessDialogOpen(true);
      cart.clearCart();
      clearAssistedCompanyId();
      replaceCurrentUrlAssistedCompanyId(null);
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      const timeoutMessage =
        isAbortError(error)
          ? tx(t, "storefront.checkout.submit.timeout", "Invio ordine scaduto. Controlla la connessione e riprova.")
          : null;

      setSubmitState({
        status: "error",
        message:
          timeoutMessage ??
          (error instanceof Error
            ? error.message
            : tx(t, "storefront.checkout.submit.sendError", "Errore durante l'invio.")),
      });
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  return (
    <>
      <StoreHeader
        assistedCompanyId={checkoutContextCompanyId || null}
        initialAccountAccess={initialAccountAccess}
      />
      <main className="min-h-screen overflow-x-hidden bg-[#f4f6fa] text-slate-950">
        <div className="mx-auto grid max-w-[1460px] gap-3 px-2 pt-2 pb-[calc(5.75rem_+_env(safe-area-inset-bottom))] sm:px-4 sm:pt-3 lg:grid-cols-[minmax(0,1fr)_330px] lg:pb-6">
          <section className="space-y-2.5">
          <CheckoutHeader cartHref={cartHref} runtime={runtime} company={selectedCompany} />
          {delegatedCheckout ? (
            <DelegatedCustomerSelector
              companies={companies}
              selectedCompanyId={selectedCompanyId}
              onSelectedCompanyIdChange={handleSelectedCompanyIdChange}
            />
          ) : null}
          <GlobalBlockers blockers={blockers} />
          <OrderLinesReview
            cartHref={cartHref}
            catalogLoadState={catalogLoadState}
            catalogResolutionPending={catalogResolutionPending}
            lineIssues={lineIssues}
            lines={cart.lines}
            pendingCustomerItems={pendingCustomerItems}
            pendingItemsReason={pendingItemsReason}
            unresolvedSkus={reviewUnresolvedSkus}
          />
          <CompanyReview
            company={selectedCompany}
            profile={selectedCustomerProfile}
            runtime={runtime}
          />
          <DeliverySection
            form={form}
            errors={formErrors}
            shippingAddress={selectedShippingAddress}
            submitAttempted={submitAttempted}
            onChange={setForm}
          />
          <PaymentSection form={form} onChange={setForm} />
          <ConfirmationSection
            confirmed={confirmed}
            errors={formErrors}
            submitAttempted={submitAttempted}
            onChange={setConfirmed}
          />
        </section>

        <aside className="hidden lg:block">
          <div className="space-y-2.5 lg:sticky lg:top-28">
            <OrderSummaryCard
              totals={cart.totals}
              continueHref={catalogHref}
              lineCount={cart.items.length}
              showContinueAction={false}
              showCheckoutAction={false}
              sticky={false}
              summaryNote={summaryNote}
            />
            <CheckoutSubmitPanel
              canSubmit={canSubmit}
              disabledReason={disabledReason}
              onSubmit={submitOrder}
              state={submitState}
            />
          </div>
        </aside>
      </div>

      <CheckoutMobileBar
        canSubmit={canSubmit}
        disabledReason={disabledReason}
        onSubmit={submitOrder}
        state={submitState}
        totals={cart.totals}
        lineCount={cart.items.length}
      />
      <CheckoutSuccessDialog
        open={successDialogOpen}
        state={submitState}
        onOpenChange={setSuccessDialogOpen}
      />
      </main>
    </>
  );
}

function CheckoutHeader({
  cartHref,
  company,
  runtime,
}: {
  cartHref: string;
  company: CompanyProfile | null;
  runtime: CheckoutRuntimeView;
}) {
  const t = useT();

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-3">
        <Button asChild variant="outline" size="icon" className="size-9 shrink-0 bg-white" title={tx(t, "storefront.checkout.backToCart", "Torna al carrello")}>
          <Link href={cartHref} aria-label={tx(t, "storefront.checkout.backToCart", "Torna al carrello")}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            <Badge className="border border-primary/20 bg-primary/8 text-primary">
              {tx(t, "storefront.checkout.badge", "Checkout clienti")}
            </Badge>
            <StatusChip ok={runtime.mode === "ready"} label={runtime.title} />
            {company && (
              <StatusChip
                ok={company.status === "approved"}
                label={company.name}
              />
            )}
          </div>
          <h1 className="text-xl font-black tracking-normal sm:text-2xl">
            {tx(t, "storefront.checkout.title", "Conferma ordine e dati fiscali")}
          </h1>
          <p className="mt-1 max-w-full break-words text-xs font-semibold leading-5 text-slate-500">
            {tx(t, "storefront.checkout.description", "Controlla cliente, articoli, spedizione e pagamento prima dell'invio.")}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <Badge
      className={cn(
        "border",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-800"
      )}
    >
      {ok ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
      {label}
    </Badge>
  );
}

function GlobalBlockers({ blockers }: { blockers: Blocker[] }) {
  if (blockers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {blockers.map((blocker) => (
        <BlockerAlert key={`${blocker.title}-${blocker.message}`} blocker={blocker} />
      ))}
    </div>
  );
}

function BlockerAlert({ blocker }: { blocker: Blocker }) {
  const Icon = blocker.tone === "neutral" ? Loader2 : AlertTriangle;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 text-sm sm:flex-row sm:items-start sm:justify-between",
        blocker.tone === "error" && "border-red-200 bg-red-50 text-red-800",
        blocker.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-950",
        blocker.tone === "neutral" && "border-slate-200 bg-white text-slate-700"
      )}
    >
      <div className="flex min-w-0 gap-3">
        <Icon className={cn("mt-0.5 size-5 shrink-0", blocker.tone === "neutral" && "animate-spin")} />
        <div className="min-w-0">
          <div className="font-black">{blocker.title}</div>
          <p className="mt-1 break-words leading-6">{blocker.message}</p>
        </div>
      </div>
      {blocker.actionHref && blocker.actionLabel && (
        <Button asChild variant="outline" size="sm" className="shrink-0 bg-white">
          <Link href={blocker.actionHref}>{blocker.actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}

function DelegatedCustomerSelector({
  companies,
  onSelectedCompanyIdChange,
  selectedCompanyId,
}: {
  companies: readonly CompanyProfile[];
  onSelectedCompanyIdChange: (value: string) => void;
  selectedCompanyId: string;
}) {
  const t = useT();
  const selectedCompany = companies.find((company) => company.id === selectedCompanyId);

  return (
    <Card size="sm" className="rounded-lg border-blue-200 bg-blue-50/70">
      <CardContent className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(260px,420px)] sm:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-black text-blue-950">
            <ShieldCheck className="size-4 text-blue-700" />
            {tx(t, "storefront.checkout.delegated.title", "Ordine per conto cliente")}
          </div>
          <p className="mt-1 text-xs font-semibold leading-5 text-blue-800">
            {tx(t, "storefront.checkout.delegated.description", "Scegli il cliente: prezzi, controlli e ordine useranno il suo livello e profilo.")}
          </p>
        </div>
        <div className="min-w-0">
          <Label htmlFor="delegated-customer" className="sr-only">
            {tx(t, "storefront.checkout.delegated.select", "Seleziona cliente")}
          </Label>
          <Select value={selectedCompanyId} onValueChange={onSelectedCompanyIdChange}>
            <SelectTrigger id="delegated-customer" className="h-10 bg-white">
              <SelectValue placeholder={tx(t, "storefront.checkout.delegated.placeholder", "Seleziona cliente")} />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name} · {customerTypeLabel(t, company.customerType)} · {assignmentStatusLabel(t, company.assignmentStatus)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedCompany ? (
            <div className="mt-1 truncate text-xs font-semibold text-blue-800">
              {customerLevelLabel(t, selectedCompany.priceList)} · {companyStatusLabel(t, selectedCompany.status)}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function OrderLinesReview({
  cartHref,
  catalogLoadState,
  catalogResolutionPending,
  lineIssues,
  lines,
  pendingCustomerItems,
  pendingItemsReason,
  unresolvedSkus,
}: {
  cartHref: string;
  catalogLoadState: "idle" | "loading" | "ready" | "error";
  catalogResolutionPending: boolean;
  lineIssues: PreviewIssue[];
  lines: CartLine[];
  pendingCustomerItems: Array<{ quantity: number; sku: string }>;
  pendingItemsReason: PendingItemsReason | null;
  unresolvedSkus: string[];
}) {
  const t = useT();
  const issuesBySku = React.useMemo(() => {
    const issues = new Map<string, PreviewIssue[]>();

    for (const issue of lineIssues) {
      const current = issues.get(issue.sku) ?? [];
      current.push(issue);
      issues.set(issue.sku, current);
    }

    return issues;
  }, [lineIssues]);

  return (
    <Card size="sm" className="rounded-lg border-slate-200 bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingBag className="size-5 text-primary" />
          {tx(t, "storefront.checkout.section.items", "Dettaglio articoli")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {lines.length === 0 && unresolvedSkus.length === 0 && pendingCustomerItems.length === 0 && (
          <p className="text-sm font-semibold leading-6 text-slate-500">
            {tx(t, "storefront.cart.emptyDescription", "Aggiungi prodotti dal catalogo per preparare il checkout.")}
          </p>
        )}
        {pendingCustomerItems.map((item) => (
          <div key={item.sku} className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0 font-mono font-black">{item.sku}</div>
              <Badge variant="outline" className="shrink-0 border-blue-200 bg-white text-blue-800">
                x{item.quantity}
              </Badge>
            </div>
            <p className="mt-1 font-semibold leading-6">
              {pendingItemsReason === "account"
                ? tx(t, "storefront.checkout.itemPendingAccount", "Accedi o collega un cliente per calcolare prezzo, scorte e MOQ.")
                : tx(t, "storefront.checkout.itemPendingCustomerContext", "选择或完善客户资料后再计算价格、库存和 MOQ。")}
            </p>
          </div>
        ))}
        {catalogLoadState === "error" && unresolvedSkus.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold leading-6 text-red-800">
            {tx(t, "storefront.checkout.catalogLoadError", "客户价目表加载失败，请刷新后重试。")}
          </div>
        )}
        {catalogResolutionPending && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600">
            {tx(t, "storefront.checkout.loadingTargetPrices", "Caricamento prezzi cliente per gli articoli del carrello.")}
          </div>
        )}
        {lines.length > 0 && (
          <div className="hidden grid-cols-[56px_minmax(220px,1fr)_70px_110px_110px] gap-3 rounded-md bg-slate-50 px-3 py-2 text-[11px] font-black uppercase tracking-normal text-slate-500 sm:grid">
            <span />
            <span>{tx(t, "storefront.checkout.itemColumn.product", "Prodotto")}</span>
            <span className="text-right">{tx(t, "storefront.checkout.quantity", "Quantita")}</span>
            <span className="text-right">{tx(t, "storefront.checkout.unitPriceTaxIncluded", "Prezzo IVA incl.")}</span>
            <span className="text-right">{tx(t, "storefront.common.total", "Totale")}</span>
          </div>
        )}
        {lines.map((line) => (
          <OrderLineRow
            key={line.sku}
            issues={issuesBySku.get(line.sku) ?? []}
            line={line}
          />
        ))}
        {!catalogResolutionPending && catalogLoadState !== "error" && unresolvedSkus.map((sku) => (
          <div key={sku} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <div className="font-mono font-black">{sku}</div>
            <p className="mt-1 font-semibold leading-6">
              {tx(t, "storefront.checkout.itemUnavailable", "Questa riga non e piu disponibile per il checkout.")}
            </p>
          </div>
        ))}
        {(lineIssues.length > 0 || unresolvedSkus.length > 0) &&
          pendingCustomerItems.length === 0 &&
          catalogLoadState !== "error" && (
          <Button asChild variant="outline" className="bg-white">
            <Link href={cartHref}>
              <RefreshCcw className="size-4" />
              {tx(t, "storefront.checkout.fixCart", "Torna al carrello per correggere")}
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function OrderLineRow({ issues, line }: { issues: PreviewIssue[]; line: CartLine }) {
  const t = useT();
  const { locale } = useI18n();
  const stockMeta = publicStockLevelMeta(t, line.product);

  return (
    <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-2.5 rounded-lg border border-slate-200 p-2.5 sm:grid-cols-[56px_minmax(220px,1fr)_70px_110px_110px] sm:items-center">
      <StorefrontProductImage
        product={line.product}
        sizes="56px"
        quality={55}
        className="size-12 rounded-md border border-slate-100 bg-slate-50 sm:size-14"
        fallbackClassName="shrink-0"
        imageClassName="object-contain p-1.5"
      />
      <div className="min-w-0">
        <div className="line-clamp-1 font-black leading-5">{line.product.name}</div>
        <div className="mt-1 font-mono text-xs text-slate-500">{line.sku}</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Badge variant="outline">{line.product.grade}</Badge>
          <Badge variant="outline">
            {txFormat(t, "storefront.checkout.moq", "MOQ {count}", { count: line.product.moq })}
          </Badge>
          <Badge className={stockMeta.className}>
            {stockMeta.label}
          </Badge>
        </div>
        {issues.length > 0 && (
          <div className="mt-2 space-y-1">
            {issues.map((issue) => (
              <div key={`${issue.code}-${issue.message}`} className="text-xs font-bold leading-5 text-red-700">
                {formatPreviewIssue(t, issue)}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="col-span-2 text-sm sm:col-span-1 sm:text-right">
        <div>
          <div className="text-[11px] font-semibold text-slate-500 sm:hidden">
            {tx(t, "storefront.checkout.quantity", "Quantita")}
          </div>
          <div className="font-black">{line.quantity}</div>
        </div>
      </div>
      <div className="hidden text-right text-sm sm:block">
        <div className="font-black">{formatMoney(line.product.price, locale)}</div>
      </div>
      <div className="col-span-2 grid grid-cols-2 gap-2 text-sm sm:col-span-1 sm:block sm:text-right">
        <div className="sm:hidden">
          <div className="text-[11px] font-semibold text-slate-500">
            {tx(t, "storefront.checkout.unitPriceTaxIncluded", "Prezzo IVA incl.")}
          </div>
          <div className="font-black">{formatMoney(line.product.price, locale)}</div>
        </div>
        <div>
          <div className="text-[11px] font-semibold text-slate-500 sm:hidden">
            {tx(t, "storefront.common.total", "Totale")}
          </div>
          <div className="font-black">{formatMoney(line.lineTotal, locale)}</div>
        </div>
      </div>
    </div>
  );
}

function CompanyReview({
  company,
  profile,
  runtime,
}: {
  company: CompanyProfile | null;
  profile: AccountCustomerProfile | null;
  runtime: CheckoutRuntimeView;
}) {
  const t = useT();
  const missing = missingProfileLabels(t, profile);

  return (
    <Card size="sm" className="rounded-lg border-slate-200 bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-5 text-primary" />
          {tx(t, "storefront.checkout.section.customer", "Cliente e fatturazione")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <div className="font-black">
                {runtime.mode === "ready"
                  ? tx(t, "storefront.checkout.accountVerified", "Account verificato")
                  : runtime.title}
              </div>
              <p className="mt-1 leading-6">{runtime.description}</p>
              {runtime.userEmail && (
                <div className="mt-1 break-words text-xs font-bold">{runtime.userEmail}</div>
              )}
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ReadonlyInfo icon={Building2} label={tx(t, "storefront.checkout.field.companyName", "Ragione sociale")} value={profile?.companyName || company?.name} />
          <ReadonlyInfo icon={FileText} label={tx(t, "storefront.account.field.contactName", "Referente")} value={profile?.contactName} />
          <ReadonlyInfo icon={FileText} label={tx(t, "storefront.professional.field.email", "Email")} value={profile?.email} />
          <ReadonlyInfo icon={FileText} label={tx(t, "storefront.checkout.field.partitaIva", "Partita IVA")} value={profile?.vatNumber || company?.partitaIva} />
          <ReadonlyInfo icon={FileText} label={tx(t, "storefront.checkout.field.codiceFiscale", "Codice fiscale")} value={profile?.fiscalCode || company?.codiceFiscale} />
          <ReadonlyInfo icon={FileText} label="PEC / SDI" value={[profile?.pec || company?.pec, profile?.sdi || company?.codiceDestinatario].filter(Boolean).join(" / ")} />
          <ReadonlyInfo icon={MapPin} label={tx(t, "storefront.checkout.billingAddress", "Indirizzo fatturazione")} value={profile?.billingAddress} wide />
          <ReadonlyInfo icon={MapPin} label={tx(t, "storefront.checkout.savedShippingAddress", "Indirizzo spedizione salvato")} value={profile?.shippingAddress} wide />
        </div>
        {missing.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <div className="font-black">
              {tx(t, "storefront.checkout.profileMissing", "Dati cliente da completare")}
            </div>
            <p className="mt-1 leading-6">{missing.join(", ")}</p>
            <Button asChild variant="outline" size="sm" className="mt-3 bg-white">
              <Link href="/account?setup=1">
                {tx(t, "storefront.checkout.completeProfile", "Completa profilo")}
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReadonlyInfo({
  icon: Icon,
  label,
  value,
  wide = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
  wide?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border border-slate-200 bg-slate-50 p-3", wide && "sm:col-span-2")}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-normal text-slate-500">
        <Icon className="size-4 text-primary" />
        {label}
      </div>
      <div className="mt-2 break-words text-sm font-black text-slate-950">
        {value || "-"}
      </div>
    </div>
  );
}

function DeliverySection({
  errors,
  form,
  onChange,
  shippingAddress,
  submitAttempted,
}: {
  errors: Record<string, string>;
  form: CheckoutFormState;
  onChange: React.Dispatch<React.SetStateAction<CheckoutFormState>>;
  shippingAddress: string;
  submitAttempted: boolean;
}) {
  const t = useT();

  return (
    <Card size="sm" className="rounded-lg border-slate-200 bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="size-5 text-primary" />
          {tx(t, "storefront.checkout.group.delivery", "Consegna")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,300px)]">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-sm font-black">
            <Truck className="size-4 text-primary" />
            {fixedShippingMethod}
          </div>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            {tx(t, "storefront.checkout.shippingFixed", "Metodo logistico gestito dal magazzino PartsPro. Puoi indicare fascia oraria o note di consegna.")}
          </p>
        </div>
        <div
          className={cn(
            "rounded-lg border p-3 text-sm",
            shippingAddress
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : "border-amber-200 bg-amber-50 text-amber-950"
          )}
        >
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="font-black">
                {tx(t, "storefront.checkout.savedShippingAddress", "Indirizzo spedizione salvato")}
              </div>
              <p className="mt-1 break-words text-xs font-semibold leading-5">
                {shippingAddress || tx(t, "storefront.checkout.deliveryAddressMissing", "Completa l'indirizzo di spedizione nel profilo cliente.")}
              </p>
              {submitAttempted && errors.deliveryAddress ? (
                <div className="mt-1 text-xs font-bold text-red-600">{errors.deliveryAddress}</div>
              ) : null}
            </div>
          </div>
        </div>
        <TextField
          id="deliveryWindow"
          label={tx(t, "storefront.checkout.field.deliveryWindow", "Fascia consegna preferita")}
          value={form.deliveryWindow}
          wrapperClassName="sm:col-span-2"
          onChange={(value) => onChange((current) => ({ ...current, deliveryWindow: value }))}
        />
      </CardContent>
    </Card>
  );
}

function TextField({
  error,
  id,
  label,
  onChange,
  value,
  wrapperClassName,
}: {
  error?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
  wrapperClassName?: string;
}) {
  return (
    <div className={cn("space-y-2", wrapperClassName)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {error && <div className="text-xs font-bold text-red-600">{error}</div>}
    </div>
  );
}

function PaymentSection({
  form,
  onChange,
}: {
  form: CheckoutFormState;
  onChange: React.Dispatch<React.SetStateAction<CheckoutFormState>>;
}) {
  const t = useT();
  const options = [
    {
      value: "bank_transfer" as const,
      label: tx(t, "storefront.checkout.option.bankTransfer.label", "Bonifico bancario"),
      description: tx(t, "storefront.checkout.option.bankTransfer.description", "Crea ordine in attesa di pagamento."),
    },
    {
      value: "cash" as const,
      label: tx(t, "storefront.checkout.option.cash.label", "Contanti"),
      description: tx(t, "storefront.checkout.option.cash.description", "Ordine in attesa di incasso in sede."),
    },
    {
      value: "agreed_terms" as const,
      label: tx(t, "storefront.checkout.option.agreedTerms.label", "Pagamento concordato"),
      description: tx(t, "storefront.checkout.option.agreedTerms.description", "Solo per clienti con termini approvati."),
    },
  ];

  return (
    <Card size="sm" className="rounded-lg border-slate-200 bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="size-5 text-primary" />
          {tx(t, "storefront.checkout.group.payment", "Pagamento")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {options.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex min-h-24 cursor-pointer gap-3 rounded-lg border p-3 text-sm transition",
                form.paymentMethod === option.value
                  ? "border-primary/50 bg-primary/8"
                  : "border-slate-200 bg-white hover:border-primary/30"
              )}
            >
              <input
                className="mt-1 size-4 accent-primary"
                type="radio"
                name="paymentMethod"
                value={option.value}
                checked={form.paymentMethod === option.value}
                onChange={() =>
                  onChange((current) => ({ ...current, paymentMethod: option.value }))
                }
              />
              <span className="min-w-0">
                <span className="block font-black">{option.label}</span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
        </div>
        <div className="grid gap-3">
          <div className="space-y-2">
            <Label htmlFor="notes">{tx(t, "storefront.checkout.field.notes", "Note ordine")}</Label>
            <Textarea
              id="notes"
              value={form.notes}
              className="min-h-20"
              maxLength={500}
              onChange={(event) =>
                onChange((current) => ({ ...current, notes: event.currentTarget.value }))
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfirmationSection({
  confirmed,
  errors,
  onChange,
  submitAttempted,
}: {
  confirmed: boolean;
  errors: Record<string, string>;
  onChange: React.Dispatch<React.SetStateAction<boolean>>;
  submitAttempted: boolean;
}) {
  const t = useT();

  return (
    <Card size="sm" className="rounded-lg border-slate-200 bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="size-5 text-primary" />
          {tx(t, "storefront.checkout.confirmTitle", "Conferme prima dell'invio")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ConfirmLine
          checked={confirmed}
          error={submitAttempted ? errors.confirmed : undefined}
          id="confirmCheckout"
          label={tx(t, "storefront.checkout.confirm.single", "Confermo dati fiscali, indirizzo di spedizione, prezzi IVA inclusa, disponibilita e MOQ mostrati nel checkout.")}
          onChange={onChange}
        />
      </CardContent>
    </Card>
  );
}

function ConfirmLine({
  checked,
  error,
  id,
  label,
  onChange,
}: {
  checked: boolean;
  error?: string;
  id: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex gap-3 rounded-lg border bg-white p-4 text-sm font-semibold leading-6 text-slate-700",
        error ? "border-red-300" : "border-slate-200"
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        className="mt-1 size-4 shrink-0 accent-primary"
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span className="min-w-0">
        {label}
        {error && <span className="mt-1 block text-xs font-bold text-red-600">{error}</span>}
      </span>
    </label>
  );
}

function CheckoutSubmitPanel({
  canSubmit,
  disabledReason,
  onSubmit,
  state,
}: {
  canSubmit: boolean;
  disabledReason?: string;
  onSubmit: () => void;
  state: SubmitState;
}) {
  const t = useT();

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
      <Button
        type="button"
        className="h-11 w-full min-w-0 gap-2"
        disabled={!canSubmit || state.status === "loading" || state.status === "success"}
        onClick={onSubmit}
      >
        {state.status === "loading" ? (
          <Loader2 className="size-4 shrink-0 animate-spin" />
        ) : state.status === "success" ? (
          <CheckCircle2 className="size-4 shrink-0" />
        ) : (
          <Send className="size-4 shrink-0" />
        )}
        <span className="min-w-0 truncate">
          {submitButtonLabel(t, state, canSubmit)}
        </span>
      </Button>
      {!canSubmit && disabledReason && state.status !== "success" && (
        <StatusMessage tone="warning" message={disabledReason} />
      )}
      {state.status === "error" && <StatusMessage tone="error" message={state.message} />}
      {state.status === "loading" && <StatusMessage tone="neutral" message={state.message} />}
      {state.status === "success" && <OrderSuccess order={state.order} message={state.message} />}
    </div>
  );
}

function StatusMessage({
  message,
  tone,
}: {
  message: string;
  tone: "warning" | "error" | "neutral";
}) {
  return (
    <div
      className={cn(
        "flex gap-2 rounded-lg border p-3 text-xs font-semibold leading-5",
        tone === "error" && "border-red-200 bg-red-50 text-red-700",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-900",
        tone === "neutral" && "border-slate-200 bg-white text-slate-500"
      )}
    >
      {tone === "neutral" ? (
        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
      ) : (
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      )}
      <span className="min-w-0 break-words">{message}</span>
    </div>
  );
}

function OrderSuccess({ message, order }: { message: string; order: OrderResult }) {
  const t = useT();
  const { locale } = useI18n();
  const totalQuantity = order.lines.reduce((total, line) => total + line.quantity, 0);
  const orderReference = order.orderNo ?? order.id;

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
      <div className="flex gap-2">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <div className="font-black">{message}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-emerald-800">
            <span className="font-mono">{orderReference}</span>
            <span>{orderStatusLabel(t, order.status)}</span>
            <span>
              {txFormat(t, "storefront.cart.itemCountMany", "{count} pezzi", {
                count: totalQuantity,
              })}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-emerald-200 bg-white/70 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-bold">{tx(t, "storefront.checkout.success.total", "Totale ordine")}</span>
          <span className="text-lg font-black">{formatMoneyDto(order.totals.total, locale)}</span>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button asChild className="bg-emerald-700 hover:bg-emerald-700">
          <Link href="/account">{tx(t, "storefront.checkout.success.openOrders", "Vai agli ordini")}</Link>
        </Button>
        <Button asChild variant="outline" className="border-emerald-200 bg-white/70 text-emerald-800">
          <Link href="/catalogo">{tx(t, "storefront.common.continueShopping", "Continua acquisti")}</Link>
        </Button>
      </div>
    </div>
  );
}

function CheckoutSuccessDialog({
  onOpenChange,
  open,
  state,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  state: SubmitState;
}) {
  const t = useT();
  const { locale } = useI18n();

  if (state.status !== "success") {
    return null;
  }

  const order = state.order;
  const totalQuantity = order.lines.reduce((total, line) => total + line.quantity, 0);
  const orderReference = order.orderNo ?? order.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="bg-emerald-50 px-4 pt-5 pb-4 text-emerald-950 sm:px-5">
          <DialogHeader className="pr-9">
            <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-emerald-600 text-white">
              <CheckCircle2 className="size-6" />
            </div>
            <DialogTitle className="text-xl font-black leading-tight text-emerald-950">
              {tx(t, "storefront.checkout.success.dialogTitle", "Ordine creato correttamente")}
            </DialogTitle>
            <DialogDescription className="text-sm font-semibold leading-6 text-emerald-800">
              {tx(t, "storefront.checkout.success.dialogDescription", "Abbiamo registrato l'ordine. Puoi seguirlo dal tuo account.")}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-3 bg-white px-4 py-4 sm:px-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-bold uppercase tracking-normal text-slate-500">
              {tx(t, "storefront.checkout.success.orderNumber", "Numero ordine")}
            </div>
            <div className="mt-1 break-all font-mono text-base font-black text-slate-950">
              {orderReference}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-sm">
            <SuccessMetric
              label={tx(t, "storefront.common.status", "Stato")}
              value={orderStatusLabel(t, order.status)}
            />
            <SuccessMetric
              label={tx(t, "storefront.cart.rows", "Articoli")}
              value={String(totalQuantity)}
            />
            <SuccessMetric
              label={tx(t, "storefront.common.total", "Totale")}
              value={formatMoneyDto(order.totals.total, locale)}
            />
          </div>
        </div>

        <div className="grid gap-2 bg-slate-50 p-3 sm:grid-cols-3">
          <DialogClose asChild>
            <Button variant="outline" className="sm:order-first">
              {tx(t, "storefront.common.close", "Chiudi")}
            </Button>
          </DialogClose>
          <Button asChild variant="outline" className="sm:col-span-1">
            <Link href="/catalogo">{tx(t, "storefront.common.continueShopping", "Continua acquisti")}</Link>
          </Button>
          <Button asChild className="bg-emerald-700 hover:bg-emerald-700 sm:col-span-1">
            <Link href="/account">{tx(t, "storefront.checkout.success.openOrders", "Vai agli ordini")}</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SuccessMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
      <div className="truncate text-[11px] font-bold uppercase tracking-normal text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-black text-slate-950">{value}</div>
    </div>
  );
}

function CheckoutMobileBar({
  canSubmit,
  disabledReason,
  lineCount,
  onSubmit,
  state,
  totals,
}: {
  canSubmit: boolean;
  disabledReason?: string;
  lineCount: number;
  onSubmit: () => void;
  state: SubmitState;
  totals: CartTotals;
}) {
  const t = useT();
  const { locale } = useI18n();
  const [expanded, setExpanded] = React.useState(false);
  const summaryId = React.useId();

  if (state.status === "success") {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-18px_40px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden">
      {expanded && (
        <div id={summaryId} className="space-y-2 border-b border-slate-200 px-3 py-2">
          <CompactSummaryLine label={tx(t, "storefront.cart.rows", "Articoli")} value={String(lineCount)} />
          <CompactSummaryLine label={tx(t, "storefront.common.subtotal", "Subtotale")} value={formatMoney(totals.subtotal, locale)} />
          <CompactSummaryLine
            label={tx(t, "storefront.common.shipping", "Spedizione")}
            value={totals.shipping === 0 ? tx(t, "storefront.common.free", "Gratis") : formatMoney(totals.shipping, locale)}
          />
          {disabledReason && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-semibold leading-5 text-amber-900">
              {disabledReason}
            </div>
          )}
        </div>
      )}
      <div className="mx-auto flex max-w-[1300px] items-center justify-between gap-2 px-3 pt-2 pb-[calc(0.625rem_+_env(safe-area-inset-bottom))]">
        <button
          type="button"
          className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-controls={summaryId}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          <div className="truncate text-[10px] font-bold uppercase tracking-normal text-slate-500">
            {tx(t, "storefront.common.total", "Totale")}
          </div>
          <div className="flex min-w-0 items-center gap-1 text-lg font-black" aria-live="polite">
            <span className="truncate">{formatMoney(totals.total, locale)}</span>
            {expanded ? (
              <ChevronDown className="size-4 shrink-0 text-slate-500" />
            ) : (
              <ChevronUp className="size-4 shrink-0 text-slate-500" />
            )}
          </div>
        </button>
        <Button
          type="button"
          className="h-10 min-w-[138px] max-w-[48vw] gap-2 px-3"
          disabled={!canSubmit || state.status === "loading"}
          onClick={onSubmit}
        >
          {state.status === "loading" ? (
            <Loader2 className="size-4 shrink-0 animate-spin" />
          ) : (
            <Send className="size-4 shrink-0" />
          )}
          <span className="min-w-0 truncate">
            {submitButtonLabel(t, state, canSubmit)}
          </span>
        </Button>
      </div>
    </div>
  );
}

function CompactSummaryLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 text-xs">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="font-bold text-slate-800">{value}</span>
    </div>
  );
}

function buildCheckoutBlockers({
  cart,
  cartHref,
  catalogHref,
  catalogLoadState,
  company,
  customerIssues,
  delegatedCheckout,
  formErrors,
  isCatalogLoading,
  lineIssues,
  loginHref,
  needsCustomerSelection,
  pendingCustomerItems,
  pendingItemsReason,
  preview,
  runtime,
  submitAttempted,
  targetCustomerBlocker,
  unresolvedSkus,
  t,
}: {
  cart: ReturnType<typeof useCart>;
  cartHref: string;
  catalogHref: string;
  catalogLoadState: "idle" | "loading" | "ready" | "error";
  company: CompanyProfile | null;
  customerIssues: PreviewIssue[];
  delegatedCheckout: boolean;
  formErrors: Record<string, string>;
  isCatalogLoading: boolean;
  lineIssues: PreviewIssue[];
  loginHref: string;
  needsCustomerSelection: boolean;
  pendingCustomerItems: Array<{ quantity: number; sku: string }>;
  pendingItemsReason: PendingItemsReason | null;
  preview: PreviewState;
  runtime: CheckoutRuntimeView;
  submitAttempted: boolean;
  targetCustomerBlocker: Blocker | null;
  unresolvedSkus: string[];
  t: StorefrontTranslator;
}) {
  const blockers: Blocker[] = [];

  if (runtime.mode === "needs-login") {
    blockers.push({
      actionHref: loginHref,
      actionLabel: tx(t, "storefront.login.action", "Accedi"),
      message: runtime.disabledReason ?? runtime.description,
      title: runtime.title,
      tone: "warning",
    });
  } else if (!runtime.canSubmit) {
    blockers.push({
      actionHref: runtime.mode === "needs-profile" ? "/account?setup=1" : undefined,
      actionLabel: runtime.mode === "needs-profile" ? tx(t, "storefront.checkout.completeProfile", "Completa profilo") : undefined,
      message: runtime.disabledReason ?? runtime.description,
      title: runtime.title,
      tone: runtime.mode === "error" ? "error" : "warning",
    });
  }

  if (!company) {
    blockers.push({
      message: delegatedCheckout
        ? tx(t, "storefront.checkout.delegated.missingDescription", "Seleziona il cliente per calcolare il suo listino e creare l'ordine.")
        : tx(t, "storefront.checkout.companyMissingDescription", "Nessun cliente e collegato alla sessione corrente."),
      title: delegatedCheckout
        ? tx(t, "storefront.checkout.delegated.missingTitle", "Cliente da selezionare")
        : tx(t, "storefront.checkout.companyMissingTitle", "Profilo cliente mancante"),
      tone: "warning",
    });
  }

  if (targetCustomerBlocker) {
    blockers.push(targetCustomerBlocker);
  }

  if (!cart.isHydrated) {
    blockers.push({
      message: tx(t, "storefront.checkout.submit.cartLoadingReason", "Caricamento carrello salvato nel browser..."),
      title: tx(t, "storefront.cart.loadingTitle", "Caricamento carrello"),
      tone: "neutral",
    });
  } else if (cart.items.length === 0) {
    blockers.push({
      actionHref: catalogHref,
      actionLabel: tx(t, "storefront.cart.goToCatalog", "Vai al catalogo"),
      message: tx(t, "storefront.checkout.submit.cartEmptyReason", "Il carrello e vuoto: aggiungi almeno un prodotto prima di confermare l'ordine."),
      title: tx(t, "storefront.cart.emptyTitle", "Carrello vuoto"),
      tone: "warning",
    });
  }

  if (catalogLoadState === "error" && unresolvedSkus.length > 0) {
    blockers.push({
      message: tx(t, "storefront.checkout.catalogLoadError", "客户价目表加载失败，请刷新后重试。"),
      title: tx(t, "storefront.checkout.preview.errorTitle", "Controllo ordine non riuscito"),
      tone: "error",
    });
  } else if (!needsCustomerSelection && unresolvedSkus.length > 0) {
    blockers.push({
      actionHref: cartHref,
      actionLabel: tx(t, "storefront.checkout.fixCart", "Torna al carrello per correggere"),
      message: isCatalogLoading
        ? tx(t, "storefront.checkout.loadingTargetPrices", "Caricamento prezzi cliente per gli articoli del carrello.")
        : `${tx(t, "storefront.checkout.unresolvedItems", "Alcune righe non sono piu disponibili.")} ${unresolvedSkus.join(", ")}`,
      title: isCatalogLoading
        ? tx(t, "storefront.checkout.loadingItemsTitle", "Caricamento articoli ordine")
        : tx(t, "storefront.cart.unresolvedTitle", "Prodotti del carrello non disponibili"),
      tone: isCatalogLoading ? "neutral" : "warning",
    });
  }

  if (!targetCustomerBlocker && pendingItemsReason === "customer-context" && pendingCustomerItems.length > 0) {
    blockers.push({
      message: txFormat(
        t,
        "storefront.checkout.customerContextPendingDescription",
        "Seleziona o completa il cliente per calcolare prezzo, scorte e MOQ prima dell'invio. SKU: {skus}.",
        { skus: pendingCustomerItems.map((item) => item.sku).join(", ") }
      ),
      title: tx(t, "storefront.checkout.customerContextPendingTitle", "Cliente da completare"),
      tone: "warning",
    });
  }

  if (preview.status === "loading") {
    blockers.push({
      message: tx(t, "storefront.checkout.preview.loading", "Controllo prezzi, scorte e MOQ in corso."),
      title: tx(t, "storefront.checkout.preview.title", "Controllo ordine"),
      tone: "neutral",
    });
  }

  if (preview.status === "error") {
    blockers.push({
      message: preview.message,
      title: tx(t, "storefront.checkout.preview.errorTitle", "Controllo ordine non riuscito"),
      tone: "error",
    });
  }

  if (customerIssues.length > 0) {
    blockers.push({
      message: customerIssues.map((issue) => formatPreviewIssue(t, issue)).join(" "),
      title: tx(t, "storefront.checkout.customerNotReady", "客户暂不能下单"),
      tone: "warning",
    });
  } else if (preview.status === "ready" && preview.canSubmit === false && cart.items.length > 0) {
    blockers.push({
      message: tx(t, "storefront.checkout.customerNotReadyDescription", "所选客户当前不满足下单条件，请检查客户状态、类型、归属和资料完整度。"),
      title: tx(t, "storefront.checkout.customerNotReady", "客户暂不能下单"),
      tone: "warning",
    });
  }

  if (lineIssues.length > 0) {
    blockers.push({
      actionHref: cartHref,
      actionLabel: tx(t, "storefront.checkout.fixCart", "Torna al carrello per correggere"),
      message: lineIssues.map((issue) => `${issue.sku}: ${formatPreviewIssue(t, issue)}`).join(" "),
      title: tx(t, "storefront.checkout.itemsNeedReview", "Articoli da rivedere"),
      tone: "warning",
    });
  }

  if (submitAttempted && Object.keys(formErrors).length > 0) {
    blockers.push({
      message: tx(t, "storefront.checkout.formInvalid", "Completa indirizzo e conferme prima di inviare l'ordine."),
      title: tx(t, "storefront.checkout.formInvalidTitle", "Dati checkout incompleti"),
      tone: "warning",
    });
  }

  return blockers;
}

function isCustomerContextCatalogRejection(reason?: string) {
  return (
    reason === "account_sync_failed" ||
    reason === "customer" ||
    reason === "customer_needs_assignment" ||
    reason === "customer_profile_required" ||
    reason === "customer_suspended" ||
    reason === "employee" ||
    reason === "login_required" ||
    reason === "wholesale_required"
  );
}

function validateForm(
  t: StorefrontTranslator,
  confirmed: boolean,
  shippingAddress: string
) {
  const required = tx(t, "storefront.checkout.required", "Campo obbligatorio.");
  const errors: Record<string, string> = {};

  if (!shippingAddress.trim()) {
    errors.deliveryAddress = required;
  }

  if (!confirmed) {
    errors.confirmed = required;
  }

  return errors;
}

function initialFormState(): CheckoutFormState {
  return {
    deliveryWindow: "",
    notes: "",
    paymentMethod: "bank_transfer",
  };
}

function customerProfileFromCompany(company: CompanyProfile | null): AccountCustomerProfile | null {
  if (!company) {
    return null;
  }

  return {
    assignmentStatus: company.assignmentStatus ?? "needs_review",
    billingAddress: company.billingAddress ?? "",
    companyName: company.name,
    contactName: company.contactName ?? "",
    customerType: company.customerType ?? "retail",
    email: company.email ?? "",
    fiscalCode: company.codiceFiscale ?? "",
    id: company.id,
    level: company.level ?? company.priceList,
    pec: company.pec ?? "",
    phone: company.phone ?? "",
    profileCompletedAt: company.profileCompletedAt ?? null,
    sdi: company.codiceDestinatario ?? "",
    shippingAddress: company.shippingAddress ?? "",
    status: company.status === "approved" ? "active" : company.status,
    vatNumber: company.partitaIva ?? "",
  };
}

function customerOrderBlocker(
  t: StorefrontTranslator,
  company: CompanyProfile | null,
  profile: AccountCustomerProfile | null,
  delegatedCheckout: boolean
): Blocker | null {
  if (!company) {
    return null;
  }

  const title = tx(t, "storefront.checkout.customerNotReady", "Cliente non pronto per l'ordine");

  if (company.status !== "approved") {
    return {
      title,
      message: tx(t, "storefront.checkout.customerBlocker.status", "Il cliente deve essere attivo prima di creare ordini."),
      tone: "warning",
    };
  }

  if (company.customerType !== "wholesale") {
    return {
      title,
      message: tx(t, "storefront.checkout.customerBlocker.type", "Il cliente deve essere wholesale per l'ordine assistito."),
      tone: "warning",
    };
  }

  if (company.assignmentStatus !== "assigned") {
    return {
      title,
      message: tx(t, "storefront.checkout.customerBlocker.assignment", "Il cliente deve essere assegnato a un listino prima dell'ordine."),
      tone: "warning",
    };
  }

  const missing = missingProfileLabels(t, profile);

  if (missing.length > 0) {
    return {
      actionHref: delegatedCheckout ? undefined : "/account?setup=1",
      actionLabel: delegatedCheckout ? undefined : tx(t, "storefront.checkout.completeProfile", "Completa profilo"),
      title,
      message: txFormat(
        t,
        "storefront.checkout.customerBlocker.profile",
        "Completa questi dati cliente prima dell'ordine: {fields}.",
        { fields: missing.join(tx(t, "storefront.common.listSeparator", ", ")) }
      ),
      tone: "warning",
    };
  }

  return null;
}

function missingProfileLabels(t: StorefrontTranslator, profile: AccountCustomerProfile | null) {
  if (!profile) {
    return [tx(t, "storefront.checkout.profileMissingAll", "Profilo cliente")];
  }

  const shared = [
    profile.companyName ? null : tx(t, "storefront.checkout.field.companyName", "Ragione sociale"),
    profile.contactName ? null : tx(t, "storefront.account.field.contactName", "Referente"),
    profile.email ? null : tx(t, "storefront.professional.field.email", "Email"),
    profile.phone ? null : tx(t, "storefront.account.field.phone", "Telefono"),
    profile.billingAddress ? null : tx(t, "storefront.checkout.billingAddress", "Indirizzo fatturazione"),
    profile.shippingAddress ? null : tx(t, "storefront.checkout.savedShippingAddress", "Indirizzo spedizione salvato"),
  ];
  const fiscal =
    profile.customerType === "retail"
      ? [
          profile.fiscalCode || profile.vatNumber
            ? null
            : tx(t, "storefront.checkout.field.codiceFiscale", "Codice fiscale"),
        ]
      : [
          profile.vatNumber ? null : tx(t, "storefront.checkout.field.partitaIva", "Partita IVA"),
          profile.fiscalCode ? null : tx(t, "storefront.checkout.field.codiceFiscale", "Codice fiscale"),
          profile.pec || profile.sdi ? null : "PEC / SDI",
        ];

  return [...shared, ...fiscal].filter((label): label is string => Boolean(label));
}

function formatPreviewIssue(t: StorefrontTranslator, issue: PreviewIssue) {
  switch (issue.code) {
    case "duplicate":
      return tx(t, "storefront.checkout.issue.duplicate", "SKU duplicato nel carrello.");
    case "moq":
      return txFormat(t, "storefront.checkout.issue.moq", "Quantità inferiore al MOQ {moq}.", {
        moq: issue.moq ?? "-",
      });
    case "out_of_stock":
      return tx(t, "storefront.checkout.issue.outOfStock", "Prodotto attualmente esaurito.");
    case "price_missing":
      return tx(t, "storefront.checkout.issue.priceMissing", "Prezzo effettivo non disponibile per questo SKU.");
    case "profile_incomplete": {
      const labels = (issue.missingFields ?? [])
        .map((field) => profileIssueFieldLabel(t, field))
        .filter(Boolean);

      return labels.length > 0
        ? txFormat(t, "storefront.checkout.issue.profileIncomplete", "Profilo cliente incompleto: {fields}.", {
            fields: labels.join(tx(t, "storefront.common.listSeparator", ", ")),
          })
        : tx(t, "storefront.checkout.customerNotReadyDescription", "Il cliente selezionato non soddisfa i requisiti ordine. Controlla stato, tipo, assegnazione e dati profilo.");
    }
    case "profile_missing":
      return tx(t, "storefront.checkout.issue.profileMissing", "Profilo cliente non disponibile.");
    case "stock_limit":
      return txFormat(t, "storefront.checkout.issue.stockLimit", "Disponibili solo {stock} pezzi.", {
        stock: issue.stock ?? "-",
      });
    case "unavailable":
      return tx(t, "storefront.checkout.issue.unavailable", "SKU non disponibile nel catalogo.");
    default:
      return issue.message || tx(t, "storefront.checkout.itemsNeedReview", "Articoli da rivedere");
  }
}

function profileIssueFieldLabel(t: StorefrontTranslator, field: string) {
  switch (field) {
    case "billing_address":
      return tx(t, "storefront.checkout.billingAddress", "Indirizzo fatturazione");
    case "company":
      return tx(t, "storefront.checkout.field.companyName", "Ragione sociale");
    case "contact":
      return tx(t, "storefront.account.field.contactName", "Referente");
    case "email":
      return tx(t, "storefront.professional.field.email", "Email");
    case "electronic_invoice":
      return tx(t, "storefront.checkout.field.electronicInvoice", "PEC / SDI");
    case "fiscal_code":
      return tx(t, "storefront.checkout.field.codiceFiscale", "Codice fiscale");
    case "phone":
      return tx(t, "storefront.account.field.phone", "Telefono");
    case "shipping_address":
      return tx(t, "storefront.checkout.savedShippingAddress", "Indirizzo spedizione salvato");
    case "vat_number":
      return tx(t, "storefront.checkout.field.partitaIva", "Partita IVA");
    default:
      return field;
  }
}

function customerTypeLabel(t: StorefrontTranslator, value: CompanyProfile["customerType"] | undefined) {
  if (value === "wholesale") {
    return tx(t, "storefront.customer.type.wholesale", "Wholesale");
  }

  return tx(t, "storefront.customer.type.retail", "Retail");
}

function assignmentStatusLabel(
  t: StorefrontTranslator,
  value: CompanyProfile["assignmentStatus"] | undefined
) {
  switch (value) {
    case "assigned":
      return tx(t, "storefront.customer.assignment.assigned", "Assegnato");
    case "archived":
      return tx(t, "storefront.customer.assignment.archived", "Archiviato");
    case "converted_to_employee":
      return tx(t, "storefront.customer.assignment.convertedToEmployee", "Convertito in staff");
    case "needs_review":
    default:
      return tx(t, "storefront.customer.assignment.needsReview", "Da revisionare");
  }
}

function companyStatusLabel(t: StorefrontTranslator, value: CompanyProfile["status"]) {
  switch (value) {
    case "approved":
      return tx(t, "storefront.customer.status.approved", "Approvato");
    case "rejected":
      return tx(t, "storefront.customer.status.rejected", "Respinto");
    case "suspended":
      return tx(t, "storefront.customer.status.suspended", "Sospeso");
    case "pending":
    default:
      return tx(t, "storefront.customer.status.pending", "In attesa");
  }
}

function customerLevelLabel(t: StorefrontTranslator, value: CompanyProfile["priceList"]) {
  return tx(t, `storefront.customer.level.${value}`, value);
}

function buildOrderNotes(customerNotes: string, deliveryWindow: string) {
  const details = [
    `Consegna: ${fixedShippingMethod}`,
    optionalText(deliveryWindow) ? `Fascia: ${deliveryWindow.trim()}` : undefined,
    optionalText(customerNotes) ? `Note: ${customerNotes.trim()}` : undefined,
  ].filter((value): value is string => Boolean(value));

  return details.join(" | ").slice(0, 500);
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function loginHrefForNext(nextHref: string) {
  return `/login?${new URLSearchParams({ next: nextHref }).toString()}`;
}

function mergeCatalogProducts(
  currentProducts: readonly PartProduct[],
  incomingProducts: readonly PartProduct[]
) {
  const productsBySku = new Map<string, PartProduct>();

  for (const product of currentProducts) {
    productsBySku.set(product.sku, product);
  }

  for (const product of incomingProducts) {
    productsBySku.set(product.sku, product);
  }

  return Array.from(productsBySku.values());
}

function submitButtonLabel(
  t: StorefrontTranslator,
  state: SubmitState,
  canSubmit: boolean
) {
  if (state.status === "success") {
    return tx(t, "storefront.checkout.submit.button.success", "Ordine inviato");
  }

  if (state.status === "loading") {
    return tx(t, "storefront.checkout.submit.button.loading", "Invio ordine...");
  }

  if (!canSubmit) {
    return tx(t, "storefront.checkout.submit.button.blocked", "无法提交");
  }

  return tx(t, "storefront.checkout.submit.button.idle", "Conferma ordine");
}

function friendlyCheckoutError(
  t: StorefrontTranslator,
  code?: string,
  message?: string
) {
  switch (code) {
    case "ORDER_PRICE_CHANGED":
      return tx(t, "storefront.checkout.error.priceChanged", "Alcuni prezzi sono cambiati. Aggiorna il checkout e riprova.");
    case "ORDER_STOCK_INVALID":
    case "ORDER_ITEMS_INVALID":
      return tx(t, "storefront.checkout.error.stockInvalid", "Una o piu righe non rispettano scorte, quantita o MOQ.");
    case "ORDER_SKU_UNAVAILABLE":
      return tx(t, "storefront.checkout.error.skuUnavailable", "Uno o piu articoli non sono piu disponibili.");
    case "ORDER_CUSTOMER_NOT_READY":
    case "CUSTOMER_PROFILE_INCOMPLETE":
      return tx(t, "storefront.checkout.error.customerNotReady", "Il profilo cliente deve essere completato prima dell'ordine.");
    case "PRICE_ACCESS_REQUIRED":
      return tx(t, "storefront.checkout.error.priceAccess", "Il listino cliente non e ancora abilitato.");
    case "LOGIN_REQUIRED":
      return tx(t, "storefront.checkout.error.loginRequired", "Accedi prima di confermare l'ordine.");
    default:
      return message ?? tx(t, "storefront.checkout.submit.sendError", "Errore durante l'invio.");
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function formatMoneyDto(value: MoneyDto, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: value.currency,
  }).format(Number(value.amount));
}
