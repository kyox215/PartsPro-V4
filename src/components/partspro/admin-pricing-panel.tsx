"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { customerTiers } from "@/lib/partspro-pricing";
import type { ClassificationPricingPreview, PricingAnomaly, PricingInspection, SignupPricingCampaign } from "@/lib/partspro-pricing-admin";

async function pricingRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store", headers: { "Content-Type": "application/json" } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? "价格管理请求失败");
  return payload.data as T;
}

function money(value: number | null | undefined) {
  return value == null ? "不可报价" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(value));
}

export function AdminPricingPanel({ permissions, customerId }: { permissions: readonly string[]; customerId?: string | null }) {
  const manage = permissions.includes("pricing.manage_policy");
  const inspect = permissions.includes("customers.read") && permissions.includes("orders.manage");
  const [opened, setOpened] = useState(false);
  if (!manage && !inspect) return null;
  return <details className="rounded-lg border bg-white p-3" onToggle={(event) => setOpened(event.currentTarget.open)}>
    <summary className="cursor-pointer text-sm font-bold">价格规则、迎新活动与检查</summary>
    {opened ? <PricingPanelContent key={customerId ?? "none"} manage={manage} inspect={inspect} customerId={customerId ?? ""} canCheck={permissions.includes("customers.read")} /> : null}
  </details>;
}

function PricingPanelContent({ manage, inspect, customerId, canCheck }: { manage: boolean; inspect: boolean; customerId: string; canCheck: boolean }) {
  const [campaign, setCampaign] = useState<SignupPricingCampaign | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState(customerId);
  const [sku, setSku] = useState("REMAX-6954851225270");
  const [quantity, setQuantity] = useState(1);
  const [quotes, setQuotes] = useState<PricingInspection[]>([]);
  const [anomalies, setAnomalies] = useState<PricingAnomaly[] | null>(null);
  const [audit, setAudit] = useState<{ created_at?: string; reason?: string; action?: string }[] | null>(null);
  useEffect(() => {
    if (!manage) return;
    let active = true;
    pricingRequest<SignupPricingCampaign>("/api/admin/pricing").then((value) => { if (active) setCampaign(value); }).catch((error) => { if (active) setNotice(error.message); });
    return () => { active = false; };
  }, [manage]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setNotice("");
    try { await action(); } catch (error) { setNotice(error instanceof Error ? error.message : "请求失败"); } finally { setBusy(false); }
  }
  return <div className="mt-3 space-y-4 text-sm">
    <p className="text-xs text-slate-600">零售/批发决定原价；基础等级与有效促销取高。REMAX、保护膜不参与折扣。售后退款不额外扣回等级累计，毛利规则本次保持不变。</p>
    {notice ? <p role="status" className="rounded bg-slate-100 p-2">{notice}</p> : null}
    {inspect ? <section className="space-y-2 border-t pt-3">
      <h4 className="font-bold">解释客户商品价格</h4>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="space-y-1">客户编号<Input disabled={busy} value={target} onChange={(e) => { setTarget(e.target.value); setQuotes([]); }} /></label>
        <label className="space-y-1">SKU<Input disabled={busy} value={sku} onChange={(e) => { setSku(e.target.value); setQuotes([]); }} /></label>
        <label className="space-y-1">数量<Input disabled={busy} type="number" min={1} max={10000} value={quantity} onChange={(e) => { setQuantity(Number(e.target.value)); setQuotes([]); }} /></label>
      </div>
      <Button variant="outline" disabled={busy || !target || !sku || !Number.isInteger(quantity) || quantity < 1} onClick={() => void run(async () => setQuotes(await pricingRequest<PricingInspection[]>("/api/admin/pricing", { method: "POST", body: JSON.stringify({ customerId: target, items: [{ sku, quantity }] }) })))}>查询价格</Button>
      {quotes.map((quote) => <div key={quote.sku_code} className="rounded border p-3">
        <p className="font-semibold">{quote.sku_code} · {quote.customer_type === "wholesale" ? "批发" : "零售"} · {quote.quoted_quantity} 件</p>
        <p>基础 {money(quote.base_unit_price)} → 成交 {money(quote.effective_unit_price)}</p>
        <p>基础等级 {quote.base_customer_level}（{quote.level_source === "manual" ? "人工" : "自动/自购"}） · 有效等级 {quote.customer_level}</p>
        <p className="break-all text-xs text-slate-500">来源：{quote.price_source} · 版本：{quote.price_version ?? "无有效报价"}</p>
        {quote.price_valid_until ? <p className="text-xs">下次规则变化：{new Date(quote.price_valid_until).toLocaleString()}</p> : null}
      </div>)}
    </section> : null}
    {manage ? <section className="space-y-2 border-t pt-3">
      <h4 className="font-bold">注册赠送等级活动</h4>
      <p className="text-xs text-slate-500">修改只影响未来发放；关闭活动不取消客户已经领取的权益。</p>
      {campaign ? <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run(async () => { const next = await pricingRequest<SignupPricingCampaign>("/api/admin/pricing", { method: "PATCH", body: JSON.stringify({ enabled: campaign.enabled, level: campaign.level, duration_months: campaign.duration_months, starts_at: campaign.starts_at, ends_at: campaign.ends_at, reason }) }); setCampaign(next); setReason(""); setNotice("活动已保存，已有客户权益保持原有效期。"); }); }}>
        <label className="flex items-center gap-2"><input type="checkbox" checked={campaign.enabled} onChange={(e) => setCampaign({ ...campaign, enabled: e.target.checked })} />向符合条件的新客户发放权益</label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>赠送等级<select className="mt-1 block w-full rounded border p-2" value={campaign.level} onChange={(e) => setCampaign({ ...campaign, level: e.target.value as SignupPricingCampaign["level"] })}>{customerTiers.map((tier) => <option key={tier}>{tier}</option>)}</select></label>
          <label>有效月数<Input type="number" min={1} max={24} required value={campaign.duration_months} onChange={(e) => setCampaign({ ...campaign, duration_months: Number(e.target.value) })} /></label>
          <label>活动开始（留空为立即）<Input type="datetime-local" value={localDateInput(campaign.starts_at)} onChange={(e) => { setCampaign({ ...campaign, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null }); }} /></label>
          <label>活动结束（留空为长期）<Input type="datetime-local" value={campaign.ends_at ? localDateInput(campaign.ends_at) : ""} onChange={(e) => setCampaign({ ...campaign, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
        </div>
        <label className="block">变更原因<Input required minLength={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <Button disabled={busy || reason.trim().length < 3}>保存活动</Button>
      </form> : <p>活动配置尚未加载；可重新展开面板重试。</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy || !canCheck} onClick={() => void run(async () => setAnomalies(await pricingRequest<PricingAnomaly[]>("/api/admin/pricing?view=anomalies")))}>运行价格一致性检查</Button>
        <Button variant="outline" disabled={busy} onClick={() => void run(async () => setAudit(await pricingRequest("/api/admin/pricing?view=audit")))}>查看活动变更记录</Button>
      </div>
      {anomalies ? <div className="space-y-1"><p>发现 {anomalies.length} 项；检查不修改账号或售价，不包含毛利检查。</p>{anomalies.map((item, index) => <p key={index} className="break-all rounded bg-amber-50 p-2">{anomalyLabel(item.kind)} · {item.sku_code ?? item.customer_id} {item.stored_level ? `${item.stored_level} → ${item.effective_level}` : ""}</p>)}</div> : null}
      {audit ? <div className="space-y-1">{audit.length ? audit.map((entry, i) => <p key={i} className="rounded border p-2">{entry.created_at ? new Date(entry.created_at).toLocaleString() : ""} · {entry.reason ?? entry.action}</p>) : <p>暂无活动变更记录</p>}</div> : null}
    </section> : null}
  </div>;
}

function localDateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function anomalyLabel(kind: string) {
  const labels: Record<string, string> = { manual_effective_mismatch: "人工与有效等级不一致", retail_below_b2b: "零售价低于批发价", exempt_customer_price_ignored: "免折扣商品存在不会生效的协议价", quote_unavailable: "报价不可用" };
  return labels[kind] ?? kind;
}

export function ClassificationPricePreview({ customerId, customerType, onReady }: { customerId: string; customerType: string; onReady: (key: string) => void }) {
  const [sku, setSku] = useState("REMAX-6954851225270");
  const [result, setResult] = useState<ClassificationPricingPreview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const scope = `${customerId}:${customerType}`;
  return <div className="space-y-2 rounded border bg-slate-50 p-3">
    <Label htmlFor="classification-preview-sku">代表商品 SKU（只读预览）</Label>
    <Input disabled={busy} id="classification-preview-sku" value={sku} onChange={(e) => { setSku(e.target.value); setResult(null); onReady(""); }} />
    <Button type="button" variant="outline" disabled={busy || !sku} onClick={async () => {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setBusy(true); setError(""); onReady("");
      try {
        const data = await pricingRequest<ClassificationPricingPreview>("/api/admin/pricing", { method: "POST", signal: controller.signal, body: JSON.stringify({ customerId, customerType, items: [{ sku, quantity: 1 }] }) });
        if (controller.signal.aborted) return;
        if (!data.items.length || data.items.some((item) => !(Number(item.before.effective_unit_price) > 0) || !(Number(item.after.effective_unit_price) > 0))) throw new Error("未找到可用于预览的商品，请更换 SKU。");
        setResult(data); onReady(scope);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "预览失败"); } finally { if (!controller.signal.aborted) setBusy(false); }
    }}>预览变更影响</Button>
    {error ? <p role="alert">{error}</p> : null}
    {result?.items.map((item) => <p key={item.sku_code}>{item.sku_code}：{money(item.before.effective_unit_price)} → {money(item.after.effective_unit_price)}</p>)}
    <p className="text-xs text-slate-500">类型变更影响该客户所有商品的后续报价，不修改已成交订单。</p>
  </div>;
}
