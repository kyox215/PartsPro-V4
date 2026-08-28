import "server-only";

/**
 * Migration B capability contract. The new admin/customer workflow is enabled
 * only after this narrow RPC exists and explicitly reports the expected
 * contract. A missing RPC is treated as a deployment gap, never as a generic
 * Supabase failure or an empty RMA result.
 */
export const rmaWorkflowCapabilityRpc = "rma_workflow_capabilities" as const;
export const rmaWorkflowContractVersion = "rma-workflow-b1" as const;

export class RmaWorkflowNotReadyError extends Error {
  readonly code = "RMA_WORKFLOW_NOT_READY" as const;
  readonly status = 503 as const;

  constructor() {
    super("The RMA workflow is not ready on the current deployment.");
    this.name = "RmaWorkflowNotReadyError";
  }
}

type RpcResult = {
  data: unknown;
  error: unknown;
};

type RpcClient = {
  rpc: (
    functionName: string,
    args?: Record<string, unknown>
  ) => PromiseLike<RpcResult>;
};

/**
 * Fail closed when Migration B is absent, partially deployed, or reports a
 * different contract. The capability response intentionally has no business
 * or customer data.
 */
export async function assertRmaWorkflowReady(client: RpcClient) {
  let result: RpcResult;

  try {
    result = await client.rpc(rmaWorkflowCapabilityRpc);
  } catch {
    throw new RmaWorkflowNotReadyError();
  }

  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (
    result.error ||
    !isRecord(row) ||
    row.ready !== true ||
    row.contract_version !== rmaWorkflowContractVersion
  ) {
    throw new RmaWorkflowNotReadyError();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
