import "server-only";

import { z } from "zod";
import { RepositoryWriteError } from "@/lib/partspro-repository";
import { createClient } from "@/lib/supabase/server";

const postgresNonnegativeNumberSchema = z
  .union([
    z.number(),
    z
      .string()
      .trim()
      .regex(/^\d+(?:\.\d+)?$/)
      .transform(Number),
  ])
  .pipe(z.number().finite().nonnegative());

const postgresNonnegativeIntegerSchema = postgresNonnegativeNumberSchema.pipe(
  z.number().int().nonnegative()
);

const postgresPositiveIntegerSchema = postgresNonnegativeNumberSchema.pipe(
  z.number().int().positive()
);

const settlementOrderPreviewSchema = z
  .object({
    id: z.string().uuid(),
    orderNo: z.string().min(1),
    orderStatus: z.string().min(1),
    paymentStatus: z.string().min(1),
    paymentMethod: z.string().nullable(),
    grossAmount: postgresNonnegativeNumberSchema,
    walletAppliedAmount: postgresNonnegativeNumberSchema,
    receivedAmount: postgresNonnegativeNumberSchema,
    dueAmount: postgresNonnegativeNumberSchema,
    createdAt: z.string().nullable(),
    updatedAt: z.string().nullable(),
  })
  .strict();

const customerSettlementPreviewSchema = z
  .object({
    customerId: z.string().uuid(),
    customerName: z.string().nullable(),
    revision: z.string().regex(/^[0-9a-f]{32}$/),
    orderCount: postgresNonnegativeIntegerSchema,
    grossAmount: postgresNonnegativeNumberSchema,
    walletAppliedAmount: postgresNonnegativeNumberSchema,
    receivedAmount: postgresNonnegativeNumberSchema,
    dueAmount: postgresNonnegativeNumberSchema,
    orders: z.array(settlementOrderPreviewSchema),
  })
  .strict();

const settledOrderSchema = z
  .object({
    id: z.string().uuid(),
    orderNo: z.string().min(1),
    previousPaymentStatus: z.string().min(1),
    paymentStatus: z.literal("paid"),
    grossAmount: postgresNonnegativeNumberSchema,
    walletAppliedAmount: postgresNonnegativeNumberSchema,
    previousReceivedAmount: postgresNonnegativeNumberSchema,
    receivedAmount: postgresNonnegativeNumberSchema,
    collectedAmount: postgresNonnegativeNumberSchema,
  })
  .strict();

const customerSettlementResultSchema = z
  .object({
    bulkSettlementId: z.string().uuid(),
    customerId: z.string().uuid(),
    orderCount: postgresPositiveIntegerSchema,
    grossAmount: postgresNonnegativeNumberSchema,
    walletAppliedAmount: postgresNonnegativeNumberSchema,
    previousReceivedAmount: postgresNonnegativeNumberSchema,
    collectedAmount: postgresNonnegativeNumberSchema,
    paymentMethod: z.enum(["bank_transfer", "cash"]),
    receivedAt: z.string().min(1),
    reference: z.string().nullable(),
    orders: z.array(settledOrderSchema).min(1),
  })
  .strict();

export type CustomerSettlementPreview = z.infer<
  typeof customerSettlementPreviewSchema
>;

export type CustomerSettlementResult = z.infer<
  typeof customerSettlementResultSchema
>;

export type CustomerSettlementInput = {
  customerId: string;
  expectedRevision: string;
  note?: string;
  paymentMethod: "bank_transfer" | "cash";
  receivedAt?: string;
  reference?: string;
};

export async function readAdminCustomerSettlementPreview(
  customerId: string
): Promise<CustomerSettlementPreview> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "admin_preview_customer_settlement",
    { p_customer_id: customerId }
  );

  if (error) {
    throw settlementRpcError(
      error,
      "ADMIN_CUSTOMER_SETTLEMENT_PREVIEW_FAILED",
      "Customer settlement preview could not be loaded."
    );
  }

  const parsed = customerSettlementPreviewSchema.safeParse(data);

  if (!parsed.success || parsed.data.orderCount !== parsed.data.orders.length) {
    throw new RepositoryWriteError(
      502,
      "ADMIN_CUSTOMER_SETTLEMENT_PREVIEW_INVALID",
      "Customer settlement preview returned an invalid result."
    );
  }

  return parsed.data;
}

export async function settleAdminCustomerOrders(
  input: CustomerSettlementInput
): Promise<CustomerSettlementResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_settle_customer_orders", {
    p_customer_id: input.customerId,
    p_expected_revision: input.expectedRevision,
    p_payment_method: input.paymentMethod,
    p_received_at: input.receivedAt ?? null,
    p_reference: normalizeOptionalText(input.reference),
    p_note: normalizeOptionalText(input.note),
  });

  if (error) {
    throw settlementRpcError(
      error,
      "ADMIN_CUSTOMER_SETTLEMENT_FAILED",
      "Customer orders could not be settled."
    );
  }

  const parsed = customerSettlementResultSchema.safeParse(data);

  if (!parsed.success || parsed.data.orderCount !== parsed.data.orders.length) {
    throw new RepositoryWriteError(
      502,
      "ADMIN_CUSTOMER_SETTLEMENT_RESULT_INVALID",
      "Customer settlement returned an invalid result."
    );
  }

  return parsed.data;
}

function settlementRpcError(
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string
) {
  const record = isRecord(error) ? error : {};
  const postgresCode = readString(record.code);
  const detail = readString(record.details);

  if (detail === "CUSTOMER_SETTLEMENT_STALE") {
    return new RepositoryWriteError(
      409,
      "ADMIN_CUSTOMER_SETTLEMENT_STALE",
      "The customer balance changed after preview. Reload it before settling.",
      safeErrorDetails(record)
    );
  }

  if (detail === "CUSTOMER_SETTLEMENT_NOTHING_TO_SETTLE") {
    return new RepositoryWriteError(
      409,
      "ADMIN_CUSTOMER_SETTLEMENT_EMPTY",
      "This customer no longer has unsettled orders.",
      safeErrorDetails(record)
    );
  }

  const status =
    postgresCode === "42501"
      ? 403
      : postgresCode === "23503"
        ? 404
        : postgresCode === "22023" || postgresCode === "23514"
          ? 400
          : postgresCode === "40001"
            ? 409
            : 502;

  return new RepositoryWriteError(
    status,
    fallbackCode,
    fallbackMessage,
    safeErrorDetails(record)
  );
}

function safeErrorDetails(record: Record<string, unknown>) {
  return Object.fromEntries(
    ["code", "details", "hint"]
      .map((key) => [key, readString(record[key])] as const)
      .filter((entry): entry is readonly [string, string] => entry[1] !== null)
  );
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
