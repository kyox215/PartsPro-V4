import { NextResponse } from "next/server";
import { z } from "zod";

export type ParsedQueryParams =
  | { ok: true; data: Record<string, string> }
  | {
      ok: false;
      details: {
        unknown: string[];
        repeated: string[];
      };
    };

export async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, data: (await request.json()) as unknown };
  } catch {
    return { ok: false as const };
  }
}

export function readQueryParams(params: URLSearchParams, allowedKeys: Set<string>): ParsedQueryParams {
  const data: Record<string, string> = {};
  const unknown: string[] = [];
  const repeated: string[] = [];

  for (const key of params.keys()) {
    if (!allowedKeys.has(key)) {
      unknown.push(key);
      continue;
    }

    const values = params.getAll(key);
    if (values.length > 1) {
      repeated.push(key);
      continue;
    }

    data[key] = values[0];
  }

  if (unknown.length > 0 || repeated.length > 0) {
    return {
      ok: false,
      details: {
        unknown: [...new Set(unknown)].sort(),
        repeated: [...new Set(repeated)].sort(),
      },
    };
  }

  return { ok: true, data };
}

export function apiError(status: number, code: string, message: string, details?: unknown) {
  const error: {
    code: string;
    message: string;
    details?: unknown;
  } = { code, message };

  if (details !== undefined) {
    error.details = details;
  }

  return NextResponse.json({ error }, { status });
}

export function formatZodIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
    message: issue.message,
  }));
}

export function money(cents: number) {
  return {
    amount: (cents / 100).toFixed(2),
    cents,
    currency: "EUR",
  };
}

export function decimal(value: number) {
  return value.toFixed(2);
}

export function toCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100);
}

export function centsToNumber(cents: number) {
  return Number((cents / 100).toFixed(2));
}

export function isValidIsoDate(value: string) {
  return parseIsoDate(value) !== null;
}

export function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return timestamp;
}

export function parseItalianDate(value: string) {
  const [day, month, year] = value.split("/").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function formatItalianDate(value: unknown) {
  const date = coerceDate(value);

  if (!date) {
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date());
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatPartsProDateTime(value: unknown) {
  const date = coerceDate(value);

  if (!date) {
    return new Date().toISOString().slice(0, 16).replace("T", " ");
  }

  return date.toISOString().slice(0, 16).replace("T", " ");
}

function coerceDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}
