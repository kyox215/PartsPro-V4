/**
 * Convert a repository order identifier into the only order value permitted
 * in the customer RMA DTO. Business order numbers remain useful to customers;
 * UUID-shaped values are internal database identifiers and are rejected.
 */
export function normalizeCustomerOrderNumber(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > 120) {
    return null;
  }

  // Reject every UUID-shaped value, including newer UUID versions and the
  // nil/variant forms that a version-specific UUID regex would miss.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    normalized
  )
    ? null
    : normalized;
}

/**
 * Runtime customer DTO boundary. This function deliberately derives only
 * customer-safe order and resolution identity; callers must not spread the
 * repository request into a customer response.
 */
export function toCustomerRmaPrivacySafeFields(request) {
  const customerOrderNumber =
    normalizeCustomerOrderNumber(request?.orderNumber) ??
    normalizeCustomerOrderNumber(request?.orderId);

  return {
    orderId: customerOrderNumber,
    orderNumber: customerOrderNumber,
    requestedResolution:
      typeof request?.requestedResolution === "string" && request.requestedResolution.trim()
        ? request.requestedResolution
        : "",
    ...(typeof request?.customerVisibleNote === "string" && request.customerVisibleNote
      ? { customerVisibleNote: request.customerVisibleNote }
      : {}),
  };
}
