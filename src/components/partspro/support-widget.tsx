"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Headphones, Loader2, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "./i18n-provider";

const SupportChatPanel = dynamic(
  () => import("./support-chat-panel").then((module) => module.SupportChatPanel),
  {
    loading: () => <SupportChatPanelLoading />,
    ssr: false,
  }
);

const supportWidgetCopy = {
  it: {
    headerSubtitle: "Chat tracciata nel tuo account",
    headerTitle: "Assistenza PartsPro",
    loading: "Caricamento assistenza...",
    openLabel: "Contatta assistenza",
  },
  zh: {
    headerSubtitle: "站内账号客服记录",
    headerTitle: "PartsPro 客服",
    loading: "正在加载客服...",
    openLabel: "联系客服",
  },
};

export function SupportWidget() {
  const { locale, scope } = useI18n();
  const copy = locale === "zh-CN" ? supportWidgetCopy.zh : supportWidgetCopy.it;
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (
      scope !== "storefront" ||
      new URLSearchParams(window.location.search).get("support") !== "open"
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setOpen(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [scope]);

  if (scope !== "storefront") {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-3 z-50 sm:bottom-5 sm:right-5">
      {open ? (
        <SupportChatPanel onClose={() => setOpen(false)} />
      ) : (
        <button
          type="button"
          className="flex h-12 items-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-bold text-white shadow-[0_18px_45px_rgba(15,23,42,0.25)] transition hover:bg-primary"
          onClick={() => setOpen(true)}
          onFocus={() => preloadSupportChatPanel()}
          onPointerEnter={() => preloadSupportChatPanel()}
        >
          <MessageCircle className="size-4" />
          <span>{copy.openLabel}</span>
        </button>
      )}
    </div>
  );
}

function SupportChatPanelLoading() {
  const { locale } = useI18n();
  const copy = locale === "zh-CN" ? supportWidgetCopy.zh : supportWidgetCopy.it;

  return (
    <section className="flex h-[min(620px,calc(100dvh-2rem))] w-[min(390px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
      <div className="flex min-w-0 items-center gap-3 border-b border-slate-200 bg-slate-950 px-3 py-3 text-white">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/12">
          <Headphones className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-black">{copy.headerTitle}</h2>
          <p className="truncate text-xs text-white/65">{copy.headerSubtitle}</p>
        </div>
        <Button
          aria-label="Close support"
          className="text-white hover:bg-white/10 hover:text-white"
          size="icon-sm"
          type="button"
          variant="ghost"
          disabled
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex min-h-[220px] flex-1 items-center justify-center bg-slate-50 text-sm font-semibold text-slate-500">
        <Loader2 className="mr-2 size-4 animate-spin" />
        {copy.loading}
      </div>
    </section>
  );
}

function preloadSupportChatPanel() {
  void import("./support-chat-panel");
}
