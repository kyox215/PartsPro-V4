export type AdminBulkHideResult<T> = {
  products: T[];
  succeededSkus: string[];
  failedSku: string | null;
  unattemptedSkus: string[];
  error: unknown | null;
};

/** Inputs have already been validated by the API. Each hide commits independently. */
export async function hideAdminProductsSequentially<T>(
  skus: readonly string[],
  hide: (sku: string) => Promise<T>,
): Promise<AdminBulkHideResult<T>> {
  const products: T[] = [];
  const succeededSkus: string[] = [];
  // Snapshot the request so callers cannot change the remaining work while awaiting a write.
  const requestedSkus = [...skus];

  for (let index = 0; index < requestedSkus.length; index += 1) {
    const sku = requestedSkus[index];
    try {
      const product = await hide(sku);
      products.push(product);
      succeededSkus.push(sku);
    } catch (error) {
      return {
        products,
        succeededSkus,
        failedSku: sku,
        unattemptedSkus: requestedSkus.slice(index + 1),
        error,
      };
    }
  }

  return { products, succeededSkus, failedSku: null, unattemptedSkus: [], error: null };
}
