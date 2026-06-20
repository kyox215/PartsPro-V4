"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  CreditCard,
  Loader2,
  MapPin,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  Truck,
  WalletCards,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  calculateShippingCents,
  defaultDeliveryMethod,
  expressShippingMethodLabel,
  pickupShippingMethodLabel,
  shippingMethodForDeliveryMethod,
  type DeliveryMethod,
} from "@/lib/partspro-shipping";
import { cn } from "@/lib/utils";
import {
  CartCatalogProvider,
  cartItemsForApi,
  serializeCartItems,
  type CartLine,
  type CartTotals,
  useCart,
} from "./cart-state";
import { useCartSyncStatus } from "./cart-sync-bridge";
import { useI18n, useT } from "./i18n-provider";
import { OrderSummaryCard } from "./order-summary-card";
import {
  StorefrontSyncStatusBar,
  type StorefrontSyncStatusState,
} from "./storefront-commerce-status";
import { StoreHeader } from "./store-header";
import { StorefrontProductImage } from "./storefront-product-image";

export type CheckoutRuntimeView = {
  actionHref?: string;
  actionLabel?: string;
  canSubmit: boolean;
  description: string;
  disabledReason?: string;
  mode: "ready" | "needs-login" | "needs-profile" | "error";
  title: string;
  userEmail?: string;
};

type CheckoutMode = "customer_self" | "employee_self" | "delegated_customer";

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
  deliveryMethod: DeliveryMethod;
  notes: string;
  paymentMethod: "bank_transfer" | "cash";
  useWallet: boolean;
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
  payableAmount?: number;
  totals: {
    subtotal: MoneyDto;
    shipping: MoneyDto;
    vat: MoneyDto;
    total: MoneyDto;
  };
  walletAppliedAmount?: number;
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

type WalletPreview = {
  appliedAmount: MoneyDto;
  availableAmount: MoneyDto;
  enabled: boolean;
  payableAmount: MoneyDto;
};

type PreviewLine = {
  sku: string;
  quantity: number;
  unitPrice: MoneyDto;
  lineGross: MoneyDto;
  priceVersion?: string | null;
};

type PreviewTotals = {
  subtotal: MoneyDto;
  shipping: MoneyDto;
  vat: MoneyDto;
  total: MoneyDto;
};

type CartCatalogRejection = {
  reason?: string;
  sku: string;
};

type PendingItemsReason = "account" | "customer" | "customer-context";

type PreviewState =
  | { status: "idle"; canSubmit?: boolean; issues: PreviewIssue[]; lines?: PreviewLine[]; totals?: PreviewTotals; wallet?: WalletPreview }
  | { status: "loading"; canSubmit?: boolean; issues: PreviewIssue[]; lines?: PreviewLine[]; totals?: PreviewTotals; wallet?: WalletPreview }
  | { status: "ready"; canSubmit?: boolean; issues: PreviewIssue[]; lines?: PreviewLine[]; totals?: PreviewTotals; wallet?: WalletPreview }
  | { status: "error"; canSubmit?: boolean; issues: PreviewIssue[]; message: string; lines?: PreviewLine[]; totals?: PreviewTotals; wallet?: WalletPreview };

type Blocker = {
  actionHref?: string;
  actionLabel?: string;
  message: string;
  title: string;
  tone: "warning" | "error" | "neutral";
};

type CheckoutSyncKind = "cart" | "catalog" | "preview" | "remote-cart" | "submit";

type CheckoutSyncState = (StorefrontSyncStatusState & {
  kind: CheckoutSyncKind;
}) | null;

type CheckoutAmountStatus = "loading" | "ready" | "stale";

type CheckoutApiErrorDetails = {
  accountProfileComplete?: boolean | null;
  accountStatus?: string | null;
  assignmentStatus?: string | null;
  customerType?: string | null;
  missingFields?: string[];
  profileComplete?: boolean | null;
  status?: string | null;
};

const fixedShippingMethod = expressShippingMethodLabel;
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
  const hasEmployeeSelfProfile = company?.profileKind === "employee_self";
  const initialCheckoutMode: CheckoutMode =
    delegatedCheckout && initialDelegatedCompanyId
      ? "delegated_customer"
      : hasEmployeeSelfProfile
        ? "employee_self"
        : delegatedCheckout
          ? "delegated_customer"
          : "customer_self";
  const [checkoutMode, setCheckoutMode] =
    React.useState<CheckoutMode>(initialCheckoutMode);
  const isDelegatedMode = checkoutMode === "delegated_customer";
  const [selectedCompanyId, setSelectedCompanyId] = React.useState(
    isDelegatedMode ? initialDelegatedCompanyId : ""
  );
  const selectedCompany =
    isDelegatedMode
      ? companies.find((item) => item.id === selectedCompanyId) ?? null
      : company;
  const selectedCustomerProfile = delegatedCheckout
    ? isDelegatedMode
      ? customerProfileFromCompany(selectedCompany)
      : customerProfile
    : customerProfile;
  const selectedShippingAddress = selectedCustomerProfile?.shippingAddress.trim() ?? "";
  const targetCustomerBlocker = customerOrderBlocker(
    t,
    selectedCompany,
    selectedCustomerProfile,
    isDelegatedMode
  );
  const cart = useCart({ preserveUnknown: true });
  const cartSyncStatus = useCartSyncStatus();
  const [form, setForm] = React.useState<CheckoutFormState>(() =>
    initialFormState()
  );
  const [catalogLoadState, setCatalogLoadState] = React.useState<"idle" | "loading" | "ready" | "error">("idle");
  const [catalogRetryToken, setCatalogRetryToken] = React.useState(0);
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
  const [previewRetryToken, setPreviewRetryToken] = React.useState(0);
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
  const needsCustomerSelection = isDelegatedMode && !selectedCompany;
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
  const checkoutContextCompanyId = isDelegatedMode
    ? selectedCompany?.id ?? initialDelegatedCompanyId
    : null;
  const checkoutHref = hrefWithAssistedCompanyId("/checkout", checkoutContextCompanyId);
  const cartHref = hrefWithAssistedCompanyId("/carrello", checkoutContextCompanyId);
  const catalogHref = hrefWithAssistedCompanyId("/catalogo", checkoutContextCompanyId);
  const loginHref = loginHrefForNext(checkoutHref);
  const summaryNote = needsCustomerSelection
    ? tx(t, "storefront.checkout.summary.needsCustomer", "选择客户后计算客户价、库存和 MOQ。")
    : form.deliveryMethod === "pickup"
      ? tx(t, "storefront.checkout.summary.pickupNote", "Ritiro in sede: spedizione gratuita.")
      : tx(t, "storefront.checkout.summary.note", "Prezzi IVA inclusa; viene aggiunta solo la spedizione.");
  const checkoutTotals = React.useMemo(
    () => totalsForDeliveryMethod(cart.totals, form.deliveryMethod),
    [cart.totals, form.deliveryMethod]
  );
  const shouldLoadPreview =
    cart.isHydrated && cart.items.length > 0 && Boolean(selectedCompany?.id) && !targetCustomerBlocker;
  const previewForUi = shouldLoadPreview ? preview : idlePreviewState;
  const walletPreview = previewForUi.wallet;
  const walletAppliedAmount = moneyDtoToNumber(walletPreview?.appliedAmount);
  const payableAmount = moneyDtoToNumber(walletPreview?.payableAmount);
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
  const isRemoteCartLoading = cartSyncStatus.remoteStatus === "loading";
  const isCartBootstrapping = !cart.isHydrated || isRemoteCartLoading;
  const previewQueued =
    shouldLoadPreview &&
    !catalogResolutionPending &&
    previewForUi.status === "idle";
  const previewBusy = previewQueued || previewForUi.status === "loading";
  const checkoutAmountStatus: CheckoutAmountStatus =
    cart.items.length > 0 &&
    (isCartBootstrapping || catalogResolutionPending || previewBusy)
      ? "loading"
      : cart.items.length > 0 && previewForUi.status === "error"
        ? "stale"
        : "ready";
  const lineIssues = React.useMemo(
    () => previewForUi.issues.filter((issue) => issue.sku !== "customer"),
    [previewForUi.issues]
  );
  const customerIssues = React.useMemo(
    () => previewForUi.issues.filter((issue) => issue.sku === "customer"),
    [previewForUi.issues]
  );
  const formErrors = validateForm(t, confirmed, selectedShippingAddress);
  const checkoutSyncState = buildCheckoutSyncState({
    cartHydrated: cart.isHydrated,
    catalogResolutionPending,
    previewQueued,
    preview: previewForUi,
    remoteCartLoading: isRemoteCartLoading,
    submitState,
    t,
  });
  const blockers = buildCheckoutBlockers({
    cartHref,
    catalogHref,
    catalogLoadState,
    cart,
    company: selectedCompany,
    customerIssues,
    delegatedCheckout: isDelegatedMode,
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
  const formDisabledReason =
    Object.keys(formErrors).length > 0
      ? tx(t, "storefront.checkout.formInvalid", "Completa indirizzo e conferme prima di inviare l'ordine.")
      : undefined;
  const syncDisabledReason = checkoutSyncState?.message;
  const disabledReason = blockers[0]?.message ?? syncDisabledReason ?? formDisabledReason;
  const previewReadyForSubmit =
    !shouldLoadPreview ||
    (previewForUi.status === "ready" && previewForUi.canSubmit === true);
  const canSubmit =
    blockers.length === 0 &&
    !checkoutSyncState &&
    !formDisabledReason &&
    previewReadyForSubmit &&
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

  function handleCheckoutModeChange(value: CheckoutMode) {
    setCheckoutMode(value);
    setForm(initialFormState());
    setConfirmed(false);
    setPreview(idlePreviewState);
    setSubmitState({ status: "idle" });
    setSuccessDialogOpen(false);
    setCatalogLoadState("idle");
    setCatalogRejections({});

    if (value !== "delegated_customer") {
      setSelectedCompanyId("");
      rememberAssistedCompanyId(null);
      replaceCurrentUrlAssistedCompanyId(null);
      return;
    }

    const nextCompanyId = selectedCompanyId || companies[0]?.id || "";
    setSelectedCompanyId(nextCompanyId);
    rememberAssistedCompanyId(nextCompanyId || null);
    replaceCurrentUrlAssistedCompanyId(nextCompanyId || null);
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
          checkoutMode,
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
    catalogRetryToken,
    catalogRejectionBySku,
    catalogSkuSet,
    onCatalogProductsLoaded,
    selectedCompany?.id,
    checkoutMode,
    targetCustomerBlocker,
  ]);

  React.useEffect(() => {
    if (!shouldLoadPreview) {
      return;
    }

    const controller = new AbortController();
    const previewCompanyId = selectedCompany?.id;
    const previewItems = cartItemsForApi(cart.items);

    async function loadPreview() {
      setPreview((current) => ({
        status: "loading",
        canSubmit: current.canSubmit,
        issues: current.status === "ready" || current.status === "loading"
          ? current.issues
          : [],
        wallet: current.wallet,
      }));

      try {
        const response = await fetch("/api/orders/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: previewCompanyId,
            checkoutMode,
            deliveryMethod: form.deliveryMethod,
            items: previewItems,
            useWallet: form.useWallet,
          }),
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as {
          data?: {
            canSubmit?: boolean;
            issues?: PreviewIssue[];
            lines?: PreviewLine[];
            totals?: PreviewTotals;
            wallet?: WalletPreview;
          };
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
            lines: Array.isArray(payload?.data?.lines) ? payload.data.lines : [],
            totals: payload?.data?.totals,
            wallet: payload?.data?.wallet,
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setPreview((current) => ({
            status: "error",
            issues: [],
            message:
              error instanceof Error
                ? error.message
                : tx(t, "storefront.checkout.preview.error", "Impossibile aggiornare i controlli ordine."),
            wallet: current.wallet,
          }));
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
  }, [cart.items, cartSignature, checkoutMode, form.deliveryMethod, form.useWallet, previewRetryToken, selectedCompany?.id, shouldLoadPreview, t]);

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
          checkoutMode,
          expectedPreview: expectedPreviewForOrder(previewForUi),
          paymentMethod: form.paymentMethod,
          useWallet: form.useWallet,
          deliveryAddress: selectedShippingAddress,
          deliveryMethod: form.deliveryMethod,
          notes: buildOrderNotes(form.notes, form.deliveryMethod),
          items: cartItemsForApi(cart.items),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: OrderResult;
        error?: {
          code?: string;
          details?: CheckoutApiErrorDetails;
          message?: string;
        };
      } | null;

      if (!response.ok) {
        if (isCheckoutContextError(payload?.error?.code)) {
          setPreview(idlePreviewState);
          setPreviewRetryToken((value) => value + 1);
          startTransition(() => {
            router.refresh();
          });
        }

        throw new Error(
          friendlyCheckoutError(
            t,
            payload?.error?.code,
            payload?.error?.message,
            payload?.error?.details
          )
        );
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

  function retryCheckoutValidation() {
    requestedCatalogKeys.current.clear();
    setCatalogLoadState("idle");
    setSubmitState({ status: "idle" });
    setPreview(idlePreviewState);
    setCatalogRetryToken((value) => value + 1);
    setPreviewRetryToken((value) => value + 1);
  }

  const canRetryCheckoutValidation =
    previewForUi.status === "error" || catalogLoadState === "error";

  return (
    <>
      <StoreHeader
        assistedCompanyId={checkoutContextCompanyId || null}
        initialAccountAccess={initialAccountAccess}
      />
      <StorefrontSyncStatusBar state={checkoutSyncState} />
      <main
        aria-busy={Boolean(checkoutSyncState)}
        className="min-h-screen overflow-x-hidden bg-[#f4f6fa] text-slate-950"
      >
        <div className="mx-auto grid max-w-[1460px] gap-2.5 px-2 pt-2 pb-[calc(5.75rem_+_env(safe-area-inset-bottom))] sm:px-4 sm:pt-3 lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-3 lg:pb-6">
          <section className="space-y-2">
          <CheckoutHeader cartHref={cartHref} runtime={runtime} company={selectedCompany} />
          {hasEmployeeSelfProfile && delegatedCheckout ? (
            <CheckoutModeSelector
              mode={checkoutMode}
              onModeChange={handleCheckoutModeChange}
            />
          ) : null}
          {isDelegatedMode ? (
            <DelegatedCustomerSelector
              companies={companies}
              selectedCompanyId={selectedCompanyId}
              onSelectedCompanyIdChange={handleSelectedCompanyIdChange}
            />
          ) : null}
          <GlobalBlockers blockers={blockers} />
          {canRetryCheckoutValidation && (
            <Button
              type="button"
              variant="outline"
              className="h-9 w-fit bg-white"
              onClick={retryCheckoutValidation}
            >
              <RefreshCcw className="size-4" />
              {tx(t, "storefront.common.retry", "Riprova")}
            </Button>
          )}
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
          <DeliverySection
            errors={formErrors}
            form={form}
            onChange={setForm}
            shippingAddress={selectedShippingAddress}
            submitAttempted={submitAttempted}
          />
          <PaymentSection
            form={form}
            onChange={setForm}
            walletPreview={walletPreview}
          />
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
              amountMessage={checkoutSyncState?.message}
              amountStatus={checkoutAmountStatus}
              totals={checkoutTotals}
              walletAppliedAmount={walletAppliedAmount}
              payableAmount={payableAmount}
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
        amountMessage={checkoutSyncState?.message}
        amountStatus={checkoutAmountStatus}
        canSubmit={canSubmit}
        disabledReason={disabledReason}
        onSubmit={submitOrder}
        state={submitState}
        totals={checkoutTotals}
        walletAppliedAmount={walletAppliedAmount}
        payableAmount={payableAmount}
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

function CheckoutModeSelector({
  mode,
  onModeChange,
}: {
  mode: CheckoutMode;
  onModeChange: (mode: CheckoutMode) => void;
}) {
  const t = useT();
  const options: Array<{
    description: string;
    label: string;
    value: CheckoutMode;
  }> = [
    {
      value: "employee_self",
      label: tx(t, "storefront.checkout.mode.employeeSelf", "员工自购"),
      description: tx(t, "storefront.checkout.mode.employeeSelfDescription", "使用员工自己的税务和配送资料。"),
    },
    {
      value: "delegated_customer",
      label: tx(t, "storefront.checkout.mode.delegated", "代客户下单"),
      description: tx(t, "storefront.checkout.mode.delegatedDescription", "选择客户，并使用客户等级、资料和价格。"),
    },
  ];

  return (
    <Card size="sm" className="rounded-lg border-slate-200 bg-white">
      <CardContent className="grid gap-2 p-2 sm:grid-cols-2">
        {options.map((option) => {
          const selected = option.value === mode;

          return (
            <button
              key={option.value}
              type="button"
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition",
                selected
                  ? "border-primary bg-primary/8 text-primary"
                  : "border-slate-200 bg-white text-slate-700 hover:border-primary/30"
              )}
              onClick={() => onModeChange(option.value)}
            >
              <div className="text-sm font-black">{option.label}</div>
              <div className="mt-0.5 text-xs font-semibold leading-5 text-slate-500">
                {option.description}
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
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
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const selectedCompany = companies.find((company) => company.id === selectedCompanyId);
  const selectedReadiness = selectedCompany
    ? delegatedCompanyReadiness(t, selectedCompany)
    : null;
  const normalizedQuery = query.trim();
  const searchResults = React.useMemo(() => {
    const matched = companies
      .filter((company) => delegatedCompanyMatchesSearch(company, normalizedQuery))
      .map((company) => ({
        company,
        readiness: delegatedCompanyReadiness(t, company),
      }))
      .sort((left, right) => {
        if (left.readiness.selectable !== right.readiness.selectable) {
          return left.readiness.selectable ? -1 : 1;
        }

        return left.company.name.localeCompare(right.company.name, "zh-Hans-CN");
      })
      .slice(0, 20);

    return {
      blocked: matched.filter((item) => !item.readiness.selectable),
      ready: matched.filter((item) => item.readiness.selectable),
    };
  }, [companies, normalizedQuery, t]);

  function selectCompany(companyId: string) {
    onSelectedCompanyIdChange(companyId);
    setOpen(false);
    setQuery("");
  }

  function renderResults(
    label: string,
    results: Array<{
      company: CompanyProfile;
      readiness: ReturnType<typeof delegatedCompanyReadiness>;
    }>
  ) {
    if (results.length === 0) {
      return null;
    }

    return (
      <div className="space-y-1.5">
        <div className="px-1 text-[11px] font-black uppercase tracking-wide text-slate-400">
          {label}
        </div>
        <div className="space-y-1">
          {results.map(({ company, readiness }) => (
            <Button
              key={company.id}
              type="button"
              variant="ghost"
              disabled={!readiness.selectable}
              className={cn(
                "h-auto w-full justify-start rounded-md px-2 py-2 text-left",
                readiness.selectable
                  ? "hover:bg-blue-50"
                  : "cursor-not-allowed opacity-70"
              )}
              onClick={() => selectCompany(company.id)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="line-clamp-1 min-w-0 font-black text-slate-950">
                    {company.name}
                  </span>
                  <Badge className={cn("border px-1.5 py-0 text-[10px]", customerTypeBadgeClass(company.customerType))}>
                    {customerTypeBadgeLabel(t, company.customerType)}
                  </Badge>
                  <Badge className="border border-blue-200 bg-blue-50 px-1.5 py-0 text-[10px] text-blue-700">
                    {customerLevelLabel(t, company.priceList)}
                  </Badge>
                </div>
                <div className="mt-1 line-clamp-1 text-xs font-semibold text-slate-500">
                  {[company.phone, company.email, company.partitaIva || company.codiceFiscale]
                    .filter(Boolean)
                    .join(" · ") ||
                    tx(t, "storefront.checkout.delegated.noContact", "暂无联系方式")}
                </div>
                <div
                  className={cn(
                    "mt-1 text-xs font-bold",
                    readiness.selectable ? "text-emerald-700" : "text-amber-700"
                  )}
                >
                  {readiness.label}
                </div>
              </div>
            </Button>
          ))}
        </div>
      </div>
    );
  }

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
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                id="delegated-customer"
                type="button"
                variant="outline"
                className="h-auto min-h-10 w-full justify-between gap-2 bg-white px-3 py-2 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-sm font-black text-slate-950">
                    {selectedCompany?.name ??
                      tx(t, "storefront.checkout.delegated.placeholder", "Seleziona cliente")}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                    {selectedCompany ? (
                      <>
                        <span>{customerTypeBadgeLabel(t, selectedCompany.customerType)}</span>
                        <span>·</span>
                        <span>{customerLevelLabel(t, selectedCompany.priceList)}</span>
                        {selectedReadiness ? (
                          <>
                            <span>·</span>
                            <span>{selectedReadiness.label}</span>
                          </>
                        ) : null}
                      </>
                    ) : (
                      tx(t, "storefront.checkout.delegated.searchHint", "按店名、手机号、邮箱或税号搜索")
                    )}
                  </span>
                </span>
                <ChevronDown className="size-4 shrink-0 text-slate-500" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(680px,calc(100vw-2rem))] gap-2 p-2"
            >
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  className="h-9 bg-white pl-9"
                  placeholder={tx(t, "storefront.checkout.delegated.searchPlaceholder", "搜索店名、手机号、邮箱或税号")}
                />
              </div>
              <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                {renderResults(tx(t, "storefront.checkout.delegated.readyGroup", "可下单"), searchResults.ready)}
                {renderResults(tx(t, "storefront.checkout.delegated.blockedGroup", "需处理"), searchResults.blocked)}
                {searchResults.ready.length === 0 && searchResults.blocked.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-200 p-4 text-center text-xs font-semibold text-slate-500">
                    {tx(t, "storefront.checkout.delegated.noResults", "没有找到匹配客户。")}
                  </div>
                ) : null}
              </div>
            </PopoverContent>
          </Popover>
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
    <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-[56px_minmax(220px,1fr)_70px_110px_110px] sm:items-center sm:gap-2.5 sm:p-2.5">
      <StorefrontProductImage
        product={line.product}
        sizes="56px"
        quality={55}
        className="size-11 rounded-md border border-slate-100 bg-slate-50 sm:size-14"
        fallbackClassName="shrink-0"
        imageClassName="object-contain p-1.5"
      />
        <div className="min-w-0">
          <div className="line-clamp-1 font-black leading-5">{line.product.name}</div>
          <div className="mt-1 font-mono text-xs text-slate-500">{line.sku}</div>
          <div className="mt-1 flex flex-wrap gap-1">
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
  const options = [
    {
      value: "express_24_48" as const,
      label: tx(t, "storefront.checkout.option.express.label", "Corriere espresso 24/48h"),
      detail: tx(t, "storefront.checkout.shippingFixedCompact", "GLS/BRT 24-48h；未满 €100 运费 €6.50，满 €100 包邮，默认 16:00 前发货。"),
      service: fixedShippingMethod,
    },
    {
      value: "pickup" as const,
      label: tx(t, "storefront.checkout.option.pickup.label", "Ritiro in sede"),
      detail: tx(t, "storefront.checkout.option.pickup.description", "Ritiro in sede senza costo di spedizione."),
      service: pickupShippingMethodLabel,
    },
  ];

  return (
    <Card size="sm" className="rounded-lg border-slate-200 bg-white py-2.5">
      <CardHeader className="px-3">
        <CardTitle className="flex items-center gap-2">
          <Truck className="size-4 text-primary" />
          {tx(t, "storefront.checkout.group.delivery", "Consegna")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2.5 px-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,300px)]">
        <div
          className={cn(
            "rounded-lg border p-2.5 text-sm sm:col-span-2",
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
              {shippingAddress ? (
                <Select defaultValue="saved-shipping-address">
                  <SelectTrigger className="mt-2 h-auto min-h-10 w-full whitespace-normal bg-white py-2 text-left">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="saved-shipping-address"
                      className="max-w-[calc(100vw-3rem)] whitespace-normal"
                    >
                      {shippingAddress}
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-2">
                  <p className="break-words text-xs font-semibold leading-5">
                    {tx(t, "storefront.checkout.deliveryAddressMissing", "Completa l'indirizzo di spedizione nel profilo cliente.")}
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-2 bg-white">
                    <Link href="/account?setup=1">
                      {tx(t, "storefront.checkout.completeProfile", "Completa profilo")}
                    </Link>
                  </Button>
                </div>
              )}
              {submitAttempted && errors.deliveryAddress ? (
                <div className="mt-1 text-xs font-bold text-red-600">{errors.deliveryAddress}</div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="grid gap-1.5 sm:col-span-2 sm:grid-cols-2">
          {options.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex min-h-20 cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2.5 text-sm transition",
                form.deliveryMethod === option.value
                  ? "border-primary/50 bg-primary/8"
                  : "border-slate-200 bg-slate-50 hover:border-primary/30"
              )}
            >
              <input
                className="sr-only"
                type="radio"
                name="deliveryMethod"
                value={option.value}
                checked={form.deliveryMethod === option.value}
                onChange={() =>
                  onChange((current) => ({ ...current, deliveryMethod: option.value }))
                }
              />
              <Truck className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block font-black">{option.label}</span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">
                  {option.detail}
                </span>
                <span className="mt-1 block text-[11px] font-bold uppercase tracking-normal text-slate-400">
                  {option.service}
                </span>
              </span>
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentSection({
  form,
  onChange,
  walletPreview,
}: {
  form: CheckoutFormState;
  onChange: React.Dispatch<React.SetStateAction<CheckoutFormState>>;
  walletPreview?: WalletPreview;
}) {
  const t = useT();
  const { locale } = useI18n();
  const walletAvailable = walletPreview?.availableAmount.cents ?? 0;
  const walletApplied = walletPreview?.appliedAmount.cents ?? 0;
  const canUseWallet = Boolean(walletPreview && walletAvailable > 0);
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
  ];

  return (
    <Card size="sm" className="rounded-lg border-slate-200 bg-white py-2.5">
      <CardHeader className="px-3">
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="size-4 text-primary" />
          {tx(t, "storefront.checkout.group.payment", "Pagamento")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5 px-3">
        <div className="grid grid-cols-2 gap-1.5">
          {options.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex min-h-14 cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-center text-xs font-black leading-4 transition sm:min-h-20 sm:items-start sm:justify-start sm:gap-2 sm:text-left sm:text-sm",
                form.paymentMethod === option.value
                  ? "border-primary/50 bg-primary/8"
                  : "border-slate-200 bg-white hover:border-primary/30"
              )}
            >
              <input
                className="sr-only"
                type="radio"
                name="paymentMethod"
                value={option.value}
                checked={form.paymentMethod === option.value}
                onChange={() =>
                  onChange((current) => ({ ...current, paymentMethod: option.value }))
                }
              />
              <span className="min-w-0">
                <span className="block">{option.label}</span>
                <span className="mt-1 hidden text-xs font-semibold leading-5 text-slate-500 sm:block">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
        </div>
        <label
          className={cn(
            "flex min-w-0 items-start gap-2.5 rounded-lg border px-2.5 py-2.5 text-sm transition",
            form.useWallet && canUseWallet
              ? "border-blue-300 bg-blue-50 text-blue-950"
              : "border-slate-200 bg-slate-50 text-slate-700",
            !canUseWallet && "cursor-not-allowed opacity-75"
          )}
        >
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0 accent-primary"
            disabled={!canUseWallet}
            checked={form.useWallet && canUseWallet}
            onChange={(event) =>
              onChange((current) => ({ ...current, useWallet: event.currentTarget.checked }))
            }
          />
          <WalletCards className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="font-black">
                {tx(t, "storefront.checkout.wallet.use", "Usa saldo wallet")}
              </span>
              {walletPreview ? (
                <span className="text-xs font-black text-blue-700">
                  {tx(t, "storefront.checkout.wallet.available", "Disponibile")}{" "}
                  {formatMoneyDto(walletPreview.availableAmount, locale)}
                </span>
              ) : null}
            </span>
            <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">
              {walletPreview
                ? canUseWallet
                  ? tx(t, "storefront.checkout.wallet.description", "Seleziona per scalare il saldo disponibile da questo ordine.")
                  : tx(t, "storefront.checkout.wallet.empty", "Nessun saldo wallet disponibile per questo cliente.")
                : tx(t, "storefront.checkout.wallet.loading", "Il saldo wallet viene calcolato con il controllo ordine.")}
            </span>
            {walletPreview && form.useWallet && canUseWallet ? (
              <span className="mt-2 grid gap-1 rounded-md border border-blue-100 bg-white/70 p-2 text-xs">
                <span className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-500">
                    {tx(t, "storefront.checkout.wallet.applied", "Detrazione wallet")}
                  </span>
                  <span className="font-black text-blue-700">
                    -{formatMoneyDto(walletPreview.appliedAmount, locale)}
                  </span>
                </span>
                <span className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-500">
                    {tx(t, "storefront.checkout.wallet.payable", "Importo da pagare")}
                  </span>
                  <span className="font-black text-slate-950">
                    {formatMoneyDto(walletPreview.payableAmount, locale)}
                  </span>
                </span>
                {walletApplied === 0 ? (
                  <span className="font-semibold text-amber-700">
                    {tx(t, "storefront.checkout.wallet.noApplied", "Il totale o il saldo non permette una detrazione.")}
                  </span>
                ) : null}
              </span>
            ) : null}
          </span>
        </label>
        <div className="space-y-1.5">
          <Label htmlFor="notes">{tx(t, "storefront.checkout.field.notes", "Note ordine")}</Label>
          <Textarea
            id="notes"
            value={form.notes}
            className="min-h-16"
            maxLength={500}
            onChange={(event) =>
              onChange((current) => ({ ...current, notes: event.currentTarget.value }))
            }
          />
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
    <Card size="sm" className="rounded-lg border-slate-200 bg-white py-2.5">
      <CardHeader className="px-3">
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="size-4 text-primary" />
          {tx(t, "storefront.checkout.confirmTitle", "Conferme prima dell'invio")}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3">
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
        "flex gap-2.5 rounded-lg border bg-white p-3 text-xs font-semibold leading-5 text-slate-700 sm:text-sm",
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
  const walletAppliedAmount = Math.max(0, order.walletAppliedAmount ?? 0);
  const payableAmount = Math.max(
    0,
    order.payableAmount ?? Number(order.totals.total.amount) - walletAppliedAmount
  );

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
        {walletAppliedAmount > 0 ? (
          <>
            <div className="mt-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-bold text-emerald-800">
                {tx(t, "storefront.checkout.wallet.applied", "Detrazione wallet")}
              </span>
              <span className="font-black text-emerald-800">
                -{formatMoney(walletAppliedAmount, locale)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-emerald-100 pt-2">
              <span className="font-bold">
                {tx(t, "storefront.checkout.wallet.payable", "Importo da pagare")}
              </span>
              <span className="text-lg font-black">{formatMoney(payableAmount, locale)}</span>
            </div>
          </>
        ) : null}
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
  const walletAppliedAmount = Math.max(0, order.walletAppliedAmount ?? 0);
  const payableAmount = Math.max(
    0,
    order.payableAmount ?? Number(order.totals.total.amount) - walletAppliedAmount
  );

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
          {walletAppliedAmount > 0 ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <SuccessMetric
                label={tx(t, "storefront.checkout.wallet.applied", "Detrazione wallet")}
                value={`-${formatMoney(walletAppliedAmount, locale)}`}
              />
              <SuccessMetric
                label={tx(t, "storefront.checkout.wallet.payable", "Importo da pagare")}
                value={formatMoney(payableAmount, locale)}
              />
            </div>
          ) : null}
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
  amountMessage,
  amountStatus,
  canSubmit,
  disabledReason,
  lineCount,
  onSubmit,
  payableAmount,
  state,
  totals,
  walletAppliedAmount,
}: {
  amountMessage?: string;
  amountStatus: CheckoutAmountStatus;
  canSubmit: boolean;
  disabledReason?: string;
  lineCount: number;
  onSubmit: () => void;
  payableAmount?: number;
  state: SubmitState;
  totals: CartTotals;
  walletAppliedAmount?: number;
}) {
  const t = useT();
  const { locale } = useI18n();
  const [expanded, setExpanded] = React.useState(false);
  const summaryId = React.useId();
  const effectiveWalletApplied = Math.max(0, walletAppliedAmount ?? 0);
  const effectivePayable = Math.max(0, payableAmount ?? totals.total - effectiveWalletApplied);
  const amountPending = amountStatus === "loading";
  const amountStale = amountStatus === "stale";
  const hasWalletApplied = !amountPending && effectiveWalletApplied > 0;
  const amountLabel =
    amountPending
      ? tx(t, "storefront.checkout.amountCalculating", "订单校验中 / Verifica ordine...")
      : hasWalletApplied
        ? tx(t, "storefront.checkout.wallet.payable", "Importo da pagare")
        : amountStale
          ? tx(t, "storefront.cart.amountNeedsReview", "金额待确认 / Totale da confermare")
          : tx(t, "storefront.common.total", "Totale");
  const amountStatusMessage =
    amountMessage ??
    (amountPending
      ? tx(t, "storefront.checkout.preview.loading", "Controllo prezzi, scorte e MOQ in corso.")
      : amountStale
        ? tx(t, "storefront.checkout.preview.error", "Impossibile aggiornare i controlli ordine.")
        : undefined);
  const mobileStatusMessage =
    state.status === "error" ? state.message : disabledReason ?? amountStatusMessage;

  if (state.status === "success") {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-18px_40px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden">
      {!expanded && state.status === "error" && (
        <div className="border-b border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-700">
          {state.message}
        </div>
      )}
      {expanded && (
        <div id={summaryId} className="space-y-2 border-b border-slate-200 px-3 py-2">
          <CompactSummaryLine label={tx(t, "storefront.cart.rows", "Articoli")} value={String(lineCount)} />
          <CompactSummaryLine
            label={tx(t, "storefront.common.subtotal", "Subtotale")}
            value={amountPending ? tx(t, "storefront.common.loading", "Caricamento") : formatMoney(totals.subtotal, locale)}
          />
          <CompactSummaryLine
            label={tx(t, "storefront.common.shipping", "Spedizione")}
            value={
              amountPending
                ? tx(t, "storefront.common.loading", "Caricamento")
                : totals.shipping === 0
                  ? tx(t, "storefront.common.free", "Gratis")
                  : formatMoney(totals.shipping, locale)
            }
          />
          {hasWalletApplied ? (
            <>
              <CompactSummaryLine label={tx(t, "storefront.common.total", "Totale")} value={formatMoney(totals.total, locale)} />
              <CompactSummaryLine
                label={tx(t, "storefront.checkout.wallet.applied", "Detrazione wallet")}
                value={`-${formatMoney(effectiveWalletApplied, locale)}`}
              />
            </>
          ) : null}
          {mobileStatusMessage && (
            <div
              className={cn(
                "rounded-md border p-2 text-xs font-semibold leading-5",
                state.status === "error" || amountStale
                  ? "border-red-200 bg-red-50 text-red-700"
                  : amountPending
                    ? "border-blue-200 bg-blue-50 text-blue-950"
                    : "border-amber-200 bg-amber-50 text-amber-900"
              )}
            >
              {mobileStatusMessage}
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
            {amountLabel}
          </div>
          <div className="flex min-w-0 items-center gap-1 text-lg font-black" aria-live="polite">
            {amountPending ? (
              <>
                <span className="h-5 w-24 animate-pulse rounded bg-slate-200" />
                <span className="text-xs font-bold text-slate-500">
                  {tx(t, "storefront.common.loading", "Caricamento")}
                </span>
              </>
            ) : (
              <span className="truncate">
                {formatMoney(hasWalletApplied ? effectivePayable : totals.total, locale)}
              </span>
            )}
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
          ) : amountPending ? (
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

function buildCheckoutSyncState({
  cartHydrated,
  catalogResolutionPending,
  previewQueued,
  preview,
  remoteCartLoading,
  submitState,
  t,
}: {
  cartHydrated: boolean;
  catalogResolutionPending: boolean;
  previewQueued: boolean;
  preview: PreviewState;
  remoteCartLoading: boolean;
  submitState: SubmitState;
  t: StorefrontTranslator;
}): CheckoutSyncState {
  if (submitState.status === "loading") {
    return {
      kind: "submit",
      title: tx(t, "storefront.checkout.sync.submitTitle", "订单提交中 / Invio ordine..."),
      message: submitState.message,
    };
  }

  if (previewQueued || preview.status === "loading") {
    return {
      kind: "preview",
      title: tx(t, "storefront.checkout.sync.previewTitle", "订单校验中 / Verifica ordine..."),
      message: tx(t, "storefront.checkout.preview.loading", "Controllo prezzi, scorte e MOQ in corso."),
    };
  }

  if (catalogResolutionPending) {
    return {
      kind: "catalog",
      title: tx(t, "storefront.checkout.sync.catalogTitle", "正在同步客户价格 / Sincronizzazione prezzi cliente..."),
      message: tx(t, "storefront.checkout.loadingTargetPrices", "Caricamento prezzi cliente per gli articoli del carrello."),
    };
  }

  if (remoteCartLoading) {
    return {
      kind: "remote-cart",
      title: tx(t, "storefront.checkout.sync.remoteCartTitle", "正在同步购物车 / Sincronizzazione carrello..."),
      message: tx(t, "storefront.checkout.sync.remoteCartMessage", "正在读取当前账号的购物车，金额和订单校验完成前无法提交。"),
    };
  }

  if (!cartHydrated) {
    return {
      kind: "cart",
      title: tx(t, "storefront.checkout.sync.cartTitle", "正在加载购物车 / Caricamento carrello..."),
      message: tx(t, "storefront.checkout.submit.cartLoadingReason", "Caricamento carrello del tuo account..."),
    };
  }

  return null;
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
      actionHref:
        runtime.actionHref ??
        (runtime.mode === "needs-profile" ? "/account?setup=1" : undefined),
      actionLabel:
        runtime.actionLabel ??
        (runtime.mode === "needs-profile"
          ? tx(t, "storefront.checkout.completeProfile", "Completa profilo")
          : undefined),
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

  if (cart.isHydrated && cart.items.length === 0) {
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
  } else if (!needsCustomerSelection && unresolvedSkus.length > 0 && !isCatalogLoading) {
    blockers.push({
      actionHref: cartHref,
      actionLabel: tx(t, "storefront.checkout.fixCart", "Torna al carrello per correggere"),
      message: `${tx(t, "storefront.checkout.unresolvedItems", "Alcune righe non sono piu disponibili.")} ${unresolvedSkus.join(", ")}`,
      title: tx(t, "storefront.cart.unresolvedTitle", "Prodotti del carrello non disponibili"),
      tone: "warning",
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
    deliveryMethod: defaultDeliveryMethod,
    notes: "",
    paymentMethod: "bank_transfer",
    useWallet: false,
  };
}

function totalsForDeliveryMethod(totals: CartTotals, deliveryMethod: DeliveryMethod): CartTotals {
  const subtotalCents = Math.max(0, Math.round(totals.subtotal * 100));
  const shippingCents = calculateShippingCents(subtotalCents, deliveryMethod);
  const shipping = shippingCents / 100;

  return {
    ...totals,
    shipping,
    total: Number((totals.subtotal + totals.vat + shipping).toFixed(2)),
  };
}

function delegatedCompanyMatchesSearch(company: CompanyProfile, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery.length === 0) {
    return true;
  }

  return [
    company.name,
    company.phone,
    company.email,
    company.partitaIva,
    company.codiceFiscale,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

function delegatedCompanyReadiness(
  t: StorefrontTranslator,
  company: CompanyProfile
) {
  if (company.profileKind === "employee_self") {
    return {
      label: tx(t, "storefront.checkout.delegated.disabled.employeeSelf", "员工自购档案不可代客下单"),
      selectable: false,
    };
  }

  if (company.status !== "approved") {
    return {
      label: txFormat(
        t,
        "storefront.checkout.delegated.disabled.status",
        "状态需处理：{status}",
        { status: companyStatusLabel(t, company.status) }
      ),
      selectable: false,
    };
  }

  if (company.assignmentStatus !== "assigned") {
    return {
      label: txFormat(
        t,
        "storefront.checkout.delegated.disabled.assignment",
        "价格未启用：{status}",
        { status: assignmentStatusLabel(t, company.assignmentStatus) }
      ),
      selectable: false,
    };
  }

  const missing = missingProfileLabels(t, customerProfileFromCompany(company));

  if (missing.length > 0) {
    return {
      label: txFormat(
        t,
        "storefront.checkout.delegated.disabled.profile",
        "资料待补全：{fields}",
        { fields: missing.join(tx(t, "storefront.common.listSeparator", ", ")) }
      ),
      selectable: false,
    };
  }

  return {
    label: tx(t, "storefront.checkout.delegated.ready", "可下单"),
    selectable: true,
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
    promoLevel: company.promoLevel ?? null,
    promoLevelStartsAt: company.promoLevelStartsAt ?? null,
    promoLevelExpiresAt: company.promoLevelExpiresAt ?? null,
    promoLevelReason: company.promoLevelReason ?? null,
    profileKind: company.profileKind ?? "customer",
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

  return [
    profile.companyName ? null : tx(t, "storefront.checkout.field.companyName", "Ragione sociale"),
    profile.email ? null : tx(t, "storefront.professional.field.email", "Email"),
    profile.phone ? null : tx(t, "storefront.account.field.phone", "Telefono"),
    profile.billingAddress ? null : tx(t, "storefront.checkout.billingAddress", "Indirizzo fatturazione"),
    profile.shippingAddress ? null : tx(t, "storefront.checkout.savedShippingAddress", "Indirizzo spedizione salvato"),
    profile.fiscalCode ? null : tx(t, "storefront.checkout.field.codiceFiscale", "Codice fiscale"),
  ].filter((label): label is string => Boolean(label));
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
        : tx(t, "storefront.checkout.customerNotReadyDescription", "Il cliente selezionato non soddisfa i requisiti ordine. Controlla stato, assegnazione e dati profilo.");
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

function customerTypeBadgeLabel(t: StorefrontTranslator, value: CompanyProfile["customerType"] | undefined) {
  if (value === "wholesale") {
    return tx(t, "storefront.customer.typeBadge.wholesale", "Cliente wholesale");
  }

  return tx(t, "storefront.customer.typeBadge.retail", "Cliente retail");
}

function customerTypeBadgeClass(value: CompanyProfile["customerType"] | undefined) {
  return value === "wholesale"
    ? "border-blue-200 bg-blue-50 text-blue-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
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

function buildOrderNotes(customerNotes: string, deliveryMethod: DeliveryMethod) {
  const details = [
    `Consegna: ${shippingMethodForDeliveryMethod(deliveryMethod)}`,
    optionalText(customerNotes) ? `Note: ${customerNotes.trim()}` : undefined,
  ].filter((value): value is string => Boolean(value));

  return details.join(" | ").slice(0, 500);
}

function expectedPreviewForOrder(preview: PreviewState) {
  if (
    preview.status !== "ready" ||
    !preview.canSubmit ||
    !preview.totals ||
    !preview.lines?.length
  ) {
    return undefined;
  }

  return {
    lines: preview.lines.map((line) => ({
      sku: line.sku,
      quantity: line.quantity,
      unitNetCents: line.unitPrice.cents,
      priceVersion: line.priceVersion ?? null,
    })),
    totals: {
      subtotalCents: preview.totals.subtotal.cents,
      shippingCents: preview.totals.shipping.cents,
      vatCents: preview.totals.vat.cents,
      totalCents: preview.totals.total.cents,
    },
  };
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
  message?: string,
  details?: CheckoutApiErrorDetails
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
      return (
        customerReadinessErrorMessage(t, details) ??
        tx(t, "storefront.checkout.error.customerNotReady", "Il profilo cliente deve essere completato prima dell'ordine.")
      );
    case "ORDER_PREVIEW_CATALOG_UNAVAILABLE":
      return tx(t, "storefront.checkout.error.catalogUnavailable", "客户价目表暂时无法加载，请稍后重试。");
    case "PRICE_ACCESS_REQUIRED":
      return tx(t, "storefront.checkout.error.priceAccess", "Il listino cliente non e ancora abilitato.");
    case "LOGIN_REQUIRED":
      return tx(t, "storefront.checkout.error.loginRequired", "Accedi prima di confermare l'ordine.");
    default:
      return message ?? tx(t, "storefront.checkout.submit.sendError", "Errore durante l'invio.");
  }
}

function isCheckoutContextError(code?: string) {
  return (
    code === "CUSTOMER_PROFILE_INCOMPLETE" ||
    code === "ORDER_CUSTOMER_NOT_READY" ||
    code === "PRICE_ACCESS_REQUIRED"
  );
}

function customerReadinessErrorMessage(
  t: StorefrontTranslator,
  details?: CheckoutApiErrorDetails
) {
  if (!details) {
    return null;
  }

  const status = details.status ?? details.accountStatus ?? null;
  const assignmentStatus = details.assignmentStatus ?? null;
  const profileComplete = Boolean(details.profileComplete ?? details.accountProfileComplete);
  const missingLabels = Array.isArray(details.missingFields)
    ? details.missingFields.map((field) => profileIssueFieldLabel(t, field)).filter(Boolean)
    : [];

  if (missingLabels.length > 0) {
    return txFormat(
      t,
      "storefront.checkout.issue.profileIncomplete",
      "Profilo cliente incompleto: {fields}.",
      { fields: missingLabels.join(tx(t, "storefront.common.listSeparator", ", ")) }
    );
  }

  if (status && status !== "approved" && status !== "active") {
    return tx(t, "storefront.checkout.customerBlocker.status", "Il cliente deve essere attivo prima di creare ordini.");
  }

  if (assignmentStatus && assignmentStatus !== "assigned") {
    return tx(t, "storefront.checkout.customerBlocker.assignment", "Il cliente deve essere assegnato a un listino prima dell'ordine.");
  }

  if (profileComplete) {
    return tx(
      t,
      "storefront.checkout.error.customerContextStale",
      "客户资料已完整，结账页面资料可能仍是旧状态。页面已刷新，请再提交一次。"
    );
  }

  return null;
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

function moneyDtoToNumber(value: MoneyDto | undefined) {
  const amount = value ? Number(value.amount) : Number.NaN;

  return Number.isFinite(amount) ? amount : undefined;
}
