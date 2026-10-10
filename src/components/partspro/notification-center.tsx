"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellRing,
  Check,
  Loader2,
  Send,
  Smartphone,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useI18n } from "./i18n-provider";
import { AdminNotice } from "./admin-feedback";

type NotificationAudience = "customer" | "staff";

type NotificationItem = {
  audience: NotificationAudience | null;
  body: string;
  createdAt: string;
  eventType: string;
  id: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  sourceAction: string | null;
  targetPath: string;
  title: string;
};

type NotificationPayload = {
  notifications: NotificationItem[];
  unreadCount: number;
  hasMore: boolean;
  nextCursor: { beforeCreatedAt: string; beforeId: string } | null;
};

type NotificationSummaryPayload = {
  latestCreatedAt: string | null;
  unreadCount: number;
};

type NotificationCenterProps = {
  audience: NotificationAudience;
  className?: string;
};

const copy = {
  it: {
    browserDenied: "Notifiche bloccate dal browser",
    browserError: "Notifiche non salvate",
    browserReady: "Il browser consente le notifiche",
    browserUnsupported: "Notifiche push non supportate",
    enable: "Attiva",
    empty: "Nessuna notifica",
    iosHint: "Su iPhone apri dal sito installato nella schermata Home.",
    loading: "Caricamento...",
    markAll: "Segna lette",
    notifications: "Notifiche",
    permissionDefault: "Non attive",
    permissionPromptBody:
      "Ricevi avvisi per nuovi ordini, messaggi e aggiornamenti anche senza tenere aperta questa pagina.",
    permissionPromptEnable: "Attiva notifiche",
    permissionPromptIosBody:
      "Su iPhone aggiungi PartsPro alla schermata Home e riaprilo da lì per attivare le notifiche.",
    permissionPromptIosTitle: "Apri PartsPro dalla schermata Home",
    permissionPromptLater: "Più tardi",
    permissionPromptOk: "Ho capito",
    permissionPromptTitle: "Attiva le notifiche PartsPro",
    pushUnavailable: "Chiavi push non configurate",
    sendTest: "Test",
    testSent: "Test inviato",
    unread: "non lette",
    readError: "Impossibile leggere le notifiche. I dati precedenti restano visibili.",
    actionError: "Operazione non completata. Riprova o aggiorna le notifiche.",
    unknown: "Esito non verificabile. Aggiorna e controlla le notifiche prima di ripetere l'azione.",
    readDone: "Notifiche segnate come lette.",
    savedReadError: "Operazione confermata; la lettura non è riuscita. Aggiorna senza ripetere l'invio.",
    testLocal: "Test creato nelle notifiche del sito; consegna al dispositivo non confermata.",
    refresh: "Aggiorna", more: "Carica altre", pending: "Operazione in corso...",
    refreshed: "Notifiche aggiornate. Controlla l'esito prima di ripetere l'azione.",
    navigationBusy: "Attendi il completamento dell'operazione aperta.",
    unsavedLeave: "Ci sono modifiche non salvate. Vuoi lasciarle per aprire la notifica?",
    invalidTarget: "Il collegamento della notifica non è disponibile.",
  },
  zh: {
    browserDenied: "浏览器已阻止通知",
    browserError: "通知保存失败",
    browserReady: "浏览器已允许通知",
    browserUnsupported: "当前浏览器不支持推送",
    enable: "开启",
    empty: "暂无通知",
    iosHint: "iPhone 需要从已添加到主屏幕的网站打开。",
    loading: "加载中...",
    markAll: "全部已读",
    notifications: "通知",
    permissionDefault: "未开启",
    permissionPromptBody:
      "开启后可以收到新订单、客服消息和订单跟进提醒，不需要一直打开页面。",
    permissionPromptEnable: "开启通知",
    permissionPromptIosBody:
      "iPhone 需要先把 PartsPro 添加到主屏幕，再从主屏幕打开网站开启通知。",
    permissionPromptIosTitle: "从主屏幕打开 PartsPro",
    permissionPromptLater: "稍后再说",
    permissionPromptOk: "知道了",
    permissionPromptTitle: "开启 PartsPro 通知",
    pushUnavailable: "推送密钥未配置",
    sendTest: "测试",
    testSent: "测试已发送",
    unread: "未读",
    readError: "通知读取失败，原有内容继续保留。",
    actionError: "操作未完成，请重试或刷新通知。",
    unknown: "结果尚未核对，请刷新并检查通知后再重复操作。",
    readDone: "通知已标为已读。",
    savedReadError: "操作已确认，通知读取失败；请刷新，不要重复提交。",
    testLocal: "站内测试通知已创建，设备推送尚未确认。",
    refresh: "刷新", more: "加载更早通知", pending: "正在处理...",
    refreshed: "通知已重新读取，请核对结果后再重复操作。",
    navigationBusy: "请等待当前操作完成后再打开通知。",
    unsavedLeave: "有未保存的修改。是否放弃这些修改并打开通知？",
    invalidTarget: "通知目标链接暂不可用。",
  },
};

const NOTIFICATION_PROMPT_SESSION_KEY =
  "partspro:notification-permission-prompt:v1";
const notificationSummaryPollMs = 150_000;

export function NotificationCenter({
  audience,
  className,
}: NotificationCenterProps) {
  const router = useRouter();
  const { locale } = useI18n();
  const text = locale === "zh-CN" ? copy.zh : copy.it;
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [busyAction, setBusyAction] = React.useState<string | null>(null);
  const [readError, setReadError] = React.useState(false);
  const [notice, setNotice] = React.useState<{ tone: "info" | "success" | "warning" | "error"; message: string } | null>(null);
  const [requiresReview, setRequiresReview] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(false);
  const nextCursorRef = React.useRef<NotificationPayload["nextCursor"]>(null);
  const notificationRequestRef = React.useRef<{ sequence: number; controller: AbortController | null }>({ sequence: 0, controller: null });
  const notificationActionRef = React.useRef(false);
  const summarySequenceRef = React.useRef(0);
  const [pushState, setPushState] = React.useState<
    "checking" | "unsupported" | "default" | "denied" | "granted" | "unconfigured" | "error"
  >("checking");
  const [isIosStandaloneMissing, setIsIosStandaloneMissing] =
    React.useState(false);
  const [permissionPromptOpen, setPermissionPromptOpen] =
    React.useState(false);
  const [permissionPromptKind, setPermissionPromptKind] = React.useState<
    "enable" | "ios" | null
  >(null);

  const loadNotificationSummary = React.useCallback(async () => {
    const sequence = ++summarySequenceRef.current;
    try {
      const response = await fetch("/api/notifications/summary", {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      });

      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      const data = readNotificationSummaryPayload(payload);
      if (sequence === summarySequenceRef.current) setUnreadCount(data.unreadCount);
    } catch {
      // Summary refresh is best-effort; the full popover load still reports errors.
    }
  }, []);

  const loadNotifications = React.useCallback(async (options: { append?: boolean; verify?: boolean } = {}) => {
    const cursor = options.append ? nextCursorRef.current : null;
    if (options.append && !cursor) return false;
    notificationRequestRef.current.controller?.abort();
    const controller = new AbortController();
    const sequence = ++notificationRequestRef.current.sequence;
    notificationRequestRef.current.controller = controller;
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    setLoading(true);
    setReadError(false);

    try {
      const params = new URLSearchParams({ limit: "20", ...(cursor ?? {}) });
      const response = await fetch(`/api/notifications?${params.toString()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) throw new Error("Notification read failed.");

      const payload = await response.json();
      const data = readNotificationPayload(payload);
      if (sequence !== notificationRequestRef.current.sequence) return false;
      setItems(current => options.append ? mergeNotificationItems(current, data.notifications) : data.notifications);
      setUnreadCount(data.unreadCount);
      setHasMore(data.hasMore);
      nextCursorRef.current = data.nextCursor;
      if (options.verify) {
        setRequiresReview(false);
        setNotice({ tone: "info", message: text.refreshed });
      }
      return true;
    } catch {
      if (sequence === notificationRequestRef.current.sequence) setReadError(true);
      return false;
    } finally {
      window.clearTimeout(timeout);
      if (sequence === notificationRequestRef.current.sequence) setLoading(false);
    }
  }, [text.refreshed]);

  React.useEffect(() => () => {
    notificationRequestRef.current.sequence++;
    notificationRequestRef.current.controller?.abort();
  }, []);

  React.useEffect(() => {
    let disposed = false;

    function refreshVisibleSummary() {
      if (disposed || document.visibilityState === "hidden") {
        return;
      }

      void loadNotificationSummary();
    }

    const timeoutId = window.setTimeout(refreshVisibleSummary, 0);
    const intervalId = window.setInterval(() => {
      refreshVisibleSummary();
    }, notificationSummaryPollMs);

    document.addEventListener("visibilitychange", refreshVisibleSummary);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", refreshVisibleSummary);
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [loadNotificationSummary]);

  React.useEffect(() => {
    if (!popoverOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadNotifications, popoverOpen]);

  React.useEffect(() => {
    let isActive = true;
    const timeoutId = window.setTimeout(() => {
      const isIos =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      const iosStandaloneMissing = isIos && !isStandalone;

      if (isActive) {
        setIsIosStandaloneMissing(iosStandaloneMissing);
      }

      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (isActive) {
          setPushState("unsupported");
        }
        return;
      }

      if (!("Notification" in window)) {
        if (isActive) {
          setPushState("unsupported");
        }
        return;
      }

      void navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });

      void (async () => {
        const publicKey = await readPushPublicKey();

        if (!isActive) {
          return;
        }

        if (publicKey === null) {
          setPushState("unconfigured");
          return;
        }

        setPushState(Notification.permission);
      })();
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, []);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (hasSeenNotificationPermissionPrompt()) {
        return;
      }

      if (
        isIosStandaloneMissing &&
        pushState !== "granted" &&
        pushState !== "denied" &&
        pushState !== "checking"
      ) {
        markNotificationPermissionPromptSeen();
        setPermissionPromptKind("ios");
        setPermissionPromptOpen(true);
        return;
      }

      if (pushState === "default" && !isIosStandaloneMissing) {
        markNotificationPermissionPromptSeen();
        setPermissionPromptKind("enable");
        setPermissionPromptOpen(true);
      }
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [isIosStandaloneMissing, pushState]);

  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const listener = (event: MessageEvent) => {
      if (!isRecord(event.data) || event.data.type !== "partspro-notification-open") {
        return;
      }

      const url = typeof event.data.url === "string" ? event.data.url : "/";
      try {
        const target = new URL(url, window.location.origin);
        if (target.origin === window.location.origin && canLeaveForNotification(text)) {
          router.push(`${target.pathname}${target.search}${target.hash}`);
        }
      } catch { setNotice({ tone: "error", message: text.invalidTarget }); }
    };

    navigator.serviceWorker.addEventListener("message", listener);

    return () => {
      navigator.serviceWorker.removeEventListener("message", listener);
    };
  }, [router, text]);

  async function enablePush() {
    if (notificationActionRef.current) return false;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setPushState("unsupported");
      return false;
    }

    notificationActionRef.current = true;
    setBusyAction("enable");

    try {
      const configResponse = await fetch("/api/notifications/config", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const configPayload = configResponse.ok ? await configResponse.json() : null;
      const publicKey = readPushPublicKeyFromPayload(configPayload);

      if (!publicKey) {
        setPushState("unconfigured");
        return false;
      }

      const permission = await Notification.requestPermission();
      setPushState(permission);

      if (permission !== "granted") {
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      const reusableSubscription =
        existingSubscription &&
        pushSubscriptionKeyMatches(existingSubscription, applicationServerKey)
          ? existingSubscription
          : null;

      if (existingSubscription && !reusableSubscription) {
        await existingSubscription.unsubscribe().catch(() => false);
      }

      const subscription =
        reusableSubscription ??
        (await registration.pushManager.subscribe({
          applicationServerKey,
          userVisibleOnly: true,
        }));

      const saveResponse = await fetch("/api/notifications/subscriptions", {
        body: JSON.stringify({
          browser: detectBrowser(),
          platform: navigator.platform || null,
          scope: registration.scope,
          subscription: subscription.toJSON(),
        }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!saveResponse.ok) {
        setPushState("error");
        return false;
      }

      setPushState("granted");

      if (popoverOpen) {
        await loadNotifications();
      } else {
        await loadNotificationSummary();
      }

      return true;
    } catch {
      setPushState("error");
      return false;
    } finally {
      notificationActionRef.current = false;
      setBusyAction(null);
    }
  }

  async function handlePermissionPromptEnable() {
    if (await enablePush()) {
      setPermissionPromptOpen(false);
      setPermissionPromptKind(null);
    }
  }

  function closePermissionPrompt() {
    markNotificationPermissionPromptSeen();
    setPermissionPromptOpen(false);
    setPermissionPromptKind(null);
  }

  async function markAllRead() {
    if (notificationActionRef.current || requiresReview) return;
    notificationActionRef.current = true;
    summarySequenceRef.current++;
    setBusyAction("read");

    try {
      await notificationActionRequest("/api/notifications/read", {
        body: JSON.stringify({}),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const refreshed = await loadNotifications();
      setRequiresReview(!refreshed);
      setNotice({ tone: refreshed ? "success" : "warning", message: refreshed ? text.readDone : text.savedReadError });
    } catch (error) {
      const unknown = error instanceof NotificationActionError && error.unknown;
      setRequiresReview(unknown);
      setNotice({ tone: unknown ? "warning" : "error", message: unknown ? text.unknown : text.actionError });
    } finally {
      notificationActionRef.current = false;
      setBusyAction(null);
    }
  }

  async function sendTest() {
    if (notificationActionRef.current || requiresReview) return;
    notificationActionRef.current = true;
    setBusyAction("test");

    try {
      const result = await notificationActionRequest("/api/notifications/test", {
        cache: "no-store",
        method: "POST",
      });
      const refreshed = await loadNotifications();
      setRequiresReview(!refreshed);
      const delivered = Number(result.pushDeliveredCount) > 0 && Number(result.pushFailedCount) === 0;
      setNotice({ tone: refreshed && delivered ? "success" : "warning", message: !refreshed ? text.savedReadError : delivered ? text.testSent : text.testLocal });
    } catch (error) {
      const unknown = error instanceof NotificationActionError && error.unknown;
      setRequiresReview(unknown);
      setNotice({ tone: unknown ? "warning" : "error", message: unknown ? text.unknown : text.actionError });
    } finally {
      notificationActionRef.current = false;
      setBusyAction(null);
    }
  }

  async function openNotification(item: NotificationItem) {
    if (notificationActionRef.current) return;
    if (!item.targetPath.startsWith("/") || item.targetPath.startsWith("//") || item.targetPath.includes("\\")) {
      setNotice({ tone: "error", message: text.invalidTarget }); return;
    }
    if (!canLeaveForNotification(text)) { setNotice({ tone: "warning", message: text.navigationBusy }); return; }
    router.push(item.targetPath);
    setPopoverOpen(false);
    if (item.readAt || requiresReview) return;
    notificationActionRef.current = true;
    summarySequenceRef.current++;
    setBusyAction("read");
    try {
      await notificationActionRequest("/api/notifications/read", {
        body: JSON.stringify({ ids: [item.id] }), cache: "no-store",
        headers: { "Content-Type": "application/json" }, method: "POST",
      });
      setItems(current => current.map(row => row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row));
      await loadNotificationSummary();
    } catch (error) {
      const unknown = error instanceof NotificationActionError && error.unknown;
      setRequiresReview(unknown);
      setNotice({ tone: unknown ? "warning" : "error", message: unknown ? text.unknown : text.actionError });
    } finally {
      notificationActionRef.current = false;
      setBusyAction(null);
    }
  }

  const statusLabel = statusText(pushState, text);
  const hasUnread = unreadCount > 0;
  const permissionPromptIsIos = permissionPromptKind === "ios";

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn("relative bg-white", className)}
            aria-label={`${text.notifications} ${audience}`}
          >
            {hasUnread ? <BellRing className="size-4" /> : <Bell className="size-4" />}
            {hasUnread ? (
              <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                {Math.min(unreadCount, 99)}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="flex max-h-[min(600px,var(--radix-popover-content-available-height))] w-[min(360px,calc(100vw-1.5rem))] flex-col overflow-y-auto p-0">
          <div className="shrink-0 border-b border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-black text-slate-950">{text.notifications}</h2>
                <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                  {unreadCount} {text.unread} · {statusLabel}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 bg-white px-2 text-xs"
                onClick={enablePush}
                disabled={Boolean(busyAction) || pushState === "unsupported"}
              >
                {busyAction === "enable" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Smartphone className="size-3.5" />
                )}
                {text.enable}
              </Button>
            </div>
            {isIosStandaloneMissing ? (
              <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-900">
                {text.iosHint}
              </p>
            ) : null}
          </div>

          <div className="min-h-0 max-h-[320px] flex-1 overflow-y-auto p-2">
            {notice ? <AdminNotice tone={notice.tone} message={notice.message} className="mb-2 text-xs" /> : null}
            {readError ? <AdminNotice tone="error" message={text.readError} action={<Button size="xs" variant="outline" disabled={loading} onClick={() => void loadNotifications({ verify: true })}>{text.refresh}</Button>} className="mb-2 text-xs" /> : null}
            {requiresReview && !readError ? <Button size="xs" variant="outline" disabled={loading} onClick={() => void loadNotifications({ verify: true })}>{text.refresh}</Button> : null}
            {loading && items.length === 0 ? (
              <div className="flex h-24 items-center justify-center text-xs font-bold text-slate-500">
                <Loader2 className="mr-2 size-3.5 animate-spin" />
                {text.loading}
              </div>
            ) : items.length === 0 && !readError ? (
              <div className="grid h-24 place-items-center text-xs font-bold text-slate-500">
                {text.empty}
              </div>
            ) : (
              <div className="space-y-1">
                {items.map((item) => {
                  const content = notificationContent(item, locale);
                  return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={Boolean(busyAction)}
                    className={cn(
                      "w-full rounded-md border px-2.5 py-2 text-left transition hover:border-primary/40 hover:bg-primary/5 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
                      item.readAt
                        ? "border-slate-200 bg-white"
                        : "border-primary/20 bg-primary/5"
                    )}
                    onClick={() => {
                      void openNotification(item);
                    }}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <p className="min-w-0 break-words text-xs font-black text-slate-950">
                        {content.title}
                      </p>
                      {item.readAt ? (
                        <Check className="mt-0.5 size-3 shrink-0 text-emerald-600" />
                      ) : (
                        <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className={cn("mt-1 break-words text-xs font-semibold leading-5 text-slate-600", !content.isRma && "line-clamp-2")}>
                      {content.body}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">
                      {formatNotificationTime(item.createdAt)}
                    </p>
                  </button>
                  );
                })}
              </div>
            )}
          </div>

          {hasMore ? <div className="shrink-0 border-t p-2"><Button className="w-full" size="sm" variant="outline" disabled={loading || Boolean(busyAction)} onClick={() => void loadNotifications({ append: true })}>{loading ? text.loading : text.more}</Button></div> : null}

          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 p-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={markAllRead}
              disabled={Boolean(busyAction) || requiresReview || unreadCount === 0}
            >
              {busyAction === "read" ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
              {text.markAll}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 bg-white px-2 text-xs"
              onClick={sendTest}
              disabled={Boolean(busyAction) || requiresReview}
            >
              {busyAction === "test" ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              {text.sendTest}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog
        open={permissionPromptOpen}
        onOpenChange={(open) => {
          if (!open) {
            closePermissionPrompt();
            return;
          }

          setPermissionPromptOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-1 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <BellRing className="size-5" />
            </div>
            <DialogTitle className="text-base font-black text-slate-950">
              {permissionPromptIsIos
                ? text.permissionPromptIosTitle
                : text.permissionPromptTitle}
            </DialogTitle>
            <DialogDescription className="text-sm font-semibold leading-6 text-slate-600">
              {permissionPromptIsIos
                ? text.permissionPromptIosBody
                : text.permissionPromptBody}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="bg-white"
              onClick={closePermissionPrompt}
            >
              {permissionPromptIsIos
                ? text.permissionPromptOk
                : text.permissionPromptLater}
            </Button>
            {permissionPromptIsIos ? null : (
              <Button
                type="button"
                onClick={() => {
                  void handlePermissionPromptEnable();
                }}
                disabled={busyAction === "enable"}
              >
                {busyAction === "enable" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Smartphone className="size-4" />
                )}
                {text.permissionPromptEnable}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

async function readPushPublicKey() {
  try {
    const response = await fetch("/api/notifications/config", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return undefined;
    }

    return readPushPublicKeyFromPayload(await response.json());
  } catch {
    return undefined;
  }
}

function readPushPublicKeyFromPayload(payload: unknown) {
  if (
    isRecord(payload) &&
    isRecord(payload.data) &&
    typeof payload.data.publicKey === "string" &&
    payload.data.publicKey.length > 0
  ) {
    return payload.data.publicKey;
  }

  return null;
}

function hasSeenNotificationPermissionPrompt() {
  try {
    return window.sessionStorage.getItem(NOTIFICATION_PROMPT_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markNotificationPermissionPromptSeen() {
  try {
    window.sessionStorage.setItem(NOTIFICATION_PROMPT_SESSION_KEY, "1");
  } catch {
    // Ignore storage failures; permission prompts still work without persistence.
  }
}

function statusText(
  state: "checking" | "unsupported" | "default" | "denied" | "granted" | "unconfigured" | "error",
  text: typeof copy.zh
) {
  if (state === "granted") {
    return text.browserReady;
  }

  if (state === "denied") {
    return text.browserDenied;
  }

  if (state === "unsupported") {
    return text.browserUnsupported;
  }

  if (state === "unconfigured") {
    return text.pushUnavailable;
  }

  if (state === "error") {
    return text.browserError;
  }

  return text.permissionDefault;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function pushSubscriptionKeyMatches(
  subscription: PushSubscription,
  expectedKey: Uint8Array
) {
  const currentKey = subscription.options.applicationServerKey;

  if (!currentKey) {
    return false;
  }

  return uint8ArrayEquals(new Uint8Array(currentKey), expectedKey);
}

function uint8ArrayEquals(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) {
    return false;
  }

  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function readNotificationPayload(payload: unknown): NotificationPayload {
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null;
  if (!data || !Array.isArray(data.notifications) || !isNotificationCount(data.unreadCount)) {
    throw new Error("Invalid notification response.");
  }
  const notifications = data.notifications.map(readNotification);
  if (notifications.some(item => item === null)) throw new Error("Invalid notification row.");
  const hasMore = data.hasMore === true;
  const cursor = isRecord(data.nextCursor) ? data.nextCursor : null;
  if (hasMore && (!cursor || typeof cursor.beforeCreatedAt !== "string" || !Number.isFinite(Date.parse(cursor.beforeCreatedAt)) || typeof cursor.beforeId !== "string" || !notificationUuid.test(cursor.beforeId))) {
    throw new Error("Invalid notification cursor.");
  }
  return {
    notifications: notifications as NotificationItem[], unreadCount: data.unreadCount, hasMore,
    nextCursor: hasMore && cursor ? { beforeCreatedAt: cursor.beforeCreatedAt as string, beforeId: cursor.beforeId as string } : null,
  };
}

function readNotificationSummaryPayload(payload: unknown): NotificationSummaryPayload {
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null;
  if (!data || !isNotificationCount(data.unreadCount)) throw new Error("Invalid notification summary.");
  return {
    latestCreatedAt:
      typeof data?.latestCreatedAt === "string" ? data.latestCreatedAt : null,
    unreadCount: data.unreadCount,
  };
}

function readNotification(value: unknown): NotificationItem | null {
  if (!isRecord(value) || typeof value.id !== "string" || !notificationUuid.test(value.id) || typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) || typeof value.targetPath !== "string") {
    return null;
  }

  return {
    audience: value.audience === "customer" || value.audience === "staff" ? value.audience : null,
    body: typeof value.body === "string" ? value.body : "",
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
    eventType: typeof value.eventType === "string" ? value.eventType : "",
    id: value.id,
    payload: isRecord(value.payload) ? value.payload : {},
    readAt: typeof value.readAt === "string" ? value.readAt : null,
    sourceAction: typeof value.sourceAction === "string" ? value.sourceAction : null,
    targetPath: typeof value.targetPath === "string" ? value.targetPath : "/",
    title: typeof value.title === "string" ? value.title : "PartsPro",
  };
}

const notificationUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function canLeaveForNotification(text: typeof copy.zh) {
  if (document.body.getAttribute("data-admin-ui") !== "true") return true;
  if (document.querySelector('[data-admin-mutating="true"]')) return false;
  return !document.querySelector('[data-admin-dirty="true"]') || window.confirm(text.unsavedLeave);
}

function isNotificationCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function mergeNotificationItems(current: NotificationItem[], incoming: NotificationItem[]) {
  const rows = new Map(current.map(item => [item.id, item]));
  for (const item of incoming) {
    const previous = rows.get(item.id);
    rows.set(item.id, previous?.readAt && !item.readAt ? { ...item, readAt: previous.readAt } : item);
  }
  return [...rows.values()];
}

class NotificationActionError extends Error {
  constructor(public readonly unknown: boolean) { super("Notification action failed."); }
}

async function notificationActionRequest(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(8_000) });
  } catch { throw new NotificationActionError(true); }
  if (!response.ok) throw new NotificationActionError(response.status >= 500);
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new NotificationActionError(true); }
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null;
  const valid = data && (url.endsWith("/read") ? data.ok === true :
    isNotificationCount(data.eventCount) && data.eventCount > 0 && isNotificationCount(data.pushDeliveredCount) && isNotificationCount(data.pushFailedCount));
  if (!valid || !data) throw new NotificationActionError(true);
  return data;
}

function notificationContent(item: NotificationItem, locale: string) {
  const rma = rmaNotificationCopy(item, locale);
  if (rma) {
    return { ...rma, isRma: true };
  }

  return {
    title: item.eventType === "new_order" ? (locale === "zh-CN" ? "新订单" : "Nuovo ordine") : item.title,
    body: item.body,
    isRma: false,
  };
}

function rmaNotificationCopy(item: NotificationItem, locale: string) {
  if (item.audience !== "customer" && item.audience !== "staff") {
    return null;
  }
  const isZh = locale === "zh-CN";
  const isStaff = item.audience === "staff";
  const rmaNo = typeof item.payload.rma_no === "string"
    ? item.payload.rma_no.trim()
    : typeof item.payload.rmaNo === "string" ? item.payload.rmaNo.trim() : "";
  const withReference = (body: string) => rmaNo ? `${rmaNo} · ${body}` : body;

  if (item.eventType === "rma_submitted") {
    return {
      title: isStaff ? (isZh ? "新的售后申请" : "Nuova richiesta di reso") : (isZh ? "售后申请已提交" : "Richiesta di reso inviata"),
      body: withReference(isStaff
        ? (isZh ? "客户提交了售后申请，请进入后台售后审核。" : "Il cliente ha inviato una richiesta di reso. Apri la sezione RMA in amministrazione per verificarla.")
        : (isZh ? "售后申请已提交，正在等待审核。进入售后页面可查看进度。" : "La richiesta di reso è stata inviata ed è in attesa di verifica. Apri la pagina Resi per seguirne lo stato.")),
    };
  }

  if (item.eventType === "rma_action_required") {
    if (!isStaff || item.payload.action !== "mark_received") {
      return null;
    }
    return {
      title: isZh ? "客户已确认寄回商品" : "Il cliente ha confermato la spedizione del reso",
      body: withReference(isZh
        ? "客户已确认寄出退回商品。请等待实物到达，收到完整商品后再进入后台登记收货。"
        : "Il cliente ha confermato di aver spedito il reso. Attendi l'arrivo della merce e registra la ricezione in amministrazione solo dopo aver ricevuto l'intera quantità."),
    };
  }

  if (item.eventType !== "rma_status_updated") {
    return null;
  }
  const actionBodies: Record<string, string> = isZh ? {
    start_negotiation: "售后处理需要与您确认方案，请联系客服协商。确认前不会执行退款或商品处置。",
    resolve_negotiation: "已记录双方确认的处理方案。退款仍需审批，请进入售后页面查看进度。",
    split_request: "售后申请已按数量拆分，分别处理。请查看关联申请及各自进度。",
    return_to_customer: "原商品已寄回给您，请进入售后页面查看物流单号。",
    cancel_unreceived: "根据双方确认，尚未收到商品的申请已取消。详情见售后记录。",
  } : {
    start_negotiation: "La soluzione richiede il tuo accordo. Contatta l'assistenza; rimborso e disposizione della merce restano sospesi fino alla conferma.",
    resolve_negotiation: "La soluzione concordata è stata registrata. Il rimborso resta soggetto ad approvazione; segui la pratica nella pagina Resi.",
    split_request: "La richiesta è stata divisa per quantità, da gestire separatamente. Controlla le pratiche collegate e il loro stato.",
    return_to_customer: "L'articolo originale è stato rispedito. Apri la pagina Resi per il codice di tracciamento.",
    cancel_unreceived: "La richiesta relativa alla merce non ricevuta è stata annullata come concordato. Consulta lo storico del reso.",
  };
  if (!isStaff && item.sourceAction && Object.hasOwn(actionBodies, item.sourceAction)) {
    return { title: isZh ? "售后处理更新" : "Gestione del reso aggiornata", body: withReference(actionBodies[item.sourceAction]) };
  }
  if (!isStaff && item.sourceAction === "request_wallet_refund") {
    return {
      title: isZh ? "钱包退款等待审核" : "Rimborso wallet in attesa di approvazione",
      body: withReference(isZh
        ? "退款申请已创建，等待审核。请勿重复申请；审批结果可在售后页面查看。"
        : "La richiesta di rimborso è stata creata ed è in attesa di approvazione. Non inviare una seconda richiesta; puoi seguire l'esito nella pagina Resi."),
    };
  }
  const status = typeof item.payload.status === "string" ? item.payload.status : "";
  const bodies: Record<string, string> = isZh ? {
    submitted: "售后申请已提交，正在等待审核。",
    requested: "售后申请已提交，正在等待审核。",
    under_review: "售后申请正在审核中。",
    approved: isStaff
      ? "售后申请已批准，等待客户寄回商品或确认已寄出。"
      : "售后申请已批准。请进入售后页面（/rma）查看；若尚未收到寄回方式或地址，请先联系客服确认。实际寄出后再点击“我已寄回”。",
    rejected: "售后申请未获批准，请进入售后页面查看原因和详情。",
    return_in_transit: isStaff
      ? "客户已确认寄出退回商品，请在实物到达后登记收货。"
      : "已记录您寄回商品的确认，正在等待门店或仓库收货。",
    received: "退回商品已收到，请进入售后页面查看检查与处理进度。",
    refunded: "此售后的钱包退款已批准，请查看钱包记录。",
    replacement_sent: "此售后的替换商品已发出，请进入售后页面查看详情。",
    replaced: "此售后的替换商品已发出，请进入售后页面查看详情。",
    closed: "此售后申请已关闭，请进入售后页面查看处理记录。",
  } : {
    submitted: "La richiesta di reso è stata inviata ed è in attesa di verifica.",
    requested: "La richiesta di reso è stata inviata ed è in attesa di verifica.",
    under_review: "La richiesta di reso è in verifica.",
    approved: isStaff
      ? "La richiesta di reso è approvata. Attendi che il cliente restituisca la merce o confermi la spedizione."
      : "La richiesta di reso è approvata. Apri la pagina Resi (/rma). Se non hai ancora ricevuto modalità e indirizzo per il reso, contatta prima l'assistenza. Dopo aver spedito la merce, conferma “Ho spedito il reso”.",
    rejected: "La richiesta di reso non è stata approvata. Apri la pagina Resi per il motivo e i dettagli.",
    return_in_transit: isStaff
      ? "Il cliente ha confermato la spedizione del reso. Registra la ricezione solo dopo l'arrivo della merce."
      : "La conferma di spedizione del reso è registrata. Siamo in attesa della consegna in negozio o magazzino.",
    received: "La merce restituita è stata ricevuta. Apri la pagina Resi per seguire i controlli e la gestione.",
    refunded: "Il rimborso wallet per questo reso è stato approvato. Controlla i movimenti del wallet.",
    replacement_sent: "La merce sostitutiva è stata spedita. Apri la pagina Resi per i dettagli.",
    replaced: "La merce sostitutiva è stata spedita. Apri la pagina Resi per i dettagli.",
    closed: "La pratica di reso è stata chiusa. Apri la pagina Resi per consultare lo storico.",
  };
  if (!Object.hasOwn(bodies, status)) {
    return null;
  }
  return {
    title: isZh ? "售后状态更新" : "Stato del reso aggiornato",
    body: withReference(bodies[status]),
  };
}

function detectBrowser() {
  const userAgent = navigator.userAgent;

  if (userAgent.includes("Edg/")) {
    return "Edge";
  }

  if (userAgent.includes("Firefox/")) {
    return "Firefox";
  }

  if (userAgent.includes("Chrome/") || userAgent.includes("CriOS/")) {
    return "Chrome";
  }

  if (userAgent.includes("Safari/")) {
    return "Safari";
  }

  return "Browser";
}

function formatNotificationTime(value: string) {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date(timestamp));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
