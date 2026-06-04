import "server-only";

import crypto from "node:crypto";

export type EbayEnvironment = "sandbox" | "production";

export type EbayTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  token_type: string;
};

export const ebayDefaultScopes = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  "https://api.ebay.com/oauth/api_scope/commerce.notification.subscription",
] as const;

export class EbayApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "EbayApiError";
  }
}

export function isEbayAppConfigured(environment: EbayEnvironment) {
  const credentials = readEbayCredentials(environment, false);
  return Boolean(credentials.clientId && credentials.clientSecret && credentials.ruName);
}

export function getEbayAuthorizationUrl(input: {
  environment: EbayEnvironment;
  scopes?: readonly string[];
  state: string;
}) {
  const credentials = readEbayCredentials(input.environment, true);
  const url = new URL(`${ebayAuthBase(input.environment)}/oauth2/authorize`);
  url.searchParams.set("client_id", credentials.clientId);
  url.searchParams.set("redirect_uri", credentials.ruName);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", (input.scopes ?? ebayDefaultScopes).join(" "));
  url.searchParams.set("state", input.state);
  return url.toString();
}

export async function exchangeEbayAuthorizationCode(input: {
  code: string;
  environment: EbayEnvironment;
}) {
  const credentials = readEbayCredentials(input.environment, true);
  return requestEbayToken(input.environment, {
    body: new URLSearchParams({
      code: input.code,
      grant_type: "authorization_code",
      redirect_uri: credentials.ruName,
    }),
    credentials,
  });
}

export async function refreshEbayAccessToken(input: {
  environment: EbayEnvironment;
  refreshToken: string;
  scopes?: readonly string[];
}) {
  const credentials = readEbayCredentials(input.environment, true);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
  });

  if (input.scopes?.length) {
    body.set("scope", input.scopes.join(" "));
  }

  return requestEbayToken(input.environment, { body, credentials });
}

export class EbaySellClient {
  constructor(
    private readonly environment: EbayEnvironment,
    private readonly accessToken: string
  ) {}

  createOrReplaceInventoryItem(sku: string, payload: unknown) {
    return this.request(`/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
      body: JSON.stringify(payload),
      method: "PUT",
    });
  }

  getOffers(sku: string) {
    const params = new URLSearchParams({ sku });
    return this.request<{ offers?: Array<{ offerId?: string; listing?: { listingId?: string } }> }>(
      `/sell/inventory/v1/offer?${params.toString()}`
    );
  }

  createOffer(payload: unknown) {
    return this.request<{ offerId?: string }>(`/sell/inventory/v1/offer`, {
      body: JSON.stringify(payload),
      method: "POST",
    });
  }

  updateOffer(offerId: string, payload: unknown) {
    return this.request(`/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`, {
      body: JSON.stringify(payload),
      method: "PUT",
    });
  }

  publishOffer(offerId: string) {
    return this.request<{ listingId?: string; warnings?: unknown[] }>(
      `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`,
      { method: "POST" }
    );
  }

  bulkUpdatePriceQuantity(payload: unknown) {
    return this.request(`/sell/inventory/v1/bulk_update_price_quantity`, {
      body: JSON.stringify(payload),
      method: "POST",
    });
  }

  getOrders(filter: string) {
    const params = new URLSearchParams({ filter, limit: "50" });
    return this.request<{ orders?: unknown[]; total?: number }>(
      `/sell/fulfillment/v1/order?${params.toString()}`
    );
  }

  createShippingFulfillment(orderId: string, payload: unknown) {
    return this.request<{ fulfillmentId?: string }>(
      `/sell/fulfillment/v1/order/${encodeURIComponent(orderId)}/shipping_fulfillment`,
      {
        body: JSON.stringify(payload),
        method: "POST",
      }
    );
  }

  private async request<T = unknown>(
    path: string,
    init: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${ebayApiBase(this.environment)}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (response.status === 204) {
      return {} as T;
    }

    const payload = (await readResponsePayload(response)) as T;

    if (!response.ok) {
      throw new EbayApiError(
        response.status,
        readEbayErrorMessage(payload) ?? `eBay API request failed with ${response.status}`,
        payload
      );
    }

    return payload;
  }
}

export function encryptEbaySecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ebayEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptEbaySecret(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const [version, ivValue, tagValue, encryptedValue] = value.split(":");

  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
    return null;
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    ebayEncryptionKey(),
    Buffer.from(ivValue, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function readEbayCredentials(environment: EbayEnvironment, required: boolean) {
  const prefix = environment === "sandbox" ? "EBAY_SANDBOX" : "EBAY_PRODUCTION";
  const clientId = process.env[`${prefix}_CLIENT_ID`] ?? process.env.EBAY_CLIENT_ID ?? "";
  const clientSecret =
    process.env[`${prefix}_CLIENT_SECRET`] ?? process.env.EBAY_CLIENT_SECRET ?? "";
  const ruName = process.env[`${prefix}_RUNAME`] ?? process.env.EBAY_RUNAME ?? "";

  if (required && (!clientId || !clientSecret || !ruName)) {
    throw new Error(
      `Missing eBay OAuth credentials for ${environment}. Configure ${prefix}_CLIENT_ID, ${prefix}_CLIENT_SECRET, and ${prefix}_RUNAME.`
    );
  }

  return { clientId, clientSecret, ruName };
}

async function requestEbayToken(
  environment: EbayEnvironment,
  input: {
    body: URLSearchParams;
    credentials: { clientId: string; clientSecret: string };
  }
) {
  const response = await fetch(`${ebayApiBase(environment)}/identity/v1/oauth2/token`, {
    body: input.body.toString(),
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${input.credentials.clientId}:${input.credentials.clientSecret}`
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
  const payload = (await readResponsePayload(response)) as EbayTokenResponse;

  if (!response.ok) {
    throw new EbayApiError(
      response.status,
      readEbayErrorMessage(payload) ?? "eBay OAuth token request failed.",
      payload
    );
  }

  return payload;
}

async function readResponsePayload(response: Response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function readEbayErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const errors = Array.isArray(record.errors) ? record.errors : [];
  const firstError = errors.find(
    (error): error is Record<string, unknown> =>
      typeof error === "object" && error !== null
  );

  if (typeof firstError?.message === "string") {
    return firstError.message;
  }

  if (typeof record.error_description === "string") {
    return record.error_description;
  }

  if (typeof record.message === "string") {
    return record.message;
  }

  return null;
}

function ebayEncryptionKey() {
  const secret = process.env.EBAY_TOKEN_ENCRYPTION_KEY;

  if (!secret) {
    throw new Error("Missing EBAY_TOKEN_ENCRYPTION_KEY.");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

function ebayApiBase(environment: EbayEnvironment) {
  return environment === "production"
    ? "https://api.ebay.com"
    : "https://api.sandbox.ebay.com";
}

function ebayAuthBase(environment: EbayEnvironment) {
  return environment === "production"
    ? "https://auth.ebay.com"
    : "https://auth.sandbox.ebay.com";
}
