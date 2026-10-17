"use client";

import { englishUiCopy } from "@/i18n/english-ui-copy";


import * as React from "react";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useI18n } from "./i18n-provider";

type SearchFieldProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
  clearLabel?: string;
  pending?: boolean;
  containerClassName?: string;
};

export function AdminSearchField({
  value, onValueChange, clearLabel, pending, containerClassName, className,
  disabled, readOnly, ...props
}: SearchFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { locale } = useI18n();
  const clearText = clearLabel ?? ((locale.startsWith("en") ? englishUiCopy("Azzera ricerca") : locale.startsWith("zh") ? "清除搜索" : "Azzera ricerca"));
  return <div className={cn("admin-ui-search relative min-w-0", containerClassName)}>
    {pending
      ? <Loader2 aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-slate-500" />
      : <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />}
    <Input {...props} ref={inputRef} value={value} disabled={disabled} readOnly={readOnly}
      className={cn("admin-ui-control bg-white pl-9", value && !readOnly ? "pr-11" : "pr-3", className)}
      onChange={(event) => onValueChange(event.target.value)} />
    {value && !readOnly && <button type="button" aria-label={clearText} title={clearText}
      disabled={disabled} className="absolute right-0 top-0 flex h-full min-h-10 w-11 items-center justify-center rounded-r-lg text-slate-500 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
      onClick={() => { onValueChange(""); inputRef.current?.focus(); }}><X aria-hidden="true" className="size-4" /></button>}
  </div>;
}

export type AdminSelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type SearchableSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly AdminSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
  id?: string;
};

function searchableText(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase();
}

/** A local option filter. It never changes the selected value while typing. */
export function AdminSearchableSelect({
  value, onValueChange, options, placeholder, searchPlaceholder, emptyLabel,
  ariaLabel, disabled, className, id,
}: SearchableSelectProps) {
  const { locale } = useI18n();
  const zh = locale.startsWith("zh");
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeValue, setActiveValue] = React.useState("");
  const listId = React.useId();
  const queryInput = React.useRef<HTMLInputElement>(null);
  const needle = searchableText(query.trim());
  const filtered = options.filter((option) => !needle || searchableText([option.label, option.value, option.description].filter(Boolean).join(" ")).includes(needle));
  const enabled = filtered.filter((option) => !option.disabled);
  const active = enabled.find((option) => option.value === activeValue) ?? enabled[0];
  const selected = options.find((option) => option.value === value);
  const activeIndex = filtered.findIndex((option) => option.value === active?.value);

  function changeOpen(next: boolean) {
    setOpen(next);
    setQuery("");
    setActiveValue(value);
  }
  function choose(option: AdminSelectOption) {
    if (disabled || option.disabled) return;
    onValueChange(option.value);
    changeOpen(false);
  }
  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const current = enabled.findIndex((option) => option.value === active?.value);
      const next = event.key === "Home" ? 0 : event.key === "End" ? enabled.length - 1 : Math.min(enabled.length - 1, Math.max(0, current + (event.key === "ArrowDown" ? 1 : -1)));
      setActiveValue(enabled[next]?.value ?? "");
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (active) choose(active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      changeOpen(false);
    }
  }
  React.useEffect(() => {
    if (open && activeIndex >= 0) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, listId]);

  return <Popover open={open && !disabled} onOpenChange={changeOpen}>
    <PopoverTrigger asChild><Button id={id} type="button" variant="outline" role="combobox"
      aria-label={ariaLabel} aria-expanded={open && !disabled} aria-controls={listId} aria-haspopup="listbox" disabled={disabled}
      title={selected?.label} onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); changeOpen(true); } }}
      className={cn("admin-ui-control h-10 w-full min-w-0 justify-between gap-2 bg-white px-3 font-normal", className)}>
      <span className={cn("min-w-0 truncate", !selected && !value && "text-muted-foreground")}>{selected?.label ?? (value || placeholder || ((locale.startsWith("en") ? englishUiCopy("Seleziona") : zh ? "请选择" : "Seleziona")))}</span>
      <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
    </Button></PopoverTrigger>
    <PopoverContent align="start" sideOffset={4}
      className="admin-ui-select-popup w-[var(--radix-popover-trigger-width)] min-w-48 max-w-[calc(100vw-24px)] gap-0 overflow-hidden p-1"
      onOpenAutoFocus={(event) => { event.preventDefault(); queryInput.current?.focus(); }}>
      <div className="relative mb-1 min-w-0">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input ref={queryInput} value={query} onChange={(event) => { setQuery(event.target.value); setActiveValue(""); }} onKeyDown={onKeyDown}
          className="admin-ui-control h-10 bg-white pl-9 text-base sm:text-sm"
          placeholder={searchPlaceholder ?? ((locale.startsWith("en") ? englishUiCopy("Cerca opzioni") : zh ? "搜索选项" : "Cerca opzioni"))} aria-label={searchPlaceholder ?? ((locale.startsWith("en") ? englishUiCopy("Cerca opzioni") : zh ? "搜索选项" : "Cerca opzioni"))}
          aria-controls={listId} aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined} autoComplete="off" />
      </div>
      <div id={listId} role="listbox" aria-label={ariaLabel} className="max-h-[min(300px,calc(var(--radix-popover-content-available-height,70svh)-64px))] min-h-0 overflow-y-auto overscroll-contain">
        {filtered.map((option, index) => <button key={option.value} id={`${listId}-${index}`} type="button" role="option" tabIndex={-1}
          aria-selected={value === option.value} aria-disabled={option.disabled || undefined} disabled={option.disabled}
          className={cn("flex min-h-10 w-full min-w-0 items-center gap-2 rounded-md px-2 py-2 text-left text-sm disabled:opacity-50", active?.value === option.value && "bg-accent", value === option.value && "text-primary")}
          onMouseEnter={() => { if (!option.disabled) setActiveValue(option.value); }} onClick={() => choose(option)}>
          <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]"><span className="block">{option.label}</span>{option.description && <span className="block text-xs text-slate-500">{option.description}</span>}</span>
          {value === option.value && <Check aria-hidden="true" className="size-4 shrink-0" />}
        </button>)}
        {filtered.length === 0 && <p role="status" className="px-3 py-4 text-sm text-slate-500">{emptyLabel ?? ((locale.startsWith("en") ? englishUiCopy("Nessuna opzione") : zh ? "没有匹配选项" : "Nessuna opzione"))}</p>}
      </div>
    </PopoverContent>
  </Popover>;
}
