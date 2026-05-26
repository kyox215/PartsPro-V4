"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Bell,
  Boxes,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  HelpCircle,
  Home,
  Menu,
  Package,
  Search,
  Settings,
  ShoppingCart,
  Truck,
  User,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  dashboardStats,
  inventoryMix,
  monthlyOrders,
  salesTrend,
  type PartProduct,
} from "@/lib/partspro-data";
import { cn } from "@/lib/utils";
import { AdminActivityTimeline } from "./admin-activity-timeline";
import { AdminCustomersPanel } from "./admin-customers-panel";
import { AdminOrdersPanel } from "./admin-orders-panel";
import { AdminPermissionsPanel } from "./admin-permissions-panel";
import { AdminProductsPanel } from "./admin-products-panel";
import { PartsProLogo } from "./logo";
import { useI18n } from "./i18n-provider";
import { LanguageSwitcher } from "./language-switcher";
import {
  formatAdminMessage,
  getAdminDictionary,
  type AdminText,
} from "@/i18n/dictionaries/admin";

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
  const [visiblePanels, setVisiblePanels] = React.useState<AdminPanelValue[] | null>(null);
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
        if (cancelled || !isRecord(payload) || !Array.isArray(payload.visiblePanels)) {
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
    if (!visiblePanelSet.has(activePanel)) {
      const timeoutId = window.setTimeout(() => {
        setActivePanel(visiblePanels?.[0] ?? "overview");
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [activePanel, visiblePanels, visiblePanelSet]);

  const handlePanelChange = React.useCallback((value: string) => {
    if (isAdminPanelValue(value) && visiblePanelSet.has(value)) {
      setActivePanel(value);
    }
  }, [visiblePanelSet]);

  return (
    <main className="h-dvh overflow-y-auto overflow-x-clip text-slate-950">
      <div className="flex min-w-0">
        <AdminSidebar
          activePanel={activePanel}
          onPanelChange={setActivePanel}
          visiblePanels={visiblePanelSet}
        />
        <section className="w-full min-w-0 flex-1">
          <AdminTopbar
            activePanel={activePanel}
            onPanelChange={setActivePanel}
            visiblePanels={visiblePanelSet}
          />
          <div className="mx-auto w-full max-w-[1500px] min-w-0 px-3 pb-3 pt-0 sm:px-4 sm:py-4">
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
              <TabsContent value="overview" className="order-4 mt-0 min-w-0 space-y-4">
                <StatsGrid />
                <ChartsPanel />
                <LowerPanels products={[]} />
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
  visiblePanels: ReadonlySet<AdminPanelValue>;
};

function AdminSidebar({ activePanel, onPanelChange, visiblePanels }: AdminNavigationProps) {
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
                !isAvailable && "cursor-default opacity-55 hover:bg-transparent hover:text-slate-600"
              )}
            >
              <item.icon className="size-4" />
              {text.nav[item.labelKey]}
              {item.labelKey === "catalog" && (
                <ChevronRight className="ml-auto size-4 opacity-60" />
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
            <div className="truncate text-sm font-bold">{text.topbar.adminName}</div>
            <div className="text-xs text-slate-500">{text.topbar.adminRole}</div>
          </div>
          <ChevronDown className="ml-auto size-4 text-slate-400" />
        </div>
      </div>
    </aside>
  );
}

function AdminTopbar({ activePanel, onPanelChange, visiblePanels }: AdminNavigationProps) {
  const text = useAdminText();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/82 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1500px] min-w-0 items-center gap-3 px-4">
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
              <LanguageSwitcher scope="admin" className="mb-4" />
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
                    {text.nav[item.labelKey]}
                    {item.labelKey === "catalog" && (
                      <ChevronRight className="ml-auto size-4 opacity-60" />
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
          <Input className="h-10 bg-white pl-9" placeholder={text.topbar.searchPlaceholder} />
        </div>

        <LanguageSwitcher scope="admin" compact className="hidden sm:inline-flex" />
        <Button variant="outline" size="icon" className="shrink-0 bg-white">
          <Calendar className="size-4" />
        </Button>
        <Button variant="outline" size="icon" className="relative hidden shrink-0 bg-white sm:inline-flex">
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

function StatsGrid() {
  return (
    <section className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
      {dashboardStats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <Card className="border-slate-200 bg-white py-2 shadow-[0_18px_45px_rgba(15,23,42,0.05)] sm:py-4">
            <CardContent className="px-2.5 sm:px-5">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium leading-tight text-slate-500 sm:text-sm">
                    {stat.label}
                  </p>
                  <div className="mt-1 whitespace-nowrap text-xl font-black leading-none tracking-normal sm:mt-2 sm:text-3xl">
                    {stat.value}
                  </div>
                  <p className="mt-1 text-[11px] font-semibold leading-tight text-emerald-600 sm:mt-2 sm:text-xs">
                    {stat.delta} vs ieri
                  </p>
                </div>
                <div className="hidden size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary sm:grid">
                  {index === 0 && <ClipboardList className="size-5" />}
                  {index === 1 && <BarChart3 className="size-5" />}
                  {index === 2 && <Users className="size-5" />}
                  {index === 3 && <Package className="size-5" />}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </section>
  );
}

function ChartsPanel() {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <Card className="border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Vendite ultimi 7 giorni</CardTitle>
            <CardDescription>Calcolate sugli ordini effettivamente pagati</CardDescription>
          </div>
          <Select defaultValue="7">
            <SelectTrigger className="w-28 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 giorni</SelectItem>
              <SelectItem value="30">30 giorni</SelectItem>
              <SelectItem value="90">90 giorni</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="h-[280px]">
          <MeasuredChart height={280}>
            {(width, height) => (
              <AreaChart width={width} height={height} data={salesTrend}>
                <defs>
                  <linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#3b5bff" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#3b5bff" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e5edf7" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <RechartsTooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #dfe6f1",
                    boxShadow: "0 16px 40px rgba(15,23,42,0.12)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#3b5bff"
                  strokeWidth={3}
                  fill="url(#salesFill)"
                />
              </AreaChart>
            )}
          </MeasuredChart>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
        <Card className="border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <CardHeader>
            <CardTitle>Distribuzione stock</CardTitle>
            <CardDescription>Totale SKU 2.840</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div className="h-[180px]">
              <MeasuredChart height={180} compact>
                {(width, height) => (
                  <PieChart width={width} height={height}>
                    <Pie
                      data={inventoryMix}
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {inventoryMix.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                )}
              </MeasuredChart>
            </div>
            <div className="flex flex-col justify-center gap-3">
              {inventoryMix.map((item) => (
                <div key={item.name} className="flex items-center gap-3 text-sm">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: item.fill }}
                  />
                  <span className="flex-1 text-slate-600">{item.name}</span>
                  <span className="font-bold">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <CardHeader>
            <CardTitle>Stato ordini</CardTitle>
            <CardDescription>Unità per mese</CardDescription>
          </CardHeader>
          <CardContent className="h-[220px]">
            <MeasuredChart height={220}>
              {(width, height) => (
                <BarChart width={width} height={height} data={monthlyOrders}>
                  <CartesianGrid stroke="#e5edf7" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} />
                  <RechartsTooltip cursor={{ fill: "rgba(59,91,255,0.06)" }} />
                  <Bar dataKey="paid" stackId="a" fill="#3b5bff" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="pending" stackId="a" fill="#dbe5ff" radius={[6, 6, 0, 0]} />
                </BarChart>
              )}
            </MeasuredChart>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function MeasuredChart({
  children,
  compact = false,
  height,
}: {
  children: (width: number, height: number) => React.ReactNode;
  compact?: boolean;
  height: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    let frame = 0;
    const updateWidth = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setWidth(Math.floor(element.getBoundingClientRect().width));
      });
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className="h-full w-full min-w-0">
      {width > 0 ? children(width, height) : <ChartPlaceholder compact={compact} />}
    </div>
  );
}

function ChartPlaceholder({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex h-full min-h-[160px] items-end gap-2 rounded-lg bg-slate-50 p-4">
      {Array.from({ length: compact ? 6 : 12 }).map((_, index) => (
        <div
          key={index}
          className="flex-1 rounded-t bg-primary/15"
          style={{ height: `${28 + ((index * 17) % 58)}%` }}
        />
      ))}
    </div>
  );
}

function LowerPanels({ products }: { products: PartProduct[] }) {
  const text = useAdminText();
  const alertProducts = products.filter((product) => product.stock <= 18);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,0.8fr)]">
      <Card className="border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <CardHeader>
          <CardTitle>Flusso ordine</CardTitle>
          <CardDescription>Picking, pagamento, spedizione e completamento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <div className="mb-2 flex justify-between text-sm font-medium">
              <span>Avanzamento batch picking</span>
              <span>60%</span>
            </div>
            <Progress value={60} className="h-2" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {["Ordine", "Pagamento", "Spedizione", "Completato"].map((step, index) => (
              <div key={step} className="text-center">
                <div
                  className={cn(
                    "mx-auto grid size-8 place-items-center rounded-full text-xs font-bold",
                    index < 2 ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
                  )}
                >
                  {index + 1}
                </div>
                <div className="mt-2 text-xs text-slate-500">{step}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <div className="relative grid size-24 place-items-center rounded-full bg-[conic-gradient(#3b5bff_75%,#e7edff_0)]">
              <div className="grid size-18 place-items-center rounded-full bg-white text-lg font-black">
                75%
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-500" />
                QC completato
              </div>
              <div className="flex items-center gap-2">
                <Truck className="size-4 text-primary" />
                In attesa del corriere
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <CardHeader>
          <CardTitle>Azioni rapide</CardTitle>
          <CardDescription>Alert, riordino e automazioni operative</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Alert stock basso", "Avvisa buyer sotto 10 pezzi", true],
              ["Riordino automatico", "Stima sul venduto degli ultimi 7 giorni", true],
              ["Sync prezzi", "Aggiorna il listino fornitori", false],
              ["Reminder pagamento", "Sollecita ordini non pagati dopo 24h", true],
            ].map(([title, body, enabled]) => (
              <div key={title as string} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold">{title}</div>
                    <div className="mt-1 text-xs text-slate-500">{body}</div>
                  </div>
                  <Switch defaultChecked={Boolean(enabled)} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <CardHeader>
          <CardTitle>{text.catalog.lower.alertsTitle}</CardTitle>
          <CardDescription>{text.catalog.lower.alertsDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {alertProducts.length ? (
            alertProducts.map((product) => (
              <div
                key={product.sku}
                className="flex items-center gap-3 rounded-lg border border-slate-100 p-3"
              >
                <span
                  className={cn(
                    "size-2.5 rounded-full",
                    product.stock === 0 ? "bg-red-500" : "bg-amber-500"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{product.sku}</div>
                  <div className="text-xs text-slate-500">
                    {formatAdminMessage(text.catalog.lower.stockLabel, {
                      count: product.stock,
                    })}
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon-sm" className="bg-white">
                      <HelpCircle className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{text.catalog.noSupplierTooltip}</TooltipContent>
                </Tooltip>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm font-medium text-slate-500">
              {text.catalog.empty}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
