"use client";

import * as React from "react";
import { AdminMetricSummary } from "./admin-summary-components";
import { AdminEmptyState, AdminNotice } from "./admin-feedback";
import dynamic from "next/dynamic";
import {
  BarChart3,
  Eye,
  Globe2,
  MousePointerClick,
  RefreshCw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "./i18n-provider";

type AnalyticsRange = 7 | 30;

type MetricRow = {
  pageviews: number;
  visitors: number;
};

type AnalyticsSnapshot = {
  countries: Array<MetricRow & { country: string }>;
  daily: Array<MetricRow & { date: string }>;
  generatedAt: string;
  pages: Array<MetricRow & { route: string }>;
  pageviews: number;
  range: AnalyticsRange;
  referrers: Array<MetricRow & { referrer: string }>;
  visitors: number;
};

type TrafficTrendPoint = MetricRow & {
  date: string;
  label: string;
};

type AnalyticsState = {
  data: AnalyticsSnapshot | null;
  errorCode: string | null;
  isLoading: boolean;
};

const AdminTrafficTrendChart = dynamic(
  () =>
    import("./admin-analytics-charts").then(
      (module) => module.AdminTrafficTrendChart
    ),
  { ssr: false, loading: () => <ChartLoading /> }
);

export function AdminAnalyticsPanel() {
  const { locale } = useI18n();
  const copy = analyticsCopy[locale];
  const [range, setRange] = React.useState<AnalyticsRange>(7);
  const [reloadIndex, setReloadIndex] = React.useState(0);
  const [state, setState] = React.useState<AnalyticsState>({
    data: null,
    errorCode: null,
    isLoading: true,
  });

  React.useEffect(() => {
    const controller = new AbortController();

    void fetch(`/api/admin/analytics?range=${range}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as unknown;

        if (!response.ok) {
          throw new AnalyticsRequestError(readErrorCode(payload));
        }

        const data = normalizeSnapshot(payload);

        if (!data) {
          throw new AnalyticsRequestError("INVALID_RESPONSE");
        }

        return data;
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ data, errorCode: null, isLoading: false });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState((current) => ({
            ...current,
            errorCode:
              error instanceof AnalyticsRequestError ? error.code : "UNKNOWN_ERROR",
            isLoading: false,
          }));
        }
      });

    return () => controller.abort();
  }, [range, reloadIndex]);

  const data = state.data;
  const trend = React.useMemo<TrafficTrendPoint[]>(
    () =>
      (data?.daily ?? []).map((row) => ({
        ...row,
        label: formatDay(row.date, locale),
      })),
    [data?.daily, locale]
  );
  const leadingCountry = data?.countries[0];
  const viewsPerVisitor = data?.visitors
    ? data.pageviews / Math.max(1, data.visitors)
    : 0;

  return (
    <section className="admin-ui-panel min-w-0 space-y-3 sm:space-y-4" aria-busy={state.isLoading}>
      <header className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary">
            <BarChart3 className="size-4" />
            {copy.eyebrow}
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
            {copy.title}
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            {copy.description}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            {([7, 30] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={range === value}
                onClick={() => {
                  if (range === value) {
                    return;
                  }

                  setState((current) => ({
                    ...current,
                    errorCode: null,
                    isLoading: true,
                  }));
                  setRange(value);
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-bold transition",
                  range === value
                    ? "bg-white text-primary shadow-sm"
                    : "text-slate-600 hover:text-slate-950"
                )}
              >
                {copy.range(value)}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={state.isLoading}
            onClick={() => {
              setState((current) => ({
                ...current,
                errorCode: null,
                isLoading: true,
              }));
              setReloadIndex((value) => value + 1);
            }}
          >
            <RefreshCw className={cn("size-4", state.isLoading && "animate-spin")} />
            {copy.refresh}
          </Button>
        </div>
      </header>

      {state.errorCode ? (
        <AnalyticsError code={state.errorCode} copy={copy} />
      ) : (
        <>
          <AdminMetricSummary className="sm:hidden" ariaLabel={copy.title} items={[
            { key: "pageviews", label: copy.pageviews, value: state.isLoading ? "—" : formatCount(data?.pageviews, locale), tone: "blue" },
            { key: "visitors", label: copy.visitors, value: state.isLoading ? "—" : formatCount(data?.visitors, locale), tone: "violet" },
            { key: "viewsPerVisitor", label: copy.viewsPerVisitor, value: state.isLoading ? "—" : formatDecimal(viewsPerVisitor, locale), tone: "blue" },
            { key: "country", label: copy.leadingCountry, value: state.isLoading ? "—" : leadingCountry ? <><span>{formatCountry(leadingCountry.country, locale)}</span><span className="block text-xs font-semibold text-slate-500">{formatCount(leadingCountry.visitors, locale)} {copy.visitors.toLowerCase()}</span></> : copy.noData, tone: "green" },
          ]} />
          <details className="text-xs text-slate-500 sm:hidden">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold">{locale.startsWith("zh") ? "指标说明" : "Dettagli metriche"}</summary>
            <p>{copy.selectedRange(range)} · {copy.privacyDetail}</p>
            <p>{copy.averageDetail}</p>
            {!leadingCountry && <p>{copy.countryDetail}</p>}
          </details>
          <div className="hidden min-w-0 grid-cols-2 gap-2 sm:grid sm:gap-3 xl:grid-cols-4">
            <MetricCard
              icon={Eye}
              label={copy.pageviews}
              value={formatCount(data?.pageviews, locale)}
              detail={copy.selectedRange(range)}
              tone="blue"
              loading={state.isLoading}
            />
            <MetricCard
              icon={Users}
              label={copy.visitors}
              value={formatCount(data?.visitors, locale)}
              detail={copy.privacyDetail}
              tone="violet"
              loading={state.isLoading}
            />
            <MetricCard
              icon={MousePointerClick}
              label={copy.viewsPerVisitor}
              value={formatDecimal(viewsPerVisitor, locale)}
              detail={copy.averageDetail}
              tone="cyan"
              loading={state.isLoading}
            />
            <MetricCard
              icon={Globe2}
              label={copy.leadingCountry}
              value={
                leadingCountry
                  ? formatCountry(leadingCountry.country, locale)
                  : copy.noData
              }
              detail={
                leadingCountry
                  ? `${formatCount(leadingCountry.visitors, locale)} ${copy.visitors.toLowerCase()}`
                  : copy.countryDetail
              }
              tone="green"
              loading={state.isLoading}
            />
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
            <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4">
                <h2 className="text-base font-black text-slate-950">{copy.trend}</h2>
                <p className="mt-1 text-xs text-slate-500">{copy.trendDescription}</p>
              </div>
              <AdminTrafficTrendChart
                data={trend}
                pageviewsLabel={copy.pageviews}
                visitorsLabel={copy.visitors}
              />
            </article>

            <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-black text-slate-950">{copy.countries}</h2>
              <p className="mt-1 text-xs text-slate-500">{copy.countriesDescription}</p>
              <CountryList
                rows={data?.countries ?? []}
                locale={locale}
                noData={copy.noData}
                visitorsLabel={copy.visitors}
              />
            </article>
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <RankingCard
              title={copy.topPages}
              description={copy.topPagesDescription}
              rows={(data?.pages ?? []).map((row) => ({
                key: row.route,
                label: formatRoute(row.route),
                pageviews: row.pageviews,
                visitors: row.visitors,
              }))}
              locale={locale}
              copy={copy}
            />
            <RankingCard
              title={copy.referrers}
              description={copy.referrersDescription}
              rows={(data?.referrers ?? []).map((row) => ({
                key: row.referrer,
                label: formatReferrer(row.referrer, copy.direct),
                pageviews: row.pageviews,
                visitors: row.visitors,
              }))}
              locale={locale}
              copy={copy}
            />
          </div>

          <footer className="flex flex-col gap-1 px-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>{copy.source}</span>
            <span>
              {copy.updated}: {formatDateTime(data?.generatedAt, locale)}
            </span>
          </footer>
        </>
      )}
    </section>
  );
}

function MetricCard({
  detail,
  icon: Icon,
  label,
  loading,
  tone,
  value,
}: {
  detail: string;
  icon: typeof Eye;
  label: string;
  loading: boolean;
  tone: "blue" | "cyan" | "green" | "violet";
  value: string;
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    cyan: "bg-cyan-50 text-cyan-700",
    green: "bg-emerald-50 text-emerald-700",
    violet: "bg-violet-50 text-violet-700",
  } as const;

  return (
    <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
          <p className={cn("mt-2 break-all text-xl font-black text-slate-950 sm:text-2xl", loading && "animate-pulse text-slate-300")}>
            {loading ? "—" : value}
          </p>
        </div>
        <div className={cn("grid size-7 shrink-0 place-items-center rounded-lg sm:size-10", tones[tone])}>
          <Icon className="size-5" />
        </div>
      </div>
      <p className="mt-3 truncate text-xs text-slate-500">{detail}</p>
    </article>
  );
}

function CountryList({
  locale,
  noData,
  rows,
  visitorsLabel,
}: {
  locale: string;
  noData: string;
  rows: AnalyticsSnapshot["countries"];
  visitorsLabel: string;
}) {
  const maxVisitors = Math.max(1, ...rows.map((row) => row.visitors));

  if (rows.length === 0) {
    return <EmptyState label={noData} />;
  }

  return (
    <div className="mt-4 space-y-3">
      {rows.slice(0, 8).map((row) => (
        <div key={row.country} className="min-w-0">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate font-semibold text-slate-700">
              {formatCountry(row.country, locale)}
            </span>
            <span className="shrink-0 text-slate-500">
              {formatCount(row.visitors, locale)} {visitorsLabel.toLowerCase()}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max(3, (row.visitors / maxVisitors) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RankingCard({
  copy,
  description,
  locale,
  rows,
  title,
}: {
  copy: AnalyticsCopy;
  description: string;
  locale: string;
  rows: Array<MetricRow & { key: string; label: string }>;
  title: string;
}) {
  return (
    <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-black text-slate-950">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      {rows.length === 0 ? (
        <EmptyState label={copy.noData} />
      ) : (
        <div className="mt-4 divide-y divide-slate-100">
          {rows.slice(0, 8).map((row, index) => (
            <div key={row.key} className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-slate-100 text-xs font-black text-slate-500">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700" title={row.label}>
                {row.label}
              </span>
              <div className="shrink-0 text-right">
                <div className="text-sm font-black text-slate-900">
                  {formatCount(row.pageviews, locale)}
                </div>
                <div className="text-[11px] text-slate-500">{copy.pageviews}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function AnalyticsError({ code, copy }: { code: string; copy: AnalyticsCopy }) {
  const isConfigError = code === "ANALYTICS_NOT_CONFIGURED";

  return (
    <AdminNotice tone={isConfigError ? "warning" : "error"} title={isConfigError ? copy.configTitle : copy.errorTitle} message={isConfigError ? copy.configDescription : copy.errorDescription} />
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <AdminEmptyState className="mt-4" title={label} />
  );
}

function ChartLoading() {
  return <div className="h-[260px] animate-pulse rounded-lg bg-slate-100" />;
}

class AnalyticsRequestError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "AnalyticsRequestError";
    this.code = code;
  }
}

function normalizeSnapshot(payload: unknown): AnalyticsSnapshot | null {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    return null;
  }

  const data = payload.data;
  const range = data.range === 30 ? 30 : data.range === 7 ? 7 : null;

  if (!range) {
    return null;
  }

  return {
    countries: normalizeRows(data.countries, "country") as AnalyticsSnapshot["countries"],
    daily: normalizeRows(data.daily, "date") as AnalyticsSnapshot["daily"],
    generatedAt: readString(data.generatedAt) ?? new Date().toISOString(),
    pages: normalizeRows(data.pages, "route") as AnalyticsSnapshot["pages"],
    pageviews: readNumber(data.pageviews),
    range,
    referrers: normalizeRows(data.referrers, "referrer") as AnalyticsSnapshot["referrers"],
    visitors: readNumber(data.visitors),
  };
}

function normalizeRows(value: unknown, key: string) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((row) => ({
      [key]: readString(row[key]) ?? "",
      pageviews: readNumber(row.pageviews),
      visitors: readNumber(row.visitors),
    }))
    .filter((row) => Boolean(row[key]));
}

function readErrorCode(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return "UNKNOWN_ERROR";
  }

  return readString(payload.error.code) ?? "UNKNOWN_ERROR";
}

function readString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatCount(value: number | undefined, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value ?? 0);
}

function formatDecimal(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(value);
}

function formatDay(value: string, locale: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(date)
    : value;
}

function formatDateTime(value: string | undefined, locale: string) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date)
    : "—";
}

function formatCountry(country: string, locale: string) {
  if (country === "Others") {
    return locale === "zh-CN" ? "其他" : "Altri";
  }

  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(country) ?? country;
  } catch {
    return country;
  }
}

function formatRoute(route: string) {
  return route === "/" ? "Homepage" : route;
}

function formatReferrer(referrer: string, direct: string) {
  return referrer === "(direct)" || referrer === "Direct" ? direct : referrer;
}

type AnalyticsCopy = (typeof analyticsCopy)[keyof typeof analyticsCopy];

const analyticsCopy = {
  "zh-CN": {
    averageDetail: "浏览量 ÷ 独立访客",
    configDescription:
      "采集组件已经就绪，但生产环境还需要配置只读 Vercel Analytics Token。完成配置并重新部署后即可显示数据。",
    configTitle: "网站统计尚未完成服务端配置",
    countries: "访客国家分布",
    countriesDescription: "按独立访客数量排列，仅显示匿名聚合结果",
    countryDetail: "等待地区数据",
    description: "查看商城页面的匿名访问趋势、访客国家、热门页面和流量来源。",
    direct: "直接访问",
    errorDescription: "Vercel Web Analytics 暂时无法返回数据，请稍后刷新。",
    errorTitle: "统计数据暂不可用",
    eyebrow: "网站运营",
    leadingCountry: "主要访客国家",
    noData: "当前时间范围暂无访问数据",
    pageviews: "页面浏览量",
    privacyDetail: "每日匿名访客，不使用 Cookie",
    range: (days: number) => `${days} 天`,
    referrers: "主要流量来源",
    referrersDescription: "访客进入 PartsPro 前所在的网站",
    refresh: "刷新",
    selectedRange: (days: number) => `最近 ${days} 天`,
    source: "数据来源：Vercel Web Analytics（匿名聚合）",
    title: "网站访问统计",
    topPages: "热门页面",
    topPagesDescription: "按页面浏览量排序",
    trend: "访问趋势",
    trendDescription: "页面浏览量与独立访客的每日变化",
    updated: "更新于",
    viewsPerVisitor: "人均浏览页数",
    visitors: "独立访客",
  },
  "it-IT": {
    averageDetail: "Visualizzazioni ÷ visitatori unici",
    configDescription:
      "La raccolta è pronta, ma in produzione manca un token Vercel Analytics in sola lettura. Dopo la configurazione e un nuovo deploy compariranno i dati.",
    configTitle: "Configurazione server delle statistiche incompleta",
    countries: "Paesi dei visitatori",
    countriesDescription: "Ordinati per visitatori unici, solo dati aggregati anonimi",
    countryDetail: "In attesa dei dati geografici",
    description:
      "Consulta trend anonimi, paesi dei visitatori, pagine più viste e sorgenti di traffico del negozio.",
    direct: "Accesso diretto",
    errorDescription: "Vercel Web Analytics non risponde al momento. Riprova tra poco.",
    errorTitle: "Statistiche temporaneamente non disponibili",
    eyebrow: "Operazioni sito",
    leadingCountry: "Paese principale",
    noData: "Nessun dato di visita nel periodo selezionato",
    pageviews: "Visualizzazioni",
    privacyDetail: "Visitatori anonimi giornalieri, senza cookie",
    range: (days: number) => `${days} giorni`,
    referrers: "Principali sorgenti",
    referrersDescription: "Siti visitati prima di entrare su PartsPro",
    refresh: "Aggiorna",
    selectedRange: (days: number) => `Ultimi ${days} giorni`,
    source: "Fonte: Vercel Web Analytics (dati anonimi aggregati)",
    title: "Statistiche visite sito",
    topPages: "Pagine più viste",
    topPagesDescription: "Ordinate per visualizzazioni",
    trend: "Trend visite",
    trendDescription: "Andamento giornaliero di visualizzazioni e visitatori unici",
    updated: "Aggiornato",
    viewsPerVisitor: "Pagine per visitatore",
    visitors: "Visitatori unici",
  },
} as const;
