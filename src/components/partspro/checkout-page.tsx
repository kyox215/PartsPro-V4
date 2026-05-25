import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Database,
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
import { companyProfiles } from "@/lib/partspro-data";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { CheckoutSubmitButton } from "./checkout-submit-button";
import { OrderSummaryCard } from "./cart-page";
import { StoreHeader } from "./store-header";

const checkoutFormId = "partspro-checkout-form";

type CheckoutRuntime =
  | {
      mode: "demo";
      canSubmit: true;
      title: string;
      description: string;
    }
  | {
      mode: "ready";
      canSubmit: true;
      title: string;
      description: string;
      userEmail: string;
    }
  | {
      mode: "needs-login" | "error";
      canSubmit: false;
      title: string;
      description: string;
      disabledReason: string;
    };

const paymentOptions = [
  {
    value: "bank_transfer",
    label: "Bonifico bancario",
    description: "Crea ordine in attesa di pagamento.",
  },
  {
    value: "card",
    label: "Carta aziendale",
    description: "Metodo registrato nel gestionale.",
  },
  {
    value: "agreed_terms",
    label: "Pagamento concordato",
    description: "Solo per clienti con termini approvati.",
  },
] as const;

const deliveryOptions = [
  {
    value: "express_24_48",
    label: "Corriere espresso 24/48h",
    description: "GLS/BRT con tracking e consegna in Italia lavorativa.",
    detail: "Gratis sopra 250 EUR imponibile",
  },
  {
    value: "insured_express",
    label: "Espresso assicurato",
    description: "Copertura merce per display e ricambi ad alto valore.",
    detail: "Priorità magazzino Milano",
  },
  {
    value: "pickup_milano",
    label: "Ritiro sede Milano",
    description: "Preparazione banco e ritiro da parte del cliente B2B.",
    detail: "Disponibile su appuntamento",
  },
] as const;

export async function CheckoutPage() {
  const runtime = await getCheckoutRuntime();
  const company = companyProfiles[0];
  const fieldGroups = [
    {
      title: "Dati azienda",
      icon: Building2,
      fields: [
        { label: "Ragione sociale", name: "companyName", value: company.name },
        { label: "Partita IVA", name: "partitaIva", value: company.partitaIva },
        { label: "Codice fiscale", name: "codiceFiscale", value: company.codiceFiscale },
      ],
    },
    {
      title: "Fatturazione elettronica",
      icon: FileText,
      fields: [
        { label: "PEC", name: "pec", value: company.pec },
        {
          label: "Codice destinatario",
          name: "codiceDestinatario",
          value: company.codiceDestinatario,
        },
      ],
    },
    {
      title: "Indirizzo spedizione",
      icon: MapPin,
      fields: [
        { label: "Via", name: "shippingStreet", value: "Via Torino 24" },
        { label: "CAP", name: "shippingZip", value: "20123" },
        { label: "Comune", name: "shippingCity", value: company.city },
        { label: "Provincia", name: "shippingProvince", value: company.province },
      ],
    },
  ];

  return (
    <main className="min-h-screen text-slate-950">
      <StoreHeader />
      <div className="mx-auto grid max-w-[1300px] gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form id={checkoutFormId} className="space-y-4">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge className="border border-primary/20 bg-primary/8 text-primary">
                Checkout B2B
              </Badge>
              <RuntimeBadge runtime={runtime} />
            </div>
            <h1 className="text-3xl font-black tracking-normal md:text-4xl">
              Conferma ordine e dati fiscali
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              I dati vengono preparati come snapshot ordine per fattura,
              spedizione e gestione RMA. L&apos;invio usa l&apos;endpoint
              esistente /api/orders con le righe salvate nel carrello locale.
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
                Consegna
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
                <Label htmlFor="deliveryWindow">Fascia consegna preferita</Label>
                <Input
                  id="deliveryWindow"
                  name="deliveryWindow"
                  defaultValue="Mattina, 09:00-13:00"
                  maxLength={80}
                  placeholder="Es. mattina, pomeriggio, ritiro su appuntamento"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="size-5 text-primary" />
                Pagamento
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
                <Label htmlFor="purchaseOrderNumber">Riferimento interno / PO</Label>
                <Input
                  id="purchaseOrderNumber"
                  name="purchaseOrderNumber"
                  defaultValue="PO-DEMO-2026-0524"
                  maxLength={64}
                  placeholder="Es. PO-2026-0524"
                />
              </div>
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor="notes">Note ordine</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  maxLength={500}
                  placeholder="Es. consegna solo mattina, riferimento interno..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="size-5 text-primary" />
                Conferme prima dell&apos;invio
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <ConfirmLine
                id="invoiceConfirmed"
                label="Confermo che Partita IVA, codice fiscale, PEC e codice destinatario sono corretti per la fattura elettronica."
              />
              <ConfirmLine
                id="addressConfirmed"
                label="Confermo che l'indirizzo di spedizione e la fascia consegna sono aggiornati."
              />
              <ConfirmLine
                id="stockPolicyConfirmed"
                label="Accetto che disponibilità, MOQ e tempi di evasione seguano lo stato magazzino mostrato nel checkout."
              />
            </CardContent>
          </Card>
        </form>

        <div className="space-y-4">
          <OrderSummaryCard showCheckoutAction={false} consumeUrlIntent />
          <RuntimeStatusCard runtime={runtime} />
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="flex gap-3 p-4 text-sm text-emerald-900">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              <div className="min-w-0">
                <div className="font-black">Cliente B2B approvato</div>
                <p className="mt-1 leading-6">
                  Il profilo azienda demo è approvato, quindi /api/orders accetta
                  l&apos;ordine e restituisce numero, stato e totali.
                </p>
              </div>
            </CardContent>
          </Card>
          <CheckoutSubmitButton
            formId={checkoutFormId}
            disabled={!runtime.canSubmit}
            disabledReason={!runtime.canSubmit ? runtime.disabledReason : undefined}
            runtimeMode={runtime.canSubmit ? runtime.mode : "disabled"}
          />
        </div>
      </div>
    </main>
  );
}

async function getCheckoutRuntime(): Promise<CheckoutRuntime> {
  if (!isSupabaseConfigured()) {
    return {
      mode: "demo",
      canSubmit: true,
      title: "Modalità demo API",
      description:
        "Supabase non ha ancora la publishable key. Puoi testare /api/orders con dati demo locali e righe lette dal carrello del browser.",
    };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        mode: "needs-login",
        canSubmit: false,
        title: "Checkout disabilitato",
        description:
          "Supabase è configurato: accedi con un account B2B per associare il checkout alla sessione.",
        disabledReason: "Checkout disabilitato: effettua il login prima di confermare l'ordine.",
      };
    }

    return {
      mode: "ready",
      canSubmit: true,
      userEmail: user.email ?? "utente Supabase",
      title: "Checkout pronto",
      description:
        "Sessione Supabase attiva. L'ordine viene inviato all'API esistente /api/orders.",
    };
  } catch {
    return {
      mode: "error",
      canSubmit: false,
      title: "Checkout disabilitato",
      description:
        "La configurazione risulta presente, ma non è stato possibile leggere la sessione Supabase.",
      disabledReason: "Checkout disabilitato: sessione Supabase non verificata. Riprova dopo il login o controlla .env.local.",
    };
  }
}

function RuntimeBadge({ runtime }: { runtime: CheckoutRuntime }) {
  if (runtime.mode === "ready") {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
        Supabase attivo
      </Badge>
    );
  }

  if (runtime.mode === "demo") {
    return (
      <Badge className="border border-amber-200 bg-amber-50 text-amber-700">
        Demo API
      </Badge>
    );
  }

  return (
    <Badge className="border border-red-200 bg-red-50 text-red-700">
      Disabilitato
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

function RuntimeStatusCard({ runtime }: { runtime: CheckoutRuntime }) {
  const Icon =
    runtime.mode === "ready" ? CheckCircle2 : runtime.mode === "demo" ? Database : AlertTriangle;
  const className =
    runtime.mode === "ready"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : runtime.mode === "demo"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-red-200 bg-red-50 text-red-800";
  const iconClassName =
    runtime.mode === "ready"
      ? "text-emerald-600"
      : runtime.mode === "demo"
        ? "text-amber-600"
        : "text-red-600";

  return (
    <Card className={className}>
      <CardContent className="flex gap-3 p-4 text-sm">
        <Icon className={`mt-0.5 size-5 shrink-0 ${iconClassName}`} />
        <div className="min-w-0">
          <div className="font-black">{runtime.title}</div>
          <p className="mt-1 leading-6">{runtime.description}</p>
          {runtime.mode === "ready" && (
            <div className="mt-2 break-words text-xs font-bold">{runtime.userEmail}</div>
          )}
          {runtime.mode === "needs-login" && (
            <Button asChild size="sm" className="mt-3">
              <Link href="/login?next=/checkout">
                <LogIn className="size-4" />
                Accedi
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
