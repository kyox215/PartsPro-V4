"use client";

import * as React from "react";
import {
  Bell,
  CheckCircle2,
  CircleDot,
  Loader2,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Send,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";
import { AdminBusyRegion, AdminSkeletonRows } from "./admin-feedback";
import { useI18n } from "./i18n-provider";

type SupportStatus = "all" | "open" | "resolved" | "archived";
type SupportScope = "all" | "mine" | "unassigned";

type SupportActor = {
  displayName: string | null;
  email: string | null;
  id: string | null;
};

type SupportCustomer = {
  companyName: string | null;
  email: string | null;
  id: string | null;
  phone: string | null;
};

type SupportConversation = {
  assignedTo: string | null;
  assignee: SupportActor | null;
  createdAt: string;
  customer: SupportCustomer | null;
  customerUnreadCount: number;
  id: string;
  lastCustomerMessageAt: string | null;
  lastMessageAt: string | null;
  lastStaffMessageAt: string | null;
  staffUnreadCount: number;
  status: Exclude<SupportStatus, "all">;
  subject: string | null;
  updatedAt: string;
};

type SupportMessage = {
  body: string;
  createdAt: string;
  id: string;
  sender: SupportActor | null;
  senderType: "customer" | "staff" | "system";
};

type SupportEvent = {
  actor: SupportActor | null;
  actorId: string | null;
  conversationId: string;
  createdAt: string;
  eventType: string;
  fromAssignee: string | null;
  fromStatus: string | null;
  id: string;
  note: string | null;
  toAssignee: string | null;
  toStatus: string | null;
};

type SupportDetail = {
  conversation: SupportConversation;
  events: SupportEvent[];
  messages: SupportMessage[];
};

type EmployeeOption = {
  displayName: string | null;
  email: string | null;
  roleTemplate: string | null;
  userId: string;
};

type Notice = {
  message: string;
  tone: "success" | "warning" | "error";
};

type MobileInboxMode = "all" | "mine" | "needsReply" | "unassigned";
type DetailView = "history" | "messages";

const unassignedValue = "__unassigned__";

const supportCopy = {
  it: {
    actions: {
      assign: "Assegna",
      claim: "Prendi in carico",
      enableNotifications: "Attiva notifiche",
      markRead: "Segna letto",
      refresh: "Aggiorna",
      reopen: "Riapri",
      reply: "Rispondi",
      resolve: "Risolvi",
    },
    assignedTo: "Responsabile",
    composerPlaceholder: "Scrivi una risposta al cliente...",
    emptyConversation: "Seleziona una conversazione dalla coda.",
    emptyQueue: "Nessuna conversazione in questa vista.",
    events: {
      assigned: "Assegnazione",
      claimed: "Presa in carico",
      created: "Creata",
      customerMessage: "Messaggio cliente",
      read: "Letta",
      reopened: "Riaperta",
      resolved: "Risolta",
      staffMessage: "Risposta staff",
      systemNote: "Nota",
    },
    filters: {
      all: "Tutte",
      archived: "Archiviate",
      mine: "Mie",
      open: "Aperte",
      resolved: "Risolte",
      unassigned: "Non assegnate",
    },
    loading: "Caricamento assistenza",
    notificationBody: "Nuovo messaggio cliente in PartsPro.",
    notificationTitle: "Nuova richiesta assistenza",
    queueTitle: "Coda assistenza",
    sendFailed: "Invio risposta non riuscito.",
    subtitle: "Messaggi clienti, assegnazione e responsabilita in tempo reale.",
    tabs: {
      history: "Storico",
      messages: "Messaggi",
    },
    tasks: {
      all: "Tutte",
      inProgress: "In gestione",
      mine: "Mie",
      needsReply: "Da rispondere",
      unassigned: "Non assegnate",
    },
    historyEmpty: "Nessuno storico disponibile.",
    title: "Assistenza clienti",
    unread: "Non lette",
    unavailable: "Assistenza temporaneamente non disponibile.",
  },
  zh: {
    actions: {
      assign: "转派",
      claim: "认领",
      enableNotifications: "启用通知",
      markRead: "标记已读",
      refresh: "刷新",
      reopen: "重开",
      reply: "回复",
      resolve: "解决",
    },
    assignedTo: "负责人",
    composerPlaceholder: "回复客户...",
    emptyConversation: "从左侧选择一个会话。",
    emptyQueue: "当前筛选下没有会话。",
    events: {
      assigned: "转派",
      claimed: "认领",
      created: "创建",
      customerMessage: "客户消息",
      read: "已读",
      reopened: "重开",
      resolved: "解决",
      staffMessage: "员工回复",
      systemNote: "记录",
    },
    filters: {
      all: "全部",
      archived: "已归档",
      mine: "我的",
      open: "进行中",
      resolved: "已解决",
      unassigned: "未分配",
    },
    loading: "正在加载客服",
    notificationBody: "PartsPro 有新的客户消息。",
    notificationTitle: "新的客服消息",
    queueTitle: "客服队列",
    sendFailed: "回复发送失败。",
    subtitle: "客户消息、负责人分配和处理状态集中管理。",
    tabs: {
      history: "历史",
      messages: "消息",
    },
    tasks: {
      all: "全部",
      inProgress: "处理中",
      mine: "我的",
      needsReply: "待回复",
      unassigned: "未认领",
    },
    historyEmpty: "暂无处理历史。",
    title: "客户客服",
    unread: "未读",
    unavailable: "客服暂时不可用。",
  },
};

type SupportPanelCopy = typeof supportCopy.zh;

export function AdminSupportPanel({
  currentUserId,
}: {
  currentUserId?: string | null;
}) {
  const { locale } = useI18n();
  const copy = locale === "zh-CN" ? supportCopy.zh : supportCopy.it;
  const [status, setStatus] = React.useState<SupportStatus>("open");
  const [scope, setScope] = React.useState<SupportScope>("all");
  const [conversations, setConversations] = React.useState<SupportConversation[]>([]);
  const [inboxConversations, setInboxConversations] = React.useState<SupportConversation[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [detail, setDetail] = React.useState<SupportDetail | null>(null);
  const [employees, setEmployees] = React.useState<EmployeeOption[]>([]);
  const [assignee, setAssignee] = React.useState(unassignedValue);
  const [reply, setReply] = React.useState("");
  const [detailView, setDetailView] = React.useState<DetailView>("messages");
  const [isDesktopLayout, setIsDesktopLayout] = React.useState(false);
  const [isLoadingList, setIsLoadingList] = React.useState(false);
  const [isLoadingInbox, setIsLoadingInbox] = React.useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = React.useState(false);
  const [mobileInboxMode, setMobileInboxMode] = React.useState<MobileInboxMode>("needsReply");
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(
    () => "Notification" in globalThis && Notification.permission === "granted"
  );
  const effectiveScope = !currentUserId && scope === "mine" ? "all" : scope;

  const refreshInbox = React.useCallback(async (signal?: AbortSignal) => {
    setIsLoadingInbox(true);

    try {
      const params = new URLSearchParams({
        limit: "100",
        offset: "0",
        scope: "all",
        status: "open",
      });
      const response = await fetch(`/api/admin/support/conversations?${params}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
      });

      if (!response.ok) {
        throw new Error(copy.unavailable);
      }

      const payload = await response.json();

      setInboxConversations(readConversations(payload));
    } catch (error) {
      if (!signal?.aborted) {
        setNotice({
          message: error instanceof Error ? error.message : copy.unavailable,
          tone: "error",
        });
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoadingInbox(false);
      }
    }
  }, [copy.unavailable]);

  const refreshList = React.useCallback(async (signal?: AbortSignal) => {
    setIsLoadingList(true);

    try {
      const params = new URLSearchParams({
        limit: "50",
        offset: "0",
        scope: effectiveScope,
        status,
      });
      const response = await fetch(`/api/admin/support/conversations?${params}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
      });

      if (!response.ok) {
        throw new Error(copy.unavailable);
      }

      const payload = await response.json();
      const nextConversations = readConversations(payload);

      setConversations(nextConversations);
      setSelectedId((current) =>
        current && nextConversations.some((conversation) => conversation.id === current)
          ? current
          : nextConversations[0]?.id ?? ""
      );
      setNotice(null);
    } catch (error) {
      if (!signal?.aborted) {
        setNotice({
          message: error instanceof Error ? error.message : copy.unavailable,
          tone: "error",
        });
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoadingList(false);
      }
    }
  }, [copy.unavailable, effectiveScope, status]);

  const refreshDetail = React.useCallback(async (conversationId: string, signal?: AbortSignal) => {
    if (!conversationId) {
      setDetail(null);
      return;
    }

    setIsLoadingDetail(true);

    try {
      const response = await fetch(`/api/admin/support/conversations/${conversationId}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
      });

      if (!response.ok) {
        throw new Error(copy.unavailable);
      }

      const payload = await response.json();
      const nextDetail = readDetail(payload);

      setDetail(nextDetail);
      setAssignee(nextDetail.conversation.assignedTo ?? unassignedValue);
    } catch (error) {
      if (!signal?.aborted) {
        setNotice({
          message: error instanceof Error ? error.message : copy.unavailable,
          tone: "error",
        });
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoadingDetail(false);
      }
    }
  }, [copy.unavailable]);

  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const syncLayout = () => {
      setIsDesktopLayout(query.matches);

      if (query.matches) {
        setMobileDetailOpen(false);
      }
    };

    syncLayout();
    query.addEventListener("change", syncLayout);

    return () => query.removeEventListener("change", syncLayout);
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void refreshList(controller.signal);
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [refreshList]);

  React.useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void refreshInbox(controller.signal);
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [refreshInbox]);

  React.useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void refreshDetail(selectedId, controller.signal);
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [refreshDetail, selectedId]);

  React.useEffect(() => {
    const controller = new AbortController();

    void fetch("/api/admin/accounts?accountType=employee&limit=100&offset=0", {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (!controller.signal.aborted) {
          setEmployees(readEmployees(payload));
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  React.useEffect(() => {
    if (!isSupabaseConfigured()) {
      return;
    }

    const supabase = createClient();
    const channel = supabase
      .channel("partspro-support-admin")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_conversations",
        },
        (payload) => {
          const next = payload.new;

          void refreshList();
          void refreshInbox();

          if (isRecord(next) && readNumber(next.staff_unread_count) > 0) {
            notifyStaff(copy.notificationTitle, copy.notificationBody);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
        },
        (payload) => {
          const next = payload.new;

          if (isRecord(next) && typeof next.conversation_id === "string") {
            if (next.conversation_id === selectedId) {
              void refreshDetail(next.conversation_id);
            }

            void refreshInbox();

            if (next.sender_type === "customer") {
              notifyStaff(copy.notificationTitle, copy.notificationBody);
            }
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [copy.notificationBody, copy.notificationTitle, refreshDetail, refreshInbox, refreshList, selectedId]);

  async function runAction(
    action: "assign" | "claim" | "mark_read" | "reopen" | "resolve",
    assignedTo?: string | null
  ) {
    if (!detail) {
      return;
    }

    setPendingAction(action);

    try {
      const response = await fetch(`/api/admin/support/conversations/${detail.conversation.id}`, {
        body: JSON.stringify({ action, assignedTo }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error(copy.unavailable);
      }

      const payload = await response.json();
      const nextDetail = readDetail(payload);

      setDetail(nextDetail);
      setAssignee(nextDetail.conversation.assignedTo ?? unassignedValue);
      setNotice({ message: copy.actions.refresh, tone: "success" });
      void refreshList();
      void refreshInbox();
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : copy.unavailable,
        tone: "error",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function sendReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!detail || !reply.trim()) {
      return;
    }

    setPendingAction("reply");

    try {
      const response = await fetch(
        `/api/admin/support/conversations/${detail.conversation.id}/messages`,
        {
          body: JSON.stringify({ body: reply.trim() }),
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error(copy.sendFailed);
      }

      const payload = await response.json();
      const nextDetail = readDetail(payload);

      setDetail(nextDetail);
      setAssignee(nextDetail.conversation.assignedTo ?? unassignedValue);
      setReply("");
      void refreshList();
      void refreshInbox();
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : copy.sendFailed,
        tone: "error",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function enableNotifications() {
    if (!("Notification" in window)) {
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === "granted");
  }

  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedId) ??
    inboxConversations.find((conversation) => conversation.id === selectedId) ??
    detail?.conversation ??
    null;
  const inboxCounts = React.useMemo(
    () => ({
      all: inboxConversations.length,
      mine: currentUserId
        ? inboxConversations.filter((conversation) => conversation.assignedTo === currentUserId).length
        : 0,
      needsReply: inboxConversations.filter((conversation) => conversation.staffUnreadCount > 0).length,
      unassigned: inboxConversations.filter((conversation) => !conversation.assignedTo).length,
    }),
    [currentUserId, inboxConversations]
  );
  const mobileInboxConversations = React.useMemo(
    () =>
      inboxConversations
        .filter((conversation) => {
          if (mobileInboxMode === "needsReply") {
            return conversation.staffUnreadCount > 0;
          }

          if (mobileInboxMode === "unassigned") {
            return !conversation.assignedTo;
          }

          if (mobileInboxMode === "mine") {
            return Boolean(currentUserId && conversation.assignedTo === currentUserId);
          }

          return true;
        })
        .sort((a, b) => getSupportPriority(a, currentUserId) - getSupportPriority(b, currentUserId)),
    [currentUserId, inboxConversations, mobileInboxMode]
  );
  const displayedConversations = isDesktopLayout ? conversations : mobileInboxConversations;
  const displayedConversationCount = isDesktopLayout
    ? conversations.length
    : mobileInboxConversations.length;
  const displayedLoading = isDesktopLayout ? isLoadingList : isLoadingInbox;

  function selectConversation(conversationId: string) {
    setSelectedId(conversationId);
    setDetailView("messages");

    if (!isDesktopLayout) {
      setMobileDetailOpen(true);
    }
  }

  return (
    <section className="min-w-0 space-y-1.5 sm:space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-[0_12px_32px_rgba(15,23,42,0.045)] sm:p-4">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <div className="hidden size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary sm:grid sm:size-9">
                <MessageCircle className="size-4" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-black leading-5 sm:text-xl sm:leading-7">{copy.title}</h1>
                <p className="hidden text-xs font-semibold text-slate-500 sm:line-clamp-1 sm:text-sm">
                  {copy.subtitle}
                </p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:flex-wrap sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="size-8 bg-white p-0 sm:h-9 sm:w-auto sm:px-3 sm:text-sm"
              onClick={() => {
                void refreshList();
                void refreshInbox();
              }}
            >
              <RefreshCw className={cn("size-4", isLoadingList && "animate-spin")} />
              <span className="hidden sm:inline">{copy.actions.refresh}</span>
            </Button>
            {"Notification" in globalThis && !notificationsEnabled ? (
              <Button
                type="button"
                variant="outline"
                className="size-8 bg-white p-0 sm:h-9 sm:w-auto sm:px-3 sm:text-sm"
                onClick={enableNotifications}
              >
                <Bell className="size-4" />
                <span className="hidden sm:inline">{copy.actions.enableNotifications}</span>
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mt-1.5 grid grid-cols-4 gap-1 sm:hidden">
          <MobileInboxModeButton
            active={mobileInboxMode === "needsReply"}
            count={inboxCounts.needsReply}
            label={copy.tasks.needsReply}
            tone="hot"
            onClick={() => setMobileInboxMode("needsReply")}
          />
          <MobileInboxModeButton
            active={mobileInboxMode === "unassigned"}
            count={inboxCounts.unassigned}
            label={copy.tasks.unassigned}
            onClick={() => setMobileInboxMode("unassigned")}
          />
          <MobileInboxModeButton
            active={mobileInboxMode === "mine"}
            count={inboxCounts.mine}
            disabled={!currentUserId}
            label={copy.tasks.mine}
            onClick={() => setMobileInboxMode("mine")}
          />
          <MobileInboxModeButton
            active={mobileInboxMode === "all"}
            count={inboxCounts.all}
            label={copy.tasks.all}
            onClick={() => setMobileInboxMode("all")}
          />
        </div>
      </div>

      {notice ? (
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-sm font-semibold",
            notice.tone === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : notice.tone === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
          )}
        >
          {notice.message}
        </div>
      ) : null}

      <div className="grid min-w-0 gap-2 lg:min-h-[640px] lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-3">
        <AdminBusyRegion
          pending={displayedLoading}
          label={copy.loading}
          className="overflow-hidden rounded-lg border border-slate-200 bg-white p-2 shadow-[0_12px_32px_rgba(15,23,42,0.045)] sm:p-3 lg:h-auto lg:min-h-0 lg:max-h-none"
          contentClassName="flex min-h-0 flex-col lg:h-full"
        >
          <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2 sm:mb-3">
            <h2 className="truncate text-sm font-black leading-5">{copy.queueTitle}</h2>
            <Badge className="h-5 px-2 text-[11px]" variant="outline">
              {displayedConversationCount}
            </Badge>
          </div>
          <div className="mb-1.5 hidden grid-cols-2 gap-1.5 sm:mb-3 sm:grid sm:gap-2">
            <Select value={status} onValueChange={(value) => setStatus(value as SupportStatus)}>
              <SelectTrigger size="sm" className="h-8 bg-white text-xs sm:h-9 sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">{copy.filters.open}</SelectItem>
                <SelectItem value="resolved">{copy.filters.resolved}</SelectItem>
                <SelectItem value="archived">{copy.filters.archived}</SelectItem>
                <SelectItem value="all">{copy.filters.all}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={scope} onValueChange={(value) => setScope(value as SupportScope)}>
              <SelectTrigger size="sm" className="h-8 bg-white text-xs sm:h-9 sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{copy.filters.all}</SelectItem>
                <SelectItem value="unassigned">{copy.filters.unassigned}</SelectItem>
                <SelectItem value="mine" disabled={!currentUserId}>
                  {copy.filters.mine}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {displayedLoading && displayedConversations.length === 0 ? (
            <AdminSkeletonRows rows={4} />
          ) : displayedConversations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm font-semibold text-slate-500 sm:p-4">
              {copy.emptyQueue}
            </div>
          ) : (
            <div className="max-h-[32svh] min-h-0 space-y-1.5 overflow-y-auto pr-0.5 sm:space-y-2 lg:max-h-none lg:flex-1">
              {displayedConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={cn(
                    "w-full rounded-lg border p-1.5 text-left transition sm:p-3",
                    conversation.id === selectedId
                      ? "border-primary bg-primary/5 ring-2 ring-primary/10"
                      : "border-slate-200 bg-white hover:border-primary/40 hover:bg-slate-50"
                  )}
                  onClick={() => selectConversation(conversation.id)}
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-black leading-4 sm:text-sm sm:leading-5">
                        {conversation.customer?.companyName ??
                          conversation.customer?.email ??
                          conversation.subject ??
                          conversation.id}
                      </div>
                      <div className="line-clamp-1 text-[11px] font-semibold leading-4 text-slate-500 sm:mt-1 sm:line-clamp-2 sm:text-xs">
                        {conversation.subject ?? conversation.id}
                      </div>
                    </div>
                    {conversation.staffUnreadCount > 0 ? (
                      <Badge className="h-5 min-w-5 justify-center bg-red-500 px-1.5 text-[11px] text-white">
                        {conversation.staffUnreadCount}
                      </Badge>
                    ) : (
                      <StatusBadge status={conversation.status} />
                    )}
                  </div>
                  <div className="mt-1 flex min-w-0 items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 sm:mt-2 sm:text-xs">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <UserCheck className="size-3.5 shrink-0" />
                      <span className="truncate">
                      {conversation.assignee?.displayName ??
                        conversation.assignee?.email ??
                        copy.filters.unassigned}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {formatSupportTime(conversation.lastMessageAt ?? conversation.updatedAt, locale)}
                    </span>
                  </div>
                  <div className="mt-1 flex min-w-0 items-center gap-1 sm:hidden">
                    <SupportTaskBadge
                      conversation={conversation}
                      currentUserId={currentUserId}
                      text={copy}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </AdminBusyRegion>

        <AdminBusyRegion
          pending={isLoadingDetail}
          label={copy.loading}
          className="hidden min-h-0 rounded-lg border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.045)] lg:block"
          contentClassName="flex min-h-0 flex-col lg:h-full lg:min-h-[640px]"
        >
          {detail && selectedConversation ? (
            <>
              <div className="border-b border-slate-200 p-2 sm:p-4">
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2 xl:flex xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-black leading-5 sm:text-lg sm:leading-7">
                        {detail.conversation.customer?.companyName ??
                          detail.conversation.customer?.email ??
                          detail.conversation.subject ??
                          detail.conversation.id}
                      </h2>
                    </div>
                    <p className="truncate text-[11px] font-semibold leading-4 text-slate-500 sm:mt-1 sm:text-sm">
                      {detail.conversation.customer?.email ?? detail.conversation.customer?.phone ?? detail.conversation.id}
                    </p>
                  </div>
                  <StatusBadge status={detail.conversation.status} />
                </div>
                {detail.conversation.status === "open" ? (
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:mt-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 bg-white px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
                      disabled={pendingAction !== null}
                      onClick={() => void runAction("claim")}
                    >
                      <UserCheck className="size-4" />
                      {copy.actions.claim}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 bg-white px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
                      disabled={pendingAction !== null}
                      onClick={() => void runAction("resolve")}
                    >
                      <CheckCircle2 className="size-4" />
                      {copy.actions.resolve}
                    </Button>
                  </div>
                ) : detail.conversation.status === "resolved" ? (
                  <div className="mt-1.5 flex sm:mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 bg-white px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
                      disabled={pendingAction !== null}
                      onClick={() => void runAction("reopen")}
                    >
                      <RotateCcw className="size-4" />
                      {copy.actions.reopen}
                    </Button>
                  </div>
                ) : null}
                <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] gap-1.5 sm:mt-3 sm:gap-2">
                  <Select value={assignee} onValueChange={setAssignee}>
                    <SelectTrigger className="h-8 bg-white text-xs sm:h-9 sm:text-sm">
                      <SelectValue placeholder={copy.assignedTo} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={unassignedValue}>{copy.filters.unassigned}</SelectItem>
                      {employees.map((employee) => (
                        <SelectItem key={employee.userId} value={employee.userId}>
                          {employee.displayName ?? employee.email ?? employee.userId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
                    disabled={pendingAction !== null}
                    onClick={() =>
                      void runAction(
                        "assign",
                        assignee === unassignedValue ? null : assignee
                      )
                    }
                  >
                    {pendingAction === "assign" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <UserCheck className="size-4" />
                    )}
                    {copy.actions.assign}
                  </Button>
                </div>
              </div>

              <div className="max-h-[34svh] min-h-0 overflow-y-auto bg-slate-50 p-2 sm:flex-1 sm:p-4 lg:max-h-none">
                <div className="space-y-1 sm:space-y-2">
                  {detail.messages.map((message) => (
                    <SupportMessageBubble key={message.id} message={message} />
                  ))}
                </div>
              </div>

              <form className="border-t border-slate-200 p-2 sm:p-4" onSubmit={sendReply}>
                <Textarea
                  value={reply}
                  className="max-h-24 min-h-12 resize-none bg-white text-sm sm:max-h-32 sm:min-h-20"
                  maxLength={2000}
                  placeholder={copy.composerPlaceholder}
                  disabled={detail.conversation.status !== "open"}
                  onChange={(event) => setReply(event.target.value)}
                />
                <div className="mt-1.5 flex items-center justify-between gap-2 sm:mt-2">
                  <span className="text-xs font-semibold text-slate-400">
                    {reply.trim().length}/2000
                  </span>
                  <Button
                    type="submit"
                    className="h-8 px-3 text-xs sm:h-9 sm:text-sm"
                    disabled={
                      detail.conversation.status !== "open" ||
                      pendingAction !== null ||
                      reply.trim().length === 0
                    }
                  >
                    {pendingAction === "reply" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    {copy.actions.reply}
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="grid min-h-32 place-items-center p-4 text-center text-sm font-semibold text-slate-500 sm:min-h-[280px] sm:p-6 lg:min-h-[520px]">
              {copy.emptyConversation}
            </div>
          )}
        </AdminBusyRegion>
      </div>
      <Sheet open={mobileDetailOpen} onOpenChange={setMobileDetailOpen}>
        <SheetContent
          side="bottom"
          className="h-[88svh] gap-0 overflow-hidden rounded-t-2xl p-0 lg:hidden"
        >
          {detail && selectedConversation ? (
            <MobileSupportDetail
              assignee={assignee}
              copy={copy}
              currentUserId={currentUserId}
              detail={detail}
              detailView={detailView}
              locale={locale}
              pendingAction={pendingAction}
              reply={reply}
              employees={employees}
              onAssigneeChange={setAssignee}
              onDetailViewChange={setDetailView}
              onReplyChange={setReply}
              onRunAction={runAction}
              onSendReply={sendReply}
            />
          ) : (
            <div className="grid min-h-64 place-items-center p-6 text-center text-sm font-semibold text-slate-500">
              {isLoadingDetail ? copy.loading : copy.emptyConversation}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function MobileInboxModeButton({
  active,
  count,
  disabled = false,
  label,
  onClick,
  tone = "neutral",
}: {
  active: boolean;
  count: number;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  tone?: "hot" | "neutral";
}) {
  return (
    <button
      type="button"
      className={cn(
        "min-w-0 rounded-md border px-1.5 py-0.5 text-left transition",
        active
          ? tone === "hot"
            ? "border-red-300 bg-red-50 text-red-700 ring-2 ring-red-100"
            : "border-primary bg-primary/5 text-primary ring-2 ring-primary/10"
          : "border-slate-200 bg-slate-50 text-slate-700",
        disabled && "cursor-not-allowed opacity-50"
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <div className="truncate text-[9px] font-bold leading-3 text-current/70">
        {label}
      </div>
      <div className="text-[13px] font-black leading-4">{count}</div>
    </button>
  );
}

function MobileSupportDetail({
  assignee,
  copy,
  currentUserId,
  detail,
  detailView,
  employees,
  locale,
  onAssigneeChange,
  onDetailViewChange,
  onReplyChange,
  onRunAction,
  onSendReply,
  pendingAction,
  reply,
}: {
  assignee: string;
  copy: SupportPanelCopy;
  currentUserId?: string | null;
  detail: SupportDetail;
  detailView: DetailView;
  employees: EmployeeOption[];
  locale: string;
  onAssigneeChange: (value: string) => void;
  onDetailViewChange: (value: DetailView) => void;
  onReplyChange: (value: string) => void;
  onRunAction: (
    action: "assign" | "claim" | "mark_read" | "reopen" | "resolve",
    assignedTo?: string | null
  ) => Promise<void>;
  onSendReply: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  pendingAction: string | null;
  reply: string;
}) {
  const conversation = detail.conversation;
  const canReply = conversation.status === "open";
  const hasStaffUnread = conversation.staffUnreadCount > 0;
  const title =
    conversation.customer?.companyName ??
    conversation.customer?.email ??
    conversation.subject ??
    conversation.id;
  const subtitle =
    conversation.customer?.email ??
    conversation.customer?.phone ??
    conversation.subject ??
    conversation.id;

  return (
    <>
      <div className="border-b border-slate-200 p-3 pr-12">
        <SheetTitle className="truncate text-base font-black leading-6">
          {title}
        </SheetTitle>
        <SheetDescription className="truncate text-xs font-semibold text-slate-500">
          {subtitle}
        </SheetDescription>
        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
          <StatusBadge status={conversation.status} />
          <SupportTaskBadge
            conversation={conversation}
            currentUserId={currentUserId}
            text={copy}
          />
          <Badge className="h-5 max-w-full truncate border-slate-200 bg-slate-50 px-1.5 text-[11px] text-slate-600" variant="outline">
            {conversation.assignee?.displayName ??
              conversation.assignee?.email ??
              copy.filters.unassigned}
          </Badge>
          <span className="ml-auto shrink-0 text-[11px] font-bold text-slate-400">
            {formatSupportTime(conversation.lastMessageAt ?? conversation.updatedAt, locale)}
          </span>
        </div>
      </div>

      <div className="border-b border-slate-200 p-2">
        {conversation.status === "open" ? (
          <div className={cn("grid gap-1.5", hasStaffUnread ? "grid-cols-3" : "grid-cols-2")}>
            <Button
              type="button"
              variant="outline"
              className="h-8 bg-white px-2 text-xs"
              disabled={pendingAction !== null}
              onClick={() => void onRunAction("claim")}
            >
              <UserCheck className="size-4" />
              {copy.actions.claim}
            </Button>
            {hasStaffUnread ? (
              <Button
                type="button"
                variant="outline"
                className="h-8 bg-white px-2 text-xs"
                disabled={pendingAction !== null}
                onClick={() => void onRunAction("mark_read")}
              >
                <CheckCircle2 className="size-4" />
                {copy.actions.markRead}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="h-8 bg-white px-2 text-xs"
              disabled={pendingAction !== null}
              onClick={() => void onRunAction("resolve")}
            >
              <CheckCircle2 className="size-4" />
              {copy.actions.resolve}
            </Button>
          </div>
        ) : conversation.status === "resolved" ? (
          <Button
            type="button"
            variant="outline"
            className="h-8 bg-white px-2 text-xs"
            disabled={pendingAction !== null}
            onClick={() => void onRunAction("reopen")}
          >
            <RotateCcw className="size-4" />
            {copy.actions.reopen}
          </Button>
        ) : null}

        <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] gap-1.5">
          <Select value={assignee} onValueChange={onAssigneeChange}>
            <SelectTrigger className="h-8 bg-white text-xs">
              <SelectValue placeholder={copy.assignedTo} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={unassignedValue}>{copy.filters.unassigned}</SelectItem>
              {employees.map((employee) => (
                <SelectItem key={employee.userId} value={employee.userId}>
                  {employee.displayName ?? employee.email ?? employee.userId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            className="h-8 px-2 text-xs"
            disabled={pendingAction !== null}
            onClick={() =>
              void onRunAction("assign", assignee === unassignedValue ? null : assignee)
            }
          >
            {pendingAction === "assign" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserCheck className="size-4" />
            )}
            {copy.actions.assign}
          </Button>
        </div>
      </div>

      <Tabs
        value={detailView}
        onValueChange={(value) => onDetailViewChange(value as DetailView)}
        className="min-h-0 flex-1 gap-0"
      >
        <div className="border-b border-slate-200 p-2">
          <TabsList className="grid h-8 w-full grid-cols-2 bg-slate-100">
            <TabsTrigger value="messages" className="text-xs">
              {copy.tabs.messages}
              <span className="ml-1 text-[10px] text-slate-400">
                {detail.messages.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              {copy.tabs.history}
              <span className="ml-1 text-[10px] text-slate-400">
                {detail.events.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent
          value="messages"
          className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-2 data-[state=inactive]:hidden"
        >
          <div className="space-y-1">
            {detail.messages.map((message) => (
              <SupportMessageBubble key={message.id} message={message} />
            ))}
          </div>
        </TabsContent>
        <TabsContent
          value="history"
          className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-2 data-[state=inactive]:hidden"
        >
          {detail.events.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-sm font-semibold text-slate-500">
              {copy.historyEmpty}
            </div>
          ) : (
            <div className="space-y-1.5">
              {[...detail.events].reverse().map((event) => (
                <SupportEventItem
                  key={event.id}
                  event={event}
                  locale={locale}
                  text={copy}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {detailView === "messages" ? (
        <form className="border-t border-slate-200 bg-white p-2" onSubmit={onSendReply}>
          <Textarea
            value={reply}
            className="max-h-24 min-h-12 resize-none bg-white text-sm"
            maxLength={2000}
            placeholder={copy.composerPlaceholder}
            disabled={!canReply}
            onChange={(event) => onReplyChange(event.target.value)}
          />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-400">
              {reply.trim().length}/2000
            </span>
            <Button
              type="submit"
              className="h-8 px-3 text-xs"
              disabled={!canReply || pendingAction !== null || reply.trim().length === 0}
            >
              {pendingAction === "reply" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {copy.actions.reply}
            </Button>
          </div>
        </form>
      ) : null}
    </>
  );
}

function SupportTaskBadge({
  conversation,
  currentUserId,
  text,
}: {
  conversation: SupportConversation;
  currentUserId?: string | null;
  text: SupportPanelCopy;
}) {
  const task = getSupportTask(conversation, currentUserId, text);

  return (
    <Badge
      className={cn(
        "h-5 gap-1 px-1.5 text-[11px]",
        task.tone === "hot"
          ? "border-red-200 bg-red-50 text-red-700"
          : task.tone === "warning"
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-slate-200 bg-slate-50 text-slate-600"
      )}
      variant="outline"
    >
      {task.label}
    </Badge>
  );
}

function SupportEventItem({
  event,
  locale,
  text,
}: {
  event: SupportEvent;
  locale: string;
  text: SupportPanelCopy;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="truncate text-xs font-black text-slate-800">
          {formatSupportEventLabel(event.eventType, text)}
        </div>
        <div className="shrink-0 text-[11px] font-semibold text-slate-400">
          {formatSupportTime(event.createdAt, locale)}
        </div>
      </div>
      <div className="mt-1 truncate text-[11px] font-semibold text-slate-500">
        {event.actor?.displayName ?? event.actor?.email ?? event.actorId ?? "system"}
      </div>
      {event.note ? (
        <div className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
          {event.note}
        </div>
      ) : null}
    </div>
  );
}

function SupportMessageBubble({ message }: { message: SupportMessage }) {
  const isCustomer = message.senderType === "customer";
  const isSystem = message.senderType === "system";

  return (
    <div
      className={cn(
        "flex min-w-0",
        isSystem ? "justify-center" : isCustomer ? "justify-start" : "justify-end"
      )}
    >
      <div
        className={cn(
          "max-w-[88%] whitespace-pre-wrap break-words rounded-lg px-2.5 py-1.5 text-xs leading-4 sm:max-w-[78%] sm:px-3 sm:py-2 sm:text-sm sm:leading-5",
          isSystem
            ? "bg-slate-200 text-xs font-semibold text-slate-600"
            : isCustomer
              ? "border border-slate-200 bg-white text-slate-800"
              : "bg-primary text-white"
        )}
      >
        <div>{message.body}</div>
        <div className={cn("mt-1 text-[10px] sm:text-[11px]", isCustomer ? "text-slate-400" : "text-white/65")}>
          {message.sender?.displayName ?? message.sender?.email ?? message.senderType}
        </div>
      </div>
    </div>
  );
}

function formatSupportTime(value: string | null, locale: string) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "it-IT", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(date);
}

function getSupportPriority(
  conversation: SupportConversation,
  currentUserId?: string | null
) {
  if (conversation.staffUnreadCount > 0) {
    return 0;
  }

  if (!conversation.assignedTo) {
    return 1;
  }

  if (currentUserId && conversation.assignedTo === currentUserId) {
    return 2;
  }

  return 3;
}

function getSupportTask(
  conversation: SupportConversation,
  currentUserId: string | null | undefined,
  text: SupportPanelCopy
) {
  if (conversation.status === "resolved") {
    return { label: text.filters.resolved, tone: "neutral" as const };
  }

  if (conversation.status === "archived") {
    return { label: text.filters.archived, tone: "neutral" as const };
  }

  if (conversation.staffUnreadCount > 0) {
    return { label: text.tasks.needsReply, tone: "hot" as const };
  }

  if (!conversation.assignedTo) {
    return { label: text.tasks.unassigned, tone: "warning" as const };
  }

  if (currentUserId && conversation.assignedTo === currentUserId) {
    return { label: text.tasks.mine, tone: "neutral" as const };
  }

  return { label: text.tasks.inProgress, tone: "neutral" as const };
}

function formatSupportEventLabel(eventType: string, text: SupportPanelCopy) {
  switch (eventType) {
    case "assigned":
      return text.events.assigned;
    case "claimed":
      return text.events.claimed;
    case "created":
      return text.events.created;
    case "customer_message":
      return text.events.customerMessage;
    case "read":
      return text.events.read;
    case "reopened":
      return text.events.reopened;
    case "resolved":
      return text.events.resolved;
    case "staff_message":
      return text.events.staffMessage;
    default:
      return text.events.systemNote;
  }
}

function StatusBadge({ status }: { status: Exclude<SupportStatus, "all"> }) {
  if (status === "resolved") {
    return (
      <Badge className="h-5 gap-1 border-emerald-200 bg-emerald-50 px-1.5 text-[11px] text-emerald-700" variant="outline">
        <CheckCircle2 className="size-3" />
        resolved
      </Badge>
    );
  }

  if (status === "archived") {
    return (
      <Badge className="h-5 border-slate-200 bg-slate-50 px-1.5 text-[11px] text-slate-600" variant="outline">
        archived
      </Badge>
    );
  }

  return (
    <Badge className="h-5 gap-1 border-sky-200 bg-sky-50 px-1.5 text-[11px] text-sky-700" variant="outline">
      <CircleDot className="size-3" />
      open
    </Badge>
  );
}

function notifyStaff(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const notification = new Notification(title, { body });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}

function readConversations(payload: unknown): SupportConversation[] {
  const data = isRecord(payload) ? payload.data : null;

  return Array.isArray(data)
    ? data.map(readConversation).filter((conversation): conversation is SupportConversation => Boolean(conversation))
    : [];
}

function readDetail(payload: unknown): SupportDetail {
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null;
  const conversation = isRecord(data?.conversation)
    ? readConversation(data.conversation)
    : null;
  const messages = Array.isArray(data?.messages)
    ? data.messages.map(readMessage).filter((message): message is SupportMessage => Boolean(message))
    : [];
  const events = Array.isArray(data?.events)
    ? data.events.map(readEvent).filter((event): event is SupportEvent => Boolean(event))
    : [];

  if (!conversation) {
    throw new Error("Support detail payload is invalid.");
  }

  return { conversation, events, messages };
}

function readEmployees(payload: unknown): EmployeeOption[] {
  const data = isRecord(payload) ? payload.data : null;

  return Array.isArray(data)
    ? data.map(readEmployee).filter((employee): employee is EmployeeOption => Boolean(employee))
    : [];
}

function readConversation(value: unknown): SupportConversation | null {
  if (!isRecord(value) || typeof value.id !== "string") {
    return null;
  }

  return {
    assignedTo: readString(value.assignedTo),
    assignee: readActor(value.assignee),
    createdAt: readString(value.createdAt) ?? "",
    customer: readCustomer(value.customer),
    customerUnreadCount: readNumber(value.customerUnreadCount),
    id: value.id,
    lastCustomerMessageAt: readString(value.lastCustomerMessageAt),
    lastMessageAt: readString(value.lastMessageAt),
    lastStaffMessageAt: readString(value.lastStaffMessageAt),
    staffUnreadCount: readNumber(value.staffUnreadCount),
    status:
      value.status === "resolved" || value.status === "archived"
        ? value.status
        : "open",
    subject: readString(value.subject),
    updatedAt: readString(value.updatedAt) ?? "",
  };
}

function readMessage(value: unknown): SupportMessage | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.body !== "string") {
    return null;
  }

  return {
    body: value.body,
    createdAt: readString(value.createdAt) ?? "",
    id: value.id,
    sender: readActor(value.sender),
    senderType:
      value.senderType === "staff" || value.senderType === "system"
        ? value.senderType
        : "customer",
  };
}

function readEvent(value: unknown): SupportEvent | null {
  if (!isRecord(value) || typeof value.id !== "string") {
    return null;
  }

  return {
    actor: readActor(value.actor),
    actorId: readString(value.actorId),
    conversationId: readString(value.conversationId) ?? "",
    createdAt: readString(value.createdAt) ?? "",
    eventType: readString(value.eventType) ?? "system_note",
    fromAssignee: readString(value.fromAssignee),
    fromStatus: readString(value.fromStatus),
    id: value.id,
    note: readString(value.note),
    toAssignee: readString(value.toAssignee),
    toStatus: readString(value.toStatus),
  };
}

function readEmployee(value: unknown): EmployeeOption | null {
  if (!isRecord(value) || typeof value.userId !== "string") {
    return null;
  }

  return {
    displayName: readString(value.displayName),
    email: readString(value.email),
    roleTemplate: readString(value.roleTemplate),
    userId: value.userId,
  };
}

function readActor(value: unknown): SupportActor | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    displayName: readString(value.displayName),
    email: readString(value.email),
    id: readString(value.id),
  };
}

function readCustomer(value: unknown): SupportCustomer | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    companyName: readString(value.companyName),
    email: readString(value.email),
    id: readString(value.id),
    phone: readString(value.phone),
  };
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
