"use client";

import * as React from "react";
import { WaiverReasonFields, type WaiverReason } from "./admin-rma-flow";
import type { AdminRmaDto } from "@/lib/partspro-rma-admin-dto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type RefundFields = { waiverReasonCode?: WaiverReason; refundMethod?: "cash" | "wallet_credit"; refundAmount?: number; cashPaid?: boolean; confirmResolutionChange?: boolean; reason?: string };
export function AdminRmaRefundCard({ request, locale, preview, pending, onAction }: {
  request: AdminRmaDto; locale: string; pending: boolean;
  preview: { available: boolean; maxRefundAmount: number } | null;
  onAction: (action: "execute_refund" | "waive_return", fields: RefundFields) => Promise<void>;
}) {
  const tr = (zh: string, it: string, en: string) => locale === "zh-CN" ? zh : locale.startsWith("en") ? en : it;
  const [dialog, setDialog] = React.useState<"refund" | "waive" | null>(null);
  const [method, setMethod] = React.useState<"cash" | "wallet_credit" | null>(null);
  const [amount, setAmount] = React.useState("");
  const [cashPaid, setCashPaid] = React.useState(false);
  const [changeConfirmed, setChangeConfirmed] = React.useState(false);
  const [waiverCode, setWaiverCode] = React.useState<WaiverReason | "">("");
  const [reason, setReason] = React.useState("");
  const completed = Boolean(request.refundCompletedAt) || ["refunded", "closed"].includes(request.status) && (request.refundAmount ?? 0) > 0;
  const money = (value: number) => new Intl.NumberFormat(locale === "zh-CN" ? "zh-CN" : locale.startsWith("en") ? "en-IE" : "it-IT", { style: "currency", currency: "EUR" }).format(value);
  const parsedAmount = Number(amount);
  const valid = preview?.available && amount.trim() && Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= preview.maxRefundAmount && Math.abs(parsedAmount * 100 - Math.round(parsedAmount * 100)) < 1e-8;
  const physical = request.returnWaivedAt ? tr("无需退回", "Reso non richiesto", "No return required") : request.receivedAt ? tr("已收货", "Merce ricevuta", "Goods received") : tr("待收货", "In attesa del reso", "Awaiting goods");
  if (["submitted", "requested", "under_review", "rejected"].includes(request.status)) return null;
  return <section id="rma-wallet-flow" className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
    <h4 className="font-bold">{request.returnWaivedAt ? tr("仅退款", "Solo rimborso", "Refund only") : tr("退货退款", "Reso e rimborso", "Return and refund")}</h4>
    {completed ? <p className="font-semibold text-emerald-800">{request.refundMethod === "cash" ? tr("已退现金", "Rimborsato in contanti", "Cash refund paid") : tr("已退至钱包", "Accreditato al portafoglio", "Credited to wallet")} · {money(request.refundGrossAmount ?? request.refundAmount ?? 0)} · {physical}</p> : <>

      {request.availableActions.includes("execute_refund") ? <Button type="button" disabled={pending} onClick={() => { setAmount(preview?.available ? String(preview.maxRefundAmount) : ""); setMethod(null); setCashPaid(false); setChangeConfirmed(false); setReason(""); setDialog("refund"); }}>{tr("办理退款", "Esegui rimborso", "Issue refund")}</Button> : null}
    </>}
    {request.availableActions.includes("waive_return") ? <Button type="button" variant="outline" disabled={pending} onClick={() => { setReason(""); setWaiverCode(""); setDialog("waive"); }}>{tr("改为仅退款", "Passa a solo rimborso", "Change to refund only")}</Button> : null}
    <Dialog open={dialog === "refund" && !completed} onOpenChange={open => !open && !pending && setDialog(null)}>
      <DialogContent className="admin-ui-panel"><DialogHeader><DialogTitle>{tr("确认退款", "Conferma rimborso", "Confirm refund")}</DialogTitle><DialogDescription>{tr("按原订单已付商品金额核算，运费不计入。一次确认结清本条售后。", "Importo della merce pagata, spedizione esclusa. La conferma salda questo reso una sola volta.", "Based on paid goods, excluding shipping. Confirmation settles this return once.")}</DialogDescription></DialogHeader>
        <fieldset className="space-y-2"><legend className="text-sm font-semibold">{tr("退款方式", "Metodo", "Refund method")}</legend><div className="grid grid-cols-2 gap-2">{(["cash", "wallet_credit"] as const).map(value => <label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm"><input type="radio" name="rma-refund-method" value={value} checked={method === value} disabled={pending} onChange={() => { setMethod(value); setCashPaid(false); }} />{value === "cash" ? tr("现金", "Contanti", "Cash") : tr("客户钱包", "Portafoglio", "Customer wallet")}</label>)}</div></fieldset>
        <div className="space-y-2"><Label htmlFor="simple-refund-amount">{tr("退款金额（EUR）", "Importo (EUR)", "Refund amount (EUR)")}</Label><Input id="simple-refund-amount" type="number" inputMode="decimal" min="0.01" step="0.01" max={preview?.maxRefundAmount} value={amount} disabled={pending || !preview?.available} onChange={event => { setAmount(event.target.value); setCashPaid(false); }} /><p className="text-sm">{preview?.available ? `${tr("最多可退", "Massimo", "Maximum")}: ${money(preview.maxRefundAmount)}` : tr("无法核对原单可退金额，请刷新详情或核查订单付款记录。", "Importo originale non verificabile. Aggiorna e controlla il pagamento.", "Original refundable amount unavailable. Refresh and verify the order payment.")}</p></div>
        {request.requestedResolution === "replacement" ? <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={changeConfirmed} disabled={pending} onChange={event => setChangeConfirmed(event.target.checked)} />{tr("确认将原换货方案改为退款", "Confermo il passaggio da sostituzione a rimborso", "Confirm changing replacement to refund")}</label> : null}
        <div className="space-y-2"><Label htmlFor="simple-refund-note">{tr("备注（选填）", "Nota (facoltativa)", "Note (optional)")}</Label><Textarea id="simple-refund-note" maxLength={1000} value={reason} disabled={pending} onChange={event => setReason(event.target.value)} /></div>
        {method === "cash" ? <label className="flex items-start gap-2 text-sm font-semibold"><input type="checkbox" checked={cashPaid} disabled={pending} onChange={event => setCashPaid(event.target.checked)} />{tr("我确认已将上述现金实际支付给客户", "Confermo di aver consegnato questo importo in contanti al cliente", "I confirm this cash amount has been paid to the customer")}</label> : null}
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setDialog(null)}>{tr("取消", "Annulla", "Cancel")}</Button><Button type="button" disabled={pending || !valid || !method || method === "cash" && !cashPaid || request.requestedResolution === "replacement" && !changeConfirmed} onClick={() => method && void onAction("execute_refund", { refundMethod: method, refundAmount: parsedAmount, cashPaid, confirmResolutionChange: changeConfirmed, reason: reason.trim() || undefined })}>{pending ? tr("处理中…", "Elaborazione…", "Processing…") : method === "cash" ? tr("确认现金已支付", "Conferma contanti pagati", "Confirm cash paid") : tr("确认转入钱包", "Conferma accredito", "Confirm wallet credit")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={dialog === "waive" && !request.returnWaivedAt} onOpenChange={open => !open && !pending && setDialog(null)}>
      <DialogContent className="admin-ui-panel"><DialogHeader><DialogTitle>{tr("改为仅退款", "Solo rimborso", "Refund only")}</DialogTitle><DialogDescription>{tr("客户无需寄回商品，不增加库存。退款完成后自动结案。", "Il cliente tiene l’articolo. Nessun aumento di stock. Chiusura dopo il rimborso.", "The customer keeps the goods. Stock is unchanged. The case closes after refund.")}</DialogDescription></DialogHeader>
        <WaiverReasonFields id="waive-return" locale={locale} code={waiverCode} note={reason} onCode={setWaiverCode} onNote={setReason} disabled={pending} />
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setDialog(null)}>{tr("取消", "Annulla", "Cancel")}</Button><Button type="button" disabled={pending || !waiverCode || waiverCode === "other" && !reason.trim()} onClick={() => waiverCode && void onAction("waive_return", { waiverReasonCode: waiverCode, reason: reason.trim() || undefined })}>{tr("确认无需退回", "Conferma", "Confirm no return")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
