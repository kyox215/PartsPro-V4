"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, RotateCcw, FolderTree, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { catalogNodeLabel, emptyCatalogDirectory, type CatalogDirectory, type CatalogNode, type CatalogNodeInput } from "@/lib/partspro-catalog-directory";
import { notifyCatalogChanged } from "./catalog-directory-provider";

export async function catalogRequest<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(15000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const response = await fetch(url, { method: body ? "POST" : "GET", cache: "no-store", signal: requestSignal,
    headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const payload = await response.json();
  if (!response.ok) {
    const message = payload.error?.message ?? payload.message ?? "Directory operation failed";
    throw new Error(response.status === 409 ? `409: ${message}` : response.status === 503 ? `503: ${message}` : message);
  }
  return payload.data as T;
}
export function AdminCatalogDirectory({ locale, canEdit, canCreate, onProducts, onCreate, onChanged, onGuardChange }: {
  locale: string; canEdit: boolean; canCreate: boolean; onProducts: (node: CatalogNode) => void;
  onCreate: (node: CatalogNode) => void; onChanged: () => void;
  onGuardChange?: (guard: { dirty: boolean; pending: boolean }) => void;
}) {
  const zh = locale.startsWith("zh");
  const [directory, setDirectory] = useState(emptyCatalogDirectory);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<CatalogNodeInput["kind"]>("department");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<CatalogNodeInput | null>(null);
  const [initial, setInitial] = useState("");
  const submission = useRef(false);
  const dirty = draft !== null && JSON.stringify(draft) !== initial;
  useEffect(() => { onGuardChange?.({ dirty, pending: busy }); }, [dirty, busy, onGuardChange]);
  useEffect(() => () => onGuardChange?.({ dirty: false, pending: false }), [onGuardChange]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => { if (dirty || submission.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);
  function discardDraft() {
    if (busy || submission.current) return false;
    if (dirty && !window.confirm(zh ? "放弃未保存的目录修改？" : "Scartare le modifiche non salvate?")) return false;
    setDraft(null); setInitial("");
    return true;
  }
  const reload = useCallback(async (signal?: AbortSignal) => {
    setBusy(true); setError("");
    try { const next = await catalogRequest<CatalogDirectory>("/api/admin/catalog-directory", undefined, signal); if (!signal?.aborted) setDirectory(next); }
    catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : "Error"); }
    finally { if (!signal?.aborted) setBusy(false); }
  }, []);
  useEffect(() => { const c = new AbortController(); queueMicrotask(() => { if (!c.signal.aborted) void reload(c.signal); }); return () => c.abort(); }, [reload]);
  function choose(next: CatalogNodeInput | null) {
    if (busy || (dirty && !window.confirm(zh ? "放弃未保存的目录修改？" : "Scartare le modifiche non salvate?"))) return;
    setDraft(next); setInitial(JSON.stringify(next)); setMessage("");
    if (next && window.innerWidth < 1024) requestAnimationFrame(() => document.getElementById("catalog-node-editor")?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }
  async function save() {
    if (!draft || submission.current) return;
    submission.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const next = await catalogRequest<CatalogDirectory>("/api/admin/catalog-directory", draft);
      setDirectory(next); setDraft(null); setInitial("");
      setMessage(zh ? "目录已保存，前台将在重新进入或刷新时更新。" : "Catalogo salvato. La vetrina si aggiorna al prossimo accesso o aggiornamento.");
      notifyCatalogChanged(); onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { submission.current = false; setBusy(false); }
  }
  const nodes = directory.nodes.filter((n) => n.kind === kind && `${n.nameZh} ${n.nameIt} ${n.value}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="min-w-0 space-y-3 rounded-lg border bg-white p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-lg font-bold"><FolderTree className="size-5" />{zh ? "目录管理" : "Gestione catalogo"}</h2>
      <Button variant="outline" disabled={busy} onClick={() => { if (!dirty || window.confirm(zh ? "保留草稿并刷新目录？" : "Aggiornare il catalogo mantenendo la bozza?")) void reload(); }}><RotateCcw className="size-4" />{zh ? "刷新" : "Aggiorna"}</Button>
    </div>
    <p className="text-sm text-slate-600">{zh ? "选择系列、品牌或分类 → 编辑显示名称与排序 → 保存。内部标识保持稳定；设备型号与兼容性使用专门审核。" : "Scegli reparto, brand o categoria → modifica nome e ordine → salva. I codici interni restano stabili; modelli e compatibilità richiedono la revisione dedicata."}</p>
    {error && <div role="alert" className="break-words rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error.startsWith("503") ? (zh ? "目录管理所需数据库更新尚未就绪，请联系管理员。" : "Aggiornamento database richiesto per la gestione catalogo.") : error.startsWith("409") ? (zh ? "目录已被其他人修改或标识已存在。请刷新后核对，草稿已保留。" : "Catalogo modificato o codice già esistente. Aggiorna e verifica la bozza.") : error}</div>}
    {message && <p role="status" className="rounded bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3">
        <div className="grid grid-cols-3 gap-1" role="group" aria-label={zh ? "目录类型" : "Tipo catalogo"}>
          {(["department","brand","category"] as const).map((value, i) => <Button key={value} variant={kind === value ? "default" : "outline"} className="h-auto min-w-0 whitespace-normal px-2 py-2" disabled={busy} onClick={() => { if (discardDraft()) setKind(value); }}>{(zh ? ["一级系列","品牌","商品分类"] : ["Reparti","Brand","Categorie"])[i]}</Button>)}
        </div>
        <Input aria-label={zh ? "搜索目录" : "Cerca nel catalogo"} placeholder={zh ? "搜索名称或内部标识" : "Cerca nome o codice"} value={search} onChange={(e) => setSearch(e.target.value)} />
        {canEdit && kind !== "department" && <Button variant="outline" disabled={busy} onClick={() => choose({ kind, value: "", nameZh: "", nameIt: "", position: 0, active: true })}><Plus className="size-4" />{zh ? "新增" : "Aggiungi"}</Button>}
        <div className="max-h-[55dvh] space-y-2 overflow-y-auto overscroll-contain">
          {nodes.map((node) => <div key={node.id} className="min-w-0 rounded border p-3">
            <div className="flex min-w-0 items-start justify-between gap-2"><button className="min-w-0 break-words text-left font-semibold underline-offset-4 hover:underline" onClick={() => choose({ id: node.id, kind: node.kind, value: node.value, nameZh: node.nameZh, nameIt: node.nameIt, position: node.position, active: node.active, version: node.version })}>{catalogNodeLabel(node, locale)}</button><span className="shrink-0 text-xs text-slate-500">{node.count} {zh ? "件商品" : "prodotti"}</span></div>
            <p className="break-all text-xs text-slate-500">{node.value} · {node.active ? (zh ? "可用" : "Attivo") : (zh ? "停用" : "Disattivo")}</p>
            <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => { if (discardDraft()) onProducts(node); }}>{zh ? "查看商品" : "Vedi prodotti"}</Button>{canCreate && node.active && <Button size="sm" variant="outline" disabled={busy} onClick={() => { if (discardDraft()) onCreate(node); }}>{zh ? "在此新建商品" : "Crea prodotto"}</Button>}</div>
          </div>)}
          {!busy && nodes.length === 0 && <p className="p-3 text-sm text-slate-500">{zh ? "没有匹配的目录项。" : "Nessuna voce trovata."}</p>}
        </div>
      </div>
      {draft ? <form id="catalog-node-editor" data-catalog-dirty={dirty ? "true" : "false"} className="min-w-0 space-y-3 rounded-lg bg-slate-50 p-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <h3 className="font-bold">{zh ? "编辑目录" : "Modifica voce"}</h3>
        {([["value",zh ? "内部标识（创建后固定）" : "Codice interno (fisso dopo la creazione)"],["nameZh","中文名称"],["nameIt","Nome italiano"]] as const).map(([key,label]) => <div key={key} className="space-y-1"><Label htmlFor={`catalog-node-${key}`}>{label}</Label><Input id={`catalog-node-${key}`} required minLength={key === "value" && draft.kind === "category" && !draft.id ? 2 : 1} maxLength={key === "value" ? 80 : 120} value={draft[key]} disabled={!canEdit || busy || (key === "value" && Boolean(draft.id))} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} /></div>)}
        <div className="space-y-1"><Label htmlFor="catalog-node-position">{zh ? "顺序（数字越小越靠前）" : "Ordine (numeri piccoli prima)"}</Label><Input id="catalog-node-position" type="number" min={0} max={10000} required value={draft.position} disabled={!canEdit || busy} onChange={(e) => setDraft({ ...draft, position: Number(e.target.value) })} /></div>
        {draft.kind !== "department" && !draft.id && <p className="text-sm text-slate-600">{zh ? "新目录保存后默认可用；没有关联商品时可以再停用。" : "Le nuove voci sono attive dopo il salvataggio. Puoi disattivarle se non hanno prodotti associati."}</p>}
        {draft.kind !== "department" && Boolean(draft.id) && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} disabled={!canEdit || busy} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />{zh ? "可用（停用前须移走关联商品）" : "Attivo (sposta i prodotti prima di disattivare)"}</label>}
        <div className="sticky bottom-0 flex flex-wrap gap-2 bg-slate-50 py-2">{canEdit && <Button disabled={busy} type="submit"><Save className="size-4" />{busy ? (zh ? "处理中…" : "Attendi…") : (zh ? "保存目录" : "Salva")}</Button>}<Button type="button" variant="outline" disabled={busy} onClick={() => choose(null)}>{zh ? "关闭" : "Chiudi"}</Button></div>
      </form> : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{zh ? "选择左侧目录项开始编辑。手机上编辑区位于列表下方。" : "Seleziona una voce per modificarla. Su telefono il modulo appare sotto l’elenco."}</p>}
    </div>
  </section>;
}

export function CatalogMoveDialog({ products, locale, onClose, onMoved }: {
  products: { sku: string; updatedAt: string; compatibilityManaged?: boolean }[];
  locale: string; onClose: () => void; onMoved: () => void;
}) {
  const zh = locale.startsWith("zh");
  const [directory, setDirectory] = useState(emptyCatalogDirectory);
  const [department, setDepartment] = useState("");
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  useEffect(() => { const c = new AbortController(); void catalogRequest<CatalogDirectory>("/api/admin/catalog-directory", undefined, c.signal).then(setDirectory).catch((e) => { if (!c.signal.aborted) setError(e.message); }); return () => c.abort(); }, []);
  async function move() {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try { await catalogRequest("/api/admin/catalog-directory/move", { products: products.map(({ sku, updatedAt }) => ({ sku, updatedAt })), target: { ...(department ? { department } : {}), ...(category ? { category } : {}) }, reason }); notifyCatalogChanged(); onMoved(); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}><DialogContent className="flex max-h-[85dvh] min-w-0 flex-col overflow-hidden"><DialogHeader><DialogTitle>{zh ? "移动商品目录" : "Sposta prodotti"}</DialogTitle><DialogDescription>{zh ? `将移动 ${products.length} 件商品；留空的项目保持原值。` : `${products.length} prodotti selezionati. I campi vuoti restano invariati.`}</DialogDescription></DialogHeader>
    <div className="min-h-0 space-y-3 overflow-y-auto">
      {error && <p role="alert" className="break-words text-sm text-red-700">{error.startsWith("409") ? (zh ? "商品已被修改，请关闭窗口并刷新列表后重新选择。" : "Prodotti modificati. Chiudi, aggiorna e seleziona di nuovo.") : error}</p>}
      {(["department","category"] as const).map((kind, i) => {
        const value = [department,category][i]; const setter = [setDepartment,setCategory][i];
        return <div key={kind} className="space-y-1"><Label htmlFor={`move-${kind}`}>{(zh ? ["目标系列","目标分类"] : ["Reparto","Categoria"])[i]}</Label><select id={`move-${kind}`} className="h-11 w-full min-w-0 rounded-md border bg-white px-2 text-sm" disabled={busy} value={value} onChange={(e) => setter(e.target.value)}><option value="">{zh ? "保持原值" : "Non modificare"}</option>{directory.nodes.filter((n) => n.kind === kind && n.active).map((n) => <option key={n.id} value={n.value}>{catalogNodeLabel(n,locale)}</option>)}</select></div>;
      })}
      {true && <p className="text-xs text-amber-700">{zh ? "真实品牌修改和影响折扣的分类修改，请使用商品编辑与审核流程。" : "Per cambiare il brand o categorie che modificano gli sconti, usa la modifica e revisione del prodotto."}</p>}
      <div className="space-y-1"><Label htmlFor="move-reason">{zh ? "操作原因（至少3个字符）" : "Motivo (almeno 3 caratteri)"}</Label><Input id="move-reason" maxLength={500} value={reason} disabled={busy} onChange={(e) => setReason(e.target.value)} /></div>
      <p className="break-words text-sm">{products.map((p) => p.sku).join(", ")}</p>
    </div><DialogFooter className="shrink-0 flex-wrap"><Button variant="outline" disabled={busy} onClick={onClose}>{zh ? "取消" : "Annulla"}</Button><Button disabled={busy || !directory.revision || (!department && !category) || reason.trim().length < 3} onClick={() => void move()}>{busy ? (zh ? "移动中…" : "Spostamento…") : (zh ? "确认移动" : "Conferma spostamento")}</Button></DialogFooter></DialogContent></Dialog>;
}

export function useAdminCatalogOptions() {
  const [directory, setDirectory] = useState(emptyCatalogDirectory);
  useEffect(() => {
    const controller = new AbortController();
    void catalogRequest<CatalogDirectory>("/api/admin/catalog-directory", undefined, controller.signal).then(setDirectory).catch(() => {});
    return () => controller.abort();
  }, []);
  return directory;
}
