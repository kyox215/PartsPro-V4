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

type SupportDetail = {
  conversation: SupportConversation;
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

const unassignedValue = "__unassigned__";

const supportCopy = {
  it: {
    actions: {
      assign: "Assegna",
      claim: "Prendi in carico",
      enableNotifications: "Attiva notifiche",
      refresh: "Aggiorna",
      reopen: "Riapri",
      reply: "Rispondi",
      resolve: "Risolvi",
    },
    assignedTo: "Responsabile",
    composerPlaceholder: "Scrivi una risposta al cliente...",
    emptyConversation: "Seleziona una conversazione dalla coda.",
    emptyQueue: "Nessuna conversazione in questa vista.",
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
    title: "Assistenza clienti",
    unavailable: "Assistenza temporaneamente non disponibile.",
  },
  zh: {
    actions: {
      assign: "转派",
      claim: "认领",
      enableNotifications: "启用通知",
      refresh: "刷新",
      reopen: "重开",
      reply: "回复",
      resolve: "解决",
    },
    assignedTo: "负责人",
    composerPlaceholder: "回复客户...",
    emptyConversation: "从左侧选择一个会话。",
    emptyQueue: "当前筛选下没有会话。",
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
    title: "客户客服",
    unavailable: "客服暂时不可用。",
  },
};

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
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [detail, setDetail] = React.useState<SupportDetail | null>(null);
  const [employees, setEmployees] = React.useState<EmployeeOption[]>([]);
  const [assignee, setAssignee] = React.useState(unassignedValue);
  const [reply, setReply] = React.useState("");
  const [isLoadingList, setIsLoadingList] = React.useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(
    () => "Notification" in globalThis && Notification.permission === "granted"
  );
  const effectiveScope = !currentUserId && scope === "mine" ? "all" : scope;

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
  }, [copy.notificationBody, copy.notificationTitle, refreshDetail, refreshList, selectedId]);

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
    conversations.find((conversation) => conversation.id === selectedId) ?? null;

  return (
    <section className="min-w-0 space-y-3">
      <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-[0_12px_32px_rgba(15,23,42,0.045)] sm:flex-row sm:items-start sm:justify-between sm:p-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <MessageCircle className="size-4" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black">{copy.title}</h1>
              <p className="truncate text-sm font-semibold text-slate-500">
                {copy.subtitle}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="bg-white"
            onClick={() => void refreshList()}
          >
            <RefreshCw className={cn("size-4", isLoadingList && "animate-spin")} />
            {copy.actions.refresh}
          </Button>
          {"Notification" in globalThis && !notificationsEnabled ? (
            <Button type="button" variant="outline" className="bg-white" onClick={enableNotifications}>
              <Bell className="size-4" />
              {copy.actions.enableNotifications}
            </Button>
          ) : null}
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

      <div className="grid min-h-[640px] min-w-0 gap-3 lg:grid-cols-[360px_minmax(0,1fr)]">
        <AdminBusyRegion
          pending={isLoadingList}
          label={copy.loading}
          className="min-h-0 rounded-lg border border-slate-200 bg-white p-3 shadow-[0_12px_32px_rgba(15,23,42,0.045)]"
        >
          <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
            <h2 className="truncate text-sm font-black">{copy.queueTitle}</h2>
            <Badge variant="outline">{conversations.length}</Badge>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Select value={status} onValueChange={(value) => setStatus(value as SupportStatus)}>
              <SelectTrigger size="sm" className="bg-white">
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
              <SelectTrigger size="sm" className="bg-white">
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

          {isLoadingList && conversations.length === 0 ? (
            <AdminSkeletonRows rows={6} />
          ) : conversations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">
              {copy.emptyQueue}
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition",
                    conversation.id === selectedId
                      ? "border-primary bg-primary/5 ring-2 ring-primary/10"
                      : "border-slate-200 bg-white hover:border-primary/40 hover:bg-slate-50"
                  )}
                  onClick={() => setSelectedId(conversation.id)}
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black">
                        {conversation.customer?.companyName ??
                          conversation.customer?.email ??
                          conversation.subject ??
                          conversation.id}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">
                        {conversation.subject ?? conversation.id}
                      </div>
                    </div>
                    {conversation.staffUnreadCount > 0 ? (
                      <Badge className="bg-red-500 text-white">
                        {conversation.staffUnreadCount}
                      </Badge>
                    ) : (
                      <StatusBadge status={conversation.status} />
                    )}
                  </div>
                  <div className="mt-2 flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-500">
                    <UserCheck className="size-3.5 shrink-0" />
                    <span className="truncate">
                      {conversation.assignee?.displayName ??
                        conversation.assignee?.email ??
                        copy.filters.unassigned}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </AdminBusyRegion>

        <AdminBusyRegion
          pending={isLoadingDetail}
          label={copy.loading}
          className="min-h-0 rounded-lg border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.045)]"
          contentClassName="flex h-full min-h-[640px] flex-col"
        >
          {detail && selectedConversation ? (
            <>
              <div className="border-b border-slate-200 p-3 sm:p-4">
                <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-black">
                        {detail.conversation.customer?.companyName ??
                          detail.conversation.customer?.email ??
                          detail.conversation.subject ??
                          detail.conversation.id}
                      </h2>
                      <StatusBadge status={detail.conversation.status} />
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-500">
                      {detail.conversation.customer?.email ?? detail.conversation.customer?.phone ?? detail.conversation.id}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {detail.conversation.status === "open" ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          className="bg-white"
                          disabled={pendingAction !== null}
                          onClick={() => void runAction("claim")}
                        >
                          <UserCheck className="size-4" />
                          {copy.actions.claim}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="bg-white"
                          disabled={pendingAction !== null}
                          onClick={() => void runAction("resolve")}
                        >
                          <CheckCircle2 className="size-4" />
                          {copy.actions.resolve}
                        </Button>
                      </>
                    ) : detail.conversation.status === "resolved" ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="bg-white"
                        disabled={pendingAction !== null}
                        onClick={() => void runAction("reopen")}
                      >
                        <RotateCcw className="size-4" />
                        {copy.actions.reopen}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <Select value={assignee} onValueChange={setAssignee}>
                    <SelectTrigger className="bg-white">
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

              <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-3 sm:p-4">
                <div className="space-y-2">
                  {detail.messages.map((message) => (
                    <SupportMessageBubble key={message.id} message={message} />
                  ))}
                </div>
              </div>

              <form className="border-t border-slate-200 p-3 sm:p-4" onSubmit={sendReply}>
                <Textarea
                  value={reply}
                  className="max-h-32 min-h-20 resize-none bg-white text-sm"
                  maxLength={2000}
                  placeholder={copy.composerPlaceholder}
                  disabled={detail.conversation.status !== "open"}
                  onChange={(event) => setReply(event.target.value)}
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-400">
                    {reply.trim().length}/2000
                  </span>
                  <Button
                    type="submit"
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
            <div className="grid min-h-[520px] place-items-center p-6 text-center text-sm font-semibold text-slate-500">
              {copy.emptyConversation}
            </div>
          )}
        </AdminBusyRegion>
      </div>
    </section>
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
          "max-w-[78%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm leading-5",
          isSystem
            ? "bg-slate-200 text-xs font-semibold text-slate-600"
            : isCustomer
              ? "border border-slate-200 bg-white text-slate-800"
              : "bg-primary text-white"
        )}
      >
        <div>{message.body}</div>
        <div className={cn("mt-1 text-[11px]", isCustomer ? "text-slate-400" : "text-white/65")}>
          {message.sender?.displayName ?? message.sender?.email ?? message.senderType}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Exclude<SupportStatus, "all"> }) {
  if (status === "resolved") {
    return (
      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">
        <CheckCircle2 className="size-3" />
        resolved
      </Badge>
    );
  }

  if (status === "archived") {
    return (
      <Badge className="border-slate-200 bg-slate-50 text-slate-600" variant="outline">
        archived
      </Badge>
    );
  }

  return (
    <Badge className="border-sky-200 bg-sky-50 text-sky-700" variant="outline">
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

  if (!conversation) {
    throw new Error("Support detail payload is invalid.");
  }

  return { conversation, messages };
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
