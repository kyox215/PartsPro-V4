import "server-only";

import { createHash } from "node:crypto";
import {
  EbayApiError,
  EbaySellClient,
  decryptEbaySecret,
  ebayDefaultScopes,
  encryptEbaySecret,
  exchangeEbayAuthorizationCode,
  isEbayAppConfigured,
  refreshEbayAccessToken,
  type EbayEnvironment,
  type EbayTokenResponse,
} from "@/lib/partspro-ebay-client";
import { getPartsProSiteUrl } from "@/lib/partspro-site-url";
import {
  RepositoryWriteError,
  getAdminProduct,
  listAdminProducts,
  type AdminOrder,
  type AdminProduct,
} from "@/lib/partspro-repository";
import { createClient } from "@/lib/supabase/server";

type DbRow = Record<string, unknown>;
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export const ebayMarketplaceDefaults = {
  currency: "EUR",
  environment: "sandbox" as EbayEnvironment,
  listingLocale: "it-IT",
  marketplaceId: "EBAY_IT",
  operationLocale: "zh-CN",
  provider: "ebay",
};

export type MarketplaceSettingsDto = {
  autoPublishEnabled: boolean;
  autoSyncEnabled: boolean;
  currency: string;
  defaultConditionId: string;
  defaultConditionLabel: string;
  enabled: boolean;
  environment: EbayEnvironment;
  fulfillmentPolicyId: string | null;
  listingDuration: string;
  listingLocale: string;
  marketplaceId: string;
  markupFixed: number;
  markupPercent: number;
  merchantLocationKey: string | null;
  offerFormat: string;
  operationLocale: string;
  orderImportEnabled: boolean;
  paymentPolicyId: string | null;
  productionEnabled: boolean;
  provider: string;
  returnPolicyId: string | null;
  stockBuffer: number;
};

export type MarketplaceConnectionDto = {
  accountId: string | null;
  accountLabel: string | null;
  connected: boolean;
  connectionStatus: string;
  environment: EbayEnvironment;
  lastConnectedAt: string | null;
  lastError: string | null;
  marketplaceId: string;
  oauthScopes: string[];
  tokenExpiresAt: string | null;
};

export type MarketplaceCategoryMappingDto = {
  aspects: Record<string, string[]>;
  brand: string | null;
  conditionId: string;
  conditionLabel: string;
  ebayCategoryId: string;
  ebayCategoryName: string | null;
  ebayCategoryTreeId: string;
  enabled: boolean;
  id: string;
  localCategory: string;
  modelSeries: string | null;
  requiredAspects: unknown[];
};

export type MarketplaceListingDto = {
  blockers: string[];
  computedPrice: number;
  computedQuantity: number;
  ebayItemWebUrl: string | null;
  ebayListingId: string | null;
  ebayOfferId: string | null;
  eligibilityStatus: string;
  id: string;
  lastErrorMessage: string | null;
  lastPublishedAt: string | null;
  lastSyncedAt: string | null;
  listingStatus: string;
  productName: string;
  sku: string;
  syncEnabled: boolean;
  title: string | null;
};

export type MarketplaceJobDto = {
  attempts: number;
  createdAt: string;
  errorMessage: string | null;
  id: string;
  jobType: string;
  status: string;
  targetOrderId: string | null;
  targetSku: string | null;
  updatedAt: string;
};

export type MarketplaceOrderLinkDto = {
  currency: string;
  externalOrderId: string;
  importStatus: string;
  importedAt: string | null;
  lastError: string | null;
  localOrderNo: string | null;
  total: number;
};

export type MarketplaceOverviewDto = {
  categoryMappings: MarketplaceCategoryMappingDto[];
  connection: MarketplaceConnectionDto | null;
  jobs: MarketplaceJobDto[];
  listings: MarketplaceListingDto[];
  orderLinks: MarketplaceOrderLinkDto[];
  settings: MarketplaceSettingsDto;
  summary: {
    blocked: number;
    connected: boolean;
    eligible: number;
    failedJobs: number;
    importedOrders: number;
    published: number;
    queuedJobs: number;
  };
};

export type MarketplaceQueueAction =
  | "import_orders"
  | "plan_listings"
  | "publish_eligible"
  | "sync_inventory";

export type MarketplaceQueueResult = {
  blocked: number;
  eligible: number;
  enqueued: number;
  evaluated: number;
  skipped: number;
};

export type MarketplaceSettingsInput = Partial<
  Pick<
    MarketplaceSettingsDto,
    | "autoPublishEnabled"
    | "autoSyncEnabled"
    | "defaultConditionId"
    | "defaultConditionLabel"
    | "enabled"
    | "fulfillmentPolicyId"
    | "listingDuration"
    | "markupFixed"
    | "markupPercent"
    | "merchantLocationKey"
    | "offerFormat"
    | "orderImportEnabled"
    | "paymentPolicyId"
    | "productionEnabled"
    | "returnPolicyId"
    | "stockBuffer"
  >
> & {
  categoryMappings?: MarketplaceCategoryMappingWriteInput[];
  environment?: EbayEnvironment;
};

export type MarketplaceCategoryMappingWriteInput = {
  aspects?: Record<string, string[]>;
  brand?: string | null;
  conditionId?: string;
  conditionLabel?: string;
  ebayCategoryId: string;
  ebayCategoryName?: string | null;
  ebayCategoryTreeId?: string;
  enabled?: boolean;
  localCategory: string;
  modelSeries?: string | null;
  requiredAspects?: unknown[];
};

export async function getMarketplaceOverview(): Promise<MarketplaceOverviewDto> {
  const client = await createClient();
  const [settings, connection, categoryMappings, listings, jobs, orderLinks] =
    await Promise.all([
      readMarketplaceSettings(client),
      readMarketplaceConnection(client),
      readCategoryMappings(client),
      readMarketplaceListings(client),
      readMarketplaceJobs(client),
      readMarketplaceOrderLinks(client),
    ]);
  const enrichedListings = await enrichListingsWithProducts(listings, settings, categoryMappings);

  return {
    categoryMappings: categoryMappings.map(toCategoryMappingDto),
    connection: connection ? toConnectionDto(connection) : null,
    jobs: jobs.map(toJobDto),
    listings: enrichedListings,
    orderLinks: orderLinks.map(toOrderLinkDto),
    settings: toSettingsDto(settings),
    summary: {
      blocked: enrichedListings.filter((listing) => listing.eligibilityStatus === "blocked").length,
      connected: connection?.connection_status === "connected",
      eligible: enrichedListings.filter((listing) => listing.eligibilityStatus === "eligible").length,
      failedJobs: jobs.filter((job) => job.status === "failed").length,
      importedOrders: orderLinks.filter((link) => link.import_status === "imported").length,
      published: enrichedListings.filter((listing) => listing.listingStatus === "published").length,
      queuedJobs: jobs.filter((job) => job.status === "queued").length,
    },
  };
}

export async function updateMarketplaceSettings(input: MarketplaceSettingsInput) {
  const client = await createClient();
  const settings = await readMarketplaceSettings(client);
  const environment = input.environment ?? toEbayEnvironment(settings.environment);
  const payload = {
    auto_publish_enabled: input.autoPublishEnabled,
    auto_sync_enabled: input.autoSyncEnabled,
    default_condition_id: input.defaultConditionId,
    default_condition_label: input.defaultConditionLabel,
    enabled: input.enabled,
    environment,
    fulfillment_policy_id: emptyToNull(input.fulfillmentPolicyId),
    listing_duration: input.listingDuration,
    offer_format: input.offerFormat,
    markup_fixed: input.markupFixed,
    markup_percent: input.markupPercent,
    marketplace_id: ebayMarketplaceDefaults.marketplaceId,
    merchant_location_key: emptyToNull(input.merchantLocationKey),
    operation_locale: ebayMarketplaceDefaults.operationLocale,
    order_import_enabled: input.orderImportEnabled,
    payment_policy_id: emptyToNull(input.paymentPolicyId),
    production_enabled: input.productionEnabled,
    provider: ebayMarketplaceDefaults.provider,
    return_policy_id: emptyToNull(input.returnPolicyId),
    stock_buffer: input.stockBuffer,
  };

  const { error } = await client
    .from("marketplace_settings")
    .upsert(removeUndefined(payload), {
      onConflict: "provider,marketplace_id,environment",
    });

  if (error) {
    throw new RepositoryWriteError(
      502,
      "MARKETPLACE_SETTINGS_UPDATE_FAILED",
      "eBay 设置保存失败。",
      { message: error.message }
    );
  }

  if (input.categoryMappings) {
    await replaceCategoryMappings(client, input.categoryMappings);
  }

  return getMarketplaceOverview();
}

export async function saveEbayConnectionFromCode(input: {
  code: string;
  environment: EbayEnvironment;
}) {
  const token = await exchangeEbayAuthorizationCode(input);
  const client = await createClient();
  await saveEbayConnection(client, input.environment, token);
  return getMarketplaceOverview();
}

export async function enqueueMarketplaceSync(input: {
  action: MarketplaceQueueAction;
  skus?: string[];
}): Promise<MarketplaceQueueResult> {
  const client = await createClient();
  const settings = await readMarketplaceSettings(client);

  switch (input.action) {
    case "plan_listings": {
      const result = await evaluateAndUpsertListings(client, settings, input.skus);
      return summarizeListingPlan(result, 0);
    }
    case "publish_eligible": {
      assertMarketplaceActionEnabled(settings, input.action);
      const result = await evaluateAndUpsertListings(client, settings, input.skus);
      const eligible = result.filter((item) => item.eligible);
      let enqueued = 0;

      for (const item of eligible) {
        const queued = await enqueueJob(client, {
          idempotencyKey: `publish:${item.sku}:${Date.now()}`,
          jobType: "publish_listing",
          targetSku: item.sku,
        });

        if (queued) {
          enqueued += 1;
        }
      }

      return summarizeListingPlan(result, enqueued);
    }
    case "sync_inventory": {
      assertMarketplaceActionEnabled(settings, input.action);
      const listings = await readMarketplaceListings(client, {
        status: "published",
      });
      const syncableListings = listings.filter((listing) => readBoolean(listing.sync_enabled) !== false);
      let enqueued = 0;

      for (const listing of syncableListings) {
        const sku = readString(listing.sku_code);

        if (sku) {
          const queued = await enqueueJob(client, {
            idempotencyKey: `sync:${sku}:${Date.now()}`,
            jobType: "sync_inventory",
            targetSku: sku,
          });

          if (queued) {
            enqueued += 1;
          }
        }
      }

      return {
        blocked: 0,
        eligible: syncableListings.length,
        enqueued,
        evaluated: listings.length,
        skipped: listings.length - enqueued,
      };
    }
    case "import_orders": {
      assertMarketplaceActionEnabled(settings, input.action);
      const queued = await enqueueJob(client, {
        idempotencyKey: `import-orders:${new Date().toISOString().slice(0, 13)}`,
        jobType: "import_orders",
      });
      return {
        blocked: 0,
        eligible: 1,
        enqueued: queued ? 1 : 0,
        evaluated: 1,
        skipped: queued ? 0 : 1,
      };
    }
    default:
      return { blocked: 0, eligible: 0, enqueued: 0, evaluated: 0, skipped: 0 };
  }
}

export async function runMarketplaceJobs(limit = 5) {
  const client = await createClient();
  const { data, error } = await client
    .from("marketplace_sync_jobs")
    .select("*")
    .eq("provider", ebayMarketplaceDefaults.provider)
    .eq("marketplace_id", ebayMarketplaceDefaults.marketplaceId)
    .eq("status", "queued")
    .lte("scheduled_at", new Date().toISOString())
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 20));

  if (error) {
    throw new RepositoryWriteError(502, "MARKETPLACE_JOBS_READ_FAILED", "eBay 任务读取失败。", {
      message: error.message,
    });
  }

  const jobs = readRows(data);
  const results = [];

  for (const job of jobs) {
    results.push(await runMarketplaceJob(client, job));
  }

  return { processed: results.length, results };
}

export async function importMarketplaceOrderPayload(order: unknown) {
  const client = await createClient();
  const normalized = normalizeEbayOrder(order);
  const { data, error } = await client.rpc("import_marketplace_order", {
    p_external_order_id: normalized.externalOrderId,
    p_lines: normalized.lines,
    p_marketplace_id: normalized.marketplaceId,
    p_order: normalized.order,
    p_provider: ebayMarketplaceDefaults.provider,
    p_reason: "Imported from eBay API.",
  });

  if (error) {
    await markMarketplaceOrderImportFailed(client, normalized, error.message);
    throw new RepositoryWriteError(502, "MARKETPLACE_ORDER_IMPORT_FAILED", "eBay 订单导入失败。", {
      message: error.message,
    });
  }

  return { localOrderId: typeof data === "string" ? data : String(data) };
}

export async function syncMarketplaceFulfillmentForOrder(order: AdminOrder) {
  if (order.status !== "shipped") {
    return { skipped: true, reason: "order_not_shipped" };
  }

  const carrier = order.carrier.trim();
  const tracking = order.trackingCode.trim();

  if (!carrier || !tracking) {
    return { skipped: true, reason: "missing_logistics" };
  }

  const client = await createClient();
  const link = await readMarketplaceOrderLinkByLocalOrder(client, order);

  if (!link) {
    return { skipped: true, reason: "not_marketplace_order" };
  }

  const [settings, connection] = await Promise.all([
    readMarketplaceSettings(client),
    readMarketplaceConnection(client),
  ]);
  const ebay = await createAuthorizedEbayClient(client, settings, connection);
  const externalOrderId = readString(link.external_order_id);

  if (!externalOrderId) {
    return { skipped: true, reason: "missing_external_order_id" };
  }

  try {
    const result = await ebay.createShippingFulfillment(externalOrderId, {
      shippedDate: new Date().toISOString(),
      shippingCarrierCode: normalizeEbayCarrierCode(carrier),
      trackingNumber: tracking,
    });

    await client
      .from("marketplace_order_links")
      .update({
        external_order_status: "FULFILLED",
        import_status: "imported",
        last_error: null,
        order_payload: {
          ...(readRecord(link.order_payload) ?? {}),
          local_fulfillment: {
            carrier,
            synced_at: new Date().toISOString(),
            tracking,
          },
        },
      })
      .eq("id", link.id);

    return { externalOrderId, fulfillmentId: result.fulfillmentId ?? null, synced: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "eBay 物流回写失败。";
    await client
      .from("marketplace_order_links")
      .update({ last_error: message })
      .eq("id", link.id);
    throw error;
  }
}

async function runMarketplaceJob(client: SupabaseServerClient, job: DbRow) {
  const id = readString(job.id);

  if (!id) {
    return { ok: false, error: "Invalid job id" };
  }

  await updateJob(client, id, {
    attempts: (readNumber(job.attempts) ?? 0) + 1,
    locked_at: new Date().toISOString(),
    locked_by: "partspro-admin",
    started_at: new Date().toISOString(),
    status: "running",
  });

  try {
    const jobType = readString(job.job_type);
    let result: unknown;

    if (jobType === "publish_listing") {
      result = await publishMarketplaceListing(client, readString(job.target_sku));
    } else if (jobType === "sync_inventory" || jobType === "sync_price") {
      result = await syncMarketplaceListing(client, readString(job.target_sku));
    } else if (jobType === "import_orders") {
      result = await importRecentEbayOrders(client);
    } else if (jobType === "import_order") {
      result = await importMarketplaceOrderPayload(readRecord(job.payload)?.order);
    } else {
      throw new Error(`Unsupported eBay job type: ${jobType ?? "unknown"}`);
    }

    await updateJob(client, id, {
      finished_at: new Date().toISOString(),
      result: resultToJson(result),
      status: "succeeded",
    });

    return { id, ok: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "eBay 任务执行失败。";
    await updateJob(client, id, {
      error_code: error instanceof EbayApiError ? `EBAY_${error.status}` : "MARKETPLACE_JOB_FAILED",
      error_message: message,
      finished_at: new Date().toISOString(),
      status: "failed",
    });
    return { id, ok: false, error: message };
  }
}

async function publishMarketplaceListing(client: SupabaseServerClient, sku: string | null) {
  if (!sku) {
    throw new Error("缺少 SKU，无法发布。");
  }

  const [settings, connection, product, mappings] = await Promise.all([
    readMarketplaceSettings(client),
    readMarketplaceConnection(client),
    getAdminProduct(sku).then((result) => result.data),
    readCategoryMappings(client),
  ]);

  if (!product) {
    throw new Error(`找不到商品 ${sku}。`);
  }

  const evaluation = evaluateProduct(product, settings, mappings);
  await upsertListingEvaluation(client, evaluation);

  if (!evaluation.eligible) {
    throw new Error(`商品 ${sku} 不满足自动发布条件：${evaluation.blockers.join("；")}`);
  }

  const ebay = await createAuthorizedEbayClient(client, settings, connection);
  const ebaySku = marketplaceSku(product);
  const listing = await readListingBySku(client, ebaySku);
  const offerId =
    readString(listing?.ebay_offer_id) ?? (await readExistingOfferId(ebay, ebaySku));

  await ebay.createOrReplaceInventoryItem(ebaySku, evaluation.inventoryItemPayload);

  const offerPayload = {
    ...evaluation.offerPayload,
    ...(offerId ? { offerId } : {}),
  };
  const createdOffer = offerId ? null : await ebay.createOffer(offerPayload);
  const resolvedOfferId = offerId ?? createdOffer?.offerId;

  if (!resolvedOfferId) {
    throw new Error("eBay 未返回 offerId。");
  }

  if (offerId) {
    await ebay.updateOffer(resolvedOfferId, offerPayload);
  }

  const publishResult = await ebay.publishOffer(resolvedOfferId);
  const listingId = publishResult.listingId ?? readString(listing?.ebay_listing_id);

  await upsertMarketplaceListing(client, {
    ...evaluation,
    ebayListingId: listingId ?? null,
    ebayOfferId: resolvedOfferId,
    ebayItemWebUrl: listingId
      ? `https://www.ebay.it/itm/${encodeURIComponent(listingId)}`
      : null,
    listingStatus: "published",
  });

  return { listingId, offerId: resolvedOfferId, sku: ebaySku };
}

async function syncMarketplaceListing(client: SupabaseServerClient, sku: string | null) {
  if (!sku) {
    throw new Error("缺少 SKU，无法同步。");
  }

  const [settings, connection, product, mappings, initialListing] = await Promise.all([
    readMarketplaceSettings(client),
    readMarketplaceConnection(client),
    getAdminProduct(sku).then((result) => result.data),
    readCategoryMappings(client),
    readListingBySku(client, sku),
  ]);

  if (!product) {
    throw new Error(`找不到商品 ${sku}。`);
  }

  const ebaySku = marketplaceSku(product);
  const listing =
    initialListing ?? (ebaySku !== sku ? await readListingBySku(client, ebaySku) : null);
  const offerId = readString(listing?.ebay_offer_id);

  if (!offerId) {
    throw new Error(`商品 ${sku} 尚未发布到 eBay。`);
  }

  const evaluation = evaluateProduct(product, settings, mappings);

  if (!evaluation.eligible) {
    await upsertListingEvaluation(client, evaluation);
    throw new Error(`商品 ${sku} 不满足同步条件：${evaluation.blockers.join("；")}`);
  }

  const ebay = await createAuthorizedEbayClient(client, settings, connection);
  await ebay.createOrReplaceInventoryItem(ebaySku, evaluation.inventoryItemPayload);
  await ebay.updateOffer(offerId, evaluation.offerPayload);
  await upsertMarketplaceListing(client, {
    ...evaluation,
    ebayListingId: readString(listing?.ebay_listing_id),
    ebayOfferId: offerId,
    ebayItemWebUrl: readString(listing?.ebay_item_web_url),
    listingStatus: "published",
  });

  return { offerId, sku: ebaySku, synced: true };
}

async function importRecentEbayOrders(client: SupabaseServerClient) {
  const settings = await readMarketplaceSettings(client);
  const connection = await readMarketplaceConnection(client);
  const ebay = await createAuthorizedEbayClient(client, settings, connection);
  const modifiedFrom = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const payload = await ebay.getOrders(`lastmodifieddate:[${modifiedFrom}..]`);
  const orders = Array.isArray(payload.orders) ? payload.orders : [];
  let imported = 0;

  for (const order of orders) {
    await importMarketplaceOrderPayload(order);
    imported += 1;
  }

  await client
    .from("marketplace_settings")
    .update({ last_orders_synced_at: new Date().toISOString() })
    .eq("provider", ebayMarketplaceDefaults.provider)
    .eq("marketplace_id", ebayMarketplaceDefaults.marketplaceId)
    .eq("environment", settings.environment);

  return { imported, total: payload.total ?? orders.length };
}

async function createAuthorizedEbayClient(
  client: SupabaseServerClient,
  settings: DbRow,
  connection: DbRow | null
) {
  const environment = toEbayEnvironment(settings.environment);

  if (environment === "production" && readBoolean(settings.production_enabled) !== true) {
    throw new Error("生产环境尚未启用。");
  }

  if (!isEbayAppConfigured(environment)) {
    throw new Error("eBay OAuth 应用未配置。");
  }

  if (!connection || readString(connection.connection_status) !== "connected") {
    throw new Error("eBay 账号未连接。");
  }

  const tokenExpiresAt = Date.parse(readString(connection.token_expires_at) ?? "");
  const encryptedAccessToken = readString(connection.access_token_ciphertext);
  const accessToken =
    encryptedAccessToken && Number.isFinite(tokenExpiresAt) && tokenExpiresAt > Date.now() + 60_000
      ? decryptEbaySecret(encryptedAccessToken)
      : null;

  if (accessToken) {
    return new EbaySellClient(environment, accessToken);
  }

  const refreshToken = decryptEbaySecret(readString(connection.refresh_token_ciphertext));

  if (!refreshToken) {
    throw new Error("eBay refresh token 缺失或无法解密。");
  }

  const refreshed = await refreshEbayAccessToken({
    environment,
    refreshToken,
    scopes: readStringArray(connection.oauth_scopes).length
      ? readStringArray(connection.oauth_scopes)
      : ebayDefaultScopes,
  });
  await saveEbayConnection(client, environment, refreshed, connection);

  return new EbaySellClient(environment, refreshed.access_token);
}

async function saveEbayConnection(
  client: SupabaseServerClient,
  environment: EbayEnvironment,
  token: EbayTokenResponse,
  current?: DbRow | null
) {
  const now = new Date();
  const tokenExpiresAt = new Date(now.getTime() + token.expires_in * 1000).toISOString();
  const refreshTokenExpiresAt = token.refresh_token_expires_in
    ? new Date(now.getTime() + token.refresh_token_expires_in * 1000).toISOString()
    : readString(current?.refresh_token_expires_at);
  const refreshToken = token.refresh_token
    ? encryptEbaySecret(token.refresh_token)
    : readString(current?.refresh_token_ciphertext);
  const { data, error } = await client
    .from("marketplace_connections")
    .upsert(
      {
        access_token_ciphertext: encryptEbaySecret(token.access_token),
        connection_status: "connected",
        environment,
        last_connected_at: now.toISOString(),
        last_error: null,
        marketplace_id: ebayMarketplaceDefaults.marketplaceId,
        oauth_scopes: ebayDefaultScopes,
        provider: ebayMarketplaceDefaults.provider,
        refresh_token_ciphertext: refreshToken,
        refresh_token_expires_at: refreshTokenExpiresAt,
        token_expires_at: tokenExpiresAt,
      },
      { onConflict: "provider,marketplace_id,environment" }
    )
    .select("id")
    .maybeSingle();

  if (error) {
    throw new RepositoryWriteError(502, "MARKETPLACE_CONNECTION_SAVE_FAILED", "eBay 连接保存失败。", {
      message: error.message,
    });
  }

  const connectionId = readString(data?.id);

  if (connectionId) {
    const { error: settingsError } = await client
      .from("marketplace_settings")
      .update({ connection_id: connectionId })
      .eq("provider", ebayMarketplaceDefaults.provider)
      .eq("marketplace_id", ebayMarketplaceDefaults.marketplaceId)
      .eq("environment", environment);

    if (settingsError) {
      throw new RepositoryWriteError(
        502,
        "MARKETPLACE_CONNECTION_LINK_FAILED",
        "eBay 连接已保存，但设置关联失败。",
        { message: settingsError.message }
      );
    }
  }
}

async function readExistingOfferId(ebay: EbaySellClient, sku: string) {
  try {
    const offers = await ebay.getOffers(sku);
    return offers.offers?.find((offer) => offer.offerId)?.offerId ?? null;
  } catch {
    return null;
  }
}

async function evaluateAndUpsertListings(
  client: SupabaseServerClient,
  settings: DbRow,
  skus?: string[]
) {
  const [products, mappings] = await Promise.all([
    readProductsForEvaluation(skus),
    readCategoryMappings(client),
  ]);
  const evaluations = products.map((product) => evaluateProduct(product, settings, mappings));

  for (const evaluation of evaluations) {
    await upsertListingEvaluation(client, evaluation);
  }

  return evaluations;
}

function summarizeListingPlan(
  evaluations: Array<ReturnType<typeof evaluateProduct>>,
  enqueued: number
): MarketplaceQueueResult {
  const eligible = evaluations.filter((item) => item.eligible).length;

  return {
    blocked: evaluations.length - eligible,
    eligible,
    enqueued,
    evaluated: evaluations.length,
    skipped: Math.max(evaluations.length - enqueued, 0),
  };
}

function assertMarketplaceActionEnabled(settings: DbRow, action: MarketplaceQueueAction) {
  const settingsDto = toSettingsDto(settings);

  if (!settingsDto.enabled) {
    throw new RepositoryWriteError(
      409,
      "EBAY_MARKETPLACE_DISABLED",
      "eBay 自动化未启用。请先启用 eBay。"
    );
  }

  if (settingsDto.environment === "production" && !settingsDto.productionEnabled) {
    throw new RepositoryWriteError(
      409,
      "EBAY_PRODUCTION_DISABLED",
      "eBay production 尚未启用，不能执行生产环境自动化。"
    );
  }

  if (action === "publish_eligible" && !settingsDto.autoPublishEnabled) {
    throw new RepositoryWriteError(
      409,
      "EBAY_AUTO_PUBLISH_DISABLED",
      "eBay 自动发布未启用。请先生成刊登计划并开启自动发布。"
    );
  }

  if (action === "sync_inventory" && !settingsDto.autoSyncEnabled) {
    throw new RepositoryWriteError(
      409,
      "EBAY_AUTO_SYNC_DISABLED",
      "eBay 价格库存同步未启用。"
    );
  }

  if (action === "import_orders" && !settingsDto.orderImportEnabled) {
    throw new RepositoryWriteError(409, "EBAY_ORDER_IMPORT_DISABLED", "eBay 订单回流未启用。");
  }
}

async function readProductsForEvaluation(skus?: string[]) {
  if (skus?.length) {
    const products = await Promise.all(
      skus.map((sku) => getAdminProduct(sku).then((result) => result.data))
    );
    return products.filter((product): product is AdminProduct => Boolean(product));
  }

  const result = await listAdminProducts({
    catalogStatus: "active",
    limit: 100,
    offset: 0,
    sort: "updated_desc",
  });
  return result.data.products;
}

function evaluateProduct(product: AdminProduct, settings: DbRow, mappings: DbRow[]) {
  const settingsDto = toSettingsDto(settings);
  const mapping = findCategoryMapping(product, mappings);
  const imageUrls = product.galleryImageUrls?.length
    ? [product.imageUrl, ...product.galleryImageUrls].filter(isNonEmptyString)
    : [product.imageUrl].filter(isNonEmptyString);
  const computedPrice = roundMoney(
    product.retailPrice * (1 + settingsDto.markupPercent / 100) + settingsDto.markupFixed
  );
  const computedQuantity = Math.max(0, product.availableQty - settingsDto.stockBuffer);
  const title = buildEbayTitle(product);
  const sku = marketplaceSku(product);
  const conditionId = readString(mapping?.condition_id) ?? settingsDto.defaultConditionId;
  const categoryId = readString(mapping?.ebay_category_id) ?? "";
  const aspects = normalizeAspects(readRecord(mapping?.aspects), product);
  const aspectValuesByKey = new Map(
    Object.entries(aspects).map(([key, value]) => [normalizeKey(key), value])
  );
  const missingAspects = requiredAspectNames(mapping).filter((name) => {
    const value = aspectValuesByKey.get(normalizeKey(name));
    return !Array.isArray(value) || value.length === 0;
  });
  const description = buildEbayDescription(product);
  const blockers = [
    product.catalogStatus !== "active" ? "商品未发布到前台" : null,
    imageUrls.length === 0 ? "缺少主图" : null,
    product.retailPrice <= 0 ? "缺少零售价" : null,
    computedQuantity <= 0 ? "可售库存不足或被安全库存扣减为 0" : null,
    !mapping ? "缺少 eBay 类目映射" : null,
    missingAspects.length > 0 ? `缺少 eBay 必填属性：${missingAspects.join("、")}` : null,
    !settingsDto.merchantLocationKey ? "缺少默认 merchantLocationKey" : null,
    !settingsDto.paymentPolicyId ? "缺少 eBay payment policy" : null,
    !settingsDto.returnPolicyId ? "缺少 eBay return policy" : null,
    !settingsDto.fulfillmentPolicyId ? "缺少 eBay fulfillment policy" : null,
    readBoolean((product as unknown as DbRow).isDangerousGoods) ? "危险品需要人工合规确认" : null,
  ].filter(isNonEmptyString);

  return {
    blockers,
    computedPrice,
    computedQuantity,
    eligible: blockers.length === 0,
    inventoryItemPayload: {
      availability: {
        shipToLocationAvailability: {
          quantity: computedQuantity,
        },
      },
      condition: conditionId,
      product: {
        aspects,
        description,
        imageUrls,
        title,
      },
    },
    lastPayload: {
      computedPrice,
      computedQuantity,
      mappingId: readString(mapping?.id),
    },
    offerPayload: {
      availableQuantity: computedQuantity,
      categoryId,
      format: settingsDto.offerFormat ?? "FIXED_PRICE",
      listingDescription: description,
      listingDuration: settingsDto.listingDuration,
      listingPolicies: {
        fulfillmentPolicyId: settingsDto.fulfillmentPolicyId,
        paymentPolicyId: settingsDto.paymentPolicyId,
        returnPolicyId: settingsDto.returnPolicyId,
      },
      marketplaceId: settingsDto.marketplaceId,
      merchantLocationKey: settingsDto.merchantLocationKey,
      pricingSummary: {
        price: {
          currency: settingsDto.currency,
          value: computedPrice.toFixed(2),
        },
      },
      sku,
    },
    product,
    sku,
    title,
  };
}

async function upsertListingEvaluation(
  client: SupabaseServerClient,
  evaluation: ReturnType<typeof evaluateProduct>
) {
  await upsertMarketplaceListing(client, {
    ...evaluation,
    listingStatus: evaluation.eligible ? "ready" : "blocked",
  });
}

async function upsertMarketplaceListing(
  client: SupabaseServerClient,
  input: ReturnType<typeof evaluateProduct> & {
    ebayItemWebUrl?: string | null;
    ebayListingId?: string | null;
    ebayOfferId?: string | null;
    listingStatus: string;
  }
) {
  const product = input.product;
  const { error } = await client.from("marketplace_listings").upsert(
    {
      currency: ebayMarketplaceDefaults.currency,
      description: buildEbayDescription(product),
      ebay_item_web_url: input.ebayItemWebUrl ?? undefined,
      ebay_listing_id: input.ebayListingId ?? undefined,
      ebay_offer_id: input.ebayOfferId ?? undefined,
      eligibility_status: input.eligible ? "eligible" : "blocked",
      last_error_at: input.eligible ? null : new Date().toISOString(),
      last_error_code: input.eligible ? null : "LISTING_NOT_ELIGIBLE",
      last_error_message: input.eligible ? null : input.blockers.join("；"),
      last_payload: input.lastPayload,
      last_published_at:
        input.listingStatus === "published" ? new Date().toISOString() : undefined,
      last_synced_at: new Date().toISOString(),
      listing_status: input.listingStatus,
      marketplace_id: ebayMarketplaceDefaults.marketplaceId,
      price: input.computedPrice,
      product_id: product.id,
      provider: ebayMarketplaceDefaults.provider,
      quantity: input.computedQuantity,
      sku_code: marketplaceSku(product),
      title: input.title,
    },
    { onConflict: "provider,marketplace_id,sku_code" }
  );

  if (error) {
    throw new RepositoryWriteError(502, "MARKETPLACE_LISTING_SAVE_FAILED", "eBay 刊登状态保存失败。", {
      message: error.message,
    });
  }
}

async function enqueueJob(
  client: SupabaseServerClient,
  input: {
    idempotencyKey: string;
    jobType: string;
    payload?: Record<string, unknown>;
    targetOrderId?: string;
    targetSku?: string;
  }
) {
  const hasActiveJob = await hasActiveMarketplaceJob(client, input);

  if (hasActiveJob) {
    return false;
  }

  const { error } = await client.from("marketplace_sync_jobs").upsert(
    {
      idempotency_key: input.idempotencyKey,
      job_type: input.jobType,
      marketplace_id: ebayMarketplaceDefaults.marketplaceId,
      payload: input.payload ?? {},
      provider: ebayMarketplaceDefaults.provider,
      status: "queued",
      target_order_id: input.targetOrderId ?? null,
      target_sku: input.targetSku ?? null,
    },
    { onConflict: "provider,marketplace_id,idempotency_key" }
  );

  if (error) {
    throw new RepositoryWriteError(502, "MARKETPLACE_JOB_ENQUEUE_FAILED", "eBay 任务入队失败。", {
      message: error.message,
    });
  }

  return true;
}

async function hasActiveMarketplaceJob(
  client: SupabaseServerClient,
  input: {
    jobType: string;
    targetOrderId?: string;
    targetSku?: string;
  }
) {
  let request = client
    .from("marketplace_sync_jobs")
    .select("id")
    .eq("provider", ebayMarketplaceDefaults.provider)
    .eq("marketplace_id", ebayMarketplaceDefaults.marketplaceId)
    .eq("job_type", input.jobType)
    .in("status", ["queued", "running"])
    .limit(1);

  request = input.targetSku ? request.eq("target_sku", input.targetSku) : request.is("target_sku", null);
  request = input.targetOrderId
    ? request.eq("target_order_id", input.targetOrderId)
    : request.is("target_order_id", null);

  const { data, error } = await request;

  if (error) {
    throw new RepositoryWriteError(502, "MARKETPLACE_JOB_READ_FAILED", "eBay 队列去重检查失败。", {
      message: error.message,
    });
  }

  return readRows(data).length > 0;
}

async function updateJob(client: SupabaseServerClient, id: string, payload: Record<string, unknown>) {
  const { error } = await client.from("marketplace_sync_jobs").update(payload).eq("id", id);

  if (error) {
    throw new RepositoryWriteError(502, "MARKETPLACE_JOB_UPDATE_FAILED", "eBay 任务状态更新失败。", {
      message: error.message,
    });
  }
}

async function readMarketplaceSettings(client: SupabaseServerClient) {
  const { data, error } = await client
    .from("marketplace_settings")
    .select("*")
    .eq("provider", ebayMarketplaceDefaults.provider)
    .eq("marketplace_id", ebayMarketplaceDefaults.marketplaceId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new RepositoryWriteError(502, "MARKETPLACE_SETTINGS_READ_FAILED", "eBay 设置读取失败。", {
      message: error.message,
    });
  }

  return isRow(data) ? data : defaultSettingsRow();
}

async function readMarketplaceConnection(client: SupabaseServerClient) {
  const { data, error } = await client
    .from("marketplace_connections")
    .select("*")
    .eq("provider", ebayMarketplaceDefaults.provider)
    .eq("marketplace_id", ebayMarketplaceDefaults.marketplaceId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new RepositoryWriteError(
      502,
      "MARKETPLACE_CONNECTION_READ_FAILED",
      "eBay 连接读取失败。",
      { message: error.message }
    );
  }

  return isRow(data) ? data : null;
}

async function readCategoryMappings(client: SupabaseServerClient) {
  const { data, error } = await client
    .from("marketplace_category_mappings")
    .select("*")
    .eq("provider", ebayMarketplaceDefaults.provider)
    .eq("marketplace_id", ebayMarketplaceDefaults.marketplaceId)
    .order("local_category", { ascending: true });

  if (error) {
    throw new RepositoryWriteError(
      502,
      "MARKETPLACE_CATEGORY_MAPPINGS_READ_FAILED",
      "eBay 类目映射读取失败。",
      { message: error.message }
    );
  }

  return readRows(data);
}

async function replaceCategoryMappings(
  client: SupabaseServerClient,
  mappings: MarketplaceCategoryMappingWriteInput[]
) {
  for (const mapping of mappings) {
    const { error } = await client.from("marketplace_category_mappings").upsert(
      {
        aspects: mapping.aspects ?? {},
        brand: emptyToNull(mapping.brand),
        condition_id: mapping.conditionId ?? "1000",
        condition_label: mapping.conditionLabel ?? "Nuovo",
        ebay_category_id: mapping.ebayCategoryId,
        ebay_category_name: emptyToNull(mapping.ebayCategoryName),
        ebay_category_tree_id: mapping.ebayCategoryTreeId ?? "101",
        enabled: mapping.enabled ?? true,
        local_category: mapping.localCategory,
        marketplace_id: ebayMarketplaceDefaults.marketplaceId,
        model_series: emptyToNull(mapping.modelSeries),
        provider: ebayMarketplaceDefaults.provider,
        required_aspects: mapping.requiredAspects ?? [],
      },
      { onConflict: "provider,marketplace_id,local_category,brand,model_series" }
    );

    if (error) {
      throw new RepositoryWriteError(
        502,
        "MARKETPLACE_CATEGORY_MAPPING_SAVE_FAILED",
        "eBay 类目映射保存失败。",
        { message: error.message }
      );
    }
  }
}

async function readMarketplaceListings(
  client: SupabaseServerClient,
  query: { status?: string } = {}
) {
  let request = client
    .from("marketplace_listings")
    .select("*")
    .eq("provider", ebayMarketplaceDefaults.provider)
    .eq("marketplace_id", ebayMarketplaceDefaults.marketplaceId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (query.status) {
    request = request.eq("listing_status", query.status);
  }

  const { data, error } = await request;

  if (error) {
    throw new RepositoryWriteError(502, "MARKETPLACE_LISTINGS_READ_FAILED", "eBay 刊登读取失败。", {
      message: error.message,
    });
  }

  return readRows(data);
}

async function readListingBySku(client: SupabaseServerClient, sku: string) {
  const { data, error } = await client
    .from("marketplace_listings")
    .select("*")
    .eq("provider", ebayMarketplaceDefaults.provider)
    .eq("marketplace_id", ebayMarketplaceDefaults.marketplaceId)
    .eq("sku_code", sku)
    .maybeSingle();

  if (error) {
    throw new RepositoryWriteError(502, "MARKETPLACE_LISTING_READ_FAILED", "eBay 刊登读取失败。", {
      message: error.message,
    });
  }

  return isRow(data) ? data : null;
}

async function readMarketplaceJobs(client: SupabaseServerClient) {
  const { data, error } = await client
    .from("marketplace_sync_jobs")
    .select("*")
    .eq("provider", ebayMarketplaceDefaults.provider)
    .eq("marketplace_id", ebayMarketplaceDefaults.marketplaceId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new RepositoryWriteError(502, "MARKETPLACE_JOBS_READ_FAILED", "eBay 任务读取失败。", {
      message: error.message,
    });
  }

  return readRows(data);
}

async function readMarketplaceOrderLinks(client: SupabaseServerClient) {
  const { data, error } = await client
    .from("marketplace_order_links")
    .select("*")
    .eq("provider", ebayMarketplaceDefaults.provider)
    .eq("marketplace_id", ebayMarketplaceDefaults.marketplaceId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new RepositoryWriteError(
      502,
      "MARKETPLACE_ORDER_LINKS_READ_FAILED",
      "eBay 订单回流记录读取失败。",
      { message: error.message }
    );
  }

  return readRows(data);
}

async function readMarketplaceOrderLinkByLocalOrder(
  client: SupabaseServerClient,
  order: AdminOrder
) {
  const { data, error } = await client
    .from("marketplace_order_links")
    .select("*")
    .eq("provider", ebayMarketplaceDefaults.provider)
    .eq("marketplace_id", ebayMarketplaceDefaults.marketplaceId)
    .or(`local_order_id.eq.${order.id},local_order_no.eq.${order.orderNo}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new RepositoryWriteError(
      502,
      "MARKETPLACE_ORDER_LINK_READ_FAILED",
      "eBay 订单关联读取失败。",
      { message: error.message }
    );
  }

  return isRow(data) ? data : null;
}

async function enrichListingsWithProducts(
  listings: DbRow[],
  settings: DbRow,
  mappings: DbRow[]
): Promise<MarketplaceListingDto[]> {
  const products = await Promise.all(
    listings.map((listing) => getAdminProduct(readString(listing.sku_code) ?? "").then((result) => result.data).catch(() => null))
  );

  return listings.map((listing, index) => {
    const product = products[index];
    const computed = product ? evaluateProduct(product, settings, mappings) : null;

    return {
      blockers:
        computed?.blockers ??
        [readString(listing.last_error_message) ?? "商品资料暂时无法读取"],
      computedPrice: computed?.computedPrice ?? readNumber(listing.price) ?? 0,
      computedQuantity: computed?.computedQuantity ?? readNumber(listing.quantity) ?? 0,
      ebayItemWebUrl: readString(listing.ebay_item_web_url),
      ebayListingId: readString(listing.ebay_listing_id),
      ebayOfferId: readString(listing.ebay_offer_id),
      eligibilityStatus: readString(listing.eligibility_status) ?? "incomplete",
      id: readString(listing.id) ?? "",
      lastErrorMessage: readString(listing.last_error_message),
      lastPublishedAt: readString(listing.last_published_at),
      lastSyncedAt: readString(listing.last_synced_at),
      listingStatus: readString(listing.listing_status) ?? "draft",
      productName: product?.name ?? readString(listing.title) ?? readString(listing.sku_code) ?? "",
      sku: readString(listing.sku_code) ?? "",
      syncEnabled: readBoolean(listing.sync_enabled) !== false,
      title: readString(listing.title),
    };
  });
}

function normalizeEbayOrder(order: unknown) {
  const record = readRecord(order);
  const externalOrderId = readString(record?.orderId) ?? readString(record?.legacyOrderId);

  if (!externalOrderId) {
    throw new Error("eBay 订单缺少 orderId。");
  }

  const pricingSummary = readRecord(record?.pricingSummary);
  const total = readAmount(pricingSummary?.total);
  const deliveryAddress = formatEbayAddress(record);
  const lines = readArray(record?.lineItems)
    .map((line) => normalizeEbayOrderLine(line))
    .filter((line): line is { external_line_id: string; quantity: number; sku_code: string; unit_net: number } =>
      Boolean(line)
    );

  if (lines.length === 0) {
    throw new Error(`eBay 订单 ${externalOrderId} 没有可导入的 SKU 行。`);
  }

  return {
    externalOrderId,
    lines,
    marketplaceId: ebayMarketplaceDefaults.marketplaceId,
    order: {
      buyer: readRecord(record?.buyer) ?? {},
      currency: total.currency,
      delivery_address: deliveryAddress,
      order_status: readString(record?.orderFulfillmentStatus) ?? readString(record?.orderPaymentStatus),
      payment_status: readString(record?.orderPaymentStatus),
      shipping: readAmount(pricingSummary?.deliveryCost).value,
      total: total.value,
      total_net: Math.max(total.value - readAmount(pricingSummary?.deliveryCost).value, 0),
      vat: 0,
    },
  };
}

function normalizeEbayOrderLine(value: unknown) {
  const line = readRecord(value);
  const sku = readString(line?.sku);
  const quantity = readNumber(line?.quantity) ?? 0;

  if (!line || !sku || quantity <= 0) {
    return null;
  }

  const cost = readAmount(line.lineItemCost);

  return {
    external_line_id: readString(line.lineItemId) ?? sku,
    quantity,
    sku_code: sku.toUpperCase(),
    unit_net: quantity > 0 ? roundMoney(cost.value / quantity) : cost.value,
  };
}

async function markMarketplaceOrderImportFailed(
  client: SupabaseServerClient,
  normalized: ReturnType<typeof normalizeEbayOrder>,
  message: string
) {
  await client.from("marketplace_order_links").upsert(
    {
      currency: normalized.order.currency,
      external_order_id: normalized.externalOrderId,
      import_status: "failed",
      last_error: message,
      marketplace_id: normalized.marketplaceId,
      order_payload: normalized.order,
      provider: ebayMarketplaceDefaults.provider,
      total: normalized.order.total,
    },
    { onConflict: "provider,marketplace_id,external_order_id" }
  );
}

function findCategoryMapping(product: AdminProduct, mappings: DbRow[]) {
  const enabled = mappings.filter((mapping) => readBoolean(mapping.enabled) !== false);
  const localCategory = normalizeKey(product.category);
  const brand = normalizeKey(product.brand);
  const modelSeries = normalizeKey(product.modelSeries);

  return (
    enabled.find(
      (mapping) =>
        normalizeKey(readString(mapping.local_category)) === localCategory &&
        normalizeKey(readString(mapping.brand)) === brand &&
        normalizeKey(readString(mapping.model_series)) === modelSeries
    ) ??
    enabled.find(
      (mapping) =>
        normalizeKey(readString(mapping.local_category)) === localCategory &&
        normalizeKey(readString(mapping.brand)) === brand &&
        !readString(mapping.model_series)
    ) ??
    enabled.find(
      (mapping) =>
        normalizeKey(readString(mapping.local_category)) === localCategory &&
        !readString(mapping.brand) &&
        !readString(mapping.model_series)
    ) ??
    null
  );
}

function buildEbayTitle(product: AdminProduct) {
  return [product.brand, product.model, product.category, product.name, product.grade]
    .filter(isNonEmptyString)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function buildEbayDescription(product: AdminProduct) {
  const compatible = product.compatibleWith.length
    ? `Compatibile con: ${product.compatibleWith.join(", ")}.`
    : "";
  return [
    `${product.name}`,
    `SKU: ${product.sku}. Qualita: ${product.grade}.`,
    compatible,
    `Spedizione dall'Italia. Garanzia ${product.warrantyDays ?? product.rmaDays} giorni.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function normalizeAspects(raw: Record<string, unknown> | null, product: AdminProduct) {
  const aspects: Record<string, string[]> = {
    Marca: [product.brand],
    "Marca compatibile": [product.brand],
    Tipo: [product.category],
    ...(raw as Record<string, string[]> | null),
  };

  if (product.model) {
    aspects.Modello = [product.model];
  }

  return Object.fromEntries(
    Object.entries(aspects).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.map(String).filter(Boolean) : [String(value)].filter(Boolean),
    ])
  );
}

function requiredAspectNames(mapping: DbRow | null) {
  const names = readArray(mapping?.required_aspects)
    .map((value) => {
      if (typeof value === "string") {
        return value;
      }

      const record = readRecord(value);
      return (
        readString(record?.localizedAspectName) ??
        readString(record?.aspectName) ??
        readString(record?.name)
      );
    })
    .filter(isNonEmptyString);

  return [...new Set(names)];
}

function formatEbayAddress(order: DbRow | null) {
  const instructions = readArray(order?.fulfillmentStartInstructions);
  const shippingStep = readRecord(readRecord(instructions[0])?.shippingStep);
  const shipTo = readRecord(shippingStep?.shipTo);
  const contactAddress = readRecord(shipTo?.contactAddress);

  return [
    readString(shipTo?.fullName),
    readString(contactAddress?.addressLine1),
    readString(contactAddress?.addressLine2),
    [readString(contactAddress?.postalCode), readString(contactAddress?.city)]
      .filter(Boolean)
      .join(" "),
    readString(contactAddress?.stateOrProvince),
    readString(contactAddress?.countryCode),
  ]
    .filter(Boolean)
    .join(", ");
}

function normalizeEbayCarrierCode(carrier: string) {
  const normalized = carrier.trim().toLowerCase();

  if (normalized.includes("dhl")) {
    return "DHL";
  }

  if (normalized.includes("ups")) {
    return "UPS";
  }

  if (normalized.includes("gls")) {
    return "GLS";
  }

  if (normalized.includes("brt") || normalized.includes("bartolini")) {
    return "BRT";
  }

  return carrier.trim();
}

function toSettingsDto(row: DbRow): MarketplaceSettingsDto {
  return {
    autoPublishEnabled: readBoolean(row.auto_publish_enabled) ?? false,
    autoSyncEnabled: readBoolean(row.auto_sync_enabled) ?? true,
    currency: readString(row.currency) ?? ebayMarketplaceDefaults.currency,
    defaultConditionId: readString(row.default_condition_id) ?? "1000",
    defaultConditionLabel: readString(row.default_condition_label) ?? "Nuovo",
    enabled: readBoolean(row.enabled) ?? false,
    environment: toEbayEnvironment(row.environment),
    fulfillmentPolicyId: readString(row.fulfillment_policy_id),
    listingDuration: readString(row.listing_duration) ?? "GTC",
    listingLocale: readString(row.listing_locale) ?? ebayMarketplaceDefaults.listingLocale,
    marketplaceId: readString(row.marketplace_id) ?? ebayMarketplaceDefaults.marketplaceId,
    markupFixed: readNumber(row.markup_fixed) ?? 0,
    markupPercent: readNumber(row.markup_percent) ?? 0,
    merchantLocationKey: readString(row.merchant_location_key),
    offerFormat: readString(row.offer_format) ?? "FIXED_PRICE",
    operationLocale: readString(row.operation_locale) ?? ebayMarketplaceDefaults.operationLocale,
    orderImportEnabled: readBoolean(row.order_import_enabled) ?? true,
    paymentPolicyId: readString(row.payment_policy_id),
    productionEnabled: readBoolean(row.production_enabled) ?? false,
    provider: readString(row.provider) ?? ebayMarketplaceDefaults.provider,
    returnPolicyId: readString(row.return_policy_id),
    stockBuffer: readNumber(row.stock_buffer) ?? 1,
  };
}

function toConnectionDto(row: DbRow): MarketplaceConnectionDto {
  const status = readString(row.connection_status) ?? "disconnected";

  return {
    accountId: readString(row.account_id),
    accountLabel: readString(row.account_label),
    connected: status === "connected",
    connectionStatus: status,
    environment: toEbayEnvironment(row.environment),
    lastConnectedAt: readString(row.last_connected_at),
    lastError: readString(row.last_error),
    marketplaceId: readString(row.marketplace_id) ?? ebayMarketplaceDefaults.marketplaceId,
    oauthScopes: readStringArray(row.oauth_scopes),
    tokenExpiresAt: readString(row.token_expires_at),
  };
}

function toCategoryMappingDto(row: DbRow): MarketplaceCategoryMappingDto {
  return {
    aspects: (readRecord(row.aspects) as Record<string, string[]>) ?? {},
    brand: readString(row.brand),
    conditionId: readString(row.condition_id) ?? "1000",
    conditionLabel: readString(row.condition_label) ?? "Nuovo",
    ebayCategoryId: readString(row.ebay_category_id) ?? "",
    ebayCategoryName: readString(row.ebay_category_name),
    ebayCategoryTreeId: readString(row.ebay_category_tree_id) ?? "101",
    enabled: readBoolean(row.enabled) ?? true,
    id: readString(row.id) ?? "",
    localCategory: readString(row.local_category) ?? "",
    modelSeries: readString(row.model_series),
    requiredAspects: readArray(row.required_aspects),
  };
}

function toJobDto(row: DbRow): MarketplaceJobDto {
  return {
    attempts: readNumber(row.attempts) ?? 0,
    createdAt: readString(row.created_at) ?? "",
    errorMessage: readString(row.error_message),
    id: readString(row.id) ?? "",
    jobType: readString(row.job_type) ?? "",
    status: readString(row.status) ?? "queued",
    targetOrderId: readString(row.target_order_id),
    targetSku: readString(row.target_sku),
    updatedAt: readString(row.updated_at) ?? "",
  };
}

function toOrderLinkDto(row: DbRow): MarketplaceOrderLinkDto {
  return {
    currency: readString(row.currency) ?? "EUR",
    externalOrderId: readString(row.external_order_id) ?? "",
    importStatus: readString(row.import_status) ?? "pending",
    importedAt: readString(row.imported_at),
    lastError: readString(row.last_error),
    localOrderNo: readString(row.local_order_no),
    total: readNumber(row.total) ?? 0,
  };
}

function defaultSettingsRow(): DbRow {
  return {
    auto_publish_enabled: false,
    auto_sync_enabled: true,
    currency: ebayMarketplaceDefaults.currency,
    default_condition_id: "1000",
    default_condition_label: "Nuovo",
    enabled: false,
    environment: ebayMarketplaceDefaults.environment,
    listing_duration: "GTC",
    listing_locale: ebayMarketplaceDefaults.listingLocale,
    marketplace_id: ebayMarketplaceDefaults.marketplaceId,
    markup_fixed: 0,
    markup_percent: 0,
    operation_locale: ebayMarketplaceDefaults.operationLocale,
    order_import_enabled: true,
    provider: ebayMarketplaceDefaults.provider,
    stock_buffer: 1,
  };
}

function readAmount(value: unknown) {
  const record = readRecord(value);
  return {
    currency: readString(record?.currency) ?? "EUR",
    value: readNumber(record?.value) ?? 0,
  };
}

function toEbayEnvironment(value: unknown): EbayEnvironment {
  return value === "production" ? "production" : "sandbox";
}

function readRows(value: unknown): DbRow[] {
  return Array.isArray(value) ? value.filter(isRow) : [];
}

function isRow(value: unknown): value is DbRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(value: unknown): DbRow | null {
  return isRow(value) ? value : null;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  return null;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter(isNonEmptyString) : [];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function emptyToNull(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function removeUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  );
}

function normalizeKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function marketplaceSku(product: AdminProduct) {
  return (product.sourceSku ?? product.sku).toUpperCase();
}

function resultToJson(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {})) as Record<string, unknown>;
}

export function buildEbayNotificationTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getEbayNotificationEndpoint() {
  return `${getPartsProSiteUrl()}/api/ebay/notifications`;
}
