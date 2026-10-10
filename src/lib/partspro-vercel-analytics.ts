import "server-only";

type AnalyticsRange = 7 | 30;

type AnalyticsMetricRow = {
  pageviews: number;
  visitors: number;
};

export type WebsiteAnalyticsSnapshot = {
  countries: Array<AnalyticsMetricRow & { country: string }>;
  daily: Array<AnalyticsMetricRow & { date: string }>;
  generatedAt: string;
  pageviews: number;
  pages: Array<AnalyticsMetricRow & { route: string }>;
  range: AnalyticsRange;
  referrers: Array<AnalyticsMetricRow & { referrer: string }>;
  visitors: number;
};

type CacheEntry = {
  expiresAt: number;
  snapshot: WebsiteAnalyticsSnapshot;
};

const analyticsCache = new Map<AnalyticsRange, CacheEntry>();
const analyticsApiBase = "https://api.vercel.com/v1/query/web-analytics/visits/aggregate";
const cacheDurationMs = 5 * 60 * 1000;
const requestTimeoutMs = 8_000;

export class WebsiteAnalyticsConfigError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super("Website analytics server configuration is incomplete.");
    this.name = "WebsiteAnalyticsConfigError";
    this.missing = missing;
  }
}

export async function readWebsiteAnalytics(
  range: AnalyticsRange
): Promise<WebsiteAnalyticsSnapshot> {
  const cached = analyticsCache.get(range);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.snapshot;
  }

  const config = readAnalyticsConfig();
  const dates = analyticsDateRange(range);
  const [dailyRows, countryRows, pageRows, referrerRows, totalRows] = await Promise.all([
    queryAggregate(config, dates, "day", 40),
    queryAggregate(config, dates, "country", 12),
    queryAggregate(config, dates, "route", 10),
    queryAggregate(config, dates, "referrerHostname", 10),
    queryAggregate(config, dates, "environment", 1),
  ]);
  // A single production-environment group spans the full requested period.
  // The API requires a supported grouping; the literal "[]" is rejected.
  if (totalRows.length > 1 || totalRows.some(row => row.environment !== "production")) {
    throw new Error("Vercel Web Analytics total has an unexpected environment.");
  }
  const daily = dailyRows
    .map((row) => ({
      date: readDate(row.timestamp),
      pageviews: readMetric(row.pageviews),
      visitors: readMetric(row.visitors),
    }))
    .filter((row) => Boolean(row.date))
    .sort((left, right) => left.date.localeCompare(right.date));
  const snapshot: WebsiteAnalyticsSnapshot = {
    countries: countryRows
      .map((row) => ({
        country: readDimension(row.country),
        pageviews: readMetric(row.pageviews),
        visitors: readMetric(row.visitors),
      }))
      .filter((row) => Boolean(row.country)),
    daily,
    generatedAt: new Date().toISOString(),
    pageviews: readMetric(totalRows[0]?.pageviews),
    pages: pageRows
      .map((row) => ({
        route: readDimension(row.route),
        pageviews: readMetric(row.pageviews),
        visitors: readMetric(row.visitors),
      }))
      .filter((row) => Boolean(row.route)),
    range,
    referrers: referrerRows
      .map((row) => ({
        referrer: readDimension(row.referrerHostname),
        pageviews: readMetric(row.pageviews),
        visitors: readMetric(row.visitors),
      }))
      .filter((row) => Boolean(row.referrer)),
    visitors: readMetric(totalRows[0]?.visitors),
  };

  analyticsCache.set(range, {
    expiresAt: Date.now() + cacheDurationMs,
    snapshot,
  });

  return snapshot;
}

function readAnalyticsConfig() {
  const token = process.env.VERCEL_ANALYTICS_TOKEN?.trim();
  const projectId = (
    process.env.PARTSPRO_VERCEL_PROJECT_ID ?? process.env.VERCEL_PROJECT_ID
  )?.trim();
  const teamId = (
    process.env.PARTSPRO_VERCEL_TEAM_ID ??
    process.env.VERCEL_TEAM_ID ??
    process.env.VERCEL_ORG_ID
  )?.trim();
  const missing: string[] = [];

  if (!token) {
    missing.push("VERCEL_ANALYTICS_TOKEN");
  }

  if (!projectId) {
    missing.push("VERCEL_PROJECT_ID");
  }

  if (!teamId) {
    missing.push("VERCEL_TEAM_ID");
  }

  if (missing.length > 0) {
    throw new WebsiteAnalyticsConfigError(missing);
  }

  return { projectId, teamId, token } as {
    projectId: string;
    teamId: string;
    token: string;
  };
}

function analyticsDateRange(range: AnalyticsRange) {
  const until = new Date();
  const since = new Date(until);
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (range - 1));

  return {
    since: since.toISOString(),
    until: until.toISOString(),
  };
}

async function queryAggregate(
  config: { projectId: string; teamId: string; token: string },
  dates: { since: string; until: string },
  by: "country" | "day" | "referrerHostname" | "route" | "environment",
  limit: number
) {
  const url = new URL(analyticsApiBase);
  url.searchParams.set("projectId", config.projectId);
  url.searchParams.set("teamId", config.teamId);
  url.searchParams.set("since", dates.since);
  url.searchParams.set("until", dates.until);
  url.searchParams.set("by", by);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("filter", "environment eq 'production'");

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.token}`,
    },
    signal: AbortSignal.timeout(requestTimeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Vercel Web Analytics API returned ${response.status}.`);
  }

  const payload = (await response.json()) as unknown;

  if (!isRecord(payload) || (!Array.isArray(payload.data) && !isRecord(payload.data))) {
    throw new Error("Vercel Web Analytics API returned an invalid response.");
  }

  const rawRows = Array.isArray(payload.data) ? payload.data : [payload.data];
  if (rawRows.some(row => !isRecord(row))) {
    throw new Error("Vercel Web Analytics API returned an invalid row.");
  }
  const rows = rawRows as Record<string, unknown>[];
  if (rows.some(row =>
    typeof row.pageviews !== "number" || !Number.isSafeInteger(row.pageviews) || row.pageviews < 0 ||
    typeof row.visitors !== "number" || !Number.isSafeInteger(row.visitors) || row.visitors < 0
  )) throw new Error("Vercel Web Analytics metrics are missing or invalid.");
  return rows;
}

function readMetric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function readDimension(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readDate(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
