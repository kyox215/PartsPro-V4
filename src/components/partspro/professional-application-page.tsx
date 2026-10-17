"use client";

import { englishUiCopy } from "@/i18n/english-ui-copy";


import { StorefrontLoading } from "./storefront-loading";

import * as React from "react";
import { usePricingSession } from "./use-pricing-session";
import Link from "next/link";
import { Building2, FileCheck2, ShoppingCart, UsersRound } from "lucide-react";
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
import { useI18n, useT } from "./i18n-provider";
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
  const session=usePricingSession(props.initialAccountAccess?.userId);
  if(!session.ready)return <StorefrontLoading variant="professional" />;
  return <ProfessionalApplicationScoped key={session.key} {...props} />;
}
function ProfessionalApplicationScoped({ initialAccountAccess }: { initialAccountAccess?: StoreHeaderAccountAccess }) {
  const t = useT();
  const { locale } = useI18n();
  const ui = (locale.startsWith("en") ? englishUiCopy({
    contact: "Azienda e contatti", tax: "Dati fiscali", address: "Sede dell’attività", additional: "Informazioni aggiuntive",
    comparison: "Account base o richiesta professionale?", basicTitle: "Account base", basicBody: "Registrati e completa i dati per consultare i prezzi e acquistare secondo i permessi del tuo account.",
    reviewTitle: "I dati professionali vengono verificati", reviewBody: "Invia azienda, referente e dati fiscali. Il team verifica le informazioni e ti contatta via email.",
    pricingTitle: "Listino e livello sono gestiti separatamente", pricingBody: "L’esito della verifica determina i relativi permessi. La registrazione base non abilita automaticamente i prezzi professionali.",
    after: "Dopo l’invio", resultTitle: "Conserva l’esito", resultBody: "La pagina mostra l’esito e il riferimento di ricezione. Conservali per eventuali verifiche con l’assistenza.",
    emailTitle: "Ti contattiamo via email", emailBody: "Dopo la verifica, il team usa l’email della richiesta e può chiedere informazioni aggiuntive.",
    accessTitle: "I permessi seguono la verifica", accessBody: "L’invio non attiva subito i prezzi professionali. Attendi la conferma dell’esito da parte del team.",
  }) : locale === "zh-CN" ? {
    contact: "公司与联系", tax: "税务资料", address: "营业地址", additional: "补充信息",
    comparison: "专业申请与基础账户有什么不同？", basicTitle: "基础账户", basicBody: "注册并完善资料后，按账户权限查看价格与采购。",
    reviewTitle: "专业申请需要审核资料", reviewBody: "提交公司、联系人与税务资料，工作人员审核后通过邮件联系。",
    pricingTitle: "价格类型与会员等级分别管理", pricingBody: "专业申请的审核结果决定相关账户权限，基础账户注册不等于已获批专业价格。",
    after: "提交之后", resultTitle: "保留提交结果", resultBody: "页面会显示本次提交结果与收件编号。请保留相关资料，以便联系支持。",
    emailTitle: "工作人员通过邮件联系", emailBody: "审核资料后，我们会通过申请邮箱联系；需要时会请你补充信息。",
    accessTitle: "按审核结果开通相应权限", accessBody: "申请提交不会立即启用专业价格；请以工作人员确认的审核结果为准。",
  } : {
    contact: "Azienda e contatti", tax: "Dati fiscali", address: "Sede dell’attività", additional: "Informazioni aggiuntive",
    comparison: "Account base o richiesta professionale?", basicTitle: "Account base", basicBody: "Registrati e completa i dati per consultare i prezzi e acquistare secondo i permessi del tuo account.",
    reviewTitle: "I dati professionali vengono verificati", reviewBody: "Invia azienda, referente e dati fiscali. Il team verifica le informazioni e ti contatta via email.",
    pricingTitle: "Listino e livello sono gestiti separatamente", pricingBody: "L’esito della verifica determina i relativi permessi. La registrazione base non abilita automaticamente i prezzi professionali.",
    after: "Dopo l’invio", resultTitle: "Conserva l’esito", resultBody: "La pagina mostra l’esito e il riferimento di ricezione. Conservali per eventuali verifiche con l’assistenza.",
    emailTitle: "Ti contattiamo via email", emailBody: "Dopo la verifica, il team usa l’email della richiesta e può chiedere informazioni aggiuntive.",
    accessTitle: "I permessi seguono la verifica", accessBody: "L’invio non attiva subito i prezzi professionali. Attendi la conferma dell’esito da parte del team.",
  });
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
    return <div key={field.key} className={`pp-professional-field space-y-2${field.key === "address" ? " pp-professional-address-field sm:col-span-2" : ""}`}><Label htmlFor={id}>{tx(t,`storefront.professional.field.${field.key}`,fallback[field.key])}<span className="ml-1 text-xs text-slate-500">{field.required ? tx(t,"storefront.ux.required","Obbligatorio") : tx(t,"storefront.ux.optional","Facoltativo")}</span></Label><Input id={id} name={field.key} value={form[field.key]} required={field.required} type={field.type || "text"} autoComplete={field.autoComplete} inputMode={field.type === "tel" ? "tel" : undefined} maxLength={field.max} minLength={field.required && !field.pattern && field.type !== "email" ? 2 : undefined} pattern={field.pattern} disabled={locked} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={event => updateField(field.key,event.target.value)} />{error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}</div>;
  }

  return <main className="pp-professional-page min-h-screen overflow-x-hidden bg-[#f4f6fa] text-slate-950"><StoreHeader initialAccountAccess={initialAccountAccess} /><div className="pp-professional-content mx-auto max-w-4xl space-y-4 px-4 py-5">
    <header className="pp-professional-page-heading col-span-full"><Badge className="mb-2">{tx(t,"storefront.professional.badge","Richiesta accesso clienti professionali")}</Badge><h1 className="text-2xl font-bold">{tx(t,"storefront.professional.title","Richiedi accesso clienti professionali")}</h1><p className="mt-2 text-sm leading-6 text-slate-600">{tx(t,"storefront.professional.description","Invia i dati aziendali per richiedere accesso e fatturazione elettronica.")}</p></header>
    {state === "success" ? <Card className="pp-professional-result-card"><CardContent className="space-y-4 p-5"><AsyncFeedback state="success" title={tx(t,"storefront.ux.applicationReceived","Richiesta ricevuta")} description={message} /><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">{tx(t,"storefront.professional.field.companyName","Ragione sociale")}</dt><dd className="font-semibold">{form.companyName}</dd></div><div><dt className="text-slate-500">Email</dt><dd className="break-all font-semibold">{form.email}</dd></div><div><dt className="text-slate-500">{tx(t,"storefront.ux.receipt","Riferimento ricezione")}</dt><dd className="break-all font-mono">{receipt?.id || "—"}</dd></div><div><dt className="text-slate-500">{tx(t,"storefront.ux.status","Stato")}</dt><dd>{tx(t,"storefront.ux.applicationSubmitted","Inviata, in attesa di verifica")}</dd></div></dl><p className="text-sm text-slate-600">{tx(t,"storefront.ux.applicationStatusHelp","Per verificare o correggere la richiesta, comunica all’assistenza email e ragione sociale. L’invio non abilita subito il listino professionale.")}</p><div className="flex flex-wrap gap-2"><Button asChild><Link href="/account">{tx(t,"nav.account","Account")}</Link></Button><Button type="button" variant="outline" onClick={() => window.dispatchEvent(new Event("partspro:open-support"))}>{tx(t,"storefront.ux.contactSupport","Contatta assistenza")}</Button></div></CardContent></Card> : <Card className="pp-professional-form-card"><form onSubmit={submitApplication}><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="size-5" />{tx(t,"storefront.professional.form.title","Dati azienda")}</CardTitle><p className="text-sm text-slate-600">{tx(t,"storefront.ux.requiredHint","I campi contrassegnati Obbligatorio sono necessari. Gli altri sono facoltativi.")}</p></CardHeader><CardContent className="space-y-4"><div className="pp-professional-form-sections space-y-6">{[
        { id: "contact", title: ui.contact, keys: ["companyName", "contactName", "email", "phone"] },
        { id: "tax", title: ui.tax, keys: ["partitaIva", "codiceFiscale", "pec", "codiceDestinatario"] },
        { id: "address", title: ui.address, keys: ["address", "city", "province"] },
        { id: "additional", title: ui.additional, keys: ["website"] },
      ].map(({ id, title, keys }, index) => <fieldset disabled={locked} className={`pp-professional-form-section pp-professional-section-${id}`} key={id}><legend className="pp-professional-section-heading"><span className="pp-professional-step-number" aria-hidden="true">{index + 1}</span><span>{title}</span></legend><div className="pp-professional-section-fields grid gap-4 sm:grid-cols-2">{keys.map(key => { const field = fields.find(item => item.key === key); return field ? renderField(field) : null; })}{id === "address" && <p className="pp-professional-address-hint text-xs leading-6 text-slate-600 sm:col-span-2">{tx(t,"storefront.ux.applicationAddress","Qui raccogliamo la sede aziendale. L’indirizzo completo di consegna, con CAP e numero civico, si completa nell’account prima del checkout.")}</p>}{id === "additional" && <div className="pp-professional-field pp-professional-notes-field space-y-2"><Label htmlFor="professional-notes">{tx(t,"storefront.professional.field.notes","Note")}<span className="ml-1 text-xs text-slate-500">{tx(t,"storefront.ux.optional","Facoltativo")}</span></Label><Textarea id="professional-notes" name="notes" value={form.notes} maxLength={1000} disabled={locked} aria-invalid={Boolean(fieldErrors.notes)} aria-describedby={fieldErrors.notes ? "professional-notes-error" : undefined} onChange={event => updateField("notes",event.target.value)} />{fieldErrors.notes && <p id="professional-notes-error" className="text-sm text-destructive">{fieldErrors.notes}</p>}</div>}</div></fieldset>)}</div>
      <ConsentRow checked={acceptsTerms} onChange={setAcceptsTerms} disabled={locked} id="professional-terms" label={tx(t,"storefront.professional.terms","Confermo i dati e accetto le condizioni di richiesta accesso.")} href="/help#application" linkLabel={tx(t,"storefront.ux.readConditions","Leggi le condizioni della richiesta")} />
      <ConsentRow checked={acceptsPrivacy} onChange={setAcceptsPrivacy} disabled={locked} id="professional-privacy" label={tx(t,"storefront.professional.privacy","Autorizzo il trattamento dei dati per valutare la richiesta.")} href="/help#privacy" linkLabel={tx(t,"storefront.ux.readPrivacy","Leggi l’uso dei dati della richiesta")} />
      {message && <AsyncFeedback state={state === "idle" ? "info" : state} title={message} description={state === "unknown" ? <span className="break-all font-mono text-xs">{receipt?.id}</span> : undefined} actions={state === "unknown" ? <Button type="button" variant="outline" onClick={() => window.dispatchEvent(new Event("partspro:open-support"))}>{tx(t,"storefront.ux.contactSupport","Contatta assistenza")}</Button> : undefined} />}
      <ActionButton type="submit" className="min-h-11 w-full" state={state === "loading" ? "pending" : state === "unknown" ? "unknown" : "idle"} pendingLabel={tx(t,"storefront.professional.submit.loading","Invio...")}>{tx(t,"storefront.professional.submit","Invia richiesta")}</ActionButton>
    </CardContent></form></Card>}
    <aside className="pp-professional-sidebar space-y-4" aria-label={ui.comparison}>
      <section className="pp-professional-account-comparison rounded-lg border bg-white p-5" aria-labelledby="professional-comparison-title"><h2 id="professional-comparison-title" className="text-lg font-semibold">{ui.comparison}</h2><div className="pp-professional-comparison-items space-y-5">{[{ icon: ShoppingCart, title: ui.basicTitle, body: ui.basicBody }, { icon: FileCheck2, title: ui.reviewTitle, body: ui.reviewBody }, { icon: UsersRound, title: ui.pricingTitle, body: ui.pricingBody }].map(({ icon: Icon, title, body }) => <div className="pp-professional-comparison-item flex items-start gap-3" key={title}><span className="pp-professional-sidebar-icon" aria-hidden="true"><Icon /></span><div><h3 className="font-semibold">{title}</h3><p className="text-sm leading-6 text-slate-600">{body}</p></div></div>)}</div></section>
      <section className="pp-professional-next rounded-lg border bg-white p-5" aria-labelledby="professional-next-title"><h2 id="professional-next-title" className="text-lg font-semibold">{ui.after}</h2><ol className="pp-professional-next-steps space-y-5">{[{ title: ui.resultTitle, body: ui.resultBody }, { title: ui.emailTitle, body: ui.emailBody }, { title: ui.accessTitle, body: ui.accessBody }].map(({ title, body }, index) => <li className="pp-professional-next-step flex items-start gap-3" key={title}><span className="pp-professional-step-number" aria-hidden="true">{index + 1}</span><div><h3 className="font-semibold">{title}</h3><p className="text-sm leading-6 text-slate-600">{body}</p></div></li>)}</ol></section>
    </aside>
    <div className="pp-professional-footer flex flex-wrap gap-3"><Button asChild variant="outline"><Link href={`/login?${new URLSearchParams({next:"/professionale"})}`}>{tx(t,"storefront.professional.login","Ho già un account")}</Link></Button><Button asChild variant="ghost"><Link href="/help">{tx(t,"storefront.ux.help","Aiuto")}</Link></Button></div>
  </div></main>;
}

function ConsentRow({ checked, disabled, onChange, id, label, href, linkLabel }: { checked:boolean;disabled:boolean;onChange:(checked:boolean)=>void;id:string;label:string;href:string;linkLabel:string }) {
  return <div className="pp-professional-consent rounded-lg border bg-slate-50 p-3 text-sm leading-6"><label htmlFor={id} className="flex cursor-pointer items-start gap-3"><Checkbox id={id} disabled={disabled} checked={checked} onCheckedChange={value => onChange(value === true)} className="mt-1" /><span>{label}</span></label><Link className="ml-7 inline-block min-h-11 py-2 text-primary underline" href={href} target="_blank" rel="noopener noreferrer">{linkLabel}<span className="sr-only"> ↗</span></Link></div>;
}
function buildApplicationPayload(form: ProfessionalForm) {
  return Object.fromEntries([...Object.entries(form).map(([key,value]) => [key,["partitaIva","codiceFiscale","codiceDestinatario","province"].includes(key) ? value.trim().toUpperCase() : value.trim()]).filter(([,value])=>value.length>0),["acceptsTerms",true],["acceptsPrivacy",true]]);
}
