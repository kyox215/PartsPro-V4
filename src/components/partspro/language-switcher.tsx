"use client";

import * as React from "react";
import { ChevronDown, Globe2, Languages, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/app/actions/i18n";
import {
  localeLabels,
  localeShortLabels,
  locales,
  type Locale,
  type LocaleScope,
} from "@/i18n/config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "./i18n-provider";

type LanguageSwitcherProps = {
  compact?: boolean;
  className?: string;
  scope?: LocaleScope;
  presentation?: "segmented" | "menu";
};

export function LanguageSwitcher({
  compact = false,
  className,
  scope: scopeOverride,
  presentation = "segmented",
}: LanguageSwitcherProps) {
  const router = useRouter();
  const { locale, scope, t } = useI18n();
  const activeScope = scopeOverride ?? scope;
  const [pendingLocale, setPendingLocale] = React.useState<Locale | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const [failed, setFailed] = React.useState(false);

  function handleLocaleChange(nextLocale: Locale) {
    if (nextLocale === locale || isPending) {
      return;
    }

    setPendingLocale(nextLocale);
    setFailed(false);
    startTransition(async () => {
      try {
        await setLocale(nextLocale, activeScope);
        router.refresh();
      } catch {
        setFailed(true);
      } finally {
        setPendingLocale(null);
      }
    });
  }

  if (presentation === "menu") {
    const fullLabels = { "it-IT": "Italiano", "zh-CN": "简体中文" };
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn("pp-language-trigger", className)}
            aria-label={`${t("language.label")}: ${fullLabels[locale]}`}
            aria-busy={isPending || undefined}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="pp-language-globe animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Globe2 className="pp-language-globe" aria-hidden="true" />}
            <span>{fullLabels[pendingLocale ?? locale]}</span>
            <ChevronDown className="pp-language-chevron" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={12} className="pp-storefront-portal pp-language-menu">
          <DropdownMenuLabel>{t("language.label")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={locale} onValueChange={(value) => handleLocaleChange(value as Locale)}>
            {locales.map((item) => (
              <DropdownMenuRadioItem key={item} value={item} disabled={isPending} lang={item}>
                {fullLabels[item]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
        {failed ? <span className="sr-only" role="alert">{locale === "zh-CN" ? "语言切换失败，请重试。" : "Cambio lingua non riuscito. Riprova."}</span> : null}
      </DropdownMenu>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm",
        compact && "h-9",
        className
      )}
      aria-label={t("language.label")}
    >
      <div className="grid size-8 place-items-center rounded-full text-slate-500">
        <Languages className="size-4" />
      </div>
      {locales.map((item) => {
        const active = item === locale;
        const loading = pendingLocale === item;
        const label = `${active ? t("language.current") : t("language.switchTo")}: ${
          localeLabels[item]
        }`;
        return (
          <Button
            key={item}
            type="button"
            variant={active ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-8 min-w-8 rounded-full px-2 text-xs font-black",
              compact && "h-7 min-w-7 px-1.5"
            )}
            aria-pressed={active}
            aria-label={label}
            disabled={isPending}
            title={label}
            onClick={() => handleLocaleChange(item)}
          >
            {loading ? "..." : localeShortLabels[item]}
          </Button>
        );
      })}
    </div>
  );
}
