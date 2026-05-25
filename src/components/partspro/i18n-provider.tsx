"use client";

import * as React from "react";
import type { Locale, LocaleScope } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { translate } from "@/i18n/get-dictionary";
import { translateText } from "@/i18n/dictionaries/auto-translate";

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

    translateDocument(locale);

    if (locale !== "zh-CN") {
      return;
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          translateTextNode(mutation.target, locale);
          continue;
        }

        mutation.addedNodes.forEach((node) => translateNode(node, locale));
      }
    });

    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [locale]);

  return null;
}

function translateDocument(locale: Locale) {
  if (locale !== "zh-CN") {
    return;
  }

  translateNode(document.body, locale);
}

function translateNode(node: Node, locale: Locale) {
  if (node.nodeType === Node.TEXT_NODE) {
    translateTextNode(node, locale);
    return;
  }

  if (!(node instanceof HTMLElement)) {
    return;
  }

  translateAttributes(node, locale);

  if (shouldSkipChildren(node)) {
    return;
  }

  const walker = document.createTreeWalker(
    node,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(currentNode) {
        if (
          currentNode instanceof HTMLElement &&
          shouldSkipChildren(currentNode)
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let current: Node | null = walker.currentNode;
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      translateTextNode(current, locale);
    } else if (current instanceof HTMLElement) {
      translateAttributes(current, locale);
    }
    current = walker.nextNode();
  }
}

function translateTextNode(node: Node, locale: Locale) {
  const next = translateText(node.textContent ?? "", locale);
  if (next !== node.textContent) {
    node.textContent = next;
  }
}

function translateAttributes(element: HTMLElement, locale: Locale) {
  for (const attribute of ["placeholder", "aria-label", "title", "alt"]) {
    const value = element.getAttribute(attribute);
    if (!value) {
      continue;
    }

    const next = translateText(value, locale);
    if (next !== value) {
      element.setAttribute(attribute, next);
    }
  }
}

function shouldSkipElement(element: HTMLElement) {
  return element.closest("[data-i18n-skip]") !== null;
}

function shouldSkipChildren(element: HTMLElement) {
  return (
    shouldSkipElement(element) ||
    ["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA", "INPUT"].includes(
      element.tagName
    )
  );
}
