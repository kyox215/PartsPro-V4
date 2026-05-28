import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileText,
  LogIn,
  MapPin,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { tx, txFormat, type StorefrontTranslator } from "@/i18n/dictionaries/storefront";
import { getDictionary, translate } from "@/i18n/get-dictionary";
import { getRequestI18n } from "@/i18n/request";
import {
  applyAccountPriceToProduct,
  getCurrentAccountContext,
} from "@/lib/partspro-account-context";
import { type CompanyProfile } from "@/lib/partspro-data";
import { listCatalogProducts, listCompanies } from "@/lib/partspro-repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { CartCatalogProvider } from "./cart-state";
import { CheckoutSubmitButton } from "./checkout-submit-button";
import { OrderSummaryCard } from "./cart-page";
import { StoreHeader } from "./store-header";

const checkoutFormId = "partspro-checkout-form";

type CheckoutRuntime =
  | {
      mode: "ready";
      canSubmit: true;
      title: string;
      description: string;
      customerId: string;
      userEmail: string;
    }
  | {
      mode: "needs-login" | "needs-profile" | "error";
      canSubmit: false;
      title: string;
      description: string;
      disabledReason: string;
      customerId?: string;
      userEmail?: string;
    };

export async function CheckoutPage() {
  const { locale } = await getRequestI18n();
  const dictionary = getDictionary(locale);
  const t: StorefrontTranslator = (key) => translate(dictionary, key);
  const paymentOptions = getPaymentOptions(t);
  const deliveryOptions = getDeliveryOptions(t);
  const [runtime, accountForCatalog, catalog] = await Promise.all([
    getCheckoutRuntime(t),
    getCurrentAccountContext({ ensure: true }),
    listCatalogProducts(),
  ]);
  const catalogProducts = catalog.data.map((product) =>
    applyAccountPriceToProduct(product, accountForCatalog)
  );
  const company =
    runtime.mode === "ready" || runtime.mode === "needs-profile"
      ? await getCheckoutCompany(runtime.customerId)
      : null;
  const companyDisabledReason =
    runtime.mode === "ready" && !company
      ? tx(t, "storefront.checkout.disabledCompanyReason", "Checkout disabilitato: collega un profilo cliente all'utente Supabase.")
      : undefined;
  const fieldGroups = [
    {
      title: tx(t, "storefront.checkout.group.company", "Dati azienda"),
      icon: Building2,
      fields: [
        { label: tx(t, "storefront.checkout.field.companyName", "Ragione sociale"), name: "companyName", value: company?.name ?? "" },
        { label: tx(t, "storefront.checkout.field.partitaIva", "Partita IVA"), name: "partitaIva", value: company?.partitaIva ?? "" },
        { label: tx(t, "storefront.checkout.field.codiceFiscale", "Codice fiscale"), name: "codiceFiscale", value: company?.codiceFiscale ?? "" },
      ],
    },
    {
      title: tx(t, "storefront.checkout.group.invoice", "Fatturazione elettronica"),
      icon: FileText,
      fields: [
        { label: tx(t, "storefront.checkout.field.pec", "PEC"), name: "pec", value: company?.pec ?? "" },
        {
          label: tx(t, "storefront.checkout.field.codiceDestinatario", "Codice destinatario"),
          name: "codiceDestinatario",
          value: company?.codiceDestinatario ?? "",
        },
      ],
    },
    {
      title: tx(t, "storefront.checkout.group.shippingAddress", "Indirizzo spedizione"),
      icon: MapPin,
      fields: [
        { label: tx(t, "storefront.checkout.field.shippingStreet", "Via"), name: "shippingStreet", value: "" },
        { label: tx(t, "storefront.checkout.field.shippingZip", "CAP"), name: "shippingZip", value: "" },
        { label: tx(t, "storefront.checkout.field.shippingCity", "Comune"), name: "shippingCity", value: company?.city ?? "" },
        { label: tx(t, "storefront.checkout.field.shippingProvince", "Provincia"), name: "shippingProvince", value: company?.province ?? "" },
      ],
    },
  ];

  return (
    <CartCatalogProvider products={catalogProducts}>
      <main className="min-h-screen overflow-x-hidden bg-[#f4f6fa] text-slate-950">
        <StoreHeader />
        <div className="mx-auto grid max-w-[1300px] gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <form id={checkoutFormId} className="space-y-4">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge className="border border-primary/20 bg-primary/8 text-primary">
                {tx(t, "storefront.checkout.badge", "Checkout clienti")}
              </Badge>
              <RuntimeBadge runtime={runtime} t={t} />
            </div>
            <h1 className="text-3xl font-black tracking-normal md:text-4xl">
              {tx(t, "storefront.checkout.title", "Conferma ordine e dati fiscali")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {tx(t, "storefront.checkout.description", "I dati vengono preparati come snapshot ordine per fattura, spedizione e gestione RMA. L'invio usa l'endpoint esistente /api/orders con le righe salvate nel carrello locale.")}
            </p>
          </div>

          {fieldGroups.map((group) => (
            <Card key={group.title} className="border-slate-200 bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <group.icon className="size-5 text-primary" />
                  {group.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {group.fields.map((field) => (
                  <div key={field.name} className="space-y-2">
                    <Label htmlFor={field.name}>{field.label}</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      defaultValue={field.value}
                      maxLength={120}
                      required
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="size-5 text-primary" />
                {tx(t, "storefront.checkout.group.delivery", "Consegna")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {deliveryOptions.map((option, index) => (
                <label
                  key={option.value}
                  htmlFor={`delivery-${option.value}`}
                  className="flex min-h-32 cursor-pointer gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left text-sm transition hover:border-primary/40 hover:bg-primary/8"
                >
                  <input
                    id={`delivery-${option.value}`}
                    className="mt-0.5 size-4 accent-primary"
                    type="radio"
                    name="deliveryMethod"
                    value={option.value}
                    defaultChecked={index === 0}
                    required
                  />
                  <span className="min-w-0">
                    <span className="block font-black">{option.label}</span>
                    <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">
                      {option.description}
                    </span>
                    <span className="mt-2 block text-xs font-black text-primary">
                      {option.detail}
                    </span>
                  </span>
                </label>
              ))}
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor="deliveryWindow">{tx(t, "storefront.checkout.field.deliveryWindow", "Fascia consegna preferita")}</Label>
                <Input
                  id="deliveryWindow"
                  name="deliveryWindow"
                  defaultValue="Mattina, 09:00-13:00"
                  maxLength={80}
                  placeholder={tx(t, "storefront.checkout.field.deliveryWindowPlaceholder", "Es. mattina, pomeriggio, ritiro su appuntamento")}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="size-5 text-primary" />
                {tx(t, "storefront.checkout.group.payment", "Pagamento")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {paymentOptions.map((option, index) => (
                <label
                  key={option.value}
                  htmlFor={`payment-${option.value}`}
                  className="flex min-h-24 cursor-pointer gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left text-sm transition hover:border-primary/40 hover:bg-primary/8"
                >
                  <input
                    id={`payment-${option.value}`}
                    className="mt-0.5 size-4 accent-primary"
                    type="radio"
                    name="paymentMethod"
                    value={option.value}
                    defaultChecked={index === 0}
                  />
                  <span className="min-w-0">
                    <span className="block font-black">{option.label}</span>
                    <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor="purchaseOrderNumber">{tx(t, "storefront.checkout.field.purchaseOrderNumber", "Riferimento interno / PO")}</Label>
                <Input
                  id="purchaseOrderNumber"
                  name="purchaseOrderNumber"
                  maxLength={64}
                  placeholder={tx(t, "storefront.checkout.field.purchaseOrderPlaceholder", "Es. PO-2026-0524")}
                />
              </div>
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor="notes">{tx(t, "storefront.checkout.field.notes", "Note ordine")}</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  maxLength={500}
                  placeholder={tx(t, "storefront.checkout.field.notesPlaceholder", "Es. consegna solo mattina, riferimento interno...")}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="size-5 text-primary" />
                {tx(t, "storefront.checkout.confirmTitle", "Conferme prima dell'invio")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <ConfirmLine
                id="invoiceConfirmed"
                label={tx(t, "storefront.checkout.confirm.invoice", "Confermo che Partita IVA, codice fiscale, PEC e codice destinatario sono corretti per la fattura elettronica.")}
              />
              <ConfirmLine
                id="addressConfirmed"
                label={tx(t, "storefront.checkout.confirm.address", "Confermo che l'indirizzo di spedizione e la fascia consegna sono aggiornati.")}
              />
              <ConfirmLine
                id="stockPolicyConfirmed"
                label={tx(t, "storefront.checkout.confirm.stockPolicy", "Accetto che disponibilità, MOQ e tempi di evasione seguano lo stato magazzino mostrato nel checkout.")}
              />
            </CardContent>
          </Card>
        </form>

        <div className="space-y-4">
          <OrderSummaryCard showCheckoutAction={false} consumeUrlIntent />
          <RuntimeStatusCard runtime={runtime} t={t} />
          <CompanyStatusCard company={company} t={t} />
          <CheckoutSubmitButton
            companyId={company?.id}
            formId={checkoutFormId}
            disabled={!runtime.canSubmit || !company}
            disabledReason={
              !runtime.canSubmit ? runtime.disabledReason : companyDisabledReason
            }
            runtimeMode={runtime.canSubmit && company ? "ready" : "disabled"}
          />
          </div>
        </div>
      </main>
    </CartCatalogProvider>
  );
}

function getPaymentOptions(t: StorefrontTranslator) {
  return [
    {
      value: "bank_transfer",
      label: tx(t, "storefront.checkout.option.bankTransfer.label", "Bonifico bancario"),
      description: tx(t, "storefront.checkout.option.bankTransfer.description", "Crea ordine in attesa di pagamento."),
    },
    {
      value: "card",
      label: tx(t, "storefront.checkout.option.card.label", "Carta aziendale"),
      description: tx(t, "storefront.checkout.option.card.description", "Metodo registrato nel gestionale."),
    },
    {
      value: "agreed_terms",
      label: tx(t, "storefront.checkout.option.agreedTerms.label", "Pagamento concordato"),
      description: tx(t, "storefront.checkout.option.agreedTerms.description", "Solo per clienti con termini approvati."),
    },
  ] as const;
}

function getDeliveryOptions(t: StorefrontTranslator) {
  return [
    {
      value: "express_24_48",
      label: tx(t, "storefront.checkout.option.express.label", "Corriere espresso 24/48h"),
      description: tx(t, "storefront.checkout.option.express.description", "GLS/BRT con tracking e consegna in Italia lavorativa."),
      detail: tx(t, "storefront.checkout.option.express.detail", "Gratis sopra 250 EUR imponibile"),
    },
    {
      value: "insured_express",
      label: tx(t, "storefront.checkout.option.insured.label", "Espresso assicurato"),
      description: tx(t, "storefront.checkout.option.insured.description", "Copertura merce per display e ricambi ad alto valore."),
      detail: tx(t, "storefront.checkout.option.insured.detail", "Priorità magazzino Milano"),
    },
    {
      value: "pickup_milano",
      label: tx(t, "storefront.checkout.option.pickup.label", "Ritiro sede Milano"),
      description: tx(t, "storefront.checkout.option.pickup.description", "Preparazione banco e ritiro da parte del cliente."),
      detail: tx(t, "storefront.checkout.option.pickup.detail", "Disponibile su appuntamento"),
    },
  ] as const;
}

async function getCheckoutRuntime(t: StorefrontTranslator): Promise<CheckoutRuntime> {
  if (!isSupabaseConfigured()) {
    return {
      mode: "error",
      canSubmit: false,
      title: tx(t, "storefront.checkout.runtime.disabled", "Checkout disabilitato"),
      description: tx(t, "storefront.checkout.runtime.missingSupabaseDescription", "Supabase non è configurato. Aggiungi le variabili Supabase prima di accettare ordini reali."),
      disabledReason: tx(t, "storefront.checkout.runtime.missingSupabaseReason", "Checkout disabilitato: configurazione Supabase mancante."),
    };
  }

  try {
    const {
      authenticated,
      canCheckout,
      customer,
      email,
    } = await getCurrentAccountContext({ ensure: true });

    if (!authenticated) {
      return {
        mode: "needs-login",
        canSubmit: false,
        title: tx(t, "storefront.checkout.runtime.disabled", "Checkout disabilitato"),
        description: tx(t, "storefront.checkout.runtime.loginDescription", "Supabase è configurato: accedi per associare il checkout alla sessione."),
        disabledReason: tx(t, "storefront.checkout.runtime.loginReason", "Checkout disabilitato: effettua il login prima di confermare l'ordine."),
      };
    }

    if (!canCheckout) {
      return {
        mode: "needs-profile",
        canSubmit: false,
        customerId: customer?.id,
        userEmail: email ?? "utente Supabase",
        title: tx(t, "storefront.checkout.runtime.needsProfileTitle", "Dati cliente da completare"),
        description: tx(t, "storefront.checkout.runtime.needsProfileDescription", "Puoi vedere i prezzi e preparare il carrello, ma prima dell'ordine devi completare dati fiscali, contatto e indirizzi richiesti dal tipo cliente."),
        disabledReason: tx(t, "storefront.checkout.runtime.needsProfileReason", "Checkout disabilitato: completa dati fiscali, contatto e indirizzi nel profilo cliente."),
      };
    }

    return {
      mode: "ready",
      canSubmit: true,
      customerId: customer?.id ?? "",
      userEmail: email ?? "utente Supabase",
      title: tx(t, "storefront.checkout.runtime.readyTitle", "Checkout pronto"),
      description: tx(t, "storefront.checkout.runtime.readyDescription", "Sessione Supabase attiva. L'ordine viene inviato all'API esistente /api/orders."),
    };
  } catch {
    return {
      mode: "error",
      canSubmit: false,
      title: tx(t, "storefront.checkout.runtime.disabled", "Checkout disabilitato"),
      description: tx(t, "storefront.checkout.runtime.sessionErrorDescription", "La configurazione risulta presente, ma non è stato possibile leggere la sessione Supabase."),
      disabledReason: tx(t, "storefront.checkout.runtime.sessionErrorReason", "Checkout disabilitato: sessione Supabase non verificata. Riprova dopo il login o controlla .env.local."),
    };
  }
}

async function getCheckoutCompany(customerId?: string): Promise<CompanyProfile | null> {
  const companies = await listCompanies();
  const assignedCompany = customerId
    ? companies.data.find((company) => company.id === customerId)
    : null;

  return (
    assignedCompany ??
    companies.data.find((company) => company.status === "approved") ??
    companies.data[0] ??
    null
  );
}

function RuntimeBadge({
  runtime,
  t,
}: {
  runtime: CheckoutRuntime;
  t: StorefrontTranslator;
}) {
  if (runtime.mode === "ready") {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
        {tx(t, "storefront.checkout.runtime.readyBadge", "Supabase attivo")}
      </Badge>
    );
  }

  return (
    <Badge className="border border-red-200 bg-red-50 text-red-700">
      {tx(t, "storefront.checkout.runtime.disabled", "Disabilitato")}
    </Badge>
  );
}

function ConfirmLine({ id, label }: { id: string; label: string }) {
  return (
    <label
      htmlFor={id}
      className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold leading-6 text-slate-700"
    >
      <input
        id={id}
        name={id}
        type="checkbox"
        required
        className="mt-1 size-4 shrink-0 accent-primary"
      />
      <span className="min-w-0">{label}</span>
    </label>
  );
}

function RuntimeStatusCard({
  runtime,
  t,
}: {
  runtime: CheckoutRuntime;
  t: StorefrontTranslator;
}) {
  const Icon = runtime.mode === "ready" ? CheckCircle2 : AlertTriangle;
  const className =
    runtime.mode === "ready"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-red-200 bg-red-50 text-red-800";
  const iconClassName =
    runtime.mode === "ready"
      ? "text-emerald-600"
      : "text-red-600";

  return (
    <Card className={className}>
      <CardContent className="flex gap-3 p-4 text-sm">
        <Icon className={`mt-0.5 size-5 shrink-0 ${iconClassName}`} />
        <div className="min-w-0">
          <div className="font-black">{runtime.title}</div>
          <p className="mt-1 leading-6">{runtime.description}</p>
          {(runtime.mode === "ready" || runtime.mode === "needs-profile") && runtime.userEmail && (
            <div className="mt-2 break-words text-xs font-bold">{runtime.userEmail}</div>
          )}
          {runtime.mode === "needs-login" && (
            <Button asChild size="sm" className="mt-3">
              <Link href="/login?next=/checkout">
                <LogIn className="size-4" />
                {tx(t, "storefront.login.action", "Accedi")}
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CompanyStatusCard({
  company,
  t,
}: {
  company: CompanyProfile | null;
  t: StorefrontTranslator;
}) {
  if (!company) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="flex gap-3 p-4 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <div className="font-black">
              {tx(t, "storefront.checkout.companyMissingTitle", "Profilo cliente mancante")}
            </div>
            <p className="mt-1 leading-6">
              {tx(t, "storefront.checkout.companyMissingDescription", "Nessun cliente è collegato alla sessione corrente. Crea o completa il profilo in gestione clienti prima del checkout.")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50">
      <CardContent className="flex gap-3 p-4 text-sm text-emerald-900">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <div className="font-black">
            {tx(t, "storefront.checkout.companyLinkedTitle", "Cliente collegato")}
          </div>
          <p className="mt-1 leading-6">
            {txFormat(t, "storefront.checkout.companyLinkedDescription", "{name} verrà usato come profilo fiscale per /api/orders.", { name: company.name })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
