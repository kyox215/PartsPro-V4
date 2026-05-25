"use client";

import * as React from "react";
import type { Locale, LocaleScope } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { translate } from "@/i18n/get-dictionary";

type I18nContextValue = {
  locale: Locale;
  scope: LocaleScope;
  dictionary: Dictionary;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

type I18nProviderProps = {
  locale: Locale;
  scope: LocaleScope;
  dictionary: Dictionary;
  children: React.ReactNode;
};

export function I18nProvider({
  locale,
  scope,
  dictionary,
  children,
}: I18nProviderProps) {
  const value = React.useMemo<I18nContextValue>(
    () => ({
      locale,
      scope,
      dictionary,
      t: (key, params) => translate(dictionary, key, params),
    }),
    [dictionary, locale, scope]
  );

  return (
    <I18nContext.Provider value={value}>
      {children}
      <AutoTranslate locale={locale} />
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = React.useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }

  return context;
}

export function useT(namespace?: string) {
  const { t } = useI18n();

  return React.useCallback(
    (key: string, params?: Record<string, string | number>) =>
      t(namespace ? `${namespace}.${key}` : key, params),
    [namespace, t]
  );
}

function AutoTranslate({ locale }: { locale: Locale }) {
  React.useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
  }, [locale]);

  return null;
}
