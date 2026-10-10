"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { customerTiers } from "@/lib/partspro-pricing";
import type { ClassificationPricingPreview, PricingAnomaly, PricingInspection, SignupPricingCampaign } from "@/lib/partspro-pricing-admin";
import { useI18n } from "./i18n-provider";
import { AdminActionButton, AdminEmptyState, AdminNotice, AdminRefreshBar } from "./admin-feedback";

type CampaignBody = Omit<SignupPricingCampaign, "updated_at"> & { reason: string };
type CampaignAttempt = { body: CampaignBody; current: SignupPricingCampaign | null };
type AuditEntry = { created_at?: string; reason?: string; action?: string };

class PricingRequestError extends Error {
  constructor(readonly kind: "read" | "rejected" | "unknown", readonly code: string) {
    super(code);
  }
}

async function pricingRequest<T>(url: string, init: RequestInit | undefined, validate: (value: unknown) => value is T): Promise<T> {
  const write = init?.method === "PATCH";
  let response: Response;
  try {
    const timeout = AbortSignal.timeout(8_000);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    response = await fetch(url, { ...init, signal, cache: "no-store", headers: { "Content-Type": "application/json" } });
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    throw new PricingRequestError(write ? "unknown" : "read", "NETWORK_ERROR");
  }
  let payload: { data?: unknown; error?: { code?: string } };
  try { payload = await response.json(); } catch {
    throw new PricingRequestError(write && (response.ok || response.status >= 500) ? "unknown" : write ? "rejected" : "read", "INVALID_RESPONSE");
  }
  if (!response.ok) {
    throw new PricingRequestError(write ? response.status >= 500 ? "unknown" : "rejected" : "read", payload?.error?.code ?? `HTTP_${response.status}`);
  }
  if (!payload || !validate(payload.data)) {
    throw new PricingRequestError(write ? "unknown" : "read", "INVALID_RESPONSE");
  }
  return payload.data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function isCampaign(value: unknown): value is SignupPricingCampaign {
  if (!isRecord(value) || typeof value.enabled !== "boolean" || !customerTiers.includes(value.level as typeof customerTiers[number]) || !Number.isInteger(value.duration_months) || Number(value.duration_months) < 1 || Number(value.duration_months) > 24) return false;
  if (![value.starts_at, value.ends_at].every(date => date === null || typeof date === "string" && Number.isFinite(Date.parse(date)))) return false;
  return !value.starts_at || !value.ends_at || Date.parse(String(value.ends_at)) > Date.parse(String(value.starts_at));
}
function isQuote(value: unknown): value is PricingInspection {
  return isRecord(value) && typeof value.sku_code === "string" && [value.base_unit_price, value.effective_unit_price].every(price => price == null || typeof price === "number" && Number.isFinite(price));
}
function isQuotes(value: unknown): value is PricingInspection[] { return Array.isArray(value) && value.every(isQuote); }
function isAnomalies(value: unknown): value is PricingAnomaly[] { return Array.isArray(value) && value.every(item => isRecord(item) && typeof item.kind === "string"); }
function isAudit(value: unknown): value is AuditEntry[] { return Array.isArray(value) && value.every(item => isRecord(item) && [item.created_at, item.reason, item.action].every(field => field == null || typeof field === "string")); }
function isClassificationPreview(value: unknown): value is ClassificationPricingPreview {
  return isRecord(value) && Array.isArray(value.items) && value.items.every(item => isRecord(item) && typeof item.sku_code === "string" && isQuote(item.before) && isQuote(item.after));
}
function campaignSignature(value: SignupPricingCampaign) {
  return JSON.stringify([value.enabled, value.level, value.duration_months, value.starts_at, value.ends_at]);
}
function errorCode(error: unknown) { return error instanceof PricingRequestError ? error.code : "REQUEST_FAILED"; }
function pricingError(code: string, zh: boolean) {
  if (code === "ADMIN_FORBIDDEN" || code === "PRICING_FORBIDDEN" || code === "HTTP_403") return zh ? "缺少此操作所需权限，请联系管理员。" : "Permessi insufficienti. Contatta l'amministratore.";
  if (code === "INVALID_BODY" || code === "HTTP_400") return zh ? "输入未通过校验，请检查客户编号、SKU、数量和日期。" : "Controlla cliente, SKU, quantità e date: i dati non sono validi.";
  if (code === "INVALID_RESPONSE") return zh ? "响应无法核对，请重新读取。" : "Risposta non verificabile. Rileggi i dati.";
  if (code === "NETWORK_ERROR") return zh ? "连接中断，请检查网络后重读。" : "Connessione interrotta. Controlla la rete e rileggi.";
  if (code === "NO_VALID_QUOTE") return zh ? "没有可用于预览的有效报价，请更换 SKU。" : "Nessun prezzo valido per l'anteprima. Scegli un altro SKU.";
  return zh ? "价格服务暂不可用，请保留输入并稍后重试。" : "Servizio prezzi non disponibile. Conserva i dati e riprova più tardi.";
}
function money(value: number | null | undefined, zh: boolean) {
  return value == null ? zh ? "不可报价" : "Prezzo non disponibile" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
}
function tierLabel(tier: string | undefined, zh: boolean) {
  const index = customerTiers.indexOf(tier as typeof customerTiers[number]);
  return index < 0 ? tier ?? "—" : (zh ? ["青铜", "白银", "黄金", "翡翠", "钻石", "大师", "王者"] : ["Bronzo", "Argento", "Oro", "Smeraldo", "Diamante", "Maestro", "Re"])[index];
}
function localDateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function AdminPricingPanel({ permissions, customerId, onMutatingChange }: { permissions: readonly string[]; customerId?: string | null; onMutatingChange?: (pending: boolean) => void }) {
  const { locale } = useI18n();
  const zh = locale.startsWith("zh");
  const manage = permissions.includes("pricing.manage_policy");
  const inspect = permissions.includes("customers.read") && permissions.includes("orders.manage");
  const [opened, setOpened] = useState(false);
  const [visited, setVisited] = useState(false);
  const [mutating, setMutating] = useState(false);
  const updateMutating = useCallback((value: boolean) => { setMutating(value); onMutatingChange?.(value); }, [onMutatingChange]);
  if (!manage && !inspect) return null;
  return <details open={opened} className="rounded-lg border bg-white p-3" onToggle={event => {
    if (mutating && !event.currentTarget.open) { event.currentTarget.open = true; return; }
    setOpened(event.currentTarget.open);
    if (event.currentTarget.open) setVisited(true);
  }}>
    <summary aria-disabled={mutating} className="cursor-pointer text-sm font-bold" onClick={event => { if (mutating) event.preventDefault(); }}>{zh ? "价格规则、迎新活动与检查" : "Regole prezzi, promozione di benvenuto e verifiche"}{mutating && <span className="ml-2 font-normal">{zh ? "保存中，请稍候" : "Salvataggio in corso"}</span>}</summary>
    {visited && <div hidden={!opened}><PricingPanelContent manage={manage} inspect={inspect} customerId={customerId ?? ""} canCheck={permissions.includes("customers.read")} onMutatingChange={updateMutating} /></div>}
  </details>;
}

function PricingPanelContent({ manage, inspect, customerId, canCheck, onMutatingChange }: { manage: boolean; inspect: boolean; customerId: string; canCheck: boolean; onMutatingChange: (pending: boolean) => void }) {
  const { locale } = useI18n();
  const zh = locale.startsWith("zh");
  const [campaign, setCampaign] = useState<SignupPricingCampaign | null>(null);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState<"saved" | "preserved" | "adopted" | "" >("");
  const [attempt, setAttempt] = useState<CampaignAttempt | null>(null);
  const [lastAttempt, setLastAttempt] = useState<CampaignBody | null>(null);
  const saveRef = useRef(false);
  const readRef = useRef<AbortController | null>(null);
  const draftRef = useRef({ campaign, reason, baseline, attempt });
  useEffect(() => { draftRef.current = { campaign, reason, baseline, attempt }; }, [campaign, reason, baseline, attempt]);
  const dirty = Boolean(campaign && baseline !== campaignSignature(campaign) || reason.length || attempt);
  const locked = saving || Boolean(attempt);
  const readCampaign = useCallback(async () => {
    if (saveRef.current) return;
    readRef.current?.abort();
    const controller = new AbortController();
    readRef.current = controller;
    if (draftRef.current.attempt) setAttempt({ ...draftRef.current.attempt, current: null });
    setReading(true); setReadError("");
    try {
      const current = await pricingRequest("/api/admin/pricing", { signal: controller.signal }, isCampaign);
      if (controller.signal.aborted) return;
      const draft = draftRef.current;
      if (draft.attempt) setAttempt({ ...draft.attempt, current });
      else if (draft.campaign && (draft.baseline !== campaignSignature(draft.campaign) || draft.reason.length)) setNotice("preserved");
      else { setCampaign(current); setBaseline(campaignSignature(current)); }
    } catch (error) { if (!controller.signal.aborted) setReadError(errorCode(error)); }
    finally { if (!controller.signal.aborted) setReading(false); }
  }, []);
  useEffect(() => {
    if (manage) void readCampaign();
    return () => readRef.current?.abort();
  }, [manage, readCampaign]);
  useEffect(() => { onMutatingChange(saving); return () => onMutatingChange(false); }, [saving, onMutatingChange]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => { if (dirty || saving) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty, saving]);
  async function saveCampaign() {
    if (saveRef.current || attempt || !campaign || !manage || reason.trim().length < 3 || reason.trim().length > 1000 || !isCampaign(campaign) || reading) return;
    const body: CampaignBody = { enabled: campaign.enabled, level: campaign.level, duration_months: campaign.duration_months, starts_at: campaign.starts_at, ends_at: campaign.ends_at, reason: reason.trim() };
    saveRef.current = true; setSaving(true); onMutatingChange(true); setSaveError(""); setNotice("");
    try {
      const next = await pricingRequest("/api/admin/pricing", { method: "PATCH", body: JSON.stringify(body) }, isCampaign);
      setCampaign(next); setBaseline(campaignSignature(next)); setReason(""); setNotice("saved"); setLastAttempt(body);
    } catch (error) {
      if (error instanceof PricingRequestError && error.kind === "unknown") { setAttempt({ body, current: null }); setLastAttempt(body); }
      else setSaveError(errorCode(error));
    } finally { saveRef.current = false; setSaving(false); onMutatingChange(false); }
  }
  const updateCampaign = (patch: Partial<SignupPricingCampaign>) => {
    if (saveRef.current || locked || !campaign) return;
    setCampaign({ ...campaign, ...patch }); setSaveError(""); setNotice("");
  };
  return <div data-admin-pricing="true" data-admin-mutating={saving ? "true" : "false"} data-admin-dirty={dirty ? "true" : "false"} className="mt-3 min-w-0 space-y-4 text-sm">
    <p className="text-xs text-slate-600">{zh ? "零售/批发决定原价；基础等级与有效促销取高。REMAX、保护膜不参与折扣。售后退款不额外扣回等级累计，毛利规则保持不变。" : "Il tipo al dettaglio/ingrosso determina il prezzo base; si applica il livello più alto fra base e promozioni valide. REMAX e pellicole sono esclusi dagli sconti. I rimborsi RMA non riducono ulteriormente il livello accumulato; le regole di margine restano invariate."}</p>
    {inspect && <PricingQuoteSection key={customerId} customerId={customerId} disabled={saving} />}
    {manage && <section className="space-y-3 border-t pt-3">
      <h4 className="font-bold">{zh ? "注册赠送等级活动 · 全局配置" : "Promozione di benvenuto · Configurazione globale"}</h4>
      <p className="text-xs text-slate-500">{zh ? "修改只影响未来发放；关闭活动不取消客户已领取的权益。折叠或切换客户会保留此全局草稿。" : "Le modifiche valgono per le assegnazioni future; disattivare la promozione non annulla i benefici già ricevuti. La bozza globale resta quando chiudi la sezione o cambi cliente."}</p>
      <AdminRefreshBar pending={reading} label={zh ? "读取活动配置…" : "Lettura configurazione…"} />
      {readError && <AdminNotice tone="error" title={zh ? "读取配置失败" : "Lettura non riuscita"} message={pricingError(readError, zh)} action={<Button type="button" variant="outline" disabled={reading || saving} onClick={() => void readCampaign()}>{zh ? "重读配置" : "Rileggi configurazione"}</Button>} />}
      {saveError && <AdminNotice tone="error" title={zh ? "保存被拒绝，草稿已保留" : "Salvataggio rifiutato, bozza conservata"} message={pricingError(saveError, zh)} />}
      {notice && <AdminNotice tone={notice === "saved" ? "success" : "info"} message={notice === "saved" ? zh ? "活动已保存，已有客户权益保持原有效期。" : "Promozione salvata. I benefici già assegnati mantengono la scadenza originale." : notice === "preserved" ? zh ? "已读取服务器配置；当前未保存草稿保持不变。" : "Configurazione letta; la bozza non salvata resta invariata." : zh ? "已采用核对后的服务器配置，可以继续编辑。未重复发送原保存。" : "Configurazione verificata adottata. Puoi modificare; il salvataggio originale non è stato reinviato."} />}
      {attempt && <AdminNotice tone="warning" title={zh ? "保存结果未知，请先只读核对" : "Esito del salvataggio non confermato"}>
        <p>{zh ? "服务器可能已保存。原提交和原因已保留，编辑与再次保存已锁定；重读不会再次写入。" : "Il server potrebbe aver salvato. Invio originale e motivo sono conservati; modifica e nuovo salvataggio sono sospesi. La rilettura non scrive dati."}</p>
        <AttemptSummary body={attempt.body} current={attempt.current} />
        <div className="mt-2 flex flex-wrap gap-2"><AdminActionButton type="button" variant="outline" pending={reading} disabled={saving} onClick={() => void readCampaign()}>{zh ? "只读重读当前配置" : "Rileggi la configurazione attuale"}</AdminActionButton>
        {attempt.current && <Button type="button" variant="outline" disabled={reading || saving} onClick={() => {
          if (!attempt.current || saveRef.current) return;
          setCampaign(attempt.current); setBaseline(campaignSignature(attempt.current)); setReason(""); setAttempt(null); setNotice("adopted"); setSaveError("");
        }}>{zh ? "已核对，采用当前配置恢复编辑" : "Verificato: adotta la configurazione e riprendi"}</Button>}</div>
      </AdminNotice>}
      {campaign ? <form className="space-y-3" onSubmit={event => { event.preventDefault(); void saveCampaign(); }}>
        <fieldset disabled={locked} className="min-w-0 space-y-3">
          <label className="flex items-center gap-2"><input type="checkbox" checked={campaign.enabled} onChange={event => updateCampaign({ enabled: event.target.checked })} />{zh ? "向符合条件的新客户发放权益" : "Assegna il beneficio ai nuovi clienti idonei"}</label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>{zh ? "赠送等级" : "Livello assegnato"}<select className="mt-1 block w-full rounded border p-2" value={campaign.level} onChange={event => updateCampaign({ level: event.target.value as SignupPricingCampaign["level"] })}>{customerTiers.map(tier => <option value={tier} key={tier}>{tierLabel(tier, zh)}</option>)}</select></label>
            <label>{zh ? "有效月数" : "Durata in mesi"}<Input type="number" min={1} max={24} required value={campaign.duration_months} onChange={event => updateCampaign({ duration_months: Number(event.target.value) })} /></label>
            <label>{zh ? "活动开始（留空为立即）" : "Inizio (vuoto: subito)"}<Input type="datetime-local" value={localDateInput(campaign.starts_at)} onChange={event => updateCampaign({ starts_at: event.target.value ? new Date(event.target.value).toISOString() : null })} /></label>
            <label>{zh ? "活动结束（留空为长期）" : "Fine (vuoto: senza scadenza)"}<Input type="datetime-local" value={localDateInput(campaign.ends_at)} onChange={event => updateCampaign({ ends_at: event.target.value ? new Date(event.target.value).toISOString() : null })} /></label>
          </div>
          <label className="block">{zh ? "变更原因" : "Motivo della modifica"}<Input aria-describedby="campaign-reason-hint" required minLength={3} maxLength={1000} value={reason} onChange={event => { if (!saveRef.current && !locked) { setReason(event.target.value); setSaveError(""); setNotice(""); } }} /></label>
          <p id="campaign-reason-hint" className="text-xs text-slate-500">{zh ? "至少填写 3 个字，去除首尾空格后计算。" : "Almeno 3 caratteri, senza gli spazi iniziali e finali."}</p>
        </fieldset>
        <AdminActionButton type="submit" pending={saving} pendingLabel={zh ? "保存活动中…" : "Salvataggio promozione…"} disabled={locked || reading || reason.trim().length < 3 || !isCampaign(campaign)}>{zh ? "保存活动" : "Salva promozione"}</AdminActionButton>
      </form> : !reading && !readError && <AdminEmptyState title={zh ? "尚未读取活动配置" : "Configurazione non ancora letta"} action={<Button variant="outline" onClick={() => void readCampaign()}>{zh ? "读取配置" : "Leggi configurazione"}</Button>} />}
      {lastAttempt && !attempt && <details className="rounded border p-2 text-xs"><summary>{zh ? "查看本次保存提交与原因" : "Vedi invio e motivo dell'ultimo tentativo"}</summary><AttemptSummary body={lastAttempt} current={null} /></details>}
      <PricingChecks key={canCheck ? "customer-readable" : "policy-only"} canCheck={canCheck} disabled={saving} />
    </section>}
  </div>;
}

function AttemptSummary({ body, current }: { body: CampaignBody; current: SignupPricingCampaign | null }) {
  const { locale } = useI18n(); const zh = locale.startsWith("zh");
  const describe = (value: SignupPricingCampaign) => `${value.enabled ? zh ? "启用" : "Attiva" : zh ? "关闭" : "Disattiva"} · ${tierLabel(value.level, zh)} · ${value.duration_months} ${zh ? "个月" : "mesi"} · ${value.starts_at ?? (zh ? "立即" : "Subito")} → ${value.ends_at ?? (zh ? "长期" : "Senza scadenza")}`;
  return <div className="mt-2 space-y-1 break-words text-xs"><p>{zh ? "原提交：" : "Invio originale: "}{describe(body)}</p><p>{zh ? "原原因：" : "Motivo originale: "}{body.reason}</p>{current && <><p>{zh ? "当前服务器配置：" : "Configurazione attuale: "}{describe(current)}</p><p>{campaignSignature(body) === campaignSignature(current) ? zh ? "当前配置与原提交一致；请核对后恢复编辑。" : "La configurazione coincide con l'invio. Verifica prima di riprendere." : zh ? "当前配置与原提交不同，可能存在其他更新。采用当前配置将结束本次未知提交核对。" : "La configurazione differisce dall'invio; potrebbero esserci altre modifiche. Adottarla conclude la verifica del tentativo."}</p></>}</div>;
}

function PricingQuoteSection({ customerId, disabled }: { customerId: string; disabled: boolean }) {
  const { locale } = useI18n(); const zh = locale.startsWith("zh");
  const [target, setTarget] = useState(customerId); const [sku, setSku] = useState("REMAX-6954851225270"); const [quantity, setQuantity] = useState(1);
  const [quotes, setQuotes] = useState<PricingInspection[] | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target.trim()) && /^[a-zA-Z0-9_+.-]{3,64}$/.test(sku.trim()) && Number.isInteger(quantity) && quantity >= 1 && quantity <= 10000;
  async function inspectPrices() {
    if (disabled || busy || !valid) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller; setBusy(true); setError(""); setQuotes(null);
    try { const data = await pricingRequest("/api/admin/pricing", { method: "POST", signal: controller.signal, body: JSON.stringify({ customerId: target.trim(), items: [{ sku: sku.trim(), quantity }] }) }, isQuotes); if (!controller.signal.aborted) setQuotes(data); }
    catch (error) { if (!controller.signal.aborted) setError(errorCode(error)); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <section className="space-y-2 border-t pt-3"><h4 className="font-bold">{zh ? "解释客户商品价格" : "Spiega il prezzo per cliente e prodotto"}</h4><fieldset disabled={busy || disabled} className="grid min-w-0 gap-2 sm:grid-cols-3">
    <label className="space-y-1">{zh ? "客户编号" : "ID cliente"}<Input value={target} onChange={event => { setTarget(event.target.value); setQuotes(null); setError(""); }} /></label>
    <label className="space-y-1">SKU<Input value={sku} onChange={event => { setSku(event.target.value); setQuotes(null); setError(""); }} /></label>
    <label className="space-y-1">{zh ? "数量" : "Quantità"}<Input type="number" min={1} max={10000} value={quantity} onChange={event => { setQuantity(Number(event.target.value)); setQuotes(null); setError(""); }} /></label>
  </fieldset><AdminActionButton type="button" variant="outline" pending={busy} pendingLabel={zh ? "读取报价中…" : "Lettura prezzi…"} disabled={disabled || !valid} onClick={() => void inspectPrices()}>{zh ? "查询价格" : "Leggi prezzi"}</AdminActionButton>
    {error && <AdminNotice tone="error" title={zh ? "读取报价失败" : "Lettura prezzi non riuscita"} message={pricingError(error, zh)} />}
    {quotes && !quotes.length && <AdminEmptyState title={zh ? "没有找到报价" : "Nessun prezzo trovato"} description={zh ? "检查客户编号和 SKU 后重新查询。" : "Controlla ID cliente e SKU e ripeti la lettura."} />}
    {quotes?.map(quote => <div key={quote.sku_code} className="rounded border p-3"><p className="break-words font-semibold">{quote.sku_code} · {quote.customer_type === "wholesale" ? zh ? "批发" : "Ingrosso" : zh ? "零售" : "Dettaglio"} · {quote.quoted_quantity} {zh ? "件" : "pz"}</p><p>{zh ? "基础" : "Base"} {money(quote.base_unit_price, zh)} → {zh ? "成交" : "Applicato"} {money(quote.effective_unit_price, zh)}</p><p>{zh ? "基础等级" : "Livello base"} {tierLabel(quote.base_customer_level, zh)}（{quote.level_source === "manual" ? zh ? "人工" : "Manuale" : zh ? "自动/自购" : "Automatico/acquisti"}） · {zh ? "有效等级" : "Livello effettivo"} {tierLabel(quote.customer_level, zh)}</p><p className="break-all text-xs text-slate-500">{zh ? "来源" : "Origine"}: {quote.price_source} · {zh ? "版本" : "Versione"}: {quote.price_version ?? (zh ? "无有效报价" : "Nessun prezzo valido")}</p>{quote.price_valid_until && <p className="text-xs">{zh ? "下次规则变化" : "Prossima variazione"}: {new Date(quote.price_valid_until).toLocaleString(locale)}</p>}</div>)}
  </section>;
}

function PricingChecks({ canCheck, disabled }: { canCheck: boolean; disabled: boolean }) {
  const { locale } = useI18n(); const zh = locale.startsWith("zh");
  const [anomalies, setAnomalies] = useState<PricingAnomaly[] | null>(null); const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [pending, setPending] = useState<"anomalies" | "audit" | null>(null); const [error, setError] = useState<{ view: "anomalies" | "audit"; code: string } | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function read(view: "anomalies" | "audit") {
    if (disabled || pending || view === "anomalies" && !canCheck) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller; setPending(view); setError(null);
    if (view === "anomalies") setAnomalies(null); else setAudit(null);
    try {
      if (view === "anomalies") { const data = await pricingRequest(`/api/admin/pricing?view=${view}`, { signal: controller.signal }, isAnomalies); if (!controller.signal.aborted) setAnomalies(data); }
      else { const data = await pricingRequest(`/api/admin/pricing?view=${view}`, { signal: controller.signal }, isAudit); if (!controller.signal.aborted) setAudit(data); }
    } catch (error) { if (!controller.signal.aborted) setError({ view, code: errorCode(error) }); }
    finally { if (!controller.signal.aborted) setPending(null); }
  }
  return <div className="space-y-2"><div className="flex flex-wrap gap-2"><AdminActionButton type="button" variant="outline" pending={pending === "anomalies"} disabled={disabled || Boolean(pending) || !canCheck} onClick={() => void read("anomalies")}>{zh ? "运行价格一致性检查" : "Verifica coerenza prezzi"}</AdminActionButton><AdminActionButton type="button" variant="outline" pending={pending === "audit"} disabled={disabled || Boolean(pending)} onClick={() => void read("audit")}>{zh ? "查看活动变更记录" : "Leggi modifiche alla promozione"}</AdminActionButton></div>
    {!canCheck && <p className="text-xs text-slate-500">{zh ? "一致性检查还需要读取客户权限。" : "La verifica richiede anche il permesso di lettura clienti."}</p>}
    {error && <AdminNotice tone="error" title={error.view === "audit" ? zh ? "读取变更记录失败" : "Lettura modifiche non riuscita" : zh ? "一致性检查失败" : "Verifica non riuscita"} message={pricingError(error.code, zh)} action={<Button variant="outline" disabled={disabled || Boolean(pending)} onClick={() => void read(error.view)}>{zh ? "重试读取" : "Riprova lettura"}</Button>} />}
    {canCheck && anomalies && <div className="space-y-1"><p>{zh ? `发现 ${anomalies.length} 项；检查不修改账号或售价，不包含毛利检查。` : `${anomalies.length} anomalie. La verifica non modifica account o prezzi e non include il margine.`}</p>{!anomalies.length && <AdminEmptyState title={zh ? "未发现价格一致性异常" : "Nessuna anomalia di coerenza"} />}{anomalies.map((item, index) => <p key={index} className="break-all rounded bg-amber-50 p-2">{anomalyLabel(item.kind, zh)} · {item.sku_code ?? item.customer_id} {item.stored_level ? `${tierLabel(item.stored_level, zh)} → ${tierLabel(item.effective_level, zh)}` : ""}</p>)}</div>}
    {audit && <div className="space-y-1">{audit.length ? audit.map((entry, index) => <p key={index} className="break-words rounded border p-2">{entry.created_at ? new Date(entry.created_at).toLocaleString(locale) : ""} · {entry.reason ?? entry.action}</p>) : <AdminEmptyState title={zh ? "暂无活动变更记录" : "Nessuna modifica alla promozione"} />}</div>}
  </div>;
}
function anomalyLabel(kind: string, zh: boolean) {
  const labels: Record<string, [string, string]> = { manual_effective_mismatch: ["人工与有效等级不一致", "Livello manuale diverso dall'effettivo"], retail_below_b2b: ["零售价低于批发价", "Prezzo al dettaglio inferiore all'ingrosso"], exempt_customer_price_ignored: ["免折扣商品存在不会生效的协议价", "Prezzo concordato ignorato per un prodotto escluso dagli sconti"], quote_unavailable: ["报价不可用", "Prezzo non disponibile"] };
  return labels[kind]?.[zh ? 0 : 1] ?? (zh ? "未知检查类型" : "Tipo di verifica sconosciuto");
}

export function ClassificationPricePreview({ customerId, customerType, onReady }: { customerId: string; customerType: string; onReady: (key: string) => void }) {
  const { locale } = useI18n(); const zh = locale.startsWith("zh");
  // Key only this read-only preview: global campaign drafts live in another component.
  return <ClassificationPreviewContent key={`${customerId}:${customerType}`} customerId={customerId} customerType={customerType} onReady={onReady} zh={zh} />;
}
function ClassificationPreviewContent({ customerId, customerType, onReady, zh }: { customerId: string; customerType: string; onReady: (key: string) => void; zh: boolean }) {
  const [sku, setSku] = useState("REMAX-6954851225270"); const [result, setResult] = useState<ClassificationPricingPreview | null>(null); const [empty, setEmpty] = useState(false); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const onReadyRef = useRef(onReady);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  useEffect(() => { onReadyRef.current(""); return () => request.current?.abort(); }, []);
  const scope = `${customerId}:${customerType}`;
  async function preview() {
    if (busy || !/^[a-zA-Z0-9_+.-]{3,64}$/.test(sku.trim())) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller; setBusy(true); setError(""); setResult(null); setEmpty(false); onReady("");
    try {
      const data = await pricingRequest("/api/admin/pricing", { method: "POST", signal: controller.signal, body: JSON.stringify({ customerId, customerType, items: [{ sku: sku.trim(), quantity: 1 }] }) }, isClassificationPreview);
      if (controller.signal.aborted) return;
      if (!data.items.length || data.items.some(item => !(Number(item.before.effective_unit_price) > 0) || !(Number(item.after.effective_unit_price) > 0))) { setEmpty(true); return; }
      setResult(data); onReady(scope);
    } catch (error) { if (!controller.signal.aborted) setError(errorCode(error)); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <div className="space-y-2 rounded border bg-slate-50 p-3"><Label htmlFor="classification-preview-sku">{zh ? "代表商品 SKU（只读预览）" : "SKU rappresentativo (anteprima di sola lettura)"}</Label><Input disabled={busy} id="classification-preview-sku" value={sku} onChange={event => { setSku(event.target.value); setResult(null); setEmpty(false); setError(""); onReady(""); }} /><AdminActionButton type="button" variant="outline" pending={busy} pendingLabel={zh ? "读取预览中…" : "Lettura anteprima…"} disabled={!/^[a-zA-Z0-9_+.-]{3,64}$/.test(sku.trim())} onClick={() => void preview()}>{zh ? "预览变更影响" : "Anteprima dell'impatto"}</AdminActionButton>{error && <AdminNotice tone="error" title={zh ? "读取预览失败" : "Anteprima non riuscita"} message={pricingError(error, zh)} />}{empty && <AdminEmptyState title={zh ? "没有可用的预览报价" : "Nessun prezzo valido per l'anteprima"} description={zh ? "请更换 SKU 后重读；尚未允许提交类型变更。" : "Scegli un altro SKU e rileggi. Il cambio di tipo non è ancora autorizzato."} />}{result?.items.map(item => <p key={item.sku_code}>{item.sku_code}: {money(item.before.effective_unit_price, zh)} → {money(item.after.effective_unit_price, zh)}</p>)}<p className="text-xs text-slate-500">{zh ? "类型变更影响该客户所有商品的后续报价，不修改已成交订单。" : "Il cambio di tipo modifica i prezzi futuri di tutti i prodotti del cliente; gli ordini già conclusi restano invariati."}</p></div>;
}
