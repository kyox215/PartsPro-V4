"use client";

import * as React from "react";
import Link from "next/link";
import {
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Home,
  Menu,
  Package,
  Search,
  Settings,
  ShoppingCart,
  User,
  Users,
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
import { getAdminDictionary, type AdminText } from "@/i18n/dictionaries/admin";
import { cn } from "@/lib/utils";
import { AdminActivityTimeline } from "./admin-activity-timeline";
import { AdminCustomersPanel } from "./admin-customers-panel";
import { AdminOverviewDashboard } from "./admin-overview-dashboard";
import { AdminOrdersPanel } from "./admin-orders-panel";
import { AdminPermissionsPanel } from "./admin-permissions-panel";
import { AdminProductsPanel } from "./admin-products-panel";
import { useI18n } from "./i18n-provider";
import { LanguageSwitcher } from "./language-switcher";
import { PartsProLogo } from "./logo";

type AdminPanelValue =
  | "overview"
  | "orders"
  | "customers"
  | "catalog"
  | "timeline"
  | "settings";

type AdminNavItem = {
  labelKey: keyof AdminText["nav"];
  icon: LucideIcon;
  panel?: AdminPanelValue;
};

const adminPanelValues = [
  "overview",
  "orders",
  "customers",
  "catalog",
  "timeline",
  "settings",
] as const satisfies readonly AdminPanelValue[];

const navItems = [
  { labelKey: "dashboard", icon: Home, panel: "overview" },
  { labelKey: "orders", icon: ClipboardList, panel: "orders" },
  { labelKey: "catalog", icon: Package, panel: "catalog" },
  { labelKey: "warehouse", icon: Warehouse },
  { labelKey: "customers", icon: Users, panel: "customers" },
  { labelKey: "marketing", icon: Bell, panel: "timeline" },
  { labelKey: "finance", icon: BarChart3 },
  { labelKey: "reports", icon: Boxes },
  { labelKey: "settings", icon: Settings, panel: "settings" },
] as const satisfies readonly AdminNavItem[];

function isAdminPanelValue(value: string): value is AdminPanelValue {
  return adminPanelValues.includes(value as AdminPanelValue);
}

function useAdminText() {
  const { locale } = useI18n();

  return getAdminDictionary(locale).admin;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function AdminDashboard() {
  const [activePanel, setActivePanel] =
    React.useState<AdminPanelValue>("overview");
  const [visiblePanels, setVisiblePanels] =
    React.useState<AdminPanelValue[] | null>(null);
  const [customerReviewCount, setCustomerReviewCount] = React.useState(0);
  const visiblePanelSet = React.useMemo(
    () => new Set<AdminPanelValue>(visiblePanels ?? [...adminPanelValues]),
    [visiblePanels]
  );

  React.useEffect(() => {
    let cancelled = false;

    void fetch("/api/me", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (
          cancelled ||
          !isRecord(payload) ||
          !Array.isArray(payload.visiblePanels)
        ) {
          return;
        }

        const panels = payload.visiblePanels.filter(
          (panel): panel is AdminPanelValue =>
            typeof panel === "string" && isAdminPanelValue(panel)
        );

        if (panels.length > 0) {
          setVisiblePanels(panels);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const handleCustomerReviewCount = (event: Event) => {
      const detail = (event as CustomEvent<{ count?: unknown }>).detail;

      if (typeof detail?.count === "number") {
        setCustomerReviewCount(Math.max(0, detail.count));
      }
    };

    window.addEventListener("partspro:customer-review-count", handleCustomerReviewCount);

    return () => {
      window.removeEventListener("partspro:customer-review-count", handleCustomerReviewCount);
    };
  }, []);

  React.useEffect(() => {
    if (!visiblePanelSet.has("customers")) {
      return;
    }

    const controller = new AbortController();

    void fetchCustomerReviewCount(controller.signal)
      .then(setCustomerReviewCount)
      .catch(() => undefined);

    return () => controller.abort();
  }, [visiblePanelSet]);

  React.useEffect(() => {
    if (!visiblePanelSet.has(activePanel)) {
      const timeoutId = window.setTimeout(() => {
        setActivePanel(visiblePanels?.[0] ?? "overview");
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [activePanel, visiblePanels, visiblePanelSet]);

  const handlePanelChange = React.useCallback(
    (value: string) => {
      if (isAdminPanelValue(value) && visiblePanelSet.has(value)) {
        setActivePanel(value);
      }
    },
    [visiblePanelSet]
  );

  return (
    <main className="h-dvh overflow-y-auto overflow-x-clip bg-slate-50 text-slate-950">
      <div className="flex min-w-0">
        <AdminSidebar
          activePanel={activePanel}
          customerReviewCount={customerReviewCount}
          onPanelChange={setActivePanel}
          visiblePanels={visiblePanelSet}
        />
        <section className="w-full min-w-0 flex-1">
          <AdminTopbar
            activePanel={activePanel}
            customerReviewCount={customerReviewCount}
            onPanelChange={setActivePanel}
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
              <TabsContent value="customers" className="order-4 mt-0 min-w-0">
                <AdminCustomersPanel />
              </TabsContent>
              <TabsContent value="catalog" className="order-4 mt-0 min-w-0">
                <AdminProductsPanel />
              </TabsContent>
              <TabsContent value="timeline" className="order-4 mt-0 min-w-0">
                <AdminActivityTimeline />
              </TabsContent>
              <TabsContent value="settings" className="order-4 mt-0 min-w-0">
                <AdminPermissionsPanel />
              </TabsContent>
              <TabsContent value="overview" className="order-4 mt-0 min-w-0">
                <AdminOverviewDashboard
                  onPanelChange={setActivePanel}
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
  customerReviewCount: number;
  onPanelChange: (panel: AdminPanelValue) => void;
  visiblePanels: ReadonlySet<AdminPanelValue>;
};

function AdminSidebar({
  activePanel,
  customerReviewCount,
  onPanelChange,
  visiblePanels,
}: AdminNavigationProps) {
  const text = useAdminText();

  return (
    <aside className="sticky top-0 hidden h-screen w-[250px] shrink-0 border-r border-slate-200 bg-white p-4 lg:block">
      <PartsProLogo />
      <nav className="mt-8 space-y-1">
        {navItems.map((item) => {
          const panel = "panel" in item ? item.panel : undefined;
          const isAvailable = Boolean(panel && visiblePanels.has(panel));
          const isActive = panel === activePanel;

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
                }
              }}
              className={cn(
                "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-slate-600 hover:bg-primary/8 hover:text-primary",
                !isAvailable &&
                  "cursor-default opacity-55 hover:bg-transparent hover:text-slate-600"
              )}
            >
              <item.icon className="size-4" />
              <span className="min-w-0 flex-1 truncate">{text.nav[item.labelKey]}</span>
              {item.labelKey === "customers" ? (
                <CustomerReviewBadge count={customerReviewCount} />
              ) : null}
              {item.labelKey === "catalog" && (
                <ChevronRight className="size-4 opacity-60" />
              )}
            </button>
          );
        })}
      </nav>
      <div className="absolute bottom-4 left-4 right-4">
        <Separator className="mb-4" />
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
          <div className="grid size-9 place-items-center rounded-full bg-primary text-white">
            <User className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">
              {text.topbar.adminName}
            </div>
            <div className="text-xs text-slate-500">
              {text.topbar.adminRole}
            </div>
          </div>
          <ChevronDown className="ml-auto size-4 text-slate-400" />
        </div>
      </div>
    </aside>
  );
}

function AdminTopbar({
  activePanel,
  customerReviewCount,
  onPanelChange,
  visiblePanels,
}: AdminNavigationProps) {
  const text = useAdminText();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/95 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-[1500px] min-w-0 items-center gap-3 px-3 sm:h-16 sm:px-4">
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="bg-white lg:hidden">
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
                </Link>
                <LanguageSwitcher scope="admin" compact className="h-10 shadow-sm" />
              </div>
              {navItems.map((item) => {
                const panel = "panel" in item ? item.panel : undefined;
                const isAvailable = Boolean(panel && visiblePanels.has(panel));
                const isActive = panel === activePanel;

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
                      "flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-slate-700 hover:bg-primary/8 hover:text-primary",
                      !isAvailable &&
                        "cursor-default opacity-55 hover:bg-transparent hover:text-slate-700"
                    )}
                  >
                    <item.icon className="size-4" />
                    <span className="min-w-0 flex-1 truncate">{text.nav[item.labelKey]}</span>
                    {item.labelKey === "customers" ? (
                      <CustomerReviewBadge count={customerReviewCount} />
                    ) : null}
                    {item.labelKey === "catalog" && (
                      <ChevronRight className="size-4 opacity-60" />
                    )}
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
        <Button
          variant="outline"
          size="icon"
          className="relative hidden shrink-0 bg-white sm:inline-flex"
        >
          <ShoppingCart className="size-4" />
          <span className="absolute right-1 top-1 size-2 rounded-full bg-red-500" />
        </Button>
        <Button variant="outline" asChild className="hidden bg-white sm:inline-flex">
          <Link href="/">{text.topbar.home}</Link>
        </Button>
      </div>
    </header>
  );
}

function CustomerReviewBadge({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }

  return (
    <span
      className="ml-auto inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded-full bg-red-500 px-1.5 text-[10px] font-black leading-none text-white shadow-sm ring-2 ring-white"
      aria-label={`待审核客户 ${count}`}
    >
      <span className="size-1.5 rounded-full bg-white" />
      {count > 99 ? "99+" : count}
    </span>
  );
}

async function fetchCustomerReviewCount(signal: AbortSignal) {
  const response = await fetch("/api/admin/customers?limit=1&offset=0&assignmentStatus=needs_review", {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    return 0;
  }

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!isRecord(payload)) {
    return 0;
  }

  const meta = isRecord(payload.meta) ? payload.meta : null;
  const facets = meta && isRecord(meta.facets) ? meta.facets : null;
  const total = readNumber(meta?.total);
  const needsReview = readNumber(facets?.needsReview);

  return Math.max(0, needsReview ?? total ?? 0);
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
