"use client";

import * as React from "react";
import { usePricingSession } from "./use-pricing-session";
import Link from "next/link";
import { Building2 } from "lucide-react";
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
import { AsyncFeedback } from "./async-feedback";
import { ActionButton } from "./action-button";
import { useUnsavedChanges } from "./use-unsaved-changes";

type ProfessionalForm = Record<"address" | "city" | "codiceDestinatario" | "codiceFiscale" | "companyName" | "contactName" | "email" | "notes" | "partitaIva" | "pec" | "phone" | "province" | "website", string>;
type SubmitState = "idle" | "loading" | "success" | "error" | "unknown";
type ApplicationDraft = { userId: string; savedAt: number; form: ProfessionalForm; acceptsPrivacy: boolean; acceptsTerms: boolean; state: SubmitState; message: string; receipt: { id?: string; createdAt?: string } | null };
let activeDraft: ApplicationDraft | null = null;
function readDraft(userId: string) { return typeof window !== "undefined" && activeDraft?.userId === userId && Date.now() - activeDraft.savedAt < 30 * 60_000 ? activeDraft : null; }
const blank: ProfessionalForm = { address: "", city: "", codiceDestinatario: "", codiceFiscale: "", companyName: "", contactName: "", email: "", notes: "", partitaIva: "", pec: "", phone: "", province: "", website: "" };
const fields: { key: keyof ProfessionalForm; required?: boolean; type?: string; autoComplete?: string; max: number; pattern?: string }[] = [
  { key: "companyName", required: true, autoComplete: "organization", max: 120 },
  { key: "contactName", required: true, autoComplete: "name", max: 120 },
  { key: "partitaIva", required: true, max: 13, pattern: "(IT)?[0-9]{11}" },
  { key: "codiceFiscale", required: true, max: 16, pattern: "[A-Za-z0-9]{11,16}" },
  { key: "email", required: true, type: "email", autoComplete: "email", max: 160 },
  { key: "phone", type: "tel", autoComplete: "tel", max: 40 },
  { key: "city", required: true, autoComplete: "address-level2", max: 80 },
  { key: "province", required: true, autoComplete: "address-level1", max: 2, pattern: "[A-Za-z]{2}" },
  { key: "address", autoComplete: "street-address", max: 160 },
  { key: "pec", type: "email", max: 160 },
  { key: "codiceDestinatario", max: 7, pattern: "[A-Za-z0-9]{7}" },
  { key: "website", type: "url", autoComplete: "url", max: 200 },
];
const fallback: Record<keyof ProfessionalForm,string> = { companyName:"Ragione sociale",contactName:"Referente",partitaIva:"Partita IVA",codiceFiscale:"Codice fiscale",email:"Email",phone:"Telefono",city:"Comune",province:"Provincia",address:"Indirizzo sede",pec:"PEC",codiceDestinatario:"Codice destinatario",website:"Sito web",notes:"Note" };

export function ProfessionalApplicationPage(props:{initialAccountAccess?:StoreHeaderAccountAccess}) {
  const session=usePricingSession(props.initialAccountAccess?.userId);const t=useT();
  if(!session.ready)return <AsyncFeedback state="loading" title={tx(t,"storefront.cart.sync.catalogTitle","Aggiornamento account…")} />;
  return <ProfessionalApplicationScoped key={session.key} {...props} />;
}
function ProfessionalApplicationScoped({ initialAccountAccess }: { initialAccountAccess?: StoreHeaderAccountAccess }) {
  const t = useT();
  const initial = React.useMemo(() => ({ ...blank, email: initialAccountAccess?.authenticated ? initialAccountAccess.email || "" : "", contactName: initialAccountAccess?.authenticated && initialAccountAccess.displayName !== initialAccountAccess.email ? initialAccountAccess.displayName || "" : "" }), [initialAccountAccess]);
  const userId = initialAccountAccess?.userId || "guest";
  const [restored] = React.useState(() => readDraft(userId));
  const [form, setForm] = React.useState<ProfessionalForm>(() => restored?.form || initial);
  const [acceptsPrivacy, setAcceptsPrivacy] = React.useState(restored?.acceptsPrivacy || false);
  const [acceptsTerms, setAcceptsTerms] = React.useState(restored?.acceptsTerms || false);
  const [state, setState] = React.useState<SubmitState>(restored?.state === "loading" ? "unknown" : restored?.state || "idle");
  const [message, setMessage] = React.useState(restored?.message || "");
  const [receipt, setReceipt] = React.useState<{ id?: string; createdAt?: string } | null>(restored?.receipt || null);
  const submissionRef = React.useRef<string | null>(null);
  const pendingKey = `partspro:application-pending:${userId}`;
  React.useEffect(()=>{let active=true;queueMicrotask(()=>{if(!active)return;try{const id=sessionStorage.getItem(pendingKey);if(id && /^[0-9a-f-]{36}$/i.test(id)){submissionRef.current=id;setState("unknown");setReceipt({id});setMessage(tx(t,"storefront.ux.applicationUnknown","Esito non confermato. Contatta l’assistenza con il riferimento per verificare."));}}catch{}});return()=>{active=false;};},[pendingKey,t]);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  React.useEffect(() => { activeDraft = {userId,savedAt:Date.now(),form,acceptsPrivacy,acceptsTerms,state,message,receipt}; }, [userId,form,acceptsPrivacy,acceptsTerms,state,message,receipt]);
  const locked = state === "loading" || state === "unknown";
  const dirty = state !== "success" && (acceptsPrivacy || acceptsTerms || Object.keys(blank).some(key => form[key as keyof ProfessionalForm] !== initial[key as keyof ProfessionalForm]));
  useUnsavedChanges(dirty, tx(t,"storefront.ux.discardApplication","Lasciare questa pagina? I dati non inviati verranno persi."));

  function updateField(key: keyof ProfessionalForm, value: string) {
    if (locked) return;
    setForm(current => ({...current,[key]:value}));
    setFieldErrors(current => ({...current,[key]:""}));
    if (state === "error") { setState("idle"); setMessage(""); }
  }

  async function submitApplication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (locked || state === "success") return;
    if (!acceptsTerms || !acceptsPrivacy) { setState("error"); setMessage(tx(t,"storefront.professional.status.consentRequired","Accetta condizioni e privacy prima di inviare.")); return; }
    setState("loading"); setMessage(tx(t,"storefront.professional.status.loading","Invio richiesta in corso..."));
    const submissionId = submissionRef.current ?? crypto.randomUUID(); submissionRef.current = submissionId; setReceipt({id:submissionId});
    try { sessionStorage.setItem(pendingKey,submissionId); } catch {}
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch("/api/b2b-applications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...buildApplicationPayload(form),submissionId}),signal:controller.signal});
      const payload = await response.json().catch(() => null) as { data?: { id?: string; createdAt?: string }; error?: { details?: { issues?: { path?: string; message?: string }[] } } } | null;
      if (!response.ok) {
        if (response.status >= 500) { setState("unknown"); setMessage(tx(t,"storefront.ux.applicationUnknown","Esito non confermato. Non inviare di nuovo: contatta l’assistenza con email e ragione sociale per verificare la richiesta.")); return; }
        submissionRef.current=null;try{sessionStorage.removeItem(pendingKey);}catch{}
        const errors: Record<string,string> = {};
        for (const issue of payload?.error?.details?.issues || []) if (issue.path) errors[issue.path] = tx(t,"storefront.ux.checkField","Controlla questo campo.");
        setFieldErrors(errors); setState("error"); setMessage(tx(t,"storefront.professional.status.rejected","Richiesta non accettata. Controlla i campi e riprova."));
        requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return;
      }
      if(!payload?.data?.id) {setState("unknown");setReceipt({id:submissionId});setMessage(tx(t,"storefront.ux.applicationUnknown","Esito non confermato. Contatta l’assistenza."));return;}
      try{sessionStorage.removeItem(pendingKey);}catch{}
      setReceipt(payload.data); setState("success"); setMessage(tx(t,"storefront.professional.status.success","Richiesta inviata. Il team PartsPro controllerà i dati e ti contatterà via email."));
    } catch {
      setState("unknown"); setMessage(tx(t,"storefront.ux.applicationUnknown","Esito non confermato. Non inviare di nuovo: contatta l’assistenza con email e ragione sociale per verificare la richiesta."));
    } finally { window.clearTimeout(timer); }
  }

  function renderField(field: typeof fields[number]) {
    const id = `professional-${field.key}`; const error = fieldErrors[field.key];
    return <div key={field.key} className="pp-professional-field space-y-2"><Label htmlFor={id}>{tx(t,`storefront.professional.field.${field.key}`,fallback[field.key])}<span className="ml-1 text-xs text-slate-500">{field.required ? tx(t,"storefront.ux.required","Obbligatorio") : tx(t,"storefront.ux.optional","Facoltativo")}</span></Label><Input id={id} name={field.key} value={form[field.key]} required={field.required} type={field.type || "text"} autoComplete={field.autoComplete} inputMode={field.type === "tel" ? "tel" : undefined} maxLength={field.max} minLength={field.required && !field.pattern && field.type !== "email" ? 2 : undefined} pattern={field.pattern} disabled={locked} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={event => updateField(field.key,event.target.value)} />{error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}</div>;
  }

  return <main className="pp-professional-page min-h-screen overflow-x-hidden bg-[#f4f6fa] text-slate-950"><StoreHeader initialAccountAccess={initialAccountAccess} /><div className="pp-professional-content mx-auto max-w-4xl space-y-4 px-4 py-5">
    <div className="pp-professional-introduction rounded-lg border bg-white p-4"><span className="pp-professional-mark" aria-hidden="true"><Building2 /></span><Badge className="mb-2">{tx(t,"storefront.professional.badge","Richiesta accesso clienti professionali")}</Badge><h1 className="text-2xl font-bold">{tx(t,"storefront.professional.title","Richiedi accesso clienti professionali")}</h1><p className="mt-2 text-sm leading-6 text-slate-600">{tx(t,"storefront.professional.description","Invia i dati aziendali per richiedere accesso e fatturazione elettronica.")}</p><p className="mt-2 text-sm leading-6">{tx(t,"storefront.ux.applicationAddress","Qui raccogliamo la sede aziendale. L’indirizzo completo di consegna, con CAP e numero civico, si completa nell’account prima del checkout.")}</p><div className="pp-professional-next"><span className="pp-account-eyebrow">{tx(t,"storefront.professional.after.title","Dopo l’invio")}</span><h2>{tx(t,"storefront.professional.after.review.title","Verifica dati")}</h2><p>{tx(t,"storefront.professional.after.review.body","Controlliamo azienda, contatto e dati fiscali prima di abilitare il profilo.")}</p></div></div>
    {state === "success" ? <Card><CardContent className="space-y-4 p-5"><AsyncFeedback state="success" title={tx(t,"storefront.ux.applicationReceived","Richiesta ricevuta")} description={message} /><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">{tx(t,"storefront.professional.field.companyName","Ragione sociale")}</dt><dd className="font-semibold">{form.companyName}</dd></div><div><dt className="text-slate-500">Email</dt><dd className="break-all font-semibold">{form.email}</dd></div><div><dt className="text-slate-500">{tx(t,"storefront.ux.receipt","Riferimento ricezione")}</dt><dd className="break-all font-mono">{receipt?.id || "—"}</dd></div><div><dt className="text-slate-500">{tx(t,"storefront.ux.status","Stato")}</dt><dd>{tx(t,"storefront.ux.applicationSubmitted","Inviata, in attesa di verifica")}</dd></div></dl><p className="text-sm text-slate-600">{tx(t,"storefront.ux.applicationStatusHelp","Per verificare o correggere la richiesta, comunica all’assistenza email e ragione sociale. L’invio non abilita subito il listino professionale.")}</p><div className="flex flex-wrap gap-2"><Button asChild><Link href="/account">{tx(t,"nav.account","Account")}</Link></Button><Button type="button" variant="outline" onClick={() => window.dispatchEvent(new Event("partspro:open-support"))}>{tx(t,"storefront.ux.contactSupport","Contatta assistenza")}</Button></div></CardContent></Card> : <Card><form onSubmit={submitApplication}><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="size-5" />{tx(t,"storefront.professional.form.title","Dati azienda")}</CardTitle><p className="text-sm text-slate-600">{tx(t,"storefront.ux.requiredHint","I campi contrassegnati Obbligatorio sono necessari. Gli altri sono facoltativi.")}</p></CardHeader><CardContent className="space-y-4"><fieldset disabled={locked} className="grid gap-4 sm:grid-cols-2">{fields.slice(0,8).map(renderField)}</fieldset><details open={Object.keys(fieldErrors).some(key => ["address","pec","codiceDestinatario","website","notes"].includes(key)) || undefined} className="rounded-lg border p-3"><summary className="min-h-11 cursor-pointer font-semibold">{tx(t,"storefront.ux.optionalDetails","Fatturazione e informazioni aggiuntive (facoltative)")}</summary><div className="mt-3 grid gap-4 sm:grid-cols-2">{fields.slice(8).map(renderField)}<div className="space-y-2 sm:col-span-2"><Label htmlFor="professional-notes">{tx(t,"storefront.professional.field.notes","Note")} · {tx(t,"storefront.ux.optional","Facoltativo")}</Label><Textarea id="professional-notes" name="notes" value={form.notes} maxLength={1000} disabled={locked} onChange={event => updateField("notes",event.target.value)} /></div></div></details>
      <ConsentRow checked={acceptsTerms} onChange={setAcceptsTerms} disabled={locked} id="professional-terms" label={tx(t,"storefront.professional.terms","Confermo i dati e accetto le condizioni di richiesta accesso.")} href="/help#application" linkLabel={tx(t,"storefront.ux.readConditions","Leggi le condizioni della richiesta")} />
      <ConsentRow checked={acceptsPrivacy} onChange={setAcceptsPrivacy} disabled={locked} id="professional-privacy" label={tx(t,"storefront.professional.privacy","Autorizzo il trattamento dei dati per valutare la richiesta.")} href="/help#privacy" linkLabel={tx(t,"storefront.ux.readPrivacy","Leggi l’uso dei dati della richiesta")} />
      {message && <AsyncFeedback state={state === "idle" ? "info" : state} title={message} description={state === "unknown" ? <span className="break-all font-mono text-xs">{receipt?.id}</span> : undefined} actions={state === "unknown" ? <Button type="button" variant="outline" onClick={() => window.dispatchEvent(new Event("partspro:open-support"))}>{tx(t,"storefront.ux.contactSupport","Contatta assistenza")}</Button> : undefined} />}
      <ActionButton type="submit" className="min-h-11 w-full" state={state === "loading" ? "pending" : state === "unknown" ? "unknown" : "idle"} pendingLabel={tx(t,"storefront.professional.submit.loading","Invio...")}>{tx(t,"storefront.professional.submit","Invia richiesta")}</ActionButton>
    </CardContent></form></Card>}
    <div className="pp-professional-footer flex flex-wrap gap-3"><Button asChild variant="outline"><Link href={`/login?${new URLSearchParams({next:"/professionale"})}`}>{tx(t,"storefront.professional.login","Ho già un account")}</Link></Button><Button asChild variant="ghost"><Link href="/help">{tx(t,"storefront.ux.help","Aiuto")}</Link></Button></div>
  </div></main>;
}

function ConsentRow({ checked, disabled, onChange, id, label, href, linkLabel }: { checked:boolean;disabled:boolean;onChange:(checked:boolean)=>void;id:string;label:string;href:string;linkLabel:string }) {
  return <div className="pp-professional-consent rounded-lg border bg-slate-50 p-3 text-sm leading-6"><label htmlFor={id} className="flex cursor-pointer items-start gap-3"><Checkbox id={id} disabled={disabled} checked={checked} onCheckedChange={value => onChange(value === true)} className="mt-1" /><span>{label}</span></label><Link className="ml-7 inline-block min-h-11 py-2 text-primary underline" href={href} target="_blank" rel="noopener noreferrer">{linkLabel}<span className="sr-only"> ↗</span></Link></div>;
}
function buildApplicationPayload(form: ProfessionalForm) {
  return Object.fromEntries([...Object.entries(form).map(([key,value]) => [key,["partitaIva","codiceFiscale","codiceDestinatario","province"].includes(key) ? value.trim().toUpperCase() : value.trim()]).filter(([,value])=>value.length>0),["acceptsTerms",true],["acceptsPrivacy",true]]);
}
