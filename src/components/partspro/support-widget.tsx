"use client";

import { englishUiCopy } from "@/i18n/english-ui-copy";


import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { usePathname } from "next/navigation";
import { Headphones, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "./i18n-provider";

const SUPPORT_ACTION_BAR_SELECTOR = '[data-support-offset="mobile-action-bar"]';
const SUPPORT_PANEL_HEIGHT_FALLBACK = "calc(100dvh - 2rem)";


const supportWidgetCopy = {
  it: {
    headerSubtitle: "Chat tracciata nel tuo account",
    headerTitle: "Assistenza PartsPro",
    loading: "Caricamento assistenza...",
    openLabel: "Contatta assistenza",
    close: "Chiudi assistenza",
    failed: "Impossibile caricare l’assistenza.",
    retry: "Riprova",
  },
  zh: {
    headerSubtitle: "站内账号客服记录",
    headerTitle: "PartsPro 客服",
    loading: "正在加载客服...",
    openLabel: "联系客服",
    close: "关闭客服",
    failed: "无法加载客服模块。",
    retry: "重试",
  },
};

export function SupportWidget() {
  const { locale, scope } = useI18n();
  const pathname = usePathname();
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const shouldRender = scope === "storefront" && !isAdminPath;
  const copy = (locale.startsWith("en") ? englishUiCopy(supportWidgetCopy.it) : locale === "zh-CN" ? supportWidgetCopy.zh : supportWidgetCopy.it);
  const [open, setOpen] = React.useState(false);
  const [moduleAttempt, setModuleAttempt] = React.useState(0);
  const [supportModule,setSupportModule] = React.useState<typeof import("./support-chat-panel") | null>(null);
  const [moduleError,setModuleError] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    import("./support-chat-panel").then(module => { if (active) {setSupportModule(module);setModuleError(false);} }).catch(() => {if(active)setModuleError(true);});
    return () => { active = false; };
  },[open,moduleAttempt]);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = React.useState(false);
  const [identity, setIdentity] = React.useState<string | null>(null);
  const identityRef = React.useRef<string | null>(null);
  const [identityReady, setIdentityReady] = React.useState(false);
  const [draft, setDraft] = React.useState({ userId: null as string | null, conversationId: null as string | null, value: "" });
  const onClose = React.useCallback(() => { setOpen(false); requestAnimationFrame(() => triggerRef.current?.focus()); }, []);
  React.useEffect(() => {
    const focus = () => setEditing(document.activeElement instanceof HTMLElement && document.activeElement.matches("input,textarea,select,[contenteditable=true]"));
    const onFocus = () => requestAnimationFrame(focus);
    document.addEventListener("focusin",onFocus); document.addEventListener("focusout",onFocus);
    return () => { document.removeEventListener("focusin",onFocus);document.removeEventListener("focusout",onFocus); };
  }, []);
  React.useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("partspro:open-support",show);
    return () => window.removeEventListener("partspro:open-support",show);
  }, []);
  React.useEffect(() => {
    if (!isSupabaseConfigured()) { const timer = window.setTimeout(() => setIdentityReady(true),0); return () => clearTimeout(timer); }
    const client = createClient(); let active = true;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event,session) => {
      if (!active) return;
      const userId = session?.user.id || null;
      if (identityRef.current !== userId) { setDraft({userId,conversationId:null,value:""}); setOpen(false); }
      identityRef.current = userId; setIdentity(userId);
      setIdentityReady(true);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  React.useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } };
    window.addEventListener("keydown",escape); return () => window.removeEventListener("keydown",escape);
  }, [open,onClose]);
  const onDraftChange = React.useCallback((value:string) => { if (identityRef.current === identity) setDraft(current => ({...current,userId:identity,value})); },[identity]);
  const onConversationChange = React.useCallback((conversationId:string|null) => { if (identityRef.current === identity) setDraft(current => current.userId === identity && (current.conversationId === conversationId || current.conversationId === null) ? {...current,conversationId} : {userId:identity,conversationId,value:""}); },[identity]);
  const actionBarOffset = useSupportActionBarOffset(
    shouldRender
  );
  const widgetBottom =
    actionBarOffset > 0
      ? `${actionBarOffset + 12}px`
      : "calc(env(safe-area-inset-bottom) + clamp(1rem, 1.5vw, 1.25rem))";
  const panelHeight =
    actionBarOffset > 0
      ? `calc(100dvh - ${actionBarOffset + 24}px)`
      : SUPPORT_PANEL_HEIGHT_FALLBACK;
  const widgetStyle = {
    "--support-widget-panel-height": panelHeight,
    bottom: widgetBottom,
  } satisfies React.CSSProperties & {
    "--support-widget-panel-height": string;
  };

  React.useEffect(() => {
    if (!shouldRender) {
      return;
    }

    if (new URLSearchParams(window.location.search).get("support") !== "open") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setOpen(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [pathname, scope, shouldRender]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={`pp-support-widget fixed right-3 z-50 transition-[bottom] duration-200 ease-out motion-reduce:transition-none sm:right-5 ${editing && !open ? "max-lg:hidden" : ""}`}
      style={widgetStyle}
    >
      {open ? (
        <SupportModuleBoundary key={moduleAttempt} fallback={<SupportChatPanelLoading onClose={onClose} error onRetry={() => setModuleAttempt(attempt => attempt + 1)} />}>
            {identityReady && supportModule ? <supportModule.SupportChatPanel key={identity || "guest"} onClose={onClose} draft={draft.userId === identity ? draft.value : ""} onDraftChange={onDraftChange} onConversationChange={onConversationChange} /> : <SupportChatPanelLoading onClose={onClose} error={moduleError} onRetry={() => setModuleAttempt(attempt => attempt + 1)} />}
        </SupportModuleBoundary>
      ) : (
        <button
          ref={triggerRef}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={copy.openLabel}
          type="button"
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-bold text-white shadow-[0_18px_45px_rgba(15,23,42,0.25)] transition hover:bg-primary max-[430px]:size-12 max-[430px]:px-0"
          onClick={() => setOpen(true)}
          onFocus={() => preloadSupportChatPanel()}
          onPointerEnter={() => preloadSupportChatPanel()}
        >
          <Headphones className="size-6" />
          <span className="max-[430px]:sr-only">{copy.openLabel}</span>
        </button>
      )}
    </div>
  );
}

function SupportChatPanelLoading({ onClose, error = false, onRetry }: { onClose: () => void; error?: boolean; onRetry?: () => void }) {
  const { locale } = useI18n();
  const copy = (locale.startsWith("en") ? englishUiCopy(supportWidgetCopy.it) : locale === "zh-CN" ? supportWidgetCopy.zh : supportWidgetCopy.it);

  return (
    <section role="dialog" aria-label={copy.headerTitle} tabIndex={-1} className="flex h-[min(620px,var(--support-widget-panel-height,calc(100dvh-2rem)))] w-[min(390px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
      <div className="flex min-w-0 items-center gap-3 border-b border-slate-200 bg-slate-950 px-3 py-3 text-white">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/12">
          <Headphones className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-black">{copy.headerTitle}</h2>
          <p className="truncate text-xs text-white/65">{copy.headerSubtitle}</p>
        </div>
        <Button
          aria-label={copy.close}
          className="text-white hover:bg-white/10 hover:text-white"
          size="icon-sm"
          type="button"
          variant="ghost"
          onClick={onClose}
          autoFocus
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex min-h-[220px] flex-1 items-center justify-center bg-slate-50 text-sm font-semibold text-slate-500">
        {error ? <div className="space-y-3 p-4" role="alert"><p>{copy.failed}</p><Button onClick={onRetry} variant="outline">{copy.retry}</Button></div> : <><Loader2 className="mr-2 size-4 animate-spin motion-reduce:animate-none" />{copy.loading}</>}
      </div>
    </section>
  );
}

function preloadSupportChatPanel() {
  void import("./support-chat-panel");
}

function useSupportActionBarOffset(enabled: boolean) {
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    let animationFrame = 0;
    const mobile = window.matchMedia("(max-width: 1023px)");
    const observedBars = new Set<HTMLElement>();
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleUpdate);

    function getActionBars() {
      return Array.from(
        document.querySelectorAll<HTMLElement>(SUPPORT_ACTION_BAR_SELECTOR)
      );
    }

    function measureOffset() {
      const bars = mobile.matches ? getActionBars() : [];
      for (const element of observedBars) {
        if (!bars.includes(element)) {
          resizeObserver?.unobserve(element);
          observedBars.delete(element);
        }
      }
      const viewportHeight = window.innerHeight;
      const nextOffset = bars.reduce((maxOffset, element) => {
        if (!observedBars.has(element)) {
          resizeObserver?.observe(element);
          observedBars.add(element);
        }

        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          rect.height <= 0 ||
          rect.bottom <= 0 ||
          rect.top >= viewportHeight
        ) {
          return maxOffset;
        }

        return Math.max(maxOffset, Math.ceil(viewportHeight - rect.top));
      }, 0);

      setOffset((currentOffset) =>
        currentOffset === nextOffset ? currentOffset : nextOffset
      );
    }

    function scheduleUpdate() {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(measureOffset);
    }

    const mutationObserver = new MutationObserver((records) => {
      const changedBars = records.some((record) =>
        [...record.addedNodes, ...record.removedNodes].some((node) =>
          node instanceof Element && (
            node.matches(SUPPORT_ACTION_BAR_SELECTOR) ||
            node.querySelector(SUPPORT_ACTION_BAR_SELECTOR)
          )
        )
      );
      if (changedBars) scheduleUpdate();
    });

    function updateBreakpoint() {
      mutationObserver.disconnect();
      if (mobile.matches) {
        mutationObserver.observe(document.body, { childList: true, subtree: true });
      }
      scheduleUpdate();
    }

    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("orientationchange", scheduleUpdate);
    window.visualViewport?.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleUpdate);
    mobile.addEventListener("change", updateBreakpoint);
    updateBreakpoint();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      mobile.removeEventListener("change", updateBreakpoint);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
      window.visualViewport?.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleUpdate);
    };
  }, [enabled]);

  return enabled ? offset : 0;
}

class SupportModuleBoundary extends React.Component<{children:React.ReactNode;fallback:React.ReactNode},{failed:boolean}> {
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
