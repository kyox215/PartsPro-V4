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
    browserError: "通知保存失败",
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
      return false;
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
                {items.map((item) => {
                  const content = notificationContent(item, locale);
                  return (
                  <button
                    key={item.id}
                    type="button"
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
