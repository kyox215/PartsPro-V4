"use client";

import { englishUiCopy } from "@/i18n/english-ui-copy";


import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageHasNext } from "@/lib/admin-operation-state.mjs";
import { useI18n } from "./i18n-provider";

export function AdminListPager({ page, pageSize, total, returned, pending, onPageChange, onPageSizeChange, hasMore }: {
  page: number; pageSize: number; total: number | null; returned: number; pending?: boolean;
  hasMore?: boolean; onPageChange: (page: number) => void; onPageSizeChange?: (size: number) => void;
}) {
  const { locale } = useI18n();
  const zh = locale.startsWith("zh");
  const start = returned ? page * pageSize + 1 : 0;
  const end = returned ? page * pageSize + returned : 0;
  return <nav aria-label={(locale.startsWith("en") ? englishUiCopy("Paginazione") : zh ? "列表分页" : "Paginazione")} className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-3 text-xs">
    <span role="status">{start}–{end}{total !== null ? ` / ${total}` : ""}</span>
    <div className="flex items-center gap-2">
      {onPageSizeChange && <select aria-label={(locale.startsWith("en") ? englishUiCopy("Righe per pagina") : zh ? "每页条数" : "Righe per pagina")} className="h-9 rounded-md border bg-white px-2" value={pageSize} disabled={pending} onChange={e => onPageSizeChange(Number(e.target.value))}>
        {[20, 50, 80, 100].map(size => <option key={size} value={size}>{size} / {(locale.startsWith("en") ? englishUiCopy("pag.") : zh ? "页" : "pag.")}</option>)}
      </select>}
      <Button size="sm" variant="outline" aria-label={(locale.startsWith("en") ? englishUiCopy("Pagina precedente") : zh ? "上一页" : "Pagina precedente")} disabled={pending || page === 0} onClick={() => onPageChange(page - 1)}><ChevronLeft className="size-4" /></Button>
      <span>{page + 1}</span>
      <Button size="sm" variant="outline" aria-label={(locale.startsWith("en") ? englishUiCopy("Pagina successiva") : zh ? "下一页" : "Pagina successiva")} disabled={pending || !(hasMore ?? pageHasNext({ total, page, pageSize, returned }))} onClick={() => onPageChange(page + 1)}><ChevronRight className="size-4" /></Button>
    </div>
  </nav>;
}
