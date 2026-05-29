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
import { type CompanyProfile, type PartProduct } from "@/lib/partspro-data";
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
  runtime: CheckoutRuntimeView;
};

type CheckoutFormState = {
  deliveryWindow: string;
  notes: string;
  paymentMethod: "bank_transfer" | "card" | "agreed_terms";
  purchaseOrderNumber: string;
  shippingCity: string;
  shippingProvince: string;
  shippingStreet: string;
  shippingZip: string;
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
  sku: string;
};

type PreviewState =
  | { status: "idle"; issues: PreviewIssue[] }
  | { status: "loading"; issues: PreviewIssue[] }
  | { status: "ready"; issues: PreviewIssue[] }
  | { status: "error"; issues: PreviewIssue[]; message: string };

type Blocker = {
  actionHref?: string;
  actionLabel?: string;
  message: string;
  title: string;
  tone: "warning" | "error" | "neutral";
};

const fixedShippingMethod = "GLS/BRT 24-48h";
const idlePreviewState: PreviewState = { status: "idle", issues: [] };

export function CheckoutClient(props: CheckoutClientProps) {
  const initialScope = props.company?.id ?? "";
  const [catalogState, setCatalogState] = React.useState<{
    products: readonly PartProduct[];
    scope: string;
  }>(() => ({
    products: props.catalogProducts,
    scope: initialScope,
  }));
  const handleCatalogScopeChange = React.useCallback(
    (scope: string) => {
      setCatalogState((current) =>
        current.scope === scope
          ? current
          : {
              products: scope === initialScope ? props.catalogProducts : [],
              scope,
            }
      );
    },
    [initialScope, props.catalogProducts]
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
      <StoreHeader />
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
  onCatalogProductsLoaded,
  onCatalogScopeChange,
  runtime,
}: CheckoutClientProps & {
  onCatalogProductsLoaded: (products: readonly PartProduct[]) => void;
  onCatalogScopeChange: (scope: string) => void;
}) {
  const t = useT();
  const router = useRouter();
  const [selectedCompanyId, setSelectedCompanyId] = React.useState(company?.id ?? "");
  const selectedCompany =
    delegatedCheckout
      ? companies.find((item) => item.id === selectedCompanyId) ?? null
      : company;
  const cart = useCart({ preserveUnknown: true });
  const [form, setForm] = React.useState<CheckoutFormState>(() =>
    initialFormState(customerProfile, selectedCompany)
  );
  const [catalogLoadState, setCatalogLoadState] = React.useState<"idle" | "loading" | "ready" | "error">("idle");
  const requestedCatalogKeys = React.useRef(new Set<string>());
  const [confirmations, setConfirmations] = React.useState({
    fiscal: false,
    address: false,
    stock: false,
  });
  const [submitAttempted, setSubmitAttempted] = React.useState(false);
  const [submitState, setSubmitState] = React.useState<SubmitState>({ status: "idle" });
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
  const selectedCatalogScope = selectedCompany?.id ?? "";
  const isCatalogLoading = catalogLoadState === "loading";
  const shouldLoadPreview =
    cart.isHydrated && cart.items.length > 0 && Boolean(selectedCompany?.id);
  const previewForUi = shouldLoadPreview ? preview : idlePreviewState;
  const unresolvedSkus = React.useMemo(() => {
    const resolvedSkus = new Set(cart.lines.map((line) => line.sku));

    return cart.items
      .map((item) => item.sku)
      .filter((sku) => !resolvedSkus.has(sku));
  }, [cart.items, cart.lines]);
  const lineIssues = React.useMemo(
    () => previewForUi.issues.filter((issue) => issue.sku !== "customer"),
    [previewForUi.issues]
  );
  const formErrors = validateForm(t, form, confirmations);
  const blockers = buildCheckoutBlockers({
    cart,
    company: selectedCompany,
    delegatedCheckout,
    formErrors,
    isCatalogLoading,
    lineIssues,
    preview: previewForUi,
    runtime,
    submitAttempted,
    unresolvedSkus,
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
    setForm(initialFormState(null, nextCompany));
    setPreview(idlePreviewState);
    setSubmitState({ status: "idle" });
    setCatalogLoadState("idle");
  }

  React.useEffect(() => {
    onCatalogScopeChange(selectedCatalogScope);
    requestedCatalogKeys.current.clear();
  }, [onCatalogScopeChange, selectedCatalogScope]);

  React.useEffect(() => {
    if (!cart.isHydrated || cart.items.length === 0 || !selectedCompany?.id) {
      return;
    }

    const missingSkus = cart.items
      .map((item) => item.sku)
      .filter((sku) => !catalogSkuSet.has(sku));
    const requestKey = `${selectedCompany.id}:${missingSkus.join(",")}`;

    if (missingSkus.length === 0) {
      return;
    }

    if (requestedCatalogKeys.current.has(requestKey)) {
      return;
    }

    const controller = new AbortController();
    requestedCatalogKeys.current.add(requestKey);

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

        const payload = (await response.json()) as { data?: PartProduct[] };
        onCatalogProductsLoaded(Array.isArray(payload.data) ? payload.data : []);
        setCatalogLoadState("ready");
      } catch {
        if (!controller.signal.aborted) {
          requestedCatalogKeys.current.delete(requestKey);
          setCatalogLoadState("error");
        }
      }
    }

    void loadCartCatalogProducts();

    return () => {
      controller.abort();
    };
  }, [
    cart.isHydrated,
    cart.items,
    cartSignature,
    catalogSkuSet,
    onCatalogProductsLoaded,
    selectedCompany?.id,
  ]);

  React.useEffect(() => {
    if (!shouldLoadPreview) {
      return;
    }

    const controller = new AbortController();

    async function loadPreview() {
      setPreview({ status: "loading", issues: [] });

      try {
        const response = await fetch("/api/orders/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: selectedCompany?.id,
            items: cart.items,
          }),
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as {
          data?: { issues?: PreviewIssue[] };
          error?: { code?: string; message?: string };
        } | null;

        if (!response.ok) {
          throw new Error(friendlyCheckoutError(t, payload?.error?.code, payload?.error?.message));
        }

        if (!controller.signal.aborted) {
          setPreview({
            status: "ready",
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

    void loadPreview();

    return () => {
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

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: selectedCompany?.id,
          paymentMethod: form.paymentMethod,
          purchaseOrderNumber: optionalText(form.purchaseOrderNumber),
          deliveryAddress: {
            street: form.shippingStreet.trim(),
            zip: form.shippingZip.trim(),
            city: form.shippingCity.trim(),
            province: form.shippingProvince.trim(),
            country: "IT",
          },
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

      cart.clearCart();
      router.refresh();
      setSubmitState({
        status: "success",
        message: txFormat(t, "storefront.checkout.submit.orderAccepted", "Ordine {id} creato correttamente.", {
          id: payload.data.id,
        }),
        order: payload.data,
      });
    } catch (error) {
      setSubmitState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : tx(t, "storefront.checkout.submit.sendError", "Errore durante l'invio."),
      });
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6fa] text-slate-950">
      <div className="mx-auto grid max-w-[1300px] gap-3 px-2 pt-3 pb-[calc(5.75rem_+_env(safe-area-inset-bottom))] sm:gap-4 sm:px-4 sm:pt-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-8">
        <section className="space-y-3 sm:space-y-4">
          <CheckoutHeader runtime={runtime} company={selectedCompany} />
          {delegatedCheckout ? (
            <DelegatedCustomerSelector
              companies={companies}
              selectedCompanyId={selectedCompanyId}
              onSelectedCompanyIdChange={handleSelectedCompanyIdChange}
            />
          ) : null}
          <GlobalBlockers blockers={blockers} />
          <OrderLinesReview
            lineIssues={lineIssues}
            lines={cart.lines}
            unresolvedSkus={unresolvedSkus}
          />
          <CompanyReview company={selectedCompany} profile={customerProfile} runtime={runtime} />
          <DeliverySection
            form={form}
            errors={formErrors}
            submitAttempted={submitAttempted}
            onChange={setForm}
          />
          <PaymentSection form={form} onChange={setForm} />
          <ConfirmationSection
            confirmations={confirmations}
            errors={formErrors}
            submitAttempted={submitAttempted}
            onChange={setConfirmations}
          />
        </section>

        <aside className="hidden space-y-3 lg:block">
          <OrderSummaryCard
            totals={cart.totals}
            showCheckoutAction={false}
            summaryNote={tx(t, "storefront.checkout.summary.note", "Totali stimati dai prezzi cliente correnti. Il gestionale conferma prezzi, scorte e riserve al momento dell'invio.")}
          />
          <CheckoutSubmitPanel
            canSubmit={canSubmit}
            disabledReason={disabledReason}
            onSubmit={submitOrder}
            state={submitState}
          />
        </aside>
      </div>

      <CheckoutMobileBar
        canSubmit={canSubmit}
        disabledReason={disabledReason}
        onSubmit={submitOrder}
        state={submitState}
        totals={cart.totals}
      />
    </main>
  );
}

function CheckoutHeader({
  company,
  runtime,
}: {
  company: CompanyProfile | null;
  runtime: CheckoutRuntimeView;
}) {
  const t = useT();

  return (
    <div className="space-y-3">
      <Button asChild variant="outline" size="sm" className="bg-white">
        <Link href="/carrello">
          <ArrowLeft className="size-4" />
          {tx(t, "storefront.checkout.backToCart", "Torna al carrello")}
        </Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
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
          <h1 className="text-2xl font-black tracking-normal sm:text-3xl md:text-4xl">
            {tx(t, "storefront.checkout.title", "Conferma ordine e dati fiscali")}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {tx(t, "storefront.checkout.description", "Rivedi righe, cliente, spedizione e conferme. L'ordine viene inviato al gestionale solo dopo il controllo finale.")}
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
          <p className="mt-1 leading-6">{blocker.message}</p>
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
    <Card className="border-blue-200 bg-blue-50/70">
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
                  {company.name} · {company.customerType ?? "retail"} · {company.assignmentStatus ?? "needs_review"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedCompany ? (
            <div className="mt-1 truncate text-xs font-semibold text-blue-800">
              {selectedCompany.priceList} · {selectedCompany.status}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function OrderLinesReview({
  lineIssues,
  lines,
  unresolvedSkus,
}: {
  lineIssues: PreviewIssue[];
  lines: CartLine[];
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
    <Card className="border-slate-200 bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingBag className="size-5 text-primary" />
          {tx(t, "storefront.checkout.section.items", "Righe ordine")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {lines.length === 0 && unresolvedSkus.length === 0 && (
          <p className="text-sm font-semibold leading-6 text-slate-500">
            {tx(t, "storefront.cart.emptyDescription", "Aggiungi prodotti dal catalogo per preparare il checkout.")}
          </p>
        )}
        {lines.map((line) => (
          <OrderLineRow
            key={line.sku}
            issues={issuesBySku.get(line.sku) ?? []}
            line={line}
          />
        ))}
        {unresolvedSkus.map((sku) => (
          <div key={sku} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <div className="font-mono font-black">{sku}</div>
            <p className="mt-1 font-semibold leading-6">
              {tx(t, "storefront.checkout.itemUnavailable", "Questa riga non e piu disponibile per il checkout.")}
            </p>
          </div>
        ))}
        {(lineIssues.length > 0 || unresolvedSkus.length > 0) && (
          <Button asChild variant="outline" className="bg-white">
            <Link href="/carrello">
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
    <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-center">
      <StorefrontProductImage
        product={line.product}
        sizes="72px"
        quality={55}
        className="size-14 rounded-md border border-slate-100 bg-slate-50 sm:size-[72px]"
        fallbackClassName="shrink-0"
        imageClassName="object-contain p-1.5"
      />
      <div className="min-w-0">
        <div className="line-clamp-2 font-black leading-5">{line.product.name}</div>
        <div className="mt-1 font-mono text-xs text-slate-500">{line.sku}</div>
        <div className="mt-2 flex flex-wrap gap-2">
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
                {issue.message}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="col-span-2 grid grid-cols-2 gap-2 text-sm sm:col-span-1 sm:block sm:text-right">
        <div>
          <div className="text-xs font-semibold text-slate-500">
            {tx(t, "storefront.checkout.quantity", "Quantita")}
          </div>
          <div className="font-black">{line.quantity}</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500">
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
    <Card className="border-slate-200 bg-white">
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
  submitAttempted,
}: {
  errors: Record<string, string>;
  form: CheckoutFormState;
  onChange: React.Dispatch<React.SetStateAction<CheckoutFormState>>;
  submitAttempted: boolean;
}) {
  const t = useT();

  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="size-5 text-primary" />
          {tx(t, "storefront.checkout.group.delivery", "Consegna")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
          <div className="flex items-center gap-2 text-sm font-black">
            <Truck className="size-4 text-primary" />
            {fixedShippingMethod}
          </div>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            {tx(t, "storefront.checkout.shippingFixed", "Metodo logistico gestito dal magazzino PartsPro. Puoi indicare fascia oraria o note di consegna.")}
          </p>
        </div>
        <TextField
          error={submitAttempted ? errors.shippingStreet : undefined}
          id="shippingStreet"
          label={tx(t, "storefront.checkout.field.shippingStreet", "Via")}
          value={form.shippingStreet}
          onChange={(value) => onChange((current) => ({ ...current, shippingStreet: value }))}
        />
        <TextField
          error={submitAttempted ? errors.shippingZip : undefined}
          id="shippingZip"
          label={tx(t, "storefront.checkout.field.shippingZip", "CAP")}
          value={form.shippingZip}
          onChange={(value) => onChange((current) => ({ ...current, shippingZip: value }))}
        />
        <TextField
          error={submitAttempted ? errors.shippingCity : undefined}
          id="shippingCity"
          label={tx(t, "storefront.checkout.field.shippingCity", "Comune")}
          value={form.shippingCity}
          onChange={(value) => onChange((current) => ({ ...current, shippingCity: value }))}
        />
        <TextField
          error={submitAttempted ? errors.shippingProvince : undefined}
          id="shippingProvince"
          label={tx(t, "storefront.checkout.field.shippingProvince", "Provincia")}
          value={form.shippingProvince}
          onChange={(value) => onChange((current) => ({ ...current, shippingProvince: value }))}
        />
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
      value: "card" as const,
      label: tx(t, "storefront.checkout.option.card.label", "Carta aziendale"),
      description: tx(t, "storefront.checkout.option.card.description", "Metodo registrato nel gestionale."),
    },
    {
      value: "agreed_terms" as const,
      label: tx(t, "storefront.checkout.option.agreedTerms.label", "Pagamento concordato"),
      description: tx(t, "storefront.checkout.option.agreedTerms.description", "Solo per clienti con termini approvati."),
    },
  ];

  return (
    <Card className="border-slate-200 bg-white">
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
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="purchaseOrderNumber"
            label={tx(t, "storefront.checkout.field.purchaseOrderNumber", "Riferimento interno / PO")}
            value={form.purchaseOrderNumber}
            onChange={(value) => onChange((current) => ({ ...current, purchaseOrderNumber: value }))}
          />
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">{tx(t, "storefront.checkout.field.notes", "Note ordine")}</Label>
            <Textarea
              id="notes"
              value={form.notes}
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
  confirmations,
  errors,
  onChange,
  submitAttempted,
}: {
  confirmations: { fiscal: boolean; address: boolean; stock: boolean };
  errors: Record<string, string>;
  onChange: React.Dispatch<React.SetStateAction<{ fiscal: boolean; address: boolean; stock: boolean }>>;
  submitAttempted: boolean;
}) {
  const t = useT();

  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="size-5 text-primary" />
          {tx(t, "storefront.checkout.confirmTitle", "Conferme prima dell'invio")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ConfirmLine
          checked={confirmations.fiscal}
          error={submitAttempted ? errors.confirmFiscal : undefined}
          id="confirmFiscal"
          label={tx(t, "storefront.checkout.confirm.invoice", "Confermo che i dati fiscali mostrati sono corretti per la fattura.")}
          onChange={(checked) => onChange((current) => ({ ...current, fiscal: checked }))}
        />
        <ConfirmLine
          checked={confirmations.address}
          error={submitAttempted ? errors.confirmAddress : undefined}
          id="confirmAddress"
          label={tx(t, "storefront.checkout.confirm.address", "Confermo che indirizzo e note di consegna sono aggiornati.")}
          onChange={(checked) => onChange((current) => ({ ...current, address: checked }))}
        />
        <ConfirmLine
          checked={confirmations.stock}
          error={submitAttempted ? errors.confirmStock : undefined}
          id="confirmStock"
          label={tx(t, "storefront.checkout.confirm.stockPolicy", "Accetto che disponibilita, MOQ e prezzi vengano confermati dal gestionale al momento dell'invio.")}
          onChange={(checked) => onChange((current) => ({ ...current, stock: checked }))}
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
        className="h-11 w-full"
        disabled={!canSubmit || state.status === "loading" || state.status === "success"}
        onClick={onSubmit}
      >
        {state.status === "loading" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : state.status === "success" ? (
          <CheckCircle2 className="size-4" />
        ) : (
          <Send className="size-4" />
        )}
        {submitButtonLabel(t, state, canSubmit)}
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
      <span>{message}</span>
    </div>
  );
}

function OrderSuccess({ message, order }: { message: string; order: OrderResult }) {
  const t = useT();
  const { locale } = useI18n();
  const totalQuantity = order.lines.reduce((total, line) => total + line.quantity, 0);

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
      <div className="flex gap-2">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <div className="font-black">{message}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-emerald-800">
            <span className="font-mono">{order.id}</span>
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

function CheckoutMobileBar({
  canSubmit,
  disabledReason,
  onSubmit,
  state,
  totals,
}: {
  canSubmit: boolean;
  disabledReason?: string;
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
          <CompactSummaryLine label={tx(t, "storefront.cart.rows", "Righe")} value={String(totals.lines.length)} />
          <CompactSummaryLine label={tx(t, "storefront.common.subtotal", "Subtotale")} value={formatMoney(totals.subtotal, locale)} />
          <CompactSummaryLine
            label={tx(t, "storefront.common.shipping", "Spedizione")}
            value={totals.shipping === 0 ? tx(t, "storefront.common.free", "Gratis") : formatMoney(totals.shipping, locale)}
          />
          <CompactSummaryLine label={`${tx(t, "storefront.common.vat", "IVA")} 22%`} value={formatMoney(totals.vat, locale)} />
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
          className="h-10 min-w-[138px] px-3"
          disabled={!canSubmit || state.status === "loading"}
          onClick={onSubmit}
        >
          {state.status === "loading" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {submitButtonLabel(t, state, canSubmit)}
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
  company,
  delegatedCheckout,
  formErrors,
  isCatalogLoading,
  lineIssues,
  preview,
  runtime,
  submitAttempted,
  unresolvedSkus,
  t,
}: {
  cart: ReturnType<typeof useCart>;
  company: CompanyProfile | null;
  delegatedCheckout: boolean;
  formErrors: Record<string, string>;
  isCatalogLoading: boolean;
  lineIssues: PreviewIssue[];
  preview: PreviewState;
  runtime: CheckoutRuntimeView;
  submitAttempted: boolean;
  unresolvedSkus: string[];
  t: StorefrontTranslator;
}) {
  const blockers: Blocker[] = [];

  if (runtime.mode === "needs-login") {
    blockers.push({
      actionHref: "/login?next=/checkout",
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

  if (!cart.isHydrated) {
    blockers.push({
      message: tx(t, "storefront.checkout.submit.cartLoadingReason", "Caricamento carrello salvato nel browser..."),
      title: tx(t, "storefront.cart.loadingTitle", "Caricamento carrello"),
      tone: "neutral",
    });
  } else if (cart.items.length === 0) {
    blockers.push({
      actionHref: "/catalogo",
      actionLabel: tx(t, "storefront.cart.goToCatalog", "Vai al catalogo"),
      message: tx(t, "storefront.checkout.submit.cartEmptyReason", "Il carrello e vuoto: aggiungi almeno un prodotto prima di confermare l'ordine."),
      title: tx(t, "storefront.cart.emptyTitle", "Carrello vuoto"),
      tone: "warning",
    });
  }

  if (unresolvedSkus.length > 0) {
    blockers.push({
      actionHref: "/carrello",
      actionLabel: tx(t, "storefront.checkout.fixCart", "Torna al carrello per correggere"),
      message: isCatalogLoading
        ? tx(t, "storefront.checkout.loadingTargetPrices", "Caricamento prezzi cliente per le righe del carrello.")
        : `${tx(t, "storefront.checkout.unresolvedItems", "Alcune righe non sono piu disponibili.")} ${unresolvedSkus.join(", ")}`,
      title: tx(t, "storefront.cart.unresolvedTitle", "Prodotti del carrello non disponibili"),
      tone: isCatalogLoading ? "neutral" : "warning",
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

  if (lineIssues.length > 0) {
    blockers.push({
      actionHref: "/carrello",
      actionLabel: tx(t, "storefront.checkout.fixCart", "Torna al carrello per correggere"),
      message: lineIssues.map((issue) => `${issue.sku}: ${issue.message}`).join(" "),
      title: tx(t, "storefront.checkout.itemsNeedReview", "Righe da rivedere"),
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

function validateForm(
  t: StorefrontTranslator,
  form: CheckoutFormState,
  confirmations: { fiscal: boolean; address: boolean; stock: boolean }
) {
  const required = tx(t, "storefront.checkout.required", "Campo obbligatorio.");
  const errors: Record<string, string> = {};

  if (!form.shippingStreet.trim()) {
    errors.shippingStreet = required;
  }

  if (!form.shippingZip.trim()) {
    errors.shippingZip = required;
  }

  if (!form.shippingCity.trim()) {
    errors.shippingCity = required;
  }

  if (!form.shippingProvince.trim()) {
    errors.shippingProvince = required;
  }

  if (!confirmations.fiscal) {
    errors.confirmFiscal = required;
  }

  if (!confirmations.address) {
    errors.confirmAddress = required;
  }

  if (!confirmations.stock) {
    errors.confirmStock = required;
  }

  return errors;
}

function initialFormState(
  profile: AccountCustomerProfile | null,
  company: CompanyProfile | null
): CheckoutFormState {
  return {
    deliveryWindow: "",
    notes: "",
    paymentMethod: "bank_transfer",
    purchaseOrderNumber: "",
    shippingCity: company?.city ?? "",
    shippingProvince: company?.province ?? "",
    shippingStreet: profile?.shippingAddress ?? "",
    shippingZip: "",
  };
}

function missingProfileLabels(t: StorefrontTranslator, profile: AccountCustomerProfile | null) {
  if (!profile) {
    return [tx(t, "storefront.checkout.profileMissingAll", "Profilo cliente")];
  }

  return [
    profile.companyName ? null : tx(t, "storefront.checkout.field.companyName", "Ragione sociale"),
    profile.contactName ? null : tx(t, "storefront.account.field.contactName", "Referente"),
    profile.phone ? null : tx(t, "storefront.account.field.phone", "Telefono"),
    profile.billingAddress ? null : tx(t, "storefront.checkout.billingAddress", "Indirizzo fatturazione"),
    profile.shippingAddress ? null : tx(t, "storefront.checkout.savedShippingAddress", "Indirizzo spedizione salvato"),
    profile.vatNumber ? null : tx(t, "storefront.checkout.field.partitaIva", "Partita IVA"),
    profile.fiscalCode ? null : tx(t, "storefront.checkout.field.codiceFiscale", "Codice fiscale"),
    profile.pec || profile.sdi ? null : "PEC / SDI",
  ].filter((label): label is string => Boolean(label));
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
    return tx(t, "storefront.checkout.submit.button.disabled", "Checkout disabilitato");
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

function formatMoneyDto(value: MoneyDto, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: value.currency,
  }).format(Number(value.amount));
}
