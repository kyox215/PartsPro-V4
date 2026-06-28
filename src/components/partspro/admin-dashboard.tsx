"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Home,
  Menu,
  MessageCircle,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Search,
  Settings,
  ShoppingBag,
  User,
  UsersRound,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useI18n } from "./i18n-provider";
import { LanguageSwitcher } from "./language-switcher";
import { PartsProLogo } from "./logo";
import {
  DelayedPendingIndicator,
  RoutePendingIndicator,
  useDelayedVisible,
} from "./pending-feedback";

type AdminPanelValue =
  | "overview"
  | "orders"
  | "rma"
  | "catalog"
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
  "overview",
  "orders",
  "rma",
  "catalog",
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
  { labelKey: "marketplace", icon: ShoppingBag, panel: "marketplace" },
  { labelKey: "support", icon: MessageCircle, panel: "support" },
  { labelKey: "accounts", icon: UsersRound, panel: "accounts" },
  { labelKey: "warehouse", icon: Warehouse },
  { labelKey: "marketing", icon: Bell, panel: "timeline" },
  { labelKey: "finance", icon: BarChart3 },
  { labelKey: "reports", icon: Boxes },
  { labelKey: "settings", icon: Settings, panel: "settings" },
] as const satisfies readonly AdminNavItem[];

type AdminOverviewDashboardProps = {
  onPanelChange?: (panel: AdminPanelValue) => void;
  visiblePanels?: ReadonlySet<AdminPanelValue>;
};

type AdminCommercePanelProps = {
  permissions?: readonly string[];
};

type AdminAccountsPanelProps = {
  initialPermissions?: readonly string[];
  initialUserId?: string | null;
  permissionsLoaded?: boolean;
};

type AdminDashboardProps = {
  initialPermissions?: readonly string[];
  initialUserId?: string | null;
  initialVisiblePanels?: readonly string[];
};

const AdminOrdersPanel = dynamic(
  () => import("./admin-orders-panel").then((module) => module.AdminOrdersPanel),
  { loading: () => <AdminPanelLoadingFallback /> }
);
const AdminRmaPanel = dynamic(
  () => import("./admin-rma-panel").then((module) => module.AdminRmaPanel),
  { loading: () => <AdminPanelLoadingFallback /> }
);
const AdminProductsPanel = dynamic(
  () =>
    import("./admin-products-panel").then((module) => module.AdminProductsPanel),
  { loading: () => <AdminPanelLoadingFallback /> }
);
const AdminActivityTimeline = dynamic(
  () =>
    import("./admin-activity-timeline").then(
      (module) => module.AdminActivityTimeline
    ),
  { loading: () => <AdminPanelLoadingFallback /> }
);
const AdminSettingsPanel = dynamic(
  () =>
    import("./admin-settings-panel").then(
      (module) => module.AdminSettingsPanel
    ),
  { loading: () => <AdminPanelLoadingFallback /> }
);
const AdminAccountsPanel = dynamic<AdminAccountsPanelProps>(
  () =>
    import("./admin-accounts-panel").then(
      (module) => module.AdminAccountsPanel
    ),
  { loading: () => <AdminPanelLoadingFallback /> }
);
const AdminCommercePanel = dynamic<AdminCommercePanelProps>(
  () =>
    import("./admin-commerce-panel").then(
      (module) => module.AdminCommercePanel
    ),
  { loading: () => <AdminPanelLoadingFallback /> }
);
const AdminSupportPanel = dynamic(
  () =>
    import("./admin-support-panel").then(
      (module) => module.AdminSupportPanel
    ),
  { loading: () => <AdminPanelLoadingFallback /> }
);
const AdminOverviewDashboard = dynamic<AdminOverviewDashboardProps>(
  () =>
    import("./admin-overview-dashboard").then(
      (module) => module.AdminOverviewDashboard
    ),
  { loading: () => <AdminPanelLoadingFallback /> }
);

function isAdminPanelValue(value: string): value is AdminPanelValue {
  return adminPanelValues.includes(value as AdminPanelValue);
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
  initialUserId = null,
  initialVisiblePanels,
}: AdminDashboardProps = {}) {
  const hasInitialAdminContext = initialPermissions !== undefined;
  const [activePanel, setActivePanel] =
    React.useState<AdminPanelValue>("overview");
  const [pendingPanel, setPendingPanel] =
    React.useState<AdminPanelValue | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(true);
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
    (panel: AdminPanelValue) => {
      if (!visiblePanelSet.has(panel)) {
        return;
      }

      if (pendingPanelTimerRef.current !== null) {
        window.clearTimeout(pendingPanelTimerRef.current);
      }

      if (panel !== activePanel) {
        setPendingPanel(panel);
      }

      setActivePanel(panel);
      pendingPanelTimerRef.current = window.setTimeout(() => {
        setPendingPanel((current) => (current === panel ? null : current));
      }, 360);
    },
    [activePanel, visiblePanelSet]
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
        selectPanel(value);
      }
    },
    [selectPanel]
  );

  return (
    <main className="h-dvh overflow-y-auto overflow-x-clip bg-slate-50 text-slate-950">
      <div className="flex min-w-0">
        <AdminSidebar
          activePanel={activePanel}
          onPanelChange={selectPanel}
          pendingPanel={pendingPanel}
          visiblePanels={visiblePanelSet}
          collapsed={isSidebarCollapsed}
          onCollapsedChange={setIsSidebarCollapsed}
        />
        <section className="w-full min-w-0 flex-1">
          <AdminTopbar
            activePanel={activePanel}
            onPanelChange={selectPanel}
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
                <AdminOrdersPanel />
              </TabsContent>
              <TabsContent value="rma" className="order-4 mt-0 min-w-0">
                <AdminRmaPanel />
              </TabsContent>
              <TabsContent value="catalog" className="order-4 mt-0 min-w-0">
                <AdminProductsPanel />
              </TabsContent>
              <TabsContent value="marketplace" className="order-4 mt-0 min-w-0">
                <AdminCommercePanel permissions={currentPermissions} />
              </TabsContent>
              <TabsContent value="support" className="order-4 mt-0 min-w-0">
                <AdminSupportPanel currentUserId={currentUserId} />
              </TabsContent>
              <TabsContent value="timeline" className="order-4 mt-0 min-w-0">
                <AdminActivityTimeline />
              </TabsContent>
              <TabsContent value="accounts" className="order-4 mt-0 min-w-0">
                <AdminAccountsPanel
                  initialPermissions={currentPermissions}
                  initialUserId={currentUserId}
                  permissionsLoaded={adminContextLoaded}
                />
              </TabsContent>
              <TabsContent value="settings" className="order-4 mt-0 min-w-0">
                <AdminSettingsPanel />
              </TabsContent>
              <TabsContent value="overview" className="order-4 mt-0 min-w-0">
                <AdminOverviewDashboard
                  onPanelChange={selectPanel}
                  visiblePanels={visiblePanelSet}
                />
              </TabsContent>
            </Tabs>
          </div>
        </section>
      </div>
    </main>
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
  onCollapsedChange: (collapsed: boolean) => void;
};

function AdminSidebar({
  activePanel,
  collapsed,
  onCollapsedChange,
  onPanelChange,
  pendingPanel,
  visiblePanels,
}: AdminSidebarProps) {
  const text = useAdminText();
  const toggleLabel = collapsed ? "Expand admin sidebar" : "Collapse admin sidebar";
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const userCard = (
    <div
      className={cn(
        "flex items-center rounded-lg bg-slate-50",
        collapsed ? "justify-center p-2" : "gap-3 p-3"
      )}
    >
      <div className="grid size-9 place-items-center rounded-full bg-primary text-white">
        <User className="size-4" />
      </div>
      {!collapsed && (
        <>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{text.topbar.adminName}</div>
            <div className="text-xs text-slate-500">{text.topbar.adminRole}</div>
          </div>
          <ChevronDown className="ml-auto size-4 text-slate-400" />
        </>
      )}
    </div>
  );

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 border-r border-slate-200 bg-white transition-[width,padding] duration-200 lg:block",
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
      <nav className={cn("space-y-1", collapsed ? "mt-6" : "mt-8")}>
        {navItems.map((item) => {
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
      <div className={cn("absolute bottom-4", collapsed ? "left-3 right-3" : "left-4 right-4")}>
        <Separator className="mb-4" />
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{userCard}</TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              <div className="font-semibold">{text.topbar.adminName}</div>
              <div className="text-xs opacity-80">{text.topbar.adminRole}</div>
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

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
          <SheetContent side="left" className="w-[310px] p-0">
            <SheetHeader className="border-b px-5 py-4 text-left">
              <SheetTitle>
                <PartsProLogo />
              </SheetTitle>
              <SheetDescription className="sr-only">
                {text.topbar.mobileNavigationDescription}
              </SheetDescription>
            </SheetHeader>
            <div className="p-4">
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
              {navItems.map((item) => {
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
          <div className="truncate text-lg font-black">{text.topbar.title}</div>
          <div className="truncate text-xs text-slate-500">
            {text.topbar.subtitle}
          </div>
        </div>

        <div className="relative ml-auto hidden w-full max-w-md md:block">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="h-10 bg-white pl-9"
            placeholder={text.topbar.searchPlaceholder}
          />
        </div>

        <LanguageSwitcher scope="admin" compact className="hidden sm:inline-flex" />
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
