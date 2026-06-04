"use client";

import * as React from "react";
import {
  products,
  type PartProduct,
} from "@/lib/partspro-data";
import { calculateShippingCents } from "@/lib/partspro-shipping";
import { toPublicSku } from "@/lib/partspro-sku";

export type CartItem = {
  snapshot?: CartItemSnapshot;
  sku: string;
  quantity: number;
};

export type CartItemSnapshot = {
  basePrice?: number;
  brand: string;
  category: string;
  discountPercent?: number;
  grade: PartProduct["grade"];
  imageAlt?: string;
  imageUrl?: string;
  levelDiscountPercent?: number;
  marginPercent?: number;
  moq: number;
  name: string;
  price: number;
  priceGroupDiscountPercent?: number;
  retailPrice: number;
  sku: string;
  status: PartProduct["status"];
  stock: number;
  updatedAt: string;
  visual: PartProduct["visual"];
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

type CatalogLookup = {
  hasCatalog: boolean;
  productsBySku: Map<string, PartProduct>;
};

type CartCatalogProviderProps = {
  children: React.ReactNode;
  products: readonly PartProduct[];
};

const CART_STORAGE_KEY = "partspro.cart.v1";
const CART_STORAGE_OWNER_PREFIX = `${CART_STORAGE_KEY}:user:`;
const CART_CHANGED_EVENT = "partspro-cart-changed";
const EMPTY_CART_ITEMS: CartItem[] = [];
const CartCatalogContext = React.createContext<readonly PartProduct[]>(products);

const cartSnapshotCache = new Map<string, CartItem[]>();
let activeCartStorageOwner: string | null = null;

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
    setItems,
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
    const storageKey = currentCartStorageKey();

    if (storageKey) {
      window.localStorage.removeItem(storageKey);
    }

    window.localStorage.removeItem(CART_STORAGE_KEY);
    resetCartSnapshotCache("", "", true, EMPTY_CART_ITEMS);
    resetCartSnapshotCache("", "", false, EMPTY_CART_ITEMS, { preserveExisting: true });
    window.dispatchEvent(new Event(CART_CHANGED_EVENT));

    return true;
  } catch {
    return false;
  }
}

export function setCartStorageOwner(userId: string | null) {
  if (!isBrowser()) {
    return false;
  }

  const nextOwner = normalizeCartStorageOwner(userId);

  if (activeCartStorageOwner === nextOwner) {
    return true;
  }

  activeCartStorageOwner = nextOwner;
  cartSnapshotCache.clear();
  window.dispatchEvent(new Event(CART_CHANGED_EVENT));

  return true;
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

export function refreshStoredCartItemSnapshots(catalog: readonly PartProduct[]) {
  if (!isBrowser() || catalog.length === 0) {
    return false;
  }

  const options = { preserveUnknown: true };
  const currentItems = readStoredCartItems([], options);
  const refreshedItems = normalizeCartItems(currentItems, catalog, options);

  if (JSON.stringify(currentItems) === JSON.stringify(refreshedItems)) {
    return true;
  }

  return writeStoredCartItems(refreshedItems, catalog, options);
}

export function mergeCartItemCollections(
  leftItems: readonly CartItem[],
  rightItems: readonly CartItem[]
) {
  const mergedItems = new Map<string, CartItem>();

  for (const item of [...leftItems, ...rightItems]) {
    const normalized = normalizeCartItems([item], [], { preserveUnknown: true })[0];

    if (!normalized) {
      continue;
    }

    const current = mergedItems.get(normalized.sku);

    mergedItems.set(normalized.sku, {
      sku: normalized.sku,
      quantity: Math.max(current?.quantity ?? 0, normalized.quantity),
      snapshot: normalized.snapshot ?? current?.snapshot,
    });
  }

  return normalizeCartItems(
    Array.from(mergedItems.values()),
    [],
    { preserveUnknown: true }
  );
}

export function serializeCartItems(items: readonly CartItem[]) {
  return JSON.stringify(cartItemsForApi(items));
}

export function cartItemsForApi(items: readonly CartItem[]) {
  return normalizeCartItems([...items], [], { preserveUnknown: true }).map(
    ({ quantity, sku }) => ({ quantity, sku })
  );
}

export function calculateCartTotalsFromItems(
  items: CartItem[],
  catalog: readonly PartProduct[] = products
): CartTotals {
  const lookup = createCatalogLookup(catalog);
  const lines = normalizeCartItemsWithLookup(items, lookup).flatMap((item) => {
    const product = getProductFromLookup(item.sku, lookup);

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
  const shippingCents = calculateShippingCents(subtotalCents);

  return {
    lines,
    subtotal: centsToEuro(subtotalCents),
    shipping: centsToEuro(shippingCents),
    vat: 0,
    total: centsToEuro(subtotalCents + shippingCents),
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
  const storageKey = currentCartStorageKey();

  if (!storageKey) {
    return false;
  }

  try {
    if (normalizedItems.length === 0) {
      window.localStorage.removeItem(storageKey);
      resetCartSnapshotCache("", catalogKey, preserveUnknown, EMPTY_CART_ITEMS);
    } else {
      const serializedItems = JSON.stringify(normalizedItems);
      window.localStorage.setItem(storageKey, serializedItems);
      resetCartSnapshotCache(serializedItems, catalogKey, preserveUnknown, normalizedItems);
    }

    window.dispatchEvent(new Event(CART_CHANGED_EVENT));

    return true;
  } catch {
    return false;
  }
}

function readStoredCartRaw() {
  const storageKey = currentCartStorageKey();

  if (!storageKey) {
    return "";
  }

  try {
    return window.localStorage.getItem(storageKey) ?? "";
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

function currentCartStorageKey() {
  return activeCartStorageOwner
    ? `${CART_STORAGE_OWNER_PREFIX}${activeCartStorageOwner}`
    : null;
}

function normalizeCartStorageOwner(userId: string | null) {
  const trimmed = userId?.trim();

  return trimmed ? trimmed : null;
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
  return normalizeCartItemsWithLookup(value, createCatalogLookup(catalog), options);
}

function normalizeCartItemsWithLookup(
  value: unknown,
  lookup: CatalogLookup,
  options: NormalizeCartOptions = {}
): CartItem[] {
  const rawItems = Array.isArray(value) ? value : [];
  const normalizedBySku = new Map<string, CartItem>();
  const preserveUnknown = Boolean(options.preserveUnknown);

  for (const item of rawItems) {
    if (!isCartItemLike(item)) {
      continue;
    }

    const sku = normalizeSku(item.sku);
    const product = getProductFromLookup(sku, lookup);
    const quantity = normalizeQuantity(item.quantity);

    if (quantity === null) {
      continue;
    }

    if (lookup.hasCatalog && !product && !preserveUnknown) {
      continue;
    }

    const existing = normalizedBySku.get(sku);
    const snapshot =
      product !== undefined
        ? cartItemSnapshotFromProduct(product)
        : normalizeCartItemSnapshot(item.snapshot, sku);

    normalizedBySku.set(sku, {
      sku,
      quantity: (existing?.quantity ?? 0) + quantity,
      snapshot: snapshot ?? existing?.snapshot,
    });
  }

  return Array.from(normalizedBySku.values())
    .map((item) => {
      const product = getProductFromLookup(item.sku, lookup);

      if (!product) {
        return lookup.hasCatalog && !preserveUnknown ? null : item;
      }

      return {
        ...item,
        snapshot: cartItemSnapshotFromProduct(product),
      };
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
  const lookup = createCatalogLookup(catalog);
  const product = getProductFromLookup(normalizedSku, lookup);
  const snapshot = product ? cartItemSnapshotFromProduct(product) : undefined;
  const hasItem = items.some((item) => normalizeSku(item.sku) === normalizedSku);
  const nextItems = hasItem
    ? items.map((item) =>
        normalizeSku(item.sku) === normalizedSku
          ? {
              sku: normalizedSku,
              quantity,
              snapshot: snapshot ?? item.snapshot,
            }
          : item
      )
    : [...items, { sku: normalizedSku, quantity, snapshot }];

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

function cartItemSnapshotFromProduct(product: PartProduct): CartItemSnapshot {
  return omitUndefined({
    basePrice: product.basePrice,
    brand: product.brand,
    category: product.category,
    discountPercent: product.discountPercent,
    grade: product.grade,
    imageAlt: product.imageAlt,
    imageUrl: product.imageUrl,
    levelDiscountPercent: product.levelDiscountPercent,
    marginPercent: product.marginPercent,
    moq: Math.max(1, product.moq),
    name: product.name,
    price: product.price,
    priceGroupDiscountPercent: product.priceGroupDiscountPercent,
    retailPrice: product.retailPrice,
    sku: normalizeSku(product.sku),
    status: product.status,
    stock: Math.max(0, product.stock),
    updatedAt: product.updatedAt,
    visual: product.visual,
  });
}

function normalizeCartItemSnapshot(
  value: unknown,
  sku: string
): CartItemSnapshot | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const name = readString(value.name);

  if (!name) {
    return undefined;
  }

  return omitUndefined({
    basePrice: readOptionalNumber(value.basePrice),
    brand: readString(value.brand) ?? "",
    category: readString(value.category) ?? "",
    discountPercent: readOptionalNumber(value.discountPercent),
    grade: normalizeProductGrade(value.grade),
    imageAlt: readString(value.imageAlt),
    imageUrl: readString(value.imageUrl),
    levelDiscountPercent: readOptionalNumber(value.levelDiscountPercent),
    marginPercent: readOptionalNumber(value.marginPercent),
    moq: Math.max(1, readOptionalNumber(value.moq) ?? 1),
    name,
    price: Math.max(0, readOptionalNumber(value.price) ?? 0),
    priceGroupDiscountPercent: readOptionalNumber(value.priceGroupDiscountPercent),
    retailPrice: Math.max(0, readOptionalNumber(value.retailPrice) ?? 0),
    sku: normalizeSku(readString(value.sku) ?? sku),
    status: normalizeStockStatus(value.status),
    stock: Math.max(0, readOptionalNumber(value.stock) ?? 0),
    updatedAt: readString(value.updatedAt) ?? "",
    visual: normalizePartVisual(value.visual),
  });
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

function normalizeProductGrade(value: unknown): PartProduct["grade"] {
  return value === "A+" ||
    value === "A" ||
    value === "B" ||
    value === "Refurbished"
    ? value
    : "A";
}

function normalizeStockStatus(value: unknown): PartProduct["status"] {
  return value === "In Stock" || value === "Low Stock" || value === "Out of Stock"
    ? value
    : "In Stock";
}

function normalizePartVisual(value: unknown): PartProduct["visual"] {
  return value === "screen" ||
    value === "battery" ||
    value === "cover" ||
    value === "port" ||
    value === "camera" ||
    value === "flex" ||
    value === "speaker" ||
    value === "frame"
    ? value
    : "screen";
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readOptionalNumber(value: unknown) {
  const number = Number(value);

  return Number.isFinite(number) ? number : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;
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

function normalizeCatalogProduct(product: PartProduct): PartProduct {
  return {
    ...product,
    sku: normalizeSku(product.sku),
  };
}

function createCatalogLookup(catalog: readonly PartProduct[]): CatalogLookup {
  return {
    hasCatalog: catalog.length > 0,
    productsBySku: new Map(
      catalog.map((product) => [normalizeSku(product.sku), product])
    ),
  };
}

function getProductFromLookup(sku: string, lookup: CatalogLookup) {
  return lookup.productsBySku.get(normalizeSku(sku));
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
