"use client";

import { englishUiCopy, englishUiTemplate } from "@/i18n/english-ui-copy";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AsyncFeedback } from "./async-feedback";
import { useCart, serializeCartItems, readClientStoredCartItems } from "./cart-state";
import { useI18n } from "./i18n-provider";
import { parseCartBatch } from "@/lib/partspro-cart-tools.mjs";
import { isProductOrderable, getProductPurchaseKind } from "@/lib/partspro-preorder-contract";
import type { PartProduct } from "@/lib/partspro-data";

export function CartBulkEntry({companyId, disabled}: {companyId: string | null; disabled: boolean}) {
  const {locale} = useI18n(); const zh = locale === "zh-CN";
  const cart = useCart({preserveUnknown: true});
  const [text,setText] = React.useState("");
  const [state,setState] = React.useState<"idle"|"loading"|"error"|"ready"|"success">("idle");
  const [message,setMessage] = React.useState("");
  const [preview,setPreview] = React.useState<Array<{sku:string;quantity:number;name:string;price:number}>>([]);
  const [previewSignature, setPreviewSignature] = React.useState("");
  const signature = serializeCartItems(cart.items);
  async function validate() {
    const parsed = parseCartBatch(text);
    if (parsed.errors.length || !parsed.items.length) { setState("error");setMessage((locale.startsWith("en") ? englishUiTemplate`Usa “SKU quantità”, una riga per articolo (max 100). Righe non valide: ${parsed.errors.join(", ")}` : zh ? `请使用“SKU 数量”，每行一项，最多100行；错误行：${parsed.errors.join(", ")}` : `Usa “SKU quantità”, una riga per articolo (max 100). Righe non valide: ${parsed.errors.join(", ")}`));return; }
    setState("loading"); const controller = new AbortController(); const timer = window.setTimeout(()=>controller.abort(),20000);
    try {
      const expected = parsed.items.map(item=>({...item,quantity:item.quantity+(cart.items.find(x=>x.sku===item.sku)?.quantity??0)}));
      if (expected.some(x=>x.quantity>999)) throw new Error((locale.startsWith("en") ? englishUiCopy("Quantità totale superiore a 999.") : zh?"合并数量超过999。":"Quantità totale superiore a 999."));
      const products: PartProduct[] = [];
      for (let offset=0;offset<expected.length;offset+=50) {
        const items=expected.slice(offset,offset+50); const params=new URLSearchParams({skus:items.map(x=>x.sku).join(","),quantities:JSON.stringify(Object.fromEntries(items.map(x=>[x.sku,x.quantity])))});
        if(companyId)params.set("companyId",companyId);
        const response=await fetch(`/api/cart/catalog?${params}`,{cache:"no-store",signal:controller.signal});
        if(!response.ok)throw new Error((locale.startsWith("en") ? englishUiCopy("Impossibile verificare prezzi e disponibilità. Riprova.") : zh?"无法核对价格和库存，请重试。":"Impossibile verificare prezzi e disponibilità. Riprova."));
        const payload=await response.json();products.push(...(payload.data??[]));
      }
      const invalid=expected.filter(item=>{const product=products.find(p=>p.sku===item.sku);return !product || !isProductOrderable(product,item.quantity);});
      if(invalid.length)throw new Error(((locale.startsWith("en") ? englishUiCopy("SKU assenti, non autorizzati, sotto MOQ o non disponibili: ") : zh?"以下SKU不存在、未获授权、未达到起订量或库存不足：":"SKU assenti, non autorizzati, sotto MOQ o non disponibili: "))+invalid.map(x=>x.sku).join(", "));
      if(cart.items.length !== cart.lines.length)throw new Error((locale.startsWith("en") ? englishUiCopy("Attendi la verifica del carrello o rimuovi gli articoli non disponibili.") : zh?"请先等待现有购物车核对完成，或移除不可用条目。":"Attendi la verifica del carrello o rimuovi gli articoli non disponibili."));
      const kinds=new Set([...products.map(getProductPurchaseKind),...cart.lines.map(line=>getProductPurchaseKind(line.product))].filter(kind=>kind!=="unavailable"));
      if(kinds.size>1)throw new Error((locale.startsWith("en") ? englishUiCopy("Articoli disponibili e preordini richiedono ordini separati. Aggiungili separatamente.") : zh?"现货和预订需分别下单，请分开加入。":"Articoli disponibili e preordini richiedono ordini separati. Aggiungili separatamente."));
      setPreviewSignature(signature);
      setPreview(parsed.items.map(item=>{const product=products.find(p=>p.sku===item.sku)!;return {...item,name:product.name,price:product.price};}));setState("ready");
    } catch(error){setState("error");setMessage(error instanceof Error?error.message:((locale.startsWith("en") ? englishUiCopy("Verifica non disponibile.") : zh?"暂时无法核对。":"Verifica non disponibile.")));}
    finally{window.clearTimeout(timer);}
  }
  return <details className="pp-cart-bulk rounded-lg border border-slate-200 bg-white p-3"><summary className="min-h-11 cursor-pointer font-semibold"><span>{(locale.startsWith("en") ? englishUiCopy("Aggiungi più SKU") : zh?"按SKU批量加入":"Aggiungi più SKU")}</span><span className="pp-cart-bulk-hint">{(locale.startsWith("en") ? englishUiCopy("Acquisto rapido · max 100 righe") : zh?"快速采购 · 最多100行":"Acquisto rapido · max 100 righe")}</span></summary><div className="space-y-3 pt-3"><label htmlFor="cart-batch" className="block text-sm">{(locale.startsWith("en") ? englishUiCopy("Una riga: SKU quantità (max 100)") : zh?"每行：SKU 数量（最多100行）":"Una riga: SKU quantità (max 100)")}</label><Textarea id="cart-batch" value={text} disabled={disabled||state==="loading"} onChange={e=>{setText(e.target.value);setState("idle");}} placeholder={'SKU-001 2\nSKU-002 5'} /><Button disabled={disabled||state==="loading"} onClick={validate}>{state==="loading"?((locale.startsWith("en") ? englishUiCopy("Verifica…") : zh?"核对中…":"Verifica…")):((locale.startsWith("en") ? englishUiCopy("Anteprima e verifica") : zh?"预览并核对":"Anteprima e verifica"))}</Button>{state==="error"?<AsyncFeedback state="error" title={message}/>:null}{state==="success"?<AsyncFeedback state="success" title={(locale.startsWith("en") ? englishUiCopy("Articoli aggiunti. Il carrello verifica di nuovo prezzi e disponibilità.") : zh?"已加入，购物车正在重新核对价格和库存。":"Articoli aggiunti. Il carrello verifica di nuovo prezzi e disponibilità.")}/>:null}{state==="ready"?<div className="space-y-2"><ul className="space-y-1 text-sm">{preview.map(x=><li key={x.sku} className="break-words">{x.sku} · {x.name} · +{x.quantity} · €{x.price.toFixed(2)}</li>)}</ul><Button disabled={disabled||previewSignature!==signature} onClick={()=>{const current=readClientStoredCartItems();if(previewSignature!==serializeCartItems(current))return;cart.setItems([...current.map(item=>({...item,quantity:item.quantity+(preview.find(x=>x.sku===item.sku)?.quantity??0)})),...preview.filter(item=>!current.some(x=>x.sku===item.sku)).map(({sku,quantity})=>({sku,quantity}))]);setText("");setState("success");}}>{(locale.startsWith("en") ? englishUiCopy("Conferma aggiunta") : zh?"确认加入":"Conferma aggiunta")}</Button>{previewSignature!==signature?<p className="text-sm text-amber-700">{(locale.startsWith("en") ? englishUiCopy("Il carrello è cambiato: verifica nuovamente.") : zh?"购物车已变化，请重新核对。":"Il carrello è cambiato: verifica nuovamente.")}</p>:null}</div>:null}</div></details>;
}
