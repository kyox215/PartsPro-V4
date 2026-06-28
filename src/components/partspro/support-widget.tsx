"use client";

import * as React from "react";
import {
  Headphones,
  Loader2,
  MessageCircle,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";
import { useI18n } from "./i18n-provider";

type SupportConversation = {
  customerUnreadCount: number;
  id: string;
  status: "open" | "resolved" | "archived";
  subject: string | null;
};

type SupportMessage = {
  body: string;
  createdAt: string;
  id: string;
  senderType: "customer" | "staff" | "system";
};

type CurrentSupportPayload = {
  conversation: SupportConversation | null;
  messages: SupportMessage[];
};

const supportCopy = {
  it: {
    closedTitle: "Assistenza",
    composerPlaceholder: "Scrivi il tuo messaggio...",
    empty: "Scrivi il primo messaggio: il team PartsPro lo vedra in tempo reale.",
    headerSubtitle: "Chat tracciata nel tuo account",
    headerTitle: "Assistenza PartsPro",
    loading: "Caricamento assistenza...",
    loginRequired: "Accedi per contattare l'assistenza.",
    openLabel: "Contatta assistenza",
    send: "Invia",
    sending: "Invio...",
    unavailable: "Assistenza temporaneamente non disponibile.",
  },
  zh: {
    closedTitle: "客服",
    composerPlaceholder: "输入你的问题...",
    empty: "发送第一条消息，PartsPro 员工会在后台实时看到。",
    headerSubtitle: "站内账号客服记录",
    headerTitle: "PartsPro 客服",
    loading: "正在加载客服...",
    loginRequired: "登录后可以联系客服。",
    openLabel: "联系客服",
    send: "发送",
    sending: "发送中...",
    unavailable: "客服暂时不可用。",
  },
};

export function SupportWidget() {
  const { locale, scope } = useI18n();
  const copy = locale === "zh-CN" ? supportCopy.zh : supportCopy.it;
  const [eligible, setEligible] = React.useState(false);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [conversation, setConversation] =
    React.useState<SupportConversation | null>(null);
  const [messages, setMessages] = React.useState<SupportMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const markedReadRef = React.useRef("");

  React.useEffect(() => {
    if (
      scope !== "storefront" ||
      !eligible ||
      new URLSearchParams(window.location.search).get("support") !== "open"
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setOpen(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [eligible, scope]);

  React.useEffect(() => {
    if (scope !== "storefront") {
      return;
    }

    let cancelled = false;

    void fetch("/api/me", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (cancelled || !isRecord(payload)) {
          return;
        }

        if (
          payload.authenticated === true &&
          payload.accountType === "customer" &&
          typeof payload.userId === "string"
        ) {
          setEligible(true);
          setUserId(payload.userId);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [scope]);

  const loadConversation = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/support/conversations/current", {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal,
        });

        if (!response.ok) {
          throw new Error(copy.unavailable);
        }

        const payload = await response.json();
        const data = readCurrentSupportPayload(payload);

        setConversation(data.conversation);
        setMessages(data.messages);
        setLoaded(true);
      } catch (loadError) {
        if (!signal?.aborted) {
          setError(loadError instanceof Error ? loadError.message : copy.unavailable);
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [copy.unavailable]
  );

  React.useEffect(() => {
    if (!open || loaded) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadConversation(controller.signal);
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [loadConversation, loaded, open]);

  React.useEffect(() => {
    if (!conversation?.id || !isSupabaseConfigured()) {
      return;
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`partspro-support-customer:${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          filter: `conversation_id=eq.${conversation.id}`,
          schema: "public",
          table: "support_messages",
        },
        () => {
          void loadConversation();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          filter: `id=eq.${conversation.id}`,
          schema: "public",
          table: "support_conversations",
        },
        () => {
          void loadConversation();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversation?.id, loadConversation]);

  React.useEffect(() => {
    if (!open || !conversation?.id || conversation.customerUnreadCount <= 0) {
      return;
    }

    const markKey = `${conversation.id}:${conversation.customerUnreadCount}`;

    if (markedReadRef.current === markKey) {
      return;
    }

    markedReadRef.current = markKey;

    void fetch("/api/support/conversations/current/read", {
      body: JSON.stringify({ conversationId: conversation.id }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => undefined);
  }, [conversation?.customerUnreadCount, conversation?.id, open]);

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();

    if (!body || sending) {
      return;
    }

    setSending(true);
    setError(null);

    try {
      const response = await fetch("/api/support/conversations/current/messages", {
        body: JSON.stringify({ body }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(copy.unavailable);
      }

      const payload = await response.json();
      const data = readCurrentSupportPayload(payload);

      setConversation(data.conversation);
      setMessages(data.messages);
      setLoaded(true);
      setDraft("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : copy.unavailable);
    } finally {
      setSending(false);
    }
  }

  if (scope !== "storefront" || !eligible || !userId) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-3 z-50 sm:bottom-5 sm:right-5">
      {open ? (
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
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-3 py-3">
            {loading && messages.length === 0 ? (
              <div className="flex h-full min-h-[220px] items-center justify-center text-sm font-semibold text-slate-500">
                <Loader2 className="mr-2 size-4 animate-spin" />
                {copy.loading}
              </div>
            ) : messages.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm font-semibold leading-6 text-slate-600">
                {error ?? copy.empty}
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
            )}
          </div>

          {error && messages.length > 0 ? (
            <div className="border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              {error}
            </div>
          ) : null}

          <form className="border-t border-slate-200 bg-white p-3" onSubmit={handleSend}>
            <Textarea
              value={draft}
              className="max-h-28 min-h-20 resize-none bg-white text-sm"
              maxLength={2000}
              placeholder={copy.composerPlaceholder}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-400">
                {draft.trim().length}/2000
              </span>
              <Button type="submit" disabled={sending || draft.trim().length === 0}>
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                {sending ? copy.sending : copy.send}
              </Button>
            </div>
          </form>
        </section>
      ) : (
        <button
          type="button"
          className="flex h-12 items-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-bold text-white shadow-[0_18px_45px_rgba(15,23,42,0.25)] transition hover:bg-primary"
          onClick={() => setOpen(true)}
        >
          <MessageCircle className="size-4" />
          <span>{copy.openLabel}</span>
          {conversation && conversation.customerUnreadCount > 0 ? (
            <span className="grid min-w-5 place-items-center rounded-full bg-red-500 px-1.5 text-[11px]">
              {conversation.customerUnreadCount}
            </span>
          ) : null}
        </button>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: SupportMessage }) {
  const isCustomer = message.senderType === "customer";
  const isSystem = message.senderType === "system";

  return (
    <div
      className={cn(
        "flex min-w-0",
        isSystem ? "justify-center" : isCustomer ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[82%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm leading-5",
          isSystem
            ? "bg-slate-200 text-xs font-semibold text-slate-600"
            : isCustomer
              ? "bg-primary text-white"
              : "border border-slate-200 bg-white text-slate-800"
        )}
      >
        {message.body}
      </div>
    </div>
  );
}

function readCurrentSupportPayload(payload: unknown): CurrentSupportPayload {
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null;
  const conversation = isRecord(data?.conversation)
    ? readConversation(data.conversation)
    : null;
  const messages = Array.isArray(data?.messages)
    ? data.messages.map(readMessage).filter((message): message is SupportMessage => Boolean(message))
    : [];

  return { conversation, messages };
}

function readConversation(value: Record<string, unknown>): SupportConversation | null {
  if (typeof value.id !== "string") {
    return null;
  }

  return {
    customerUnreadCount:
      typeof value.customerUnreadCount === "number" ? value.customerUnreadCount : 0,
    id: value.id,
    status:
      value.status === "resolved" || value.status === "archived"
        ? value.status
        : "open",
    subject: typeof value.subject === "string" ? value.subject : null,
  };
}

function readMessage(value: unknown): SupportMessage | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.body !== "string") {
    return null;
  }

  return {
    body: value.body,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
    id: value.id,
    senderType:
      value.senderType === "staff" || value.senderType === "system"
        ? value.senderType
        : "customer",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
