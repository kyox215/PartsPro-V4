"use client";

import * as React from "react";
import {
  products,
  type PartProduct,
} from "@/lib/partspro-data";
import { toPublicSku } from "@/lib/partspro-sku";

export type CartItem = {
  sku: string;
  quantity: number;
};

export type CartLine = CartItem & {
  product: PartProduct;
  lineTotal: number;
};

export type CartTotals = {
  lines: CartLine[];
  subtotal: number;
  shipping: number;
  vat: number;
  total: number;
};

type UseCartOptions = {
  consumeUrlIntent?: boolean;
  preserveUnknown?: boolean;
};

type NormalizeCartOptions = {
  preserveUnknown?: boolean;
};

type CartCatalogProviderProps = {
  children: React.ReactNode;
  products: readonly PartProduct[];
};

const CART_STORAGE_KEY = "partspro.cart.v1";
const CART_CHANGED_EVENT = "partspro-cart-changed";
const EMPTY_CART_ITEMS: CartItem[] = [];
const CartCatalogContext = React.createContext<readonly PartProduct[]>(products);

const cartSnapshotCache = new Map<string, CartItem[]>();

export function CartCatalogProvider({ children, products }: CartCatalogProviderProps) {
  const catalog = React.useMemo(() => products.map(normalizeCatalogProduct), [products]);

  return React.createElement(CartCatalogContext.Provider, { value: catalog }, children);
}

export function useCart({
  consumeUrlIntent = false,
  preserveUnknown = false,
}: UseCartOptions = {}) {
  const catalog = React.useContext(CartCatalogContext);
  const normalizeOptions = React.useMemo(
    () => ({ preserveUnknown }),
    [preserveUnknown]
  );
  const items = React.useSyncExternalStore(
    subscribeToCart,
    () => readStoredCartItems(catalog, normalizeOptions),
    getServerCartSnapshot
  );
  const isHydrated = React.useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot
  );

  React.useEffect(() => {
    const intent = consumeUrlIntent ? consumeCartIntentFromUrl(catalog) : null;

    if (intent) {
      const nextItems = mergeCartItems(
        readStoredCartItems(catalog, normalizeOptions),
        intent,
        catalog,
        normalizeOptions
      );
      writeStoredCartItems(nextItems, catalog, normalizeOptions);
    }
  }, [catalog, consumeUrlIntent, normalizeOptions]);

  const setItems = React.useCallback((nextItems: CartItem[]) => {
    const normalizedItems = normalizeCartItems(nextItems, catalog, normalizeOptions);
    return writeStoredCartItems(normalizedItems, catalog, normalizeOptions);
  }, [catalog, normalizeOptions]);

  const addItem = React.useCallback((sku: string, quantity = 1) => {
    return setItems(
      mergeCartItems(
        readStoredCartItems(catalog, normalizeOptions),
        { sku, quantity },
        catalog,
        normalizeOptions
      )
    );
  }, [catalog, normalizeOptions, setItems]);

  const updateQuantity = React.useCallback((sku: string, quantity: number) => {
    return setItems(
      updateCartItemQuantity(
        readStoredCartItems(catalog, normalizeOptions),
        sku,
        quantity,
        catalog,
        normalizeOptions
      )
    );
  }, [catalog, normalizeOptions, setItems]);

  const removeItem = React.useCallback((sku: string) => {
    return setItems(
      removeCartItem(
        readStoredCartItems(catalog, normalizeOptions),
        sku,
        catalog,
        normalizeOptions
      )
    );
  }, [catalog, normalizeOptions, setItems]);

  const clearCart = React.useCallback(() => {
    return setItems([]);
  }, [setItems]);

  const totals = React.useMemo(
    () => calculateCartTotalsFromItems(items, catalog),
    [catalog, items]
  );
  const itemCount = React.useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items]
  );

  return {
    addItem,
    clearCart,
    isHydrated,
    itemCount,
    items,
    lines: totals.lines,
    removeItem,
    totals,
    updateQuantity,
  };
}

export function addCartItem(
  sku: string,
  quantity = 1,
  catalog: readonly PartProduct[] = products
) {
  if (!isBrowser()) {
    return false;
  }

  try {
    const options = { preserveUnknown: true };
    const nextItems = mergeCartItems(
      readStoredCartItems(catalog, options),
      { sku, quantity },
      catalog,
      options
    );

    return writeStoredCartItems(nextItems, catalog, options);
  } catch {
    return false;
  }
}

export function setCartItemQuantity(
  sku: string,
  quantity: number,
  catalog: readonly PartProduct[] = products
) {
  if (!isBrowser()) {
    return false;
  }

  try {
    const options = { preserveUnknown: true };
    const currentItems = readStoredCartItems(catalog, options);

    if (quantity < 1) {
      return writeStoredCartItems(
        removeCartItem(currentItems, sku, catalog, options),
        catalog,
        options
      );
    }

    return writeStoredCartItems(
      updateCartItemQuantity(currentItems, sku, quantity, catalog, options),
      catalog,
      options
    );
  } catch {
    return false;
  }
}

export function removeCartItemBySku(
  sku: string,
  catalog: readonly PartProduct[] = products
) {
  return setCartItemQuantity(sku, 0, catalog);
}

export function clearStoredCart() {
  if (!isBrowser()) {
    return false;
  }

  try {
    window.localStorage.removeItem(CART_STORAGE_KEY);
    resetCartSnapshotCache("", "", true, EMPTY_CART_ITEMS);
    resetCartSnapshotCache("", "", false, EMPTY_CART_ITEMS, { preserveExisting: true });
    window.dispatchEvent(new Event(CART_CHANGED_EVENT));

    return true;
  } catch {
    return false;
  }
}

export function useStoredCartItems({ preserveUnknown = true }: NormalizeCartOptions = {}) {
  const normalizeOptions = React.useMemo(
    () => ({ preserveUnknown }),
    [preserveUnknown]
  );

  return React.useSyncExternalStore(
    subscribeToCart,
    () => readStoredCartItems([], normalizeOptions),
    getServerCartSnapshot
  );
}

export function readClientStoredCartItems(
  options: NormalizeCartOptions = { preserveUnknown: true }
) {
  return readStoredCartItems([], options);
}

export function replaceStoredCartItems(
  items: CartItem[],
  options: NormalizeCartOptions = { preserveUnknown: true }
) {
  return writeStoredCartItems(items, [], options);
}

export function mergeCartItemCollections(
  leftItems: readonly CartItem[],
  rightItems: readonly CartItem[]
) {
  const quantities = new Map<string, number>();

  for (const item of [...leftItems, ...rightItems]) {
    const normalized = normalizeCartItems([item], [], { preserveUnknown: true })[0];

    if (!normalized) {
      continue;
    }

    quantities.set(
      normalized.sku,
      Math.max(quantities.get(normalized.sku) ?? 0, normalized.quantity)
    );
  }

  return normalizeCartItems(
    Array.from(quantities.entries()).map(([sku, quantity]) => ({ sku, quantity })),
    [],
    { preserveUnknown: true }
  );
}

export function serializeCartItems(items: readonly CartItem[]) {
  return JSON.stringify(
    normalizeCartItems([...items], [], { preserveUnknown: true })
  );
}

export function calculateCartTotalsFromItems(
  items: CartItem[],
  catalog: readonly PartProduct[] = products
): CartTotals {
  const lines = normalizeCartItems(items, catalog).flatMap((item) => {
    const product = getProductBySku(item.sku, catalog);

    if (!product || !isOrderableCartLine(product, item.quantity)) {
      return [];
    }

    return {
      ...item,
      product,
      lineTotal: centsToEuro(toCents(product.price) * item.quantity),
    };
  });
  const subtotalCents = lines.reduce(
    (total, line) => total + toCents(line.product.price) * line.quantity,
    0
  );
  const shippingCents = subtotalCents === 0 || subtotalCents > 25000 ? 0 : 1290;
  const itemVatCents = lines.reduce((total, line) => {
    const lineNetCents = toCents(line.product.price) * line.quantity;

    return total + Math.round((lineNetCents * line.product.vatRate) / 100);
  }, 0);
  const vatCents = itemVatCents + Math.round((shippingCents * 22) / 100);

  return {
    lines,
    subtotal: centsToEuro(subtotalCents),
    shipping: centsToEuro(shippingCents),
    vat: centsToEuro(vatCents),
    total: centsToEuro(subtotalCents + shippingCents + vatCents),
  };
}

function readStoredCartItems(
  catalog: readonly PartProduct[],
  options: NormalizeCartOptions = {}
) {
  if (!isBrowser()) {
    return EMPTY_CART_ITEMS;
  }

  const rawCart = readStoredCartRaw();
  const catalogKey = cartCatalogKey(catalog);
  const preserveUnknown = Boolean(options.preserveUnknown);
  const cacheKey = cartSnapshotCacheKey(rawCart, catalogKey, preserveUnknown);
  const cachedSnapshot = cartSnapshotCache.get(cacheKey);

  if (cachedSnapshot) {
    return cachedSnapshot;
  }

  try {
    const normalizedItems = normalizeCartItems(
      JSON.parse(rawCart || "[]"),
      catalog,
      options
    );
    const snapshotItems = normalizedItems.length > 0 ? normalizedItems : EMPTY_CART_ITEMS;
    cartSnapshotCache.set(cacheKey, snapshotItems);

    return snapshotItems;
  } catch {
    cartSnapshotCache.set(cacheKey, EMPTY_CART_ITEMS);

    return EMPTY_CART_ITEMS;
  }
}

function writeStoredCartItems(
  items: CartItem[],
  catalog: readonly PartProduct[],
  options: NormalizeCartOptions = {}
) {
  if (!isBrowser()) {
    return false;
  }

  const normalizedItems = normalizeCartItems(items, catalog, options);
  const catalogKey = cartCatalogKey(catalog);
  const preserveUnknown = Boolean(options.preserveUnknown);

  try {
    if (normalizedItems.length === 0) {
      window.localStorage.removeItem(CART_STORAGE_KEY);
      resetCartSnapshotCache("", catalogKey, preserveUnknown, EMPTY_CART_ITEMS);
    } else {
      const serializedItems = JSON.stringify(normalizedItems);
      window.localStorage.setItem(CART_STORAGE_KEY, serializedItems);
      resetCartSnapshotCache(serializedItems, catalogKey, preserveUnknown, normalizedItems);
    }

    window.dispatchEvent(new Event(CART_CHANGED_EVENT));

    return true;
  } catch {
    return false;
  }
}

function readStoredCartRaw() {
  try {
    return window.localStorage.getItem(CART_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function resetCartSnapshotCache(
  rawCart: string,
  catalogKey: string,
  preserveUnknown: boolean,
  items: CartItem[],
  options: { preserveExisting?: boolean } = {}
) {
  if (!options.preserveExisting) {
    cartSnapshotCache.clear();
  }

  cartSnapshotCache.set(
    cartSnapshotCacheKey(rawCart, catalogKey, preserveUnknown),
    items.length > 0 ? items : EMPTY_CART_ITEMS
  );
}

function cartSnapshotCacheKey(
  rawCart: string,
  catalogKey: string,
  preserveUnknown: boolean
) {
  return JSON.stringify([rawCart, catalogKey, preserveUnknown]);
}

function subscribeToCart(onStoreChange: () => void) {
  if (!isBrowser()) {
    return () => {};
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CART_CHANGED_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CART_CHANGED_EVENT, onStoreChange);
  };
}

function getServerCartSnapshot() {
  return EMPTY_CART_ITEMS;
}

function subscribeToHydration() {
  return () => {};
}

function getClientHydrationSnapshot() {
  return true;
}

function getServerHydrationSnapshot() {
  return false;
}

function normalizeCartItems(
  value: unknown,
  catalog: readonly PartProduct[] = products,
  options: NormalizeCartOptions = {}
): CartItem[] {
  const rawItems = Array.isArray(value) ? value : [];
  const quantities = new Map<string, number>();
  const hasCatalog = catalog.length > 0;
  const preserveUnknown = Boolean(options.preserveUnknown);

  for (const item of rawItems) {
    if (!isCartItemLike(item)) {
      continue;
    }

    const sku = normalizeSku(item.sku);
    const product = getProductBySku(sku, catalog);
    const quantity = normalizeQuantity(item.quantity);

    if (quantity === null) {
      continue;
    }

    if (hasCatalog && !product && !preserveUnknown) {
      continue;
    }

    quantities.set(sku, (quantities.get(sku) ?? 0) + quantity);
  }

  return Array.from(quantities.entries())
    .map(([sku, quantity]) => {
      const product = getProductBySku(sku, catalog);

      if (!product) {
        return hasCatalog && !preserveUnknown ? null : { sku, quantity };
      }

      return { sku, quantity };
    })
    .filter((item): item is CartItem => Boolean(item))
    .sort((left, right) => left.sku.localeCompare(right.sku));
}

function mergeCartItems(
  items: CartItem[],
  item: CartItem,
  catalog: readonly PartProduct[],
  options: NormalizeCartOptions = {}
) {
  return normalizeCartItems([...items, item], catalog, options);
}

function updateCartItemQuantity(
  items: CartItem[],
  sku: string,
  quantity: number,
  catalog: readonly PartProduct[],
  options: NormalizeCartOptions = {}
) {
  const normalizedSku = normalizeSku(sku);
  const hasItem = items.some((item) => normalizeSku(item.sku) === normalizedSku);
  const nextItems = hasItem
    ? items.map((item) =>
        normalizeSku(item.sku) === normalizedSku ? { sku: normalizedSku, quantity } : item
      )
    : [...items, { sku: normalizedSku, quantity }];

  return normalizeCartItems(nextItems, catalog, options);
}

function removeCartItem(
  items: CartItem[],
  sku: string,
  catalog: readonly PartProduct[],
  options: NormalizeCartOptions = {}
) {
  const normalizedSku = normalizeSku(sku);

  return normalizeCartItems(
    items.filter((item) => normalizeSku(item.sku) !== normalizedSku),
    catalog,
    options
  );
}

function consumeCartIntentFromUrl(catalog: readonly PartProduct[]) {
  if (!isBrowser()) {
    return null;
  }

  const url = new URL(window.location.href);
  const sku = url.searchParams.get("sku");

  if (!sku) {
    return null;
  }

  const quantity = normalizeQuantity(url.searchParams.get("qty") ?? 1) ?? 1;
  const [intent] = normalizeCartItems([{ sku, quantity }], catalog);

  url.searchParams.delete("sku");
  url.searchParams.delete("qty");
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`
  );

  return intent ?? null;
}

function isCartItemLike(item: unknown): item is CartItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "sku" in item &&
    "quantity" in item &&
    typeof (item as CartItem).sku === "string"
  );
}

function isOrderableCartLine(product: PartProduct, quantity: number) {
  const minimumQuantity = Math.max(1, product.moq);

  return (
    product.price > 0 &&
    product.status !== "Out of Stock" &&
    product.stock >= minimumQuantity &&
    quantity >= minimumQuantity &&
    quantity <= product.stock
  );
}

function normalizeQuantity(value: unknown) {
  const quantity = Number(value);

  if (!Number.isFinite(quantity)) {
    return null;
  }

  return Math.max(1, Math.trunc(quantity));
}

function normalizeSku(value: string) {
  return toPublicSku(value);
}

function getProductBySku(sku: string, catalog: readonly PartProduct[]) {
  const normalizedSku = normalizeSku(sku);

  return catalog.find((product) => normalizeSku(product.sku) === normalizedSku);
}

function normalizeCatalogProduct(product: PartProduct): PartProduct {
  return {
    ...product,
    sku: normalizeSku(product.sku),
  };
}

function cartCatalogKey(catalog: readonly PartProduct[]) {
  return catalog
    .map((product) => (
      `${normalizeSku(product.sku)}:${product.stock}:${product.moq}:${product.status}`
    ))
    .join("|");
}

function toCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100);
}

function centsToEuro(cents: number) {
  return cents / 100;
}

function isBrowser() {
  return typeof window !== "undefined";
}
