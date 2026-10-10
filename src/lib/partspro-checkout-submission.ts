import "server-only";
import { classifyCheckoutRpcError } from "@/lib/partspro-checkout-result.mjs";
import { createClient } from "@/lib/supabase/server";
import { RepositoryWriteError, type SavedOrder } from "@/lib/partspro-repository";

export type CheckoutAttempt = { requestId: string; intent: Record<string, unknown> };
export type CheckoutReceipt = {
  id: string; orderNo: string; status: SavedOrder["status"]; createdAt: string;
  orderKind: "stock" | "preorder"; walletAppliedAmount: number; payableAmount: number;
  totals: { subtotal: Money; shipping: Money; vat: Money; total: Money };
  lines: Array<{ sku: string; quantity: number; lineGross: Money }>;
};
type Money = { amount: string; cents: number; currency: "EUR" };
type SubmissionResult = { state: "created" | "pending" | "not_found" | "cancelled"; data?: CheckoutReceipt; replayed?: boolean };

export async function readCheckoutSubmission(requestId: string, intent?: Record<string, unknown>) {
  const client = await createClient();
  const { data, error } = await client.rpc("checkout_submission_result", {
    p_request_id: requestId, p_intent: intent ?? null,
  });
  if (error) throw rpcError(error);
  return data as SubmissionResult;
}

export async function createCheckoutSubmission(attempt: CheckoutAttempt, kind: "stock" | "preorder", payload: Record<string, unknown>): Promise<SavedOrder> {
  const client = await createClient();
  const { data, error } = await client.rpc("create_checkout_order_once", {
    p_request_id: attempt.requestId, p_intent: attempt.intent, p_kind: kind, p_payload: payload,
  });
  if (error) throw rpcError(error);
  const result = data as SubmissionResult | null;
  if (!result?.data?.id || !result.data.totals?.total) {
    throw new RepositoryWriteError(502, "ORDER_RESULT_UNKNOWN", "Order result needs verification.");
  }
  return { ...result.data, receipt: result.data, replayed: Boolean(result.replayed) };
}

function rpcError(error: { code?: string; message?: string }) {
  const classification = classifyCheckoutRpcError(error);
  return new RepositoryWriteError(classification.status, classification.code,
    classification.transactionRolledBack ? "Order was not created. Refresh checkout details and try again." : "Order result needs verification.",
    {transactionRolledBack: classification.transactionRolledBack});
}

export async function cancelCheckoutSubmission(requestId: string, intent: Record<string, unknown>) {
  const client = await createClient();
  const {data,error} = await client.rpc("cancel_checkout_submission",{p_request_id:requestId,p_intent:intent});
  if(error)throw rpcError(error);
  return data as SubmissionResult;
}
