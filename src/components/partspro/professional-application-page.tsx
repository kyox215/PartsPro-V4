"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  FileCheck2,
  Loader2,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { tx } from "@/i18n/dictionaries/storefront";
import type { StoreHeaderAccountAccess } from "@/lib/partspro-header-access";
import { StoreHeader } from "./store-header";
import { useT } from "./i18n-provider";

type ProfessionalApplicationPageProps = {
  initialAccountAccess?: StoreHeaderAccountAccess;
};

type ProfessionalForm = {
  address: string;
  city: string;
  codiceDestinatario: string;
  codiceFiscale: string;
  companyName: string;
  contactName: string;
  email: string;
  notes: string;
  partitaIva: string;
  pec: string;
  phone: string;
  province: string;
  website: string;
};

type SubmitState =
  | { status: "idle"; message: string }
  | { status: "loading"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const initialForm: ProfessionalForm = {
  address: "",
  city: "",
  codiceDestinatario: "",
  codiceFiscale: "",
  companyName: "",
  contactName: "",
  email: "",
  notes: "",
  partitaIva: "",
  pec: "",
  phone: "",
  province: "",
  website: "",
};

export function ProfessionalApplicationPage({
  initialAccountAccess,
}: ProfessionalApplicationPageProps) {
  const t = useT();
  const [form, setForm] = React.useState<ProfessionalForm>(initialForm);
  const [acceptsPrivacy, setAcceptsPrivacy] = React.useState(false);
  const [acceptsTerms, setAcceptsTerms] = React.useState(false);
  const [submitState, setSubmitState] = React.useState<SubmitState>({
    status: "idle",
    message: tx(
      t,
      "storefront.professional.status.idle",
      "Compila i dati aziendali per richiedere l'accesso clienti professionali."
    ),
  });

  function updateField<Key extends keyof ProfessionalForm>(
    key: Key,
    value: ProfessionalForm[Key]
  ) {
    setForm((current) => ({ ...current, [key]: value }));

    if (submitState.status === "error" || submitState.status === "success") {
      setSubmitState({
        status: "idle",
        message: tx(
          t,
          "storefront.professional.status.changed",
          "Modifiche pronte. Invia di nuovo la richiesta quando vuoi."
        ),
      });
    }
  }

  async function submitApplication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!acceptsTerms || !acceptsPrivacy) {
      setSubmitState({
        status: "error",
        message: tx(
          t,
          "storefront.professional.status.consentRequired",
          "Accetta condizioni e privacy prima di inviare la richiesta."
        ),
      });
      return;
    }

    setSubmitState({
      status: "loading",
      message: tx(
        t,
        "storefront.professional.status.loading",
        "Invio richiesta in corso..."
      ),
    });

    try {
      const response = await fetch("/api/b2b-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildApplicationPayload(form)),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        throw new Error(
          payload?.error?.message ??
            tx(
              t,
              "storefront.professional.status.rejected",
              "Richiesta non accettata. Controlla i campi e riprova."
            )
        );
      }

      setSubmitState({
        status: "success",
        message: tx(
          t,
          "storefront.professional.status.success",
          "Richiesta inviata. Il team PartsPro controllerà i dati e ti contatterà via email."
        ),
      });
      setForm(initialForm);
      setAcceptsPrivacy(false);
      setAcceptsTerms(false);
    } catch (error) {
      setSubmitState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : tx(
              t,
              "storefront.professional.status.error",
              "Errore durante l'invio della richiesta."
            ),
      });
    }
  }

  const statusTone =
    submitState.status === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : submitState.status === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6fa] text-slate-950">
      <StoreHeader initialAccountAccess={initialAccountAccess} />
      <div className="mx-auto grid max-w-[1320px] gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
            <Badge className="mb-3 border border-primary/20 bg-primary/8 text-primary">
              {tx(
                t,
                "storefront.professional.badge",
                "Richiesta accesso clienti professionali"
              )}
            </Badge>
            <h1 className="max-w-3xl text-3xl font-black tracking-normal md:text-4xl">
              {tx(
                t,
                "storefront.professional.title",
                "Richiedi accesso clienti professionali"
              )}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {tx(
                t,
                "storefront.professional.description",
                "Invia i dati aziendali per abilitare prezzi professionali, condizioni dedicate e checkout con fatturazione elettronica."
              )}
            </p>
          </div>

          <Card className="border-slate-200 bg-white">
            <form onSubmit={submitApplication}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="size-5 text-primary" />
                  {tx(t, "storefront.professional.form.title", "Dati azienda")}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={tx(t, "storefront.professional.field.companyName", "Ragione sociale")}
                  htmlFor="professional-company-name"
                >
                  <Input
                    id="professional-company-name"
                    value={form.companyName}
                    onChange={(event) => updateField("companyName", event.target.value)}
                    maxLength={120}
                    required
                  />
                </Field>
                <Field
                  label={tx(t, "storefront.professional.field.contactName", "Referente")}
                  htmlFor="professional-contact-name"
                >
                  <Input
                    id="professional-contact-name"
                    value={form.contactName}
                    onChange={(event) => updateField("contactName", event.target.value)}
                    maxLength={120}
                    required
                  />
                </Field>
                <Field
                  label={tx(t, "storefront.professional.field.partitaIva", "Partita IVA")}
                  htmlFor="professional-partita-iva"
                >
                  <Input
                    id="professional-partita-iva"
                    value={form.partitaIva}
                    onChange={(event) => updateField("partitaIva", event.target.value)}
                    autoCapitalize="characters"
                    maxLength={13}
                    placeholder="IT12345678901"
                    required
                  />
                </Field>
                <Field
                  label={tx(t, "storefront.professional.field.codiceFiscale", "Codice fiscale")}
                  htmlFor="professional-codice-fiscale"
                >
                  <Input
                    id="professional-codice-fiscale"
                    value={form.codiceFiscale}
                    onChange={(event) => updateField("codiceFiscale", event.target.value)}
                    autoCapitalize="characters"
                    maxLength={16}
                    required
                  />
                </Field>
                <Field
                  label={tx(t, "storefront.professional.field.email", "Email")}
                  htmlFor="professional-email"
                >
                  <Input
                    id="professional-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    maxLength={160}
                    placeholder="buyer@azienda.it"
                    required
                  />
                </Field>
                <Field
                  label={tx(t, "storefront.professional.field.phone", "Telefono")}
                  htmlFor="professional-phone"
                >
                  <Input
                    id="professional-phone"
                    value={form.phone}
                    onChange={(event) => updateField("phone", event.target.value)}
                    maxLength={40}
                  />
                </Field>
                <Field
                  label={tx(t, "storefront.professional.field.city", "Comune")}
                  htmlFor="professional-city"
                >
                  <Input
                    id="professional-city"
                    value={form.city}
                    onChange={(event) => updateField("city", event.target.value)}
                    maxLength={80}
                    required
                  />
                </Field>
                <Field
                  label={tx(t, "storefront.professional.field.province", "Provincia")}
                  htmlFor="professional-province"
                >
                  <Input
                    id="professional-province"
                    value={form.province}
                    onChange={(event) => updateField("province", event.target.value)}
                    autoCapitalize="characters"
                    maxLength={2}
                    placeholder="MI"
                    required
                  />
                </Field>
                <Field
                  label={tx(t, "storefront.professional.field.address", "Indirizzo")}
                  htmlFor="professional-address"
                >
                  <Input
                    id="professional-address"
                    value={form.address}
                    onChange={(event) => updateField("address", event.target.value)}
                    maxLength={160}
                  />
                </Field>
                <Field
                  label={tx(t, "storefront.professional.field.pec", "PEC")}
                  htmlFor="professional-pec"
                >
                  <Input
                    id="professional-pec"
                    type="email"
                    value={form.pec}
                    onChange={(event) => updateField("pec", event.target.value)}
                    maxLength={160}
                  />
                </Field>
                <Field
                  label={tx(
                    t,
                    "storefront.professional.field.codiceDestinatario",
                    "Codice destinatario"
                  )}
                  htmlFor="professional-codice-destinatario"
                >
                  <Input
                    id="professional-codice-destinatario"
                    value={form.codiceDestinatario}
                    onChange={(event) =>
                      updateField("codiceDestinatario", event.target.value)
                    }
                    autoCapitalize="characters"
                    maxLength={7}
                  />
                </Field>
                <Field
                  label={tx(t, "storefront.professional.field.website", "Sito web")}
                  htmlFor="professional-website"
                >
                  <Input
                    id="professional-website"
                    type="url"
                    value={form.website}
                    onChange={(event) => updateField("website", event.target.value)}
                    maxLength={200}
                    placeholder="https://azienda.it"
                  />
                </Field>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="professional-notes">
                    {tx(t, "storefront.professional.field.notes", "Note")}
                  </Label>
                  <Textarea
                    id="professional-notes"
                    className="min-h-28"
                    value={form.notes}
                    onChange={(event) => updateField("notes", event.target.value)}
                    maxLength={1000}
                    placeholder={tx(
                      t,
                      "storefront.professional.field.notesPlaceholder",
                      "Indica categorie di interesse, volume medio o esigenze operative..."
                    )}
                  />
                </div>
                <ConsentRow
                  checked={acceptsTerms}
                  id="professional-terms"
                  label={tx(
                    t,
                    "storefront.professional.terms",
                    "Confermo che i dati inseriti sono corretti e accetto le condizioni di richiesta accesso."
                  )}
                  onCheckedChange={setAcceptsTerms}
                />
                <ConsentRow
                  checked={acceptsPrivacy}
                  id="professional-privacy"
                  label={tx(
                    t,
                    "storefront.professional.privacy",
                    "Autorizzo il trattamento dei dati per la valutazione della richiesta."
                  )}
                  onCheckedChange={setAcceptsPrivacy}
                />
                <div
                  className={`rounded-lg border p-4 text-sm font-semibold sm:col-span-2 ${statusTone}`}
                  role={submitState.status === "error" ? "alert" : "status"}
                  aria-live="polite"
                >
                  <div className="flex items-start gap-2">
                    {submitState.status === "loading" ? (
                      <Loader2 className="mt-0.5 size-4 animate-spin" />
                    ) : submitState.status === "success" ? (
                      <CheckCircle2 className="mt-0.5 size-4" />
                    ) : (
                      <FileCheck2 className="mt-0.5 size-4" />
                    )}
                    <span>{submitState.message}</span>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="h-11 sm:col-span-2"
                  disabled={submitState.status === "loading"}
                >
                  {submitState.status === "loading" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {submitState.status === "loading"
                    ? tx(t, "storefront.professional.submit.loading", "Invio...")
                    : tx(t, "storefront.professional.submit", "Invia richiesta")}
                </Button>
              </CardContent>
            </form>
          </Card>
        </section>

        <aside className="space-y-4">
          <Card className="border-slate-200 bg-white lg:sticky lg:top-32">
            <CardHeader>
              <CardTitle>
                {tx(t, "storefront.professional.after.title", "Dopo l'invio")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  icon: FileCheck2,
                  title: tx(
                    t,
                    "storefront.professional.after.review.title",
                    "Verifica dati"
                  ),
                  body: tx(
                    t,
                    "storefront.professional.after.review.body",
                    "Controlliamo azienda, contatto e dati fiscali prima di abilitare il profilo."
                  ),
                },
                {
                  icon: ShieldCheck,
                  title: tx(
                    t,
                    "storefront.professional.after.prices.title",
                    "Prezzi professionali"
                  ),
                  body: tx(
                    t,
                    "storefront.professional.after.prices.body",
                    "Dopo l'approvazione puoi vedere listino, MOQ e condizioni dedicate."
                  ),
                },
                {
                  icon: CheckCircle2,
                  title: tx(
                    t,
                    "storefront.professional.after.account.title",
                    "Accesso account"
                  ),
                  body: tx(
                    t,
                    "storefront.professional.after.account.body",
                    "Userai login, carrello, checkout e assistenza con lo stesso profilo cliente."
                  ),
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <item.icon className="size-4" />
                  </div>
                  <div>
                    <div className="font-black">{item.title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.body}</p>
                  </div>
                </div>
              ))}
              <Button asChild variant="outline" className="w-full bg-white">
                <Link href="/login">
                  {tx(t, "storefront.professional.login", "Ho già un account")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}

function Field({
  children,
  htmlFor,
  label,
}: {
  children: React.ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function ConsentRow({
  checked,
  id,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  id: string;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700 sm:col-span-2"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-1"
      />
      <span>{label}</span>
    </label>
  );
}

function buildApplicationPayload(form: ProfessionalForm) {
  const values = {
    address: form.address.trim(),
    city: form.city.trim(),
    codiceDestinatario: form.codiceDestinatario.trim().toUpperCase(),
    codiceFiscale: form.codiceFiscale.trim().toUpperCase(),
    companyName: form.companyName.trim(),
    contactName: form.contactName.trim(),
    email: form.email.trim(),
    notes: form.notes.trim(),
    partitaIva: form.partitaIva.trim().toUpperCase(),
    pec: form.pec.trim(),
    phone: form.phone.trim(),
    province: form.province.trim().toUpperCase(),
    website: form.website.trim(),
  };

  return Object.fromEntries(
    [
      ...Object.entries(values).filter(([, value]) => value.length > 0),
      ["acceptsTerms", true],
      ["acceptsPrivacy", true],
    ]
  );
}
