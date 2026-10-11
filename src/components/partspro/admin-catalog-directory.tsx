"use client";

import { AdminNotice, AdminActionButton } from "./admin-feedback";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, RotateCcw, FolderTree, Save, MoreHorizontal, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { catalogNodeLabel, emptyCatalogDirectory, type CatalogDirectory, type CatalogNode, type CatalogNodeInput } from "@/lib/partspro-catalog-directory";
import { notifyCatalogChanged } from "./catalog-directory-provider";
import { AdminSearchField } from "./admin-ui-controls";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export class CatalogWriteUnknownError extends Error {}
export async function catalogRequest<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(15000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response: Response;
  let payload;
  try {
    response = await fetch(url, { method: body ? "POST" : "GET", cache: "no-store", signal: requestSignal,
      headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const rawPayload = await response.json();
    payload = rawPayload && typeof rawPayload === "object" ? rawPayload : {};
  } catch (error) {
    if (body) throw new CatalogWriteUnknownError("Catalog write result is unknown");
    throw error;
  }
  if (body && response.status >= 500) throw new CatalogWriteUnknownError("Catalog write result is unknown");
  if (!response.ok) {
    const message = payload.error?.message ?? payload.message ?? "Directory operation failed";
    throw new Error(response.status === 409 ? `409: ${message}` : response.status === 503 ? `503: ${message}` : message);
  }
  if (url === "/api/admin/catalog-directory" && (!Array.isArray(payload.data?.nodes) || typeof payload.data?.revision !== "string")) {
    if (body) throw new CatalogWriteUnknownError("Catalog write result is unknown");
    throw new Error("Catalog directory response is incomplete");
  }
  if (body && url === "/api/admin/catalog-directory/move") {
    const expected = (body as { products?: unknown[] }).products?.length;
    if (!expected || payload.data?.moved !== expected || !Array.isArray(payload.data?.directory?.nodes) || typeof payload.data?.directory?.revision !== "string") {
      throw new CatalogWriteUnknownError("Catalog move result is unknown");
    }
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
  const [isSaving, setIsSaving] = useState(false);
  const [kind, setKind] = useState<CatalogNodeInput["kind"]>("department");
  const [search, setSearch] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [draft, setDraft] = useState<CatalogNodeInput | null>(null);
  const [initial, setInitial] = useState("");
  const [orderIds, setOrderIds] = useState<string[] | null>(null);
  const [orderUnknown, setOrderUnknown] = useState(false);
  const [writeUnknown, setWriteUnknown] = useState(false);
  const submission = useRef(false);
  const dirty = (draft !== null && JSON.stringify(draft) !== initial) || orderIds !== null;
  useEffect(() => { onGuardChange?.({ dirty, pending: busy || writeUnknown }); }, [dirty, busy, writeUnknown, onGuardChange]);
  useEffect(() => () => onGuardChange?.({ dirty: false, pending: false }), [onGuardChange]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => { if (dirty || submission.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);
  function discardDraft() {
    if (busy || submission.current || writeUnknown) return false;
    if (dirty && !window.confirm(zh ? "放弃未保存的目录修改？" : "Scartare le modifiche non salvate?")) return false;
    setDraft(null); setInitial(""); setOrderIds(null); setOrderUnknown(false);
    return true;
  }
  const reload = useCallback(async (signal?: AbortSignal) => {
    setBusy(true); setError("");
    try { const next = await catalogRequest<CatalogDirectory>("/api/admin/catalog-directory", undefined, signal); if (!signal?.aborted) setDirectory(next); return !signal?.aborted; }
    catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : "Error"); return false; }
    finally { if (!signal?.aborted) setBusy(false); }
  }, []);
  useEffect(() => { const c = new AbortController(); queueMicrotask(() => { if (!c.signal.aborted) void reload(c.signal); }); return () => c.abort(); }, [reload]);
  function choose(next: CatalogNodeInput | null) {
    if (busy || writeUnknown || (dirty && !window.confirm(zh ? "放弃未保存的目录修改？" : "Scartare le modifiche non salvate?"))) return;
    setDraft(next); setInitial(JSON.stringify(next)); setOrderIds(null); setOrderUnknown(false); setMessage("");
    if (next && window.innerWidth < 1024) requestAnimationFrame(() => document.getElementById("catalog-node-editor")?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }
  async function save() {
    if (!draft || submission.current || writeUnknown) return;
    submission.current = true; setIsSaving(true); setBusy(true); setError(""); setMessage("");
    try {
      const next = await catalogRequest<CatalogDirectory>("/api/admin/catalog-directory", draft);
      setDirectory(next); setDraft(null); setInitial("");
      setMessage(zh ? "目录已保存，前台将在重新进入或刷新时更新。" : "Catalogo salvato. La vetrina si aggiorna al prossimo accesso o aggiornamento.");
      notifyCatalogChanged(); onChanged();
    } catch (e) { if (e instanceof CatalogWriteUnknownError) { setWriteUnknown(true); setError(zh ? "保存结果尚未确认，请查询核对后再操作。" : "Esito del salvataggio non confermato. Verifica prima di continuare."); } else setError(e instanceof Error ? e.message : "Error"); }
    finally { submission.current = false; setIsSaving(false); setBusy(false); }
  }
  async function verifySave() {
    if (!draft || !writeUnknown || submission.current) return;
    submission.current = true; setBusy(true);
    try {
      const next = await catalogRequest<CatalogDirectory>("/api/admin/catalog-directory");
      setDirectory(next);
      const node = next.nodes.find(n => draft.id ? n.id === draft.id : n.kind === draft.kind && n.value === draft.value.trim());
      const confirmed = node && node.nameZh === draft.nameZh.trim() && node.nameIt === draft.nameIt.trim() && node.position === draft.position && node.active === draft.active && node.version > (draft.version ?? 0);
      setWriteUnknown(false);
      if (confirmed) { setDraft(null); setInitial(""); setError(""); setMessage(zh ? "已查询确认目录内容。" : "Contenuto del catalogo verificato."); notifyCatalogChanged(); onChanged(); }
      else setError(zh ? "尚未确认保存；已读取最新目录，草稿保留，请核对后再保存。" : "Salvataggio non confermato. Catalogo aggiornato e bozza conservata: verifica prima di salvare.");
    } catch { setError(zh ? "查询失败，保存结果仍待核对。" : "Verifica non disponibile: esito ancora da controllare."); }
    finally { submission.current = false; setBusy(false); }
  }
  const allKindNodes = directory.nodes.filter(node => node.kind === kind).sort((a,b) => a.position - b.position || a.value.localeCompare(b.value));
  function moveOrder(index: number, direction: number) {
    if (!orderIds || busy) return;
    const target = index + direction; if (target < 0 || target >= orderIds.length) return;
    const next = [...orderIds]; [next[index], next[target]] = [next[target], next[index]]; setOrderIds(next);
  }
  async function saveOrder() {
    if (!orderIds || busy || submission.current || orderUnknown) return;
    if (!window.confirm(zh ? "确认保存以下排序？按条保存，失败会停止并保留剩余调整。" : "Salvare questo ordine? Le voci sono salvate singolarmente; un errore interrompe le restanti modifiche.")) return;
    submission.current = true; setIsSaving(true); setBusy(true); setError(""); let saved = 0;
    try {
      for (let index = 0; index < orderIds.length; index++) {
        const node = directory.nodes.find(item => item.id === orderIds[index]); if (!node) throw new Error("Directory changed");
        if (node.position === index * 10) continue;
        const next = await catalogRequest<CatalogDirectory>("/api/admin/catalog-directory", { id: node.id, kind: node.kind, value: node.value, nameZh: node.nameZh, nameIt: node.nameIt, active: node.active, version: node.version, position: index * 10 });
        setDirectory(next); saved++;
      }
      setOrderIds(null); setMessage(zh ? `排序已保存（${saved}项）。` : `Ordine salvato (${saved} voci).`); notifyCatalogChanged(); onChanged();
    } catch (error) {
      setOrderUnknown(true);
      setError(zh ? `已确认保存${saved}项，后续已停止。请先刷新核对当前顺序，未完成调整仍保留。` : `${saved} voci salvate, operazione interrotta. Aggiorna e verifica prima di continuare; l'ordine proposto è conservato.`);
      console.warn("Catalog reorder", error instanceof Error ? error.message : "failed");
    } finally { submission.current = false; setIsSaving(false); setBusy(false); }
  }
  const nodes = directory.nodes.filter((n) => n.kind === kind && `${n.nameZh} ${n.nameIt} ${n.value}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="admin-ui-panel min-w-0 space-y-2 rounded-lg border bg-white p-3 sm:space-y-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-lg font-bold"><FolderTree className="size-5" />{zh ? "目录管理" : "Gestione catalogo"}</h2>
      <div className="flex items-center gap-1"><Button variant="outline" size="icon" aria-label={zh ? "刷新目录" : "Aggiorna catalogo"} title={zh ? "刷新目录" : "Aggiorna catalogo"} disabled={busy} onClick={() => { if (!dirty || window.confirm(zh ? "保留草稿并刷新目录？" : "Aggiornare il catalogo mantenendo la bozza?")) void reload(); }}><RotateCcw className="size-4" /></Button>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" disabled={busy} aria-label={zh ? "目录操作" : "Azioni catalogo"}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent className="admin-ui-panel" align="end">
        {canEdit && <DropdownMenuItem disabled={Boolean(search.trim()) || allKindNodes.length > 100 || Boolean(orderIds)} onSelect={() => { if (discardDraft()) setOrderIds(allKindNodes.map(node => node.id)); }}>{zh ? "批量调整顺序（上移/下移）" : "Riordina elenco (su/giù)"}</DropdownMenuItem>}
        <DropdownMenuItem onSelect={() => setShowHelp(value => !value)}><Info className="size-4" />{zh ? "操作说明" : "Istruzioni"}</DropdownMenuItem>
      </DropdownMenuContent></DropdownMenu></div>
    </div>
    {showHelp && <p className="text-sm text-slate-600">{zh ? "选择系列、品牌或分类 → 编辑显示名称与排序 → 保存。内部标识保持稳定；设备型号与兼容性使用专门审核。" : "Scegli reparto, brand o categoria → modifica nome e ordine → salva. I codici interni restano stabili; modelli e compatibilità richiedono la revisione dedicata."}</p>}
    {writeUnknown && <AdminNotice tone="warning" message={zh ? "保存结果未知，不能重复提交。" : "Esito sconosciuto: non ripetere l’invio."} action={<Button variant="outline" disabled={busy} onClick={() => void verifySave()}>{zh ? "查询保存结果" : "Verifica salvataggio"}</Button>} />}{error && <AdminNotice tone={orderUnknown || error.startsWith("409") || error.startsWith("503") ? "warning" : "error"} message={error.startsWith("503") ? (zh ? "目录管理所需数据库更新尚未就绪，请联系管理员。" : "Aggiornamento database richiesto per la gestione catalogo.") : error.startsWith("409") ? (zh ? "目录已被其他人修改或标识已存在。请刷新后核对，草稿已保留。" : "Catalogo modificato o codice già esistente. Aggiorna e verifica la bozza.") : error} />}
    {message && <AdminNotice tone="success" message={message} />}
    {canEdit && orderIds && <div data-catalog-dirty={orderIds ? "true" : "false"} data-admin-mutating={isSaving ? "true" : "false"} className="space-y-2 rounded border border-slate-200 p-3">{!orderIds ? <Button variant="outline" disabled={busy || Boolean(search.trim()) || allKindNodes.length > 100} onClick={() => { if (discardDraft()) setOrderIds(allKindNodes.map(node => node.id)); }}>{zh ? "批量调整顺序（上移/下移）" : "Riordina elenco (su/giù)"}</Button> : <><p className="text-xs text-slate-600">{zh ? "先调整完整列表，核对后保存。排序按条执行；失败后先刷新核对已保存部分。" : "Riordina l’elenco completo e controlla prima di salvare. In caso di errore, verifica le voci già salvate."}</p><ol className="max-h-80 space-y-1 overflow-y-auto">{orderIds.map((id,index) => { const node = directory.nodes.find(item => item.id === id); return <li key={id} className="flex items-center gap-2 rounded border bg-slate-50 p-2 text-sm"><span className="min-w-0 flex-1 break-words">{index + 1}. {node ? catalogNodeLabel(node, locale) : id}</span><Button size="sm" variant="outline" disabled={busy || index === 0} aria-label={zh ? "上移" : "Sposta su"} onClick={() => moveOrder(index,-1)}>↑</Button><Button size="sm" variant="outline" disabled={busy || index === orderIds.length - 1} aria-label={zh ? "下移" : "Sposta giù"} onClick={() => moveOrder(index,1)}>↓</Button></li>; })}</ol><div className="flex flex-wrap gap-2"><AdminActionButton pending={isSaving} disabled={busy || orderUnknown} onClick={() => void saveOrder()}>{zh ? "核对并保存排序" : "Conferma ordine"}</AdminActionButton><Button variant="outline" disabled={busy} onClick={() => { setOrderIds(null); setOrderUnknown(false); }}>{zh ? "取消排序" : "Annulla"}</Button>{orderUnknown && <Button variant="outline" disabled={busy} onClick={() => { void reload().then(success => { if (success) setOrderUnknown(false); }); }}>{zh ? "重读并核对" : "Rileggi e verifica"}</Button>}</div></>}</div>}
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3">
        <div className="grid grid-cols-3 gap-1" role="group" aria-label={zh ? "目录类型" : "Tipo catalogo"}>
          {(["department","brand","category"] as const).map((value, i) => <Button key={value} variant={kind === value ? "default" : "outline"} className="h-auto min-w-0 whitespace-normal px-2 py-2" disabled={busy || writeUnknown} onClick={() => { if (discardDraft()) setKind(value); }}>{(zh ? ["一级系列","品牌","商品分类"] : ["Reparti","Brand","Categorie"])[i]}</Button>)}
        </div>
        <div className="flex min-w-0 items-center gap-2"><AdminSearchField containerClassName="min-w-0 flex-1" aria-label={zh ? "搜索目录" : "Cerca nel catalogo"} placeholder={zh ? "搜索名称或内部标识" : "Cerca nome o codice"} value={search} onValueChange={setSearch} />
        {canEdit && kind !== "department" && <Button variant="outline" disabled={busy} onClick={() => choose({ kind, value: "", nameZh: "", nameIt: "", position: 0, active: true })}><Plus className="size-4" />{zh ? "新增" : "Aggiungi"}</Button>}</div>
        <div className="space-y-2 lg:max-h-[55dvh] lg:overflow-y-auto lg:overscroll-contain">
          {nodes.map((node) => <div key={node.id} data-catalog-node={node.id} className="flex min-w-0 items-center gap-2 rounded border p-2">
            <button disabled={busy} className="min-h-11 min-w-0 flex-1 text-left hover:text-primary" onClick={() => choose({ id: node.id, kind: node.kind, value: node.value, nameZh: node.nameZh, nameIt: node.nameIt, position: node.position, active: node.active, version: node.version })}><span className="block break-words text-sm font-semibold">{catalogNodeLabel(node, locale)}</span><span className="block truncate text-xs text-slate-500" title={node.value}>{node.value} · {node.active ? (zh ? "可用" : "Attivo") : (zh ? "停用" : "Disattivo")}</span></button>
            <span className="shrink-0 text-xs text-slate-500">{node.count} {zh ? "件商品" : "prodotti"}</span>
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" disabled={busy} aria-label={`${zh ? "目录项操作" : "Azioni voce"}: ${catalogNodeLabel(node, locale)}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent className="admin-ui-panel" align="end"><DropdownMenuItem onSelect={event => { if (discardDraft()) onProducts(node); else event.preventDefault(); }}>{zh ? "查看商品" : "Vedi prodotti"}</DropdownMenuItem>{canCreate && node.active && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={event => { if (discardDraft()) onCreate(node); else event.preventDefault(); }}>{zh ? "在此新建商品" : "Crea prodotto"}</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu>
          </div>)}
          {!busy && nodes.length === 0 && <p className="p-3 text-sm text-slate-500">{zh ? "没有匹配的目录项。" : "Nessuna voce trovata."}</p>}
        </div>
      </div>
      {draft ? <form id="catalog-node-editor" data-catalog-dirty={dirty ? "true" : "false"} data-admin-mutating={busy || writeUnknown ? "true" : "false"} className="order-first min-w-0 space-y-3 rounded-lg bg-slate-50 p-3 lg:order-last" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <h3 className="font-bold">{zh ? "编辑目录" : "Modifica voce"}</h3>
        {([["value",zh ? "内部标识（创建后固定）" : "Codice interno (fisso dopo la creazione)"],["nameZh","中文名称"],["nameIt","Nome italiano"]] as const).map(([key,label]) => <div key={key} className="space-y-1"><Label htmlFor={`catalog-node-${key}`}>{label}</Label><Input id={`catalog-node-${key}`} required minLength={key === "value" && draft.kind === "category" && !draft.id ? 2 : 1} maxLength={key === "value" ? 80 : 120} value={draft[key]} disabled={!canEdit || busy || writeUnknown || (key === "value" && Boolean(draft.id))} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} /></div>)}
        <div className="space-y-1"><Label htmlFor="catalog-node-position">{zh ? "顺序（数字越小越靠前）" : "Ordine (numeri piccoli prima)"}</Label><Input id="catalog-node-position" type="number" min={0} max={10000} required value={draft.position} disabled={!canEdit || busy || writeUnknown} onChange={(e) => setDraft({ ...draft, position: Number(e.target.value) })} /></div>
        {draft.kind !== "department" && !draft.id && <p className="text-sm text-slate-600">{zh ? "新目录保存后默认可用；没有关联商品时可以再停用。" : "Le nuove voci sono attive dopo il salvataggio. Puoi disattivarle se non hanno prodotti associati."}</p>}
        {draft.kind !== "department" && Boolean(draft.id) && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} disabled={!canEdit || busy || writeUnknown} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />{zh ? "可用（停用前须移走关联商品）" : "Attivo (sposta i prodotti prima di disattivare)"}</label>}
        <div className="sticky bottom-0 flex flex-wrap gap-2 bg-slate-50 py-2">{canEdit && <AdminActionButton pending={busy} disabled={busy || writeUnknown} type="submit">{!(busy) && <Save className="size-4" />}{busy ? (zh ? "处理中…" : "Attendi…") : (zh ? "保存目录" : "Salva")}</AdminActionButton>}<Button type="button" variant="outline" disabled={busy || writeUnknown} onClick={() => choose(null)}>{zh ? "关闭" : "Chiudi"}</Button></div>
      </form> : <p className="hidden rounded-lg bg-slate-50 p-4 text-sm text-slate-600 lg:block">{zh ? "选择左侧目录项开始编辑。" : "Seleziona una voce per modificarla."}</p>}
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
  const [moveUnknown, setMoveUnknown] = useState(false);
  const dirty = Boolean(department || category || reason.trim());
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => { if (dirty || busy || moveUnknown) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty, busy, moveUnknown]);
  useEffect(() => { const c = new AbortController(); void catalogRequest<CatalogDirectory>("/api/admin/catalog-directory", undefined, c.signal).then(setDirectory).catch((e) => { if (!c.signal.aborted) setError(e.message); }); return () => c.abort(); }, []);
  async function move() {
    if (lock.current || moveUnknown) return; lock.current = true; setBusy(true); setError("");
    try { await catalogRequest("/api/admin/catalog-directory/move", { products: products.map(({ sku, updatedAt }) => ({ sku, updatedAt })), target: { ...(department ? { department } : {}), ...(category ? { category } : {}) }, reason }); notifyCatalogChanged(); onMoved(); onClose(); }
    catch (e) { if (e instanceof CatalogWriteUnknownError) { setMoveUnknown(true); setError(zh ? "移动结果待核对，不能重复提交；关闭窗口后将刷新商品列表。" : "Esito da verificare: non ripetere l’invio. Chiudendo verrà aggiornato l’elenco."); } else setError(e instanceof Error ? e.message : "Error"); }
    finally { lock.current = false; setBusy(false); }
  }
  function close() { if (busy) return; if (!moveUnknown && dirty && !window.confirm(zh ? "放弃未保存的目录移动设置？" : "Scartare le impostazioni di spostamento non salvate?")) return; if (moveUnknown) onMoved(); onClose(); }
  return <Dialog open onOpenChange={(open) => { if (!open) close(); }}><DialogContent data-admin-mutating={busy || moveUnknown ? "true" : "false"} data-admin-dirty={dirty ? "true" : "false"} className="admin-ui-panel flex max-h-[85dvh] min-w-0 flex-col overflow-hidden"><DialogHeader><DialogTitle>{zh ? "移动商品目录" : "Sposta prodotti"}</DialogTitle><DialogDescription>{zh ? `将移动 ${products.length} 件商品；留空的项目保持原值。` : `${products.length} prodotti selezionati. I campi vuoti restano invariati.`}</DialogDescription></DialogHeader>
    <div className="min-h-0 space-y-3 overflow-y-auto">
      {error && <AdminNotice tone={error.startsWith("409") ? "warning" : "error"} message={error.startsWith("409") ? (zh ? "商品已被修改，请关闭窗口并刷新列表后重新选择。" : "Prodotti modificati. Chiudi, aggiorna e seleziona di nuovo.") : error} />}
      {(["department","category"] as const).map((kind, i) => {
        const value = [department,category][i]; const setter = [setDepartment,setCategory][i];
        return <div key={kind} className="space-y-1"><Label htmlFor={`move-${kind}`}>{(zh ? ["目标系列","目标分类"] : ["Reparto","Categoria"])[i]}</Label><select id={`move-${kind}`} className="h-11 w-full min-w-0 rounded-md border bg-white px-2 text-sm" disabled={busy || moveUnknown} value={value} onChange={(e) => setter(e.target.value)}><option value="">{zh ? "保持原值" : "Non modificare"}</option>{directory.nodes.filter((n) => n.kind === kind && n.active).map((n) => <option key={n.id} value={n.value}>{catalogNodeLabel(n,locale)}</option>)}</select></div>;
      })}
      {true && <p className="text-xs text-amber-700">{zh ? "真实品牌修改和影响折扣的分类修改，请使用商品编辑与审核流程。" : "Per cambiare il brand o categorie che modificano gli sconti, usa la modifica e revisione del prodotto."}</p>}
      <div className="space-y-1"><Label htmlFor="move-reason">{zh ? "操作原因（至少3个字符）" : "Motivo (almeno 3 caratteri)"}</Label><Input id="move-reason" maxLength={500} value={reason} disabled={busy || moveUnknown} onChange={(e) => setReason(e.target.value)} /></div>
      <p className="break-words text-sm">{products.map((p) => p.sku).join(", ")}</p>
    </div><DialogFooter className="shrink-0 flex-wrap"><Button variant="outline" disabled={busy} onClick={close}>{zh ? "取消" : "Annulla"}</Button><AdminActionButton pending={busy} disabled={busy || moveUnknown || !directory.revision || (!department && !category) || reason.trim().length < 3} onClick={() => void move()}>{busy ? (zh ? "移动中…" : "Spostamento…") : (zh ? "确认移动" : "Conferma spostamento")}</AdminActionButton></DialogFooter></DialogContent></Dialog>;
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
