"use client";

import { AdminNotice, AdminActionButton } from "./admin-feedback";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, RotateCcw, Save, MoreHorizontal, HelpCircle, ArrowUp, ArrowDown } from "lucide-react";
import { useAdminMobile } from "./admin-mobile-layout";
import { usePersistentAdminQuery } from "./admin-workspace-state";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { catalogNodeLabel, emptyCatalogDirectory, type CatalogDirectory, type CatalogNode, type CatalogNodeInput } from "@/lib/partspro-catalog-directory";
import { notifyCatalogChanged } from "./catalog-directory-provider";

class CatalogWriteUnknownError extends Error {}
export async function catalogRequest<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(15000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response: Response;
  let payload;
  try {
    response = await fetch(url, { method: body ? "POST" : "GET", cache: "no-store", signal: requestSignal,
      headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    payload = await response.json();
  } catch (error) {
    if (body) throw new CatalogWriteUnknownError("Write result unknown; verify before retrying.");
    throw error;
  }
  if (!response.ok) {
    const message = payload.error?.message ?? payload.message ?? "Directory operation failed";
    if (body && response.status >= 500) throw new CatalogWriteUnknownError(message);
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
  const [isSaving, setIsSaving] = useState(false);
  const mobile = useAdminMobile();
  const [query, setQuery] = usePersistentAdminQuery("directory.query", { kind: "department", search: "" });
  const kind = (["department", "brand", "category"].includes(query.kind) ? query.kind : "department") as CatalogNodeInput["kind"];
  const search = query.search;
  const setKind = (kind: CatalogNodeInput["kind"]) => setQuery(current => ({ ...current, kind }));
  const setSearch = (search: string) => setQuery(current => ({ ...current, search }));
  const [helpOpen, setHelpOpen] = useState(false);
  const [draft, setDraft] = useState<CatalogNodeInput | null>(null);
  const [initial, setInitial] = useState("");
  const [orderIds, setOrderIds] = useState<string[] | null>(null);
  const [orderUnknown, setOrderUnknown] = useState(false);
  const [saveUnknown, setSaveUnknown] = useState(false);
  const submission = useRef(false);
  const dirty = (draft !== null && JSON.stringify(draft) !== initial) || orderIds !== null || saveUnknown;
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
    setDraft(null); setInitial(""); setOrderIds(null); setOrderUnknown(false); setSaveUnknown(false);
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
    if (busy || (dirty && !window.confirm(zh ? "放弃未保存的目录修改？" : "Scartare le modifiche non salvate?"))) return;
    setDraft(next); setInitial(JSON.stringify(next)); setOrderIds(null); setOrderUnknown(false); setSaveUnknown(false); setMessage(""); setError("");

  }
  async function save() {
    if (!draft || submission.current || saveUnknown) return;
    submission.current = true; setIsSaving(true); setBusy(true); setError(""); setMessage("");
    try {
      const next = await catalogRequest<CatalogDirectory>("/api/admin/catalog-directory", draft);
      setDirectory(next); setDraft(null); setInitial("");
      setMessage(zh ? "目录已保存，前台将在重新进入或刷新时更新。" : "Catalogo salvato. La vetrina si aggiorna al prossimo accesso o aggiornamento.");
      notifyCatalogChanged(); onChanged();
    } catch (e) {
      if (e instanceof CatalogWriteUnknownError) {
        setSaveUnknown(true);
        setError(zh ? "保存结果尚未确认。草稿保留，请先查询结果，勿重复提交。" : "Esito non confermato. Bozza conservata: verifica prima di inviare di nuovo.");
      } else setError(e instanceof Error ? e.message : "Error");
    }
    finally { submission.current = false; setIsSaving(false); setBusy(false); }
  }
  async function verifySave() {
    if (!draft || busy || submission.current) return;
    setBusy(true);
    try {
      const next = await catalogRequest<CatalogDirectory>("/api/admin/catalog-directory");
      setDirectory(next);
      const node = next.nodes.find(node => draft.id ? node.id === draft.id : node.kind === draft.kind && node.value === draft.value.trim());
      const matches = node && (!draft.id || node.version > (draft.version ?? 0)) && (["nameZh", "nameIt", "position", "active"] as const).every(key => node[key] === (typeof draft[key] === "string" ? draft[key].trim() : draft[key]));
      if (matches) {
        setDraft(null); setSaveUnknown(false); setInitial(""); setError("");
        setMessage(zh ? "已查询确认保存成功。" : "Salvataggio verificato."); notifyCatalogChanged(); onChanged();
      } else setError(zh ? "当前目录尚未确认这次修改。草稿仍保留，请稍后再次查询，或取消后人工核对。" : "La modifica non è ancora confermata. Ricontrolla più tardi o annulla e verifica manualmente.");
    } catch { setError(zh ? "暂时无法核对保存结果，请稍后再次查询。" : "Verifica non disponibile. Riprova più tardi."); }
    finally { setBusy(false); }
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
  const nodes = allKindNodes.filter(n => `${n.nameZh} ${n.nameIt} ${n.value}`.toLowerCase().includes(search.toLowerCase()));
  const displayNodes = orderIds ? orderIds.map(id => directory.nodes.find(node => node.id === id)).filter((node): node is CatalogNode => Boolean(node)) : nodes;
  const editorError = error.startsWith("409") ? (zh ? "目录已更新或标识重复，请核对后再保存；草稿已保留。" : "Voce aggiornata o codice duplicato. Verifica prima di salvare; bozza conservata.") : error;
  const editor = draft ? <form id="catalog-node-editor" data-catalog-dirty={dirty ? "true" : "false"} className="flex min-h-0 min-w-0 flex-1 flex-col" onSubmit={e => { e.preventDefault(); void save(); }}>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      {!mobile && <h3 className="font-bold">{zh ? "编辑目录" : "Modifica voce"}</h3>}
      {error && <AdminNotice tone="error" message={editorError} />}
      {([["value",zh ? "内部标识（创建后固定）" : "Codice interno (fisso)"],["nameZh","中文名称"],["nameIt","Nome italiano"]] as const).map(([key,label]) => <div key={key} className="space-y-1"><Label htmlFor={`catalog-node-${key}`}>{label}</Label><Input id={`catalog-node-${key}`} required minLength={key === "value" && draft.kind === "category" && !draft.id ? 2 : 1} maxLength={key === "value" ? 80 : 120} value={draft[key]} disabled={!canEdit || busy || saveUnknown || (key === "value" && Boolean(draft.id))} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></div>)}
      <div className="space-y-1"><Label htmlFor="catalog-node-position">{zh ? "顺序（数字越小越靠前）" : "Ordine (numeri piccoli prima)"}</Label><Input id="catalog-node-position" type="number" min={0} max={10000} required value={draft.position} disabled={!canEdit || busy || saveUnknown} onChange={e => setDraft({ ...draft, position: Number(e.target.value) })} /></div>
      {draft.kind !== "department" && !draft.id && <p className="text-xs text-slate-600">{zh ? "保存后默认可用；没有关联商品时可停用。" : "Attiva dopo il salvataggio. Disattivabile senza prodotti associati."}</p>}
      {draft.kind !== "department" && Boolean(draft.id) && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} disabled={!canEdit || busy || saveUnknown} onChange={e => setDraft({ ...draft, active: e.target.checked })} />{zh ? "可用（停用前须移走关联商品）" : "Attivo (sposta i prodotti prima)"}</label>}
    </div>
    <div className="admin-mobile-save-bar flex shrink-0 justify-end gap-2 border-t bg-white p-3">
      <Button type="button" variant="outline" disabled={busy} onClick={() => choose(null)}>{zh ? "取消" : "Annulla"}</Button>
      {saveUnknown ? <AdminActionButton pending={busy} disabled={busy} type="button" onClick={() => void verifySave()}>{zh ? "查询保存结果" : "Verifica salvataggio"}</AdminActionButton> : canEdit && <AdminActionButton pending={busy} disabled={busy} type="submit"><Save className="size-4" />{zh ? "保存目录" : "Salva"}</AdminActionButton>}
    </div>
  </form> : null;
  return <section className="admin-catalog-directory min-w-0 bg-white lg:rounded-lg lg:border lg:p-3">
    <div className="hidden items-center justify-between lg:flex"><h2 className="text-lg font-bold">{zh ? "目录管理" : "Gestione catalogo"}</h2><span className="text-xs text-slate-500">{nodes.length} {zh ? "项" : "voci"}</span></div>
    {error && !draft && <AdminNotice tone={orderUnknown || error.startsWith("409") || error.startsWith("503") ? "warning" : "error"} message={error.startsWith("503") ? (zh ? "目录服务暂不可用，请稍后核对。" : "Catalogo non disponibile. Verifica più tardi.") : error.startsWith("409") ? (zh ? "目录已被修改。请刷新核对，草稿已保留。" : "Catalogo modificato. Aggiorna e verifica la bozza.") : error} />}
    {message && <AdminNotice tone="success" message={message} onDismiss={() => setMessage("")} dismissLabel={zh ? "关闭" : "Chiudi"} />}
    <div className="flex h-11 items-center border-b" role="group" aria-label={zh ? "目录类型" : "Tipo catalogo"}>
      {(["department","brand","category"] as const).map((value,i) => <Button key={value} variant="ghost" className={`h-11 min-w-0 flex-1 rounded-none px-2 transition-none ${kind === value ? "bg-primary/5 text-primary shadow-[inset_0_-2px_0_var(--primary)]" : ""}`} aria-pressed={kind === value} disabled={busy} onClick={() => { if (discardDraft()) setKind(value); }}>{(zh ? ["系列","品牌","分类"] : ["Reparti","Brand","Categorie"])[i]}</Button>)}
    </div>
    <div className="flex min-h-11 min-w-0 items-center gap-1 border-b px-2">
      <Input className="h-11 min-w-0 flex-1 border-0 shadow-none" aria-label={zh ? "搜索目录" : "Cerca nel catalogo"} placeholder={zh ? "搜索目录名称 / 标识" : "Cerca nome / codice"} value={search} disabled={Boolean(orderIds)} onChange={e => setSearch(e.target.value)} />
      {canEdit && kind !== "department" && !orderIds && <Button variant="ghost" size="icon" aria-label={zh ? "新增目录" : "Aggiungi voce"} disabled={busy} onClick={() => choose({ kind, value: "", nameZh: "", nameIt: "", position: 0, active: true })}><Plus className="size-4" /></Button>}
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={zh ? "目录操作" : "Azioni catalogo"}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
        <DropdownMenuItem disabled={busy} onClick={() => { if (!dirty || window.confirm(zh ? "保留草稿并刷新目录？" : "Aggiornare mantenendo la bozza?")) void reload(); }}><RotateCcw className="size-4" />{zh ? "刷新" : "Aggiorna"}</DropdownMenuItem>
        {canEdit && <DropdownMenuItem disabled={busy || Boolean(search.trim()) || allKindNodes.length > 100 || Boolean(orderIds)} onClick={() => { if (discardDraft()) setOrderIds(allKindNodes.map(node => node.id)); }}>{search.trim() ? (zh ? "清空搜索后可排序" : "Azzera la ricerca per riordinare") : allKindNodes.length > 100 ? (zh ? "超过100项，请逐项编辑顺序" : "Oltre 100 voci: modifica l’ordine singolarmente") : (zh ? "调整顺序" : "Riordina elenco")}</DropdownMenuItem>}
        <DropdownMenuItem onClick={() => setHelpOpen(true)}><HelpCircle className="size-4" />{zh ? "使用说明" : "Guida"}</DropdownMenuItem>
      </DropdownMenuContent></DropdownMenu>
    </div>
    <div className="grid min-w-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-3">
      <div className="min-w-0" data-catalog-dirty={orderIds ? "true" : "false"} data-admin-mutating={isSaving ? "true" : "false"} aria-busy={busy}>
        {busy && !displayNodes.length && <div className="space-y-2 p-2" aria-label={zh ? "加载目录" : "Caricamento catalogo"}>{[0,1,2,3,4,5].map(i => <div key={i} className="h-16 animate-pulse rounded bg-slate-100" />)}</div>}
        {displayNodes.map((node,index) => <div key={node.id} data-catalog-node={node.id} className="flex min-h-16 min-w-0 items-center gap-1 border-b border-slate-100 px-2 py-1">
          {orderIds && <span className="w-5 shrink-0 text-xs text-slate-500">{index + 1}</span>}
          <button type="button" className="min-h-11 min-w-0 flex-1 text-left" disabled={busy || Boolean(orderIds)} onClick={() => choose({ id: node.id, kind: node.kind, value: node.value, nameZh: node.nameZh, nameIt: node.nameIt, position: node.position, active: node.active, version: node.version })}>
            <span className="block truncate text-sm font-semibold">{catalogNodeLabel(node, locale)}</span>
            <span className="block truncate text-xs text-slate-500">{node.value} · {node.active ? (zh ? "可用" : "Attivo") : (zh ? "停用" : "Disattivo")}</span>
          </button>
          {orderIds ? <><Button size="icon" variant="ghost" disabled={busy || index === 0} aria-label={zh ? `上移 ${catalogNodeLabel(node,locale)}` : `Sposta su ${catalogNodeLabel(node,locale)}`} onClick={() => moveOrder(index,-1)}><ArrowUp className="size-4" /></Button><Button size="icon" variant="ghost" disabled={busy || index === orderIds.length - 1} aria-label={zh ? `下移 ${catalogNodeLabel(node,locale)}` : `Sposta giù ${catalogNodeLabel(node,locale)}`} onClick={() => moveOrder(index,1)}><ArrowDown className="size-4" /></Button></> : <>
            <button type="button" disabled={busy} className="min-h-11 shrink-0 px-1 text-right text-xs text-slate-600" aria-label={`${zh ? "查看商品" : "Vedi prodotti"}: ${catalogNodeLabel(node,locale)}`} onClick={() => { if (discardDraft()) onProducts(node); }}><strong className="block text-sm tabular-nums">{node.count}</strong>{zh ? "商品" : "prodotti"}</button>
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={busy} aria-label={`${zh ? "目录操作" : "Azioni"}: ${catalogNodeLabel(node,locale)}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => choose({ id: node.id, kind: node.kind, value: node.value, nameZh: node.nameZh, nameIt: node.nameIt, position: node.position, active: node.active, version: node.version })}>{zh ? "编辑目录" : "Modifica voce"}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { if (discardDraft()) onProducts(node); }}>{zh ? "查看商品" : "Vedi prodotti"}</DropdownMenuItem>
              {canCreate && node.active && <DropdownMenuItem onClick={() => { if (discardDraft()) onCreate(node); }}>{zh ? "在此新建商品" : "Crea prodotto qui"}</DropdownMenuItem>}
            </DropdownMenuContent></DropdownMenu>
          </>}
        </div>)}
        {!busy && !displayNodes.length && <p className="p-3 text-sm text-slate-500">{zh ? "没有匹配的目录项。" : "Nessuna voce trovata."}</p>}
        {orderIds && <div className="admin-mobile-save-bar sticky bottom-0 z-20 flex flex-wrap items-center gap-2 border-t bg-white p-2">
          <span className="text-xs text-slate-600">{orderIds.length} {zh ? "项 · 按条保存" : "voci · salvataggio singolo"}</span>
          <Button variant="outline" disabled={busy} onClick={() => { setOrderIds(null); setOrderUnknown(false); }}>{zh ? "取消" : "Annulla"}</Button>
          <AdminActionButton pending={isSaving} disabled={busy || orderUnknown} onClick={() => void saveOrder()}>{zh ? "核对并保存排序" : "Conferma ordine"}</AdminActionButton>
          {orderUnknown && <Button variant="outline" disabled={busy} onClick={() => { void reload().then(success => { if (success) setOrderUnknown(false); }); }}>{zh ? "重读并核对" : "Rileggi e verifica"}</Button>}
        </div>}
      </div>
      {!mobile && editor && <div className="flex min-h-0 flex-col rounded-lg border bg-white">{editor}</div>}
    </div>
    {mobile && <Sheet open={Boolean(draft)} onOpenChange={open => { if (!open) choose(null); }}><SheetContent side="right" className="admin-mobile-editor w-screen max-w-none gap-0 p-0"><SheetHeader className="border-b p-3 pr-12"><SheetTitle>{zh ? "编辑目录" : "Modifica voce"}</SheetTitle><SheetDescription>{draft?.value || (zh ? "新增目录" : "Nuova voce")}</SheetDescription></SheetHeader>{editor}</SheetContent></Sheet>}
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}><DialogContent><DialogHeader><DialogTitle>{zh ? "目录管理说明" : "Guida catalogo"}</DialogTitle><DialogDescription>{zh ? "选择系列、品牌或分类，再点目录项编辑名称和顺序。内部标识创建后固定；型号与兼容性仍需专门审核。调整顺序须先清空搜索，按条保存，失败后先刷新核对已保存部分。" : "Scegli reparto, brand o categoria e tocca una voce per modificarla. Il codice interno resta fisso; modelli e compatibilità richiedono revisione. Azzera la ricerca prima di riordinare. In caso di errore, verifica le voci già salvate."}</DialogDescription></DialogHeader></DialogContent></Dialog>
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
  const [unknown, setUnknown] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  useEffect(() => { const c = new AbortController(); void catalogRequest<CatalogDirectory>("/api/admin/catalog-directory", undefined, c.signal).then(setDirectory).catch((e) => { if (!c.signal.aborted) setError(e.message); }); return () => c.abort(); }, []);
  async function move() {
    if (lock.current || unknown) return; lock.current = true; setBusy(true); setError("");
    try { await catalogRequest("/api/admin/catalog-directory/move", { products: products.map(({ sku, updatedAt }) => ({ sku, updatedAt })), target: { ...(department ? { department } : {}), ...(category ? { category } : {}) }, reason }); notifyCatalogChanged(); onMoved(); onClose(); }
    catch (e) { if (e instanceof CatalogWriteUnknownError) { setUnknown(true); setError(zh ? "移动结果尚未确认，请关闭并刷新列表核对，勿重复提交。" : "Esito non confermato. Chiudi e aggiorna l’elenco prima di riprovare."); } else setError(e instanceof Error ? e.message : "Error"); }
    finally { lock.current = false; setBusy(false); }
  }
  function closeMove() { if (busy) return; if (unknown) onMoved(); onClose(); }
  return <Dialog open onOpenChange={open => { if (!open) closeMove(); }}><DialogContent className="flex max-h-[85dvh] min-w-0 flex-col overflow-hidden"><DialogHeader><DialogTitle>{zh ? "移动商品目录" : "Sposta prodotti"}</DialogTitle><DialogDescription>{zh ? `将移动 ${products.length} 件商品；留空的项目保持原值。` : `${products.length} prodotti selezionati. I campi vuoti restano invariati.`}</DialogDescription></DialogHeader>
    <div className="min-h-0 space-y-3 overflow-y-auto">
      {error && <AdminNotice tone={error.startsWith("409") ? "warning" : "error"} message={error.startsWith("409") ? (zh ? "商品已被修改，请关闭窗口并刷新列表后重新选择。" : "Prodotti modificati. Chiudi, aggiorna e seleziona di nuovo.") : error} />}
      {(["department","category"] as const).map((kind, i) => {
        const value = [department,category][i]; const setter = [setDepartment,setCategory][i];
        return <div key={kind} className="space-y-1"><Label htmlFor={`move-${kind}`}>{(zh ? ["目标系列","目标分类"] : ["Reparto","Categoria"])[i]}</Label><select id={`move-${kind}`} className="h-11 w-full min-w-0 rounded-md border bg-white px-2 text-sm" disabled={busy || unknown} value={value} onChange={(e) => setter(e.target.value)}><option value="">{zh ? "保持原值" : "Non modificare"}</option>{directory.nodes.filter((n) => n.kind === kind && n.active).map((n) => <option key={n.id} value={n.value}>{catalogNodeLabel(n,locale)}</option>)}</select></div>;
      })}
      {true && <p className="text-xs text-amber-700">{zh ? "真实品牌修改和影响折扣的分类修改，请使用商品编辑与审核流程。" : "Per cambiare il brand o categorie che modificano gli sconti, usa la modifica e revisione del prodotto."}</p>}
      <div className="space-y-1"><Label htmlFor="move-reason">{zh ? "操作原因（至少3个字符）" : "Motivo (almeno 3 caratteri)"}</Label><Input id="move-reason" maxLength={500} value={reason} disabled={busy || unknown} onChange={(e) => setReason(e.target.value)} /></div>
      <p className="break-words text-sm">{products.map((p) => p.sku).join(", ")}</p>
    </div><DialogFooter className="shrink-0 flex-wrap"><Button variant="outline" disabled={busy} onClick={closeMove}>{zh ? "取消" : "Annulla"}</Button><AdminActionButton pending={busy} disabled={busy || unknown || !directory.revision || (!department && !category) || reason.trim().length < 3} onClick={() => void move()}>{busy ? (zh ? "移动中…" : "Spostamento…") : (zh ? "确认移动" : "Conferma spostamento")}</AdminActionButton></DialogFooter></DialogContent></Dialog>;
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
