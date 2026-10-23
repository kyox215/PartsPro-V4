"use client";

import { Check, ClipboardCheck, Wallet, PackageCheck, CircleCheck, Truck } from "lucide-react";
import type { AdminRmaDto } from "@/lib/partspro-rma-admin-dto";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ReturnMode = "return_required" | "refund_only";
export type WaiverReason = "no_recovery_value" | "return_cost_high" | "other";
export const rmaText = (locale: string, zh: string, it: string, en: string) => locale === "zh-CN" ? zh : locale.startsWith("en") ? en : it;

export function WaiverReasonFields({ locale, code, note, onCode, onNote, disabled = false, id }: {
  locale: string; code: WaiverReason | ""; note: string; onCode: (code: WaiverReason) => void;
  onNote: (note: string) => void; disabled?: boolean; id: string;
}) {
  const tr = (zh: string, it: string, en: string) => rmaText(locale, zh, it, en);
  return <div className="space-y-3">
    <Label htmlFor={`${id}-reason`}>{tr("免退回原因", "Motivo del reso non richiesto", "Reason for no return")}</Label>
    <select id={`${id}-reason`} value={code} disabled={disabled} onChange={event => onCode(event.target.value as WaiverReason)} className="min-h-11 w-full rounded-lg border bg-white px-3 text-sm">
      <option value="" disabled>{tr("请选择原因", "Seleziona un motivo", "Select a reason")}</option>
      <option value="no_recovery_value">{tr("无回收价值", "Nessun valore di recupero", "No recovery value")}</option>
      <option value="return_cost_high">{tr("退回成本过高", "Costo del reso eccessivo", "Return cost too high")}</option>
      <option value="other">{tr("其他", "Altro", "Other")}</option>
    </select>
    {code === "other" ? <div className="space-y-2"><Label htmlFor={`${id}-note`}>{tr("具体原因", "Motivo specifico", "Specific reason")}</Label><Textarea id={`${id}-note`} maxLength={1000} value={note} disabled={disabled} onChange={event => onNote(event.target.value)} /></div> : <details className="text-sm"><summary className="cursor-pointer text-slate-600">{tr("补充备注（选填）", "Nota aggiuntiva (facoltativa)", "Additional note (optional)")}</summary><Textarea aria-label={tr("补充备注", "Nota aggiuntiva", "Additional note")} className="mt-2" maxLength={1000} value={note} disabled={disabled} onChange={event => onNote(event.target.value)} /></details>}
  </div>;
}

export function ReturnModeFields({ locale, value, onChange, disabled, allowRefundOnly = true }: {
  locale: string; value: ReturnMode | null; onChange: (mode: ReturnMode) => void; disabled: boolean; allowRefundOnly?: boolean;
}) {
  const tr = (zh: string, it: string, en: string) => rmaText(locale, zh, it, en);
  return <fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">{tr("处理方式", "Soluzione", "Handling")}</legend>
    <div className="grid grid-cols-2 gap-2">{(["return_required", "refund_only"] as const).map(mode => <label key={mode} className={cn("flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm", value === mode ? "border-primary bg-primary/5" : "border-slate-200")}>
      <input type="radio" className="mt-1" name="rma-return-mode" value={mode} checked={value === mode} disabled={disabled || mode === "refund_only" && !allowRefundOnly} onChange={() => onChange(mode)} />
      <span><span className="block font-semibold">{mode === "return_required" ? tr("退货退款", "Reso e rimborso", "Return and refund") : tr("仅退款", "Solo rimborso", "Refund only")}</span><span className="mt-1 block text-xs text-slate-500">{mode === "return_required" ? tr("需要退回商品", "Articolo da restituire", "Goods must be returned") : tr("无需退回商品", "Articolo da tenere", "No return required")}</span></span>
    </label>)}</div>
  </fieldset>;
}

export function AdminRmaFlow({ request, locale }: { request: AdminRmaDto; locale: string }) {
  const tr = (zh: string, it: string, en: string) => rmaText(locale, zh, it, en);
  if (request.status === "rejected") return null;
  const reviewed = !["submitted", "under_review", "requested"].includes(request.status);
  const settled = Boolean(request.refundCompletedAt) || ["refunded", "closed"].includes(request.status) && (request.refundAmount ?? 0) > 0;
  const complete = request.status === "closed";
  const steps = [
    { label: tr("审核", "Verifica", "Review"), done: reviewed, icon: ClipboardCheck },
    { label: tr("退款", "Rimborso", "Refund"), done: settled, icon: Wallet },
    { label: tr("完成", "Completato", "Complete"), done: complete, icon: CircleCheck },
  ];
  const physicalDone = request.returnWaivedAt || ["restock", "scrap", "supplier_return"].includes(request.inventoryDisposition ?? "") && request.receivedQuantity === request.quantity && request.inventoryDispositionQuantity === request.quantity;
  const physical = request.returnWaivedAt ? tr("无需退回", "Reso non richiesto", "No return required")
    : physicalDone ? tr("商品处置完成", "Merce gestita", "Goods processed")
    : request.receivedAt ? tr("已收货 · 待处置", "Ricevuto · da gestire", "Received · awaiting processing")
    : request.customerShippedAt ? tr("客户已寄出 · 待收货", "Spedito · in attesa", "Shipped · awaiting receipt")
    : tr("等待客户寄回", "In attesa del reso", "Awaiting customer return");
  return <section aria-label={tr("处理进度", "Avanzamento", "Progress")} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
    <ol className="flex items-center">{steps.map((step, index) => <li key={step.label} className="flex min-w-0 flex-1 items-center gap-2 last:flex-none">
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", step.done ? "bg-emerald-100 text-emerald-700" : index === (reviewed ? settled ? 2 : 1 : 0) ? "bg-primary text-white" : "bg-slate-200 text-slate-500")}>
        {step.done ? <Check className="size-4" /> : <step.icon className="size-4" />}
      </span><span className="text-xs font-semibold">{step.label}</span>{index < 2 && <span className="mx-1 h-px min-w-2 flex-1 bg-slate-200" />}
    </li>)}</ol>
    {reviewed ? <p className="flex items-center gap-2 border-t border-slate-200 pt-3 text-sm text-slate-600">{physicalDone ? <PackageCheck className="size-4 shrink-0 text-emerald-700" /> : <Truck className="size-4 shrink-0" />}{physical}</p> : null}
  </section>;
}
