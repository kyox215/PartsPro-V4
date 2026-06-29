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

type NotificationAudience = "customer" | "staff";

type NotificationItem = {
  body: string;
  createdAt: string;
  id: string;
  readAt: string | null;
  targetPath: string;
  title: string;
};

type NotificationPayload = {
  notifications: NotificationItem[];
  unreadCount: number;
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
    browserReady: "Notifiche browser attive",
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
  },
  zh: {
    browserDenied: "浏览器已阻止通知",
    browserReady: "浏览器通知已开启",
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
  const [pushState, setPushState] = React.useState<
    "checking" | "unsupported" | "default" | "denied" | "granted" | "unconfigured"
  >("checking");
  const [isIosStandaloneMissing, setIsIosStandaloneMissing] =
    React.useState(false);
  const [permissionPromptOpen, setPermissionPromptOpen] =
    React.useState(false);
  const [permissionPromptKind, setPermissionPromptKind] = React.useState<
    "enable" | "ios" | null
  >(null);

  const loadNotificationSummary = React.useCallback(async () => {
    try {
      const response = await fetch("/api/notifications/summary", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      const data = readNotificationSummaryPayload(payload);
      setUnreadCount(data.unreadCount);
    } catch {
      // Summary refresh is best-effort; the full popover load still reports errors.
    }
  }, []);

  const loadNotifications = React.useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/notifications?limit=20", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      const data = readNotificationPayload(payload);
      setItems(data.notifications);
      setUnreadCount(data.unreadCount);
    } finally {
      setLoading(false);
    }
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
        pushState !== "checking" &&
        pushState !== "unconfigured"
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
      const target = new URL(url, window.location.origin);

      if (target.origin === window.location.origin) {
        router.push(`${target.pathname}${target.search}${target.hash}`);
      }
    };

    navigator.serviceWorker.addEventListener("message", listener);

    return () => {
      navigator.serviceWorker.removeEventListener("message", listener);
    };
  }, [router]);

  async function enablePush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setPushState("unsupported");
      return;
    }

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
        return;
      }

      const permission = await Notification.requestPermission();
      setPushState(permission);

      if (permission !== "granted") {
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription =
        existingSubscription ??
        (await registration.pushManager.subscribe({
          applicationServerKey: urlBase64ToUint8Array(publicKey),
          userVisibleOnly: true,
        }));

      await fetch("/api/notifications/subscriptions", {
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

      if (popoverOpen) {
        await loadNotifications();
      } else {
        await loadNotificationSummary();
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePermissionPromptEnable() {
    await enablePush();
    setPermissionPromptOpen(false);
    setPermissionPromptKind(null);
  }

  function closePermissionPrompt() {
    markNotificationPermissionPromptSeen();
    setPermissionPromptOpen(false);
    setPermissionPromptKind(null);
  }

  async function markAllRead() {
    setBusyAction("read");

    try {
      await fetch("/api/notifications/read", {
        body: JSON.stringify({}),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      await loadNotifications();
    } finally {
      setBusyAction(null);
    }
  }

  async function sendTest() {
    setBusyAction("test");

    try {
      await fetch("/api/notifications/test", {
        cache: "no-store",
        method: "POST",
      });
      await loadNotifications();
    } finally {
      setBusyAction(null);
    }
  }

  async function openNotification(item: NotificationItem) {
    await fetch("/api/notifications/read", {
      body: JSON.stringify({ ids: [item.id] }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => undefined);
    setItems((current) =>
      current.map((notification) =>
        notification.id === item.id
          ? { ...notification, readAt: new Date().toISOString() }
          : notification
      )
    );
    setUnreadCount((current) => Math.max(0, current - 1));
    router.push(item.targetPath);
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
        <PopoverContent align="end" className="w-[min(360px,calc(100vw-1.5rem))] p-0">
          <div className="border-b border-slate-200 p-3">
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
                disabled={busyAction === "enable" || pushState === "unsupported"}
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

          <div className="max-h-[320px] overflow-y-auto p-2">
            {loading && items.length === 0 ? (
              <div className="flex h-24 items-center justify-center text-xs font-bold text-slate-500">
                <Loader2 className="mr-2 size-3.5 animate-spin" />
                {text.loading}
              </div>
            ) : items.length === 0 ? (
              <div className="grid h-24 place-items-center text-xs font-bold text-slate-500">
                {text.empty}
              </div>
            ) : (
              <div className="space-y-1">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "w-full rounded-md border px-2.5 py-2 text-left transition hover:border-primary/40 hover:bg-primary/5",
                      item.readAt
                        ? "border-slate-200 bg-white"
                        : "border-primary/20 bg-primary/5"
                    )}
                    onClick={() => {
                      void openNotification(item);
                    }}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <p className="line-clamp-1 text-xs font-black text-slate-950">
                        {item.title}
                      </p>
                      {item.readAt ? (
                        <Check className="mt-0.5 size-3 shrink-0 text-emerald-600" />
                      ) : (
                        <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-600">
                      {item.body}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">
                      {formatNotificationTime(item.createdAt)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-slate-200 p-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={markAllRead}
              disabled={busyAction === "read" || unreadCount === 0}
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
              disabled={busyAction === "test"}
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
  state: "checking" | "unsupported" | "default" | "denied" | "granted" | "unconfigured",
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

function readNotificationPayload(payload: unknown): NotificationPayload {
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null;
  const notifications = Array.isArray(data?.notifications)
    ? data.notifications
        .map(readNotification)
        .filter((item): item is NotificationItem => Boolean(item))
    : [];
  const unreadCount =
    typeof data?.unreadCount === "number"
      ? data.unreadCount
      : notifications.filter((item) => !item.readAt).length;

  return { notifications, unreadCount };
}

function readNotificationSummaryPayload(payload: unknown): NotificationSummaryPayload {
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null;

  return {
    latestCreatedAt:
      typeof data?.latestCreatedAt === "string" ? data.latestCreatedAt : null,
    unreadCount: typeof data?.unreadCount === "number" ? data.unreadCount : 0,
  };
}

function readNotification(value: unknown): NotificationItem | null {
  if (!isRecord(value) || typeof value.id !== "string") {
    return null;
  }

  return {
    body: typeof value.body === "string" ? value.body : "",
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
    id: value.id,
    readAt: typeof value.readAt === "string" ? value.readAt : null,
    targetPath: typeof value.targetPath === "string" ? value.targetPath : "/",
    title: typeof value.title === "string" ? value.title : "PartsPro",
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
