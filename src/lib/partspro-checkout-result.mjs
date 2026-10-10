/** PostgreSQL business exceptions prove the entire RPC rolled back.
 * Transport/PostgREST errors and conflicting existing references do not. */
export function classifyCheckoutRpcError(error) {
  if (error?.code === 'P0002') return {status:409,code:'CHECKOUT_REQUEST_CANCELLED',transactionRolledBack:true};
  if (error?.code === '23514') return {status:422,code:'ORDER_STOCK_INVALID',transactionRolledBack:true};
  if (error?.code === '40001') return {status:409,code:/preorder|capacity|eta/i.test(error.message??'')?'PREORDER_OFFER_CHANGED':'ORDER_PRICE_CHANGED',transactionRolledBack:true};
  if (error?.code === '23503') return {status:422,code:'ORDER_SKU_UNAVAILABLE',transactionRolledBack:true};
  if (error?.code === '22023') return {status:409,code:'CHECKOUT_REQUEST_CONFLICT',transactionRolledBack:false};
  if (error?.code === '42501') return {status:403,code:'CHECKOUT_SUBMISSION_FORBIDDEN',transactionRolledBack:false};
  return {status:503,code:'ORDER_RESULT_UNKNOWN',transactionRolledBack:false};
}
