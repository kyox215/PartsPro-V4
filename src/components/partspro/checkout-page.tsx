import { tx, type StorefrontTranslator } from "@/i18n/dictionaries/storefront";
import { getDictionary, translate } from "@/i18n/get-dictionary";
import { getRequestI18n } from "@/i18n/request";
import {
  applyAccountPriceToProduct,
  canDelegateCheckout,
  getCurrentAccountContext,
  type AccountContext,
} from "@/lib/partspro-account-context";
import { type CompanyProfile, type PartProduct } from "@/lib/partspro-data";
import {
  getCurrentCustomerProfile,
  listCatalogProducts,
  listCompanies,
  listCurrentCustomerCompanies,
} from "@/lib/partspro-repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  CheckoutClient,
  type CheckoutRuntimeView,
} from "./checkout-client";

export async function CheckoutPage({
  requestedCompanyId = null,
}: {
  requestedCompanyId?: string | null;
} = {}) {
  const { locale } = await getRequestI18n();
  const dictionary = getDictionary(locale);
  const t: StorefrontTranslator = (key) => translate(dictionary, key);
  const account = await getCurrentAccountContext({ ensure: true });
  const delegatedCheckout = canDelegateCheckout(account);
  const runtime = getCheckoutRuntime(t, account, delegatedCheckout);
  const [companies, catalog, customerProfile] = await Promise.all([
    delegatedCheckout ? listCompanies() : listCurrentCustomerCompanies(),
    listCatalogProducts(),
    getCurrentCustomerProfile(),
  ]);
  const company = delegatedCheckout
    ? null
    : resolveCheckoutCompany(account, companies.data);
  const catalogProducts = catalog.data
    .map((product) => applyAccountPriceToProduct(product, account))
    .filter(isCheckoutOrderableProduct);

  return (
    <CheckoutClient
      catalogProducts={catalogProducts}
      company={company}
      companies={delegatedCheckout ? companies.data : []}
      customerProfile={customerProfile.data}
      delegatedCheckout={delegatedCheckout}
      initialSelectedCompanyId={delegatedCheckout ? requestedCompanyId : null}
      runtime={runtime}
    />
  );
}

function getCheckoutRuntime(
  t: StorefrontTranslator,
  account: AccountContext,
  delegatedCheckout: boolean
): CheckoutRuntimeView {
  if (!isSupabaseConfigured()) {
    return {
      mode: "error",
      canSubmit: false,
      title: tx(t, "storefront.checkout.runtime.disabled", "Checkout disabilitato"),
      description: tx(t, "storefront.checkout.runtime.missingSupabaseDescription", "Il checkout non e configurato per accettare ordini reali."),
      disabledReason: tx(t, "storefront.checkout.runtime.missingSupabaseReason", "Checkout disabilitato: configurazione ordini mancante."),
    };
  }

  if (!account.authenticated) {
    return {
      mode: "needs-login",
      canSubmit: false,
      title: tx(t, "storefront.checkout.runtime.disabled", "Checkout disabilitato"),
      description: tx(t, "storefront.checkout.runtime.loginDescription", "Accedi per associare il checkout al tuo account cliente."),
      disabledReason: tx(t, "storefront.checkout.runtime.loginReason", "Checkout disabilitato: effettua il login prima di confermare l'ordine."),
    };
  }

  if (account.customer && !account.canViewPrices) {
    return {
      mode: "needs-profile",
      canSubmit: false,
      title: tx(t, "storefront.checkout.runtime.priceAccessTitle", "Listino da abilitare"),
      description: tx(t, "storefront.checkout.runtime.priceAccessDescription", "Il checkout richiede un cliente professionale abilitato e un prezzo effettivo valido per ogni SKU."),
      disabledReason: tx(t, "storefront.checkout.runtime.priceAccessReason", "Checkout disabilitato: il listino cliente non e ancora abilitato."),
      userEmail: account.email ?? undefined,
    };
  }

  if (!account.canCheckout && !delegatedCheckout) {
    return {
      mode: "needs-profile",
      canSubmit: false,
      title: tx(t, "storefront.checkout.runtime.needsProfileTitle", "Dati cliente da completare"),
      description: tx(t, "storefront.checkout.runtime.needsProfileDescription", "Completa dati fiscali, contatto, fatturazione e spedizione prima di confermare l'ordine."),
      disabledReason: tx(t, "storefront.checkout.runtime.needsProfileReason", "Checkout disabilitato: completa dati cliente e abilitazione professionale."),
      userEmail: account.email ?? undefined,
    };
  }

  return {
    mode: "ready",
    canSubmit: true,
    title: tx(t, "storefront.checkout.runtime.readyTitle", "Checkout pronto"),
    description: delegatedCheckout
      ? tx(t, "storefront.checkout.runtime.delegatedReadyDescription", "Seleziona un cliente: prezzi e ordine useranno il profilo cliente scelto.")
      : tx(t, "storefront.checkout.runtime.readyDescription", "Account verificato. L'ordine verra inviato al gestionale dopo il controllo finale."),
    userEmail: account.email ?? undefined,
  };
}

function resolveCheckoutCompany(
  account: AccountContext,
  companies: CompanyProfile[]
) {
  if (!account.customer?.id) {
    return null;
  }

  return companies.find((company) => company.id === account.customer?.id) ?? null;
}

function isCheckoutOrderableProduct(product: PartProduct) {
  return (
    product.price > 0 &&
    product.status !== "Out of Stock" &&
    product.stock >= Math.max(1, product.moq)
  );
}
