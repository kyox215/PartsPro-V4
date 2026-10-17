"use client";

import { englishUiCopy } from "@/i18n/english-ui-copy";


import * as React from "react";
import { Expand, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useI18n } from "./i18n-provider";

type SummaryTone = "slate" | "blue" | "amber" | "red" | "green" | "violet";
export type AdminMetricSummaryItem = {
  key: string;
  label: string;
  value: React.ReactNode;
  tone?: SummaryTone;
};

const summaryTones: Record<SummaryTone, string> = {
  slate: "text-slate-950", blue: "text-blue-700", amber: "text-amber-800",
  red: "text-rose-700", green: "text-emerald-700", violet: "text-violet-700",
};

/** Labels and values remain visible together; no carousel or hidden zero values. */
export function AdminMetricSummary({ items, className, ariaLabel }: {
  items: readonly AdminMetricSummaryItem[];
  className?: string;
  ariaLabel?: string;
}) {
  return <dl aria-label={ariaLabel} data-admin-metrics className={cn("grid min-w-0 grid-cols-2 gap-x-3 rounded-lg border border-slate-200 bg-white px-2", className)}>
    {items.map(item => <div key={item.key} className="flex min-h-[30px] min-w-0 items-center justify-between gap-2 border-b border-slate-100 py-1 last:border-b-0 [&:nth-last-child(2)]:border-b-0">
      <dt className="min-w-0 break-words text-xs font-medium leading-4 text-slate-600 [overflow-wrap:anywhere]">{item.label}</dt>
      <dd className={cn("min-w-0 max-w-[65%] shrink-0 break-words text-right text-sm font-bold leading-5 tabular-nums [overflow-wrap:anywhere]", summaryTones[item.tone ?? "slate"])}>{item.value}</dd>
    </div>)}
  </dl>;
}

/** Full text is local, read-only, and never replaces a surrounding row action. */
export function AdminExpandableText({ text, className, lines = 2 }: {
  text: string;
  className?: string;
  lines?: 1 | 2;
}) {
  const { locale } = useI18n();
  const zh = locale.startsWith("zh");
  const [truncated, setTruncated] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const content = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const node = content.current;
    if (!node) return;
    const measure = () => setTruncated(node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1);
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [text, lines, truncated]);
  const label = (locale.startsWith("en") ? englishUiCopy("Mostra nome completo") : zh ? "显示完整名称" : "Mostra nome completo");
  const textNode = <span ref={content} className={cn("block min-w-0 whitespace-normal break-words [overflow-wrap:anywhere]", lines === 1 ? "line-clamp-1" : "line-clamp-2")}>{text}</span>;
  return <span data-admin-expandable={truncated ? "truncated" : "complete"} className={cn("block min-w-0", className)}>
    {truncated ? <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><button type="button" aria-label={`${label}: ${text.slice(0, 80)}`} className="relative flex min-h-11 w-full min-w-0 items-center rounded-md pr-5 text-left hover:bg-slate-100/70 focus-visible:outline-2 focus-visible:outline-ring">
        <span className="min-w-0 flex-1">{textNode}</span><Expand aria-hidden="true" className="absolute right-0 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
      </button></PopoverTrigger>
      <PopoverContent align="start" aria-label={label} onEscapeKeyDown={event => event.stopPropagation()} className="admin-ui-panel w-[min(420px,calc(100vw-24px))] max-w-[calc(100vw-24px)] p-3">
        <div className="flex items-center justify-between gap-2"><strong className="text-xs text-slate-500">{(locale.startsWith("en") ? englishUiCopy("Nome completo") : zh ? "完整名称" : "Nome completo")}</strong><button type="button" aria-label={(locale.startsWith("en") ? englishUiCopy("Chiudi nome completo") : zh ? "关闭完整名称" : "Chiudi nome completo")} className="flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-slate-100" onClick={() => setOpen(false)}><X aria-hidden="true" className="size-4" /></button></div>
        <p className="max-h-[50dvh] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6 text-slate-950 [overflow-wrap:anywhere]">{text}</p>
      </PopoverContent>
    </Popover> : textNode}
  </span>;
}
