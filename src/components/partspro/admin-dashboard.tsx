"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Bell,
  Boxes,
  ChevronRight,
  ClipboardList,
  Home,
  Menu,
  MessageCircle,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Settings,
  ShoppingBag,
  User,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getAdminDictionary, type AdminText } from "@/i18n/dictionaries/admin";
import { cn } from "@/lib/utils";
import { useI18n, useT } from "./i18n-provider";
import { LanguageSwitcher } from "./language-switcher";
import { PartsProLogo } from "./logo";
import { AdminGlobalSearch } from "./admin-global-search";
import { AdminSearchField } from "./admin-ui-controls";
import { AdminWorkspaceStateProvider } from "./admin-workspace-state";
import { NotificationCenter } from "./notification-center";
import {
  DelayedPendingIndicator,
  RoutePendingIndicator,
  useDelayedVisible,
} from "./pending-feedback";

type AdminPanelValue =
  | "remax"
  | "analytics"
  | "overview"
  | "orders"
  | "rma"
  | "catalog"
  | "finance"
  | "inventory"
  | "marketplace"
  | "support"
  | "timeline"
  | "accounts"
  | "settings";

type AdminNavItem = {
  labelKey: keyof AdminText["nav"];
  icon: LucideIcon;
  panel?: AdminPanelValue;
};

const adminPanelValues = [
  "remax",
  "analytics",
  "overview",
  "orders",
  "rma",
  "catalog",
  "finance",
  "marketplace",
  "support",
  "timeline",
  "accounts",
  "settings",
] as const satisfies readonly AdminPanelValue[];

const navItems = [
  { labelKey: "dashboard", icon: Home, panel: "overview" },
  { labelKey: "orders", icon: ClipboardList, panel: "orders" },
  { labelKey: "rma", icon: RotateCcw, panel: "rma" },
  { labelKey: "catalog", icon: Package, panel: "catalog" },
  { labelKey: "remax", icon: Package, panel: "remax" },
  { labelKey: "marketplace", icon: ShoppingBag, panel: "marketplace" },
  { labelKey: "support", icon: MessageCircle, panel: "support" },
  { labelKey: "accounts", icon: UsersRound, panel: "accounts" },
  { labelKey: "marketing", icon: Bell, panel: "timeline" },
  { labelKey: "finance", icon: BarChart3, panel: "finance" },
  { labelKey: "reports", icon: Boxes, panel: "analytics" },
  { labelKey: "settings", icon: Settings, panel: "settings" },
] as const satisfies readonly AdminNavItem[];

type AdminOverviewDashboardProps = {
  onPanelChange?: (panel: AdminPanelValue) => void;
  visiblePanels?: ReadonlySet<AdminPanelValue>;
};

type AdminCommercePanelProps = {
  permissions?: readonly string[];
};

type AdminProductsPanelProps = {
  permissions?: readonly string[];
  permissionsLoaded?: boolean;
};

type AdminOrdersPanelProps = {
  permissions?: string[]; customerId?: string; returnAccountId?: string; focusStatus?: string;
  focusOrderId?: string;
};

type AdminAccountsPanelProps = {
  focusAccountId?: string;
  initialPermissions?: readonly string[];
  initialUserId?: string | null;
  permissionsLoaded?: boolean;
};

type AdminSupportPanelProps = {
  currentUserId?: string | null;
  focusConversationId?: string;
};

type AdminDashboardProps = {
  initialUserName?: string | null;
  initialUserRole?: string | null;
  initialPermissions?: readonly string[];
  initialUserId?: string | null;
  initialVisiblePanels?: readonly string[];
};

const AdminRemaxPanel = dynamic(() => import("./admin-remax-center").then(module => module.AdminRemaxCenter), { ssr: false, loading: AdminPanelLoadingFallback });

const AdminAnalyticsPanel = dynamic(() => import("./admin-analytics-panel").then(module => module.AdminAnalyticsPanel), { ssr: false, loading: () => <AdminPanelLoadingFallback /> });

const AdminOrdersPanel = dynamic(
  () => import("./admin-orders-panel").then((module) => module.AdminOrdersPanel),
  { ssr: false, loading: () => <AdminPanelLoadingFallback /> }
) as React.ComponentType<AdminOrdersPanelProps>;
const AdminRmaPanel = dynamic(
  () => import("./admin-rma-panel").then((module) => module.AdminRmaPanel),
  { ssr: false, loading: () => <AdminPanelLoadingFallback /> }
);
const AdminProductsPanel = dynamic<AdminProductsPanelProps>(
  () =>
    import("./admin-products-panel").then((module) => module.AdminProductsPanel),
  { ssr: false, loading: () => <AdminPanelLoadingFallback /> }
);
const AdminFinancePanel = dynamic(
  () =>
    import("./admin-finance-panel").then((module) => module.AdminFinancePanel),
  { ssr: false, loading: () => <AdminPanelLoadingFallback /> }
);
const AdminActivityTimeline = dynamic(
  () =>
    import("./admin-activity-timeline").then(
      (module) => module.AdminActivityTimeline
    ),
  { ssr: false, loading: () => <AdminPanelLoadingFallback /> }
);
const AdminSettingsPanel = dynamic(
  () =>
    import("./admin-settings-panel").then(
      (module) => module.AdminSettingsPanel
    ),
  { ssr: false, loading: () => <AdminPanelLoadingFallback /> }
);
const AdminAccountsPanel = dynamic<AdminAccountsPanelProps>(
  () =>
    import("./admin-accounts-panel").then(
      (module) => module.AdminAccountsPanel
    ),
  { ssr: false, loading: () => <AdminPanelLoadingFallback /> }
);
const AdminCommercePanel = dynamic<AdminCommercePanelProps>(
  () =>
    import("./admin-commerce-panel").then(
      (module) => module.AdminCommercePanel
    ),
  { ssr: false, loading: () => <AdminPanelLoadingFallback /> }
);
const AdminSupportPanel = dynamic(
  () =>
    import("./admin-support-panel").then(
      (module) => module.AdminSupportPanel
    ),
  { ssr: false, loading: () => <AdminPanelLoadingFallback /> }
) as React.ComponentType<AdminSupportPanelProps>;
const AdminOverviewDashboard = dynamic<AdminOverviewDashboardProps>(
  () =>
    import("./admin-overview-dashboard").then(
      (module) => module.AdminOverviewDashboard
    ),
  { ssr: false, loading: () => <AdminPanelLoadingFallback /> }
);

function isAdminPanelValue(value: string): value is AdminPanelValue {
  return (adminPanelValues as readonly string[]).includes(value);
}

function adminPanelHref(panel: AdminPanelValue) {
  return `/admin?panel=${encodeURIComponent(panel)}`;
}

function normalizeVisiblePanels(values: readonly string[] | undefined) {
  const panels = values?.filter(isAdminPanelValue) ?? [];

  return panels.length > 0 ? panels : null;
}

function useAdminText() {
  const { locale } = useI18n();

  return getAdminDictionary(locale).admin;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function AdminPanelLoading() {
  return (
    <div className="min-h-[360px] rounded-lg border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.045)]">
      <div className="h-6 w-48 animate-pulse rounded bg-slate-100" />
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="h-28 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-28 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-28 animate-pulse rounded-lg bg-slate-100" />
      </div>
      <div className="mt-4 h-56 animate-pulse rounded-lg bg-slate-100" />
    </div>
  );
}

function AdminPanelLoadingFallback() {
  const text = useAdminText();
  const showSkeleton = useDelayedVisible(true, 300);

  if (showSkeleton) {
    return <AdminPanelLoading />;
  }

  return (
    <div
      aria-busy="true"
      className="grid min-h-[360px] place-items-start rounded-lg border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.045)]"
    >
      <div
        className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary"
        role="status"
      >
        <DelayedPendingIndicator
          className="size-3.5"
          label={text.common.loadingPanel}
          pending
        />
        {text.common.loadingPanel}
      </div>
    </div>
  );
}

export function AdminDashboard({
  initialPermissions,
  initialUserName = null,
  initialUserRole = null,
  initialUserId = null,
  initialVisiblePanels,
}: AdminDashboardProps = {}) {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasInitialAdminContext = initialPermissions !== undefined;
  const [activePanel, setActivePanel] =
    React.useState<AdminPanelValue>("overview");
  const [pendingPanel, setPendingPanel] =
    React.useState<AdminPanelValue | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const mainRef = React.useRef<HTMLElement>(null);
  const scrollPositions = React.useRef<Record<string, number>>({});
  const panelUrls = React.useRef<Record<string, string>>({});
  React.useEffect(() => {
    const previousScope = document.body.dataset.adminUi;
    document.body.dataset.adminUi = "true";
    return () => {
      if (previousScope === undefined) delete document.body.dataset.adminUi;
      else document.body.dataset.adminUi = previousScope;
    };
  }, []);
  React.useEffect(() => {
    const timer = window.setTimeout(() => { try { setIsSidebarCollapsed(localStorage.getItem("partspro:admin-sidebar") === "collapsed"); } catch {} }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const [visiblePanels, setVisiblePanels] =
    React.useState<AdminPanelValue[] | null>(() =>
      normalizeVisiblePanels(initialVisiblePanels)
    );
  const [currentPermissions, setCurrentPermissions] = React.useState<string[]>(
    () => [...(initialPermissions ?? [])]
  );
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(
    initialUserId
  );
  const [adminContextLoaded, setAdminContextLoaded] =
    React.useState(hasInitialAdminContext);
  const visiblePanelSet = React.useMemo(
    () => new Set<AdminPanelValue>(visiblePanels ?? [...adminPanelValues]),
    [visiblePanels]
  );
  const activePanelRef = React.useRef<AdminPanelValue>(activePanel);

  React.useEffect(() => {
    activePanelRef.current = activePanel;
  }, [activePanel]);

  React.useEffect(() => {
    if (hasInitialAdminContext) {
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

        if (Array.isArray(payload.permissions)) {
          setCurrentPermissions(
            payload.permissions.filter(
              (permission): permission is string => typeof permission === "string"
            )
          );
        }

        if (typeof payload.userId === "string") {
          setCurrentUserId(payload.userId);
        }

        if (Array.isArray(payload.visiblePanels)) {
          const panels = payload.visiblePanels.filter(
            (panel): panel is AdminPanelValue =>
              typeof panel === "string" && isAdminPanelValue(panel)
          );

          if (panels.length > 0) {
            setVisiblePanels(panels);
          }
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setAdminContextLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasInitialAdminContext]);

  React.useEffect(() => {
    if (!visiblePanelSet.has(activePanel)) {
      const timeoutId = window.setTimeout(() => {
        setActivePanel(visiblePanels?.[0] ?? "overview");
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [activePanel, visiblePanels, visiblePanelSet]);

  const pendingPanelTimerRef = React.useRef<number | null>(null);

  const selectPanel = React.useCallback(
    (panel: AdminPanelValue, options: { syncUrl?: boolean } = {}) => {
      if (!visiblePanelSet.has(panel)) {
        return;
      }

      const previous = activePanelRef.current;
      if (previous !== panel && document.querySelector('[data-admin-mutating="true"]')) return;
      if (previous !== panel && document.querySelector('[data-admin-dirty="true"], [data-catalog-dirty="true"]') && !window.confirm(t("admin.navigation.discardSwitch"))) {
        if (!options.syncUrl) router.replace(panelUrls.current[previous] ?? adminPanelHref(previous), { scroll: false });
        return;
      }
      if (pendingPanelTimerRef.current !== null) {
        window.clearTimeout(pendingPanelTimerRef.current);
      }

      if (panel !== activePanelRef.current) {
        setPendingPanel(panel);
      }

      if (previous !== panel) {
        scrollPositions.current[previous] = mainRef.current?.scrollTop ?? 0;
        const currentParams = new URLSearchParams(window.location.search);
        const urlPanel = currentParams.get("panel") ?? "overview";
        // On a Link/back navigation the browser already contains the target URL.
        if (urlPanel === previous) panelUrls.current[previous] = window.location.pathname + window.location.search;
        else panelUrls.current[previous] ??= adminPanelHref(previous);
      }
      if (!options.syncUrl) panelUrls.current[panel] = window.location.pathname + window.location.search;
      activePanelRef.current = panel;
      setActivePanel(panel);
      if (options.syncUrl) {
        router.push(panelUrls.current[panel] ?? adminPanelHref(panel), { scroll: false });
      }

      pendingPanelTimerRef.current = window.setTimeout(() => {
        setPendingPanel((current) => (current === panel ? null : current));
      }, 360);
    },
    [router, visiblePanelSet, t]
  );


  React.useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const target = scrollPositions.current[activePanel] ?? 0;
    let done = false;
    let frame = 0;
    const stop = () => { done = true; observer.disconnect(); resize.disconnect(); cancelAnimationFrame(frame); };
    const restore = () => {
      if (done) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!done && main.scrollHeight - main.clientHeight >= target) { main.scrollTop = target; stop(); }
      });
    };
    const observer = new MutationObserver(restore);
    const resize = new ResizeObserver(restore);
    observer.observe(main, { childList: true, subtree: true, characterData: true });
    resize.observe(main);
    const timer = window.setTimeout(stop, 5000);
    main.addEventListener("wheel", stop, { passive: true });
    main.addEventListener("pointerdown", stop, { passive: true });
    restore();
    return () => { stop(); window.clearTimeout(timer); main.removeEventListener("wheel", stop); main.removeEventListener("pointerdown", stop); };
  }, [activePanel]);

  React.useEffect(() => {
    const guardLink = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = new URL(link.getAttribute("href") ?? "", window.location.href);
      if (url.origin !== window.location.origin || !url.pathname.startsWith("/admin") || url.href === window.location.href) return;
      // Error-summary anchors move focus inside the current form, without leaving it.
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;
      if (document.querySelector('[data-admin-mutating="true"]')) { event.preventDefault(); event.stopPropagation(); return; }
      if (document.querySelector('[data-admin-dirty="true"], [data-catalog-dirty="true"]') && !window.confirm(t("admin.navigation.discardOpen"))) { event.preventDefault(); event.stopPropagation(); }
    };
    document.addEventListener("click", guardLink, true);
    return () => document.removeEventListener("click", guardLink, true);
  }, [t]);
  React.useEffect(() => {
    const changed = () => { void fetch("/api/me", { cache: "no-store" }).then(async response => {
      if (!response.ok) return; const data = await response.json();
      if (data.userId !== currentUserId) { router.refresh(); return; }
      if (Array.isArray(data.permissions)) setCurrentPermissions(data.permissions.filter((item: unknown): item is string => typeof item === "string"));
      if (Array.isArray(data.visiblePanels)) setVisiblePanels(normalizeVisiblePanels(data.visiblePanels));
    }).catch(() => undefined); };
    window.addEventListener("partspro:admin-permissions-changed", changed); return () => window.removeEventListener("partspro:admin-permissions-changed", changed);
  }, [currentUserId, router]);

  const navigateToPanel = React.useCallback(
    (panel: AdminPanelValue) => selectPanel(panel, { syncUrl: true }),
    [selectPanel]
  );

  React.useEffect(() => {
    return () => {
      if (pendingPanelTimerRef.current !== null) {
        window.clearTimeout(pendingPanelTimerRef.current);
      }
    };
  }, []);

  const handlePanelChange = React.useCallback(
    (value: string) => {
      if (isAdminPanelValue(value)) {
        selectPanel(value, { syncUrl: value !== activePanelRef.current });
      }
    },
    [selectPanel]
  );
  const focusOrderId = searchParams.get("orderId") ?? undefined;
  const focusConversationId = searchParams.get("conversationId") ?? undefined;

  React.useEffect(() => {
    const requestedPanel = searchParams.get("panel");
    if (!requestedPanel) {
      const timeoutId = window.setTimeout(() => selectPanel("overview"), 0);
      return () => window.clearTimeout(timeoutId);
    }

    if (requestedPanel === "inventory") {
      const params = new URLSearchParams(searchParams.toString());

      params.set("panel", "catalog");
      params.set("catalogView", "sold-shortages");
      const timeoutId = window.setTimeout(() => {
        selectPanel("catalog");
      }, 0);
      router.replace(`/admin?${params.toString()}`, { scroll: false });

      return () => window.clearTimeout(timeoutId);
    }

    if (requestedPanel && isAdminPanelValue(requestedPanel)) {
      const timeoutId = window.setTimeout(() => {
        selectPanel(requestedPanel);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [router, searchParams, selectPanel]);

  return (
    <AdminWorkspaceStateProvider userId={currentUserId}><main ref={mainRef} data-admin-ui="true" className="h-dvh overflow-y-auto overflow-x-clip bg-slate-50 text-slate-950">
      <div className="flex min-w-0">
        <AdminSidebar
          activePanel={activePanel}
          onPanelChange={navigateToPanel}
          pendingPanel={pendingPanel}
          visiblePanels={visiblePanelSet}
          collapsed={isSidebarCollapsed}
          onCollapsedChange={(collapsed) => { setIsSidebarCollapsed(collapsed); try { localStorage.setItem("partspro:admin-sidebar", collapsed ? "collapsed" : "expanded"); } catch {} }}
          userName={initialUserName}
          userRole={initialUserRole}
        />
        <section className="w-full min-w-0 flex-1">
          <AdminTopbar
            activePanel={activePanel}
            onPanelChange={navigateToPanel}
            pendingPanel={pendingPanel}
            visiblePanels={visiblePanelSet}
          />
          <div className="mx-auto w-full max-w-[1500px] min-w-0 px-3 pb-3 pt-2 sm:px-4 sm:py-4">
            <Tabs
              value={activePanel}
              onValueChange={handlePanelChange}
              className="flex min-w-0 flex-col gap-3 sm:gap-4"
            >
              <TabsContent value="orders" className="order-4 mt-0 min-w-0">
                <AdminOrdersPanel focusStatus={searchParams.get("status") ?? undefined} focusOrderId={focusOrderId} permissions={currentPermissions} customerId={searchParams.get("customerId") ?? undefined} returnAccountId={searchParams.get("returnAccountId") ?? undefined} />
              </TabsContent>
              <TabsContent value="rma" className="order-4 mt-0 min-w-0">
                <AdminRmaPanel />
              </TabsContent>
              <TabsContent value="catalog" className="order-4 mt-0 min-w-0">
                <AdminProductsPanel
                  permissions={currentPermissions}
                  permissionsLoaded={adminContextLoaded}
                />
              </TabsContent>
              <TabsContent value="finance" className="order-4 mt-0 min-w-0">
                <AdminFinancePanel permissions={currentPermissions} currentUserId={currentUserId ?? undefined} />
              </TabsContent>
              <TabsContent value="marketplace" className="order-4 mt-0 min-w-0">
                <AdminCommercePanel permissions={currentPermissions} />
              </TabsContent>
              <TabsContent value="support" className="order-4 mt-0 min-w-0">
                <AdminSupportPanel
                  currentUserId={currentUserId}
                  focusConversationId={focusConversationId}
                />
              </TabsContent>
              <TabsContent value="timeline" className="order-4 mt-0 min-w-0">
                <AdminActivityTimeline permissions={currentPermissions} />
              </TabsContent>
              <TabsContent value="accounts" className="order-4 mt-0 min-w-0">
                <AdminAccountsPanel
                  focusAccountId={searchParams.get("accountId") ?? undefined}
                  initialPermissions={currentPermissions}
                  initialUserId={currentUserId}
                  permissionsLoaded={adminContextLoaded}
                />
              </TabsContent>
              <TabsContent value="settings" className="order-4 mt-0 min-w-0">
                <AdminSettingsPanel />
              </TabsContent>
              <TabsContent value="remax" className="order-4 mt-0 min-w-0"><AdminRemaxPanel initialDashboard={null} initialError={null} /></TabsContent>
              <TabsContent value="analytics" className="order-4 mt-0 min-w-0"><AdminAnalyticsPanel /></TabsContent>
              <TabsContent value="overview" className="order-4 mt-0 min-w-0">
                <AdminOverviewDashboard
                  onPanelChange={navigateToPanel}
                  visiblePanels={visiblePanelSet}
                />
              </TabsContent>
            </Tabs>
          </div>
        </section>
      </div>
    </main></AdminWorkspaceStateProvider>
  );
}

type AdminNavigationProps = {
  activePanel: AdminPanelValue;
  onPanelChange: (panel: AdminPanelValue) => void;
  pendingPanel: AdminPanelValue | null;
  visiblePanels: ReadonlySet<AdminPanelValue>;
};

type AdminSidebarProps = AdminNavigationProps & {
  collapsed: boolean;
  userName?: string | null;
  userRole?: string | null;
  onCollapsedChange: (collapsed: boolean) => void;
};

function AdminSidebar({
  activePanel,
  collapsed,
  userName,
  userRole,
  onCollapsedChange,
  onPanelChange,
  pendingPanel,
  visiblePanels,
}: AdminSidebarProps) {
  const text = useAdminText();
  const t = useT();
  const [navigationQuery, setNavigationQuery] = React.useState("");
  const navigationItems = navItems.filter(item => visiblePanels.has(item.panel) && (collapsed || text.nav[item.labelKey].toLocaleLowerCase().includes(navigationQuery.trim().toLocaleLowerCase())));
  const toggleLabel = t(collapsed ? "admin.navigation.expand" : "admin.navigation.collapse");
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const userCard = (
    <Link href="/account" aria-label={userName ?? text.topbar.adminName}
      className={cn(
        "flex items-center rounded-lg bg-slate-50 hover:bg-primary/10",
        collapsed ? "justify-center p-2" : "gap-3 p-3"
      )}
    >
      <div className="grid size-9 place-items-center rounded-full bg-primary text-white">
        <User className="size-4" />
      </div>
      {!collapsed && (
        <>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{userName ?? text.topbar.adminName}</div>
            <div className="text-xs text-slate-500">{userRole ?? text.topbar.adminRole}</div>
          </div>
          <ChevronRight className="ml-auto size-4 text-slate-400" />
        </>
      )}
    </Link>
  );

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-slate-200 bg-white transition-[width,padding] duration-200 lg:flex",
        collapsed ? "w-[72px] px-3 py-4" : "w-[250px] p-4"
      )}
    >
      <div
        className={cn(
          "flex",
          collapsed ? "flex-col items-center gap-3" : "items-center justify-between gap-3"
        )}
      >
        <PartsProLogo compact={collapsed} className={cn(collapsed && "justify-center")} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-expanded={!collapsed}
              aria-label={toggleLabel}
              className="bg-white"
              onClick={() => onCollapsedChange(!collapsed)}
            >
              <ToggleIcon className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={collapsed ? "right" : "bottom"} sideOffset={8}>
            {toggleLabel}
          </TooltipContent>
        </Tooltip>
      </div>
      {!collapsed && <AdminSearchField containerClassName="mt-4" value={navigationQuery} onValueChange={setNavigationQuery} aria-label={t("admin.navigation.searchLabel")} placeholder={t("admin.navigation.search")} className="h-9" />}
      <nav className={cn("min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain py-2", collapsed ? "mt-4" : "mt-2")}>
        {navigationItems.length === 0 && <p role="status" className="p-2 text-sm text-slate-500">{t("admin.navigation.empty")}</p>}
        {navigationItems.map((item) => {
          const panel = "panel" in item ? item.panel : undefined;
          const label = text.nav[item.labelKey];
          const isAvailable = Boolean(panel && visiblePanels.has(panel));
          const isActive = panel === activePanel;
          const isPending = panel === pendingPanel;

          if (panel && !visiblePanels.has(panel)) {
            return null;
          }

          const navButton = (
            <button
              key={item.labelKey}
              type="button"
              disabled={!isAvailable}
              aria-label={collapsed ? label : undefined}
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                if (panel) {
                  onPanelChange(panel);
                }
              }}
              className={cn(
                "relative flex h-10 w-full items-center rounded-lg text-sm font-medium transition active:scale-[0.98]",
                collapsed ? "justify-center px-0" : "gap-3 px-3 text-left",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-slate-600 hover:bg-primary/8 hover:text-primary",
                isPending && "ring-2 ring-primary/15",
                !isAvailable &&
                  "cursor-default opacity-55 hover:bg-transparent hover:text-slate-600"
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {!collapsed && <span className="min-w-0 truncate">{label}</span>}
              {!collapsed && isPending && (
                <DelayedPendingIndicator
                  className="ml-auto size-3.5"
                  label={text.common.loadingPanel}
                  pending
                />
              )}
              {!collapsed && !isPending && item.labelKey === "catalog" && (
                <ChevronRight className="ml-auto size-4 opacity-60" />
              )}
              {collapsed && isPending && (
                <DelayedPendingIndicator
                  className="absolute right-1 top-1 size-3"
                  label={text.common.loadingPanel}
                  pending
                />
              )}
            </button>
          );

          if (!collapsed) {
            return navButton;
          }

          return (
            <Tooltip key={item.labelKey}>
              <TooltipTrigger asChild>
                <span className="block">{navButton}</span>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                {label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
      <div className="shrink-0 pt-2">
        <Separator className="mb-4" />
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{userCard}</TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              <div className="font-semibold">{userName ?? text.topbar.adminName}</div>
              <div className="text-xs opacity-80">{userRole ?? text.topbar.adminRole}</div>
            </TooltipContent>
          </Tooltip>
        ) : (
          userCard
        )}
      </div>
    </aside>
  );
}

function AdminTopbar({
  activePanel,
  onPanelChange,
  pendingPanel,
  visiblePanels,
}: AdminNavigationProps) {
  const text = useAdminText();
  const t = useT();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [navigationQuery, setNavigationQuery] = React.useState("");
  const navigationItems = navItems.filter(item => visiblePanels.has(item.panel) && text.nav[item.labelKey].toLocaleLowerCase().includes(navigationQuery.trim().toLocaleLowerCase()));

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/95 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-[1500px] min-w-0 items-center gap-3 px-3 sm:h-16 sm:px-4">
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="bg-white lg:hidden"
              aria-label={text.topbar.mobileNavigationLabel}
              title={text.topbar.mobileNavigationLabel}
            >
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="admin-ui-panel w-[min(310px,var(--overlay-width,100vw))] gap-0 overflow-hidden p-0">
            <SheetHeader className="border-b px-5 py-4 text-left">
              <SheetTitle>
                <PartsProLogo />
              </SheetTitle>
              <SheetDescription className="sr-only">
                {text.topbar.mobileNavigationDescription}
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              <div className="mb-3 flex min-w-0 items-center gap-2">
                <Link
                  href="/"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-primary/8 hover:text-primary"
                >
                  <Home className="size-4 shrink-0" />
                  <span className="truncate">{text.topbar.home}</span>
                  <RoutePendingIndicator
                    className="ml-auto size-3.5"
                    label={text.common.loadingPanel}
                  />
                </Link>
                <LanguageSwitcher scope="admin" compact className="h-10 shadow-sm" />
              </div>
              <AdminSearchField containerClassName="mb-2" value={navigationQuery} onValueChange={setNavigationQuery} aria-label={t("admin.navigation.searchLabel")} placeholder={t("admin.navigation.search")} />
              {navigationItems.length === 0 && <p role="status" className="p-3 text-sm text-slate-500">{t("admin.navigation.empty")}</p>}
              {navigationItems.map((item) => {
                const panel = "panel" in item ? item.panel : undefined;
                const isAvailable = Boolean(panel && visiblePanels.has(panel));
                const isActive = panel === activePanel;
                const isPending = panel === pendingPanel;

                if (panel && !visiblePanels.has(panel)) {
                  return null;
                }

                return (
                  <button
                    key={item.labelKey}
                    type="button"
                    disabled={!isAvailable}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => {
                      if (panel) {
                        onPanelChange(panel);
                        setIsMobileMenuOpen(false);
                      }
                    }}
                    className={cn(
                      "flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition active:scale-[0.98]",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-slate-700 hover:bg-primary/8 hover:text-primary",
                      isPending && "ring-2 ring-primary/15",
                      !isAvailable &&
                        "cursor-default opacity-55 hover:bg-transparent hover:text-slate-700"
                    )}
                  >
                    <item.icon className="size-4" />
                    <span className="min-w-0 flex-1 truncate">{text.nav[item.labelKey]}</span>
                    {isPending ? (
                      <DelayedPendingIndicator
                        className="size-3.5"
                        label={text.common.loadingPanel}
                        pending
                      />
                    ) : item.labelKey === "catalog" ? (
                      <ChevronRight className="size-4 opacity-60" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1 sm:flex-none">
          <div className="truncate text-lg font-black">{text.nav[navItems.find(item => item.panel === activePanel)?.labelKey ?? "dashboard"]}</div>
          <div className="truncate text-xs text-slate-500">
            {text.topbar.subtitle}
          </div>
        </div>

        <AdminGlobalSearch />

        <LanguageSwitcher scope="admin" compact className="hidden sm:inline-flex" />
        <NotificationCenter audience="staff" />
        <Button variant="outline" asChild className="hidden bg-white sm:inline-flex">
          <Link href="/">
            <span>{text.topbar.home}</span>
            <RoutePendingIndicator
              className="size-3.5"
              label={text.common.loadingPanel}
            />
          </Link>
        </Button>
      </div>
    </header>
  );
}
