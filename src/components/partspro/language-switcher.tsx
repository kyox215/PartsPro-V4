"use client";

import * as React from "react";
import { Languages } from "lucide-react";
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
import { useI18n } from "./i18n-provider";

type LanguageSwitcherProps = {
  compact?: boolean;
  className?: string;
  scope?: LocaleScope;
};

export function LanguageSwitcher({
  compact = false,
  className,
  scope: scopeOverride,
}: LanguageSwitcherProps) {
  const router = useRouter();
  const { locale, scope, t } = useI18n();
  const activeScope = scopeOverride ?? scope;
  const [pendingLocale, setPendingLocale] = React.useState<Locale | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function handleLocaleChange(nextLocale: Locale) {
    if (nextLocale === locale || isPending) {
      return;
    }

    setPendingLocale(nextLocale);
    startTransition(async () => {
      try {
        await setLocale(nextLocale, activeScope);
        router.refresh();
      } finally {
        setPendingLocale(null);
      }
    });
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
