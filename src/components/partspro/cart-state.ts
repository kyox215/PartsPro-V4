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
};

type CartCatalogProviderProps = {
  children: React.ReactNode;
  products: readonly PartProduct[];
};

const CART_STORAGE_KEY = "partspro.cart.v1";
const CART_CHANGED_EVENT = "partspro-cart-changed";
const EMPTY_CART_ITEMS: CartItem[] = [];
const CartCatalogContext = React.createContext<readonly PartProduct[]>(products);

let cartSnapshotRaw = "";
let cartSnapshotCatalogKey = "";
let cartSnapshotItems: CartItem[] = EMPTY_CART_ITEMS;

export function CartCatalogProvider({ children, products }: CartCatalogProviderProps) {
  const catalog = React.useMemo(() => products.map(normalizeCatalogProduct), [products]);

  return React.createElement(CartCatalogContext.Provider, { value: catalog }, children);
}

export function useCart({ consumeUrlIntent = false }: UseCartOptions = {}) {
  const catalog = React.useContext(CartCatalogContext);
  const items = React.useSyncExternalStore(
    subscribeToCart,
    () => readStoredCartItems(catalog),
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
      const nextItems = mergeCartItems(readStoredCartItems(catalog), intent, catalog);
      writeStoredCartItems(nextItems, catalog);
    }
  }, [catalog, consumeUrlIntent]);

  const setItems = React.useCallback((nextItems: CartItem[]) => {
    const normalizedItems = normalizeCartItems(nextItems, catalog);
    writeStoredCartItems(normalizedItems, catalog);
  }, [catalog]);

  const addItem = React.useCallback((sku: string, quantity = 1) => {
    setItems(mergeCartItems(readStoredCartItems(catalog), { sku, quantity }, catalog));
  }, [catalog, setItems]);

  const updateQuantity = React.useCallback((sku: string, quantity: number) => {
    setItems(updateCartItemQuantity(readStoredCartItems(catalog), sku, quantity, catalog));
  }, [catalog, setItems]);

  const removeItem = React.useCallback((sku: string) => {
    setItems(removeCartItem(readStoredCartItems(catalog), sku, catalog));
  }, [catalog, setItems]);

  const clearCart = React.useCallback(() => {
    setItems([]);
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

export function addCartItem(sku: string, quantity = 1) {
  if (!isBrowser()) {
    return;
  }

  const nextItems = mergeCartItems(readStoredCartItems(products), { sku, quantity }, products);
  writeStoredCartItems(nextItems, products);
}

export function calculateCartTotalsFromItems(
  items: CartItem[],
  catalog: readonly PartProduct[] = products
): CartTotals {
  const lines = normalizeCartItems(items, catalog).flatMap((item) => {
    const product = getProductBySku(item.sku, catalog);

    if (!product) {
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

function readStoredCartItems(catalog: readonly PartProduct[]) {
  if (!isBrowser()) {
    return EMPTY_CART_ITEMS;
  }

  const rawCart = window.localStorage.getItem(CART_STORAGE_KEY) ?? "";
  const catalogKey = cartCatalogKey(catalog);

  if (rawCart === cartSnapshotRaw && catalogKey === cartSnapshotCatalogKey) {
    return cartSnapshotItems;
  }

  try {
    const normalizedItems = normalizeCartItems(JSON.parse(rawCart || "[]"), catalog);
    cartSnapshotRaw = rawCart;
    cartSnapshotCatalogKey = catalogKey;
    cartSnapshotItems = normalizedItems.length > 0 ? normalizedItems : EMPTY_CART_ITEMS;

    return cartSnapshotItems;
  } catch {
    cartSnapshotRaw = rawCart;
    cartSnapshotCatalogKey = catalogKey;
    cartSnapshotItems = EMPTY_CART_ITEMS;

    return cartSnapshotItems;
  }
}

function writeStoredCartItems(items: CartItem[], catalog: readonly PartProduct[]) {
  if (!isBrowser()) {
    return;
  }

  const normalizedItems = normalizeCartItems(items, catalog);
  const catalogKey = cartCatalogKey(catalog);

  if (normalizedItems.length === 0) {
    window.localStorage.removeItem(CART_STORAGE_KEY);
    cartSnapshotRaw = "";
    cartSnapshotCatalogKey = catalogKey;
    cartSnapshotItems = EMPTY_CART_ITEMS;
  } else {
    const serializedItems = JSON.stringify(normalizedItems);
    window.localStorage.setItem(CART_STORAGE_KEY, serializedItems);
    cartSnapshotRaw = serializedItems;
    cartSnapshotCatalogKey = catalogKey;
    cartSnapshotItems = normalizedItems;
  }

  window.dispatchEvent(new Event(CART_CHANGED_EVENT));
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
  catalog: readonly PartProduct[] = products
): CartItem[] {
  const rawItems = Array.isArray(value) ? value : [];
  const quantities = new Map<string, number>();
  const hasCatalog = catalog.length > 0;

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

    if (hasCatalog && (!product || !isOrderableProduct(product))) {
      continue;
    }

    quantities.set(sku, (quantities.get(sku) ?? 0) + quantity);
  }

  return Array.from(quantities.entries())
    .map(([sku, quantity]) => {
      const product = getProductBySku(sku, catalog);

      if (!product) {
        return hasCatalog ? null : { sku, quantity };
      }

      const clampedQuantity = clampQuantity(product, quantity);

      return clampedQuantity > 0 ? { sku, quantity: clampedQuantity } : null;
    })
    .filter((item): item is CartItem => Boolean(item))
    .sort((left, right) => left.sku.localeCompare(right.sku));
}

function mergeCartItems(
  items: CartItem[],
  item: CartItem,
  catalog: readonly PartProduct[]
) {
  return normalizeCartItems([...items, item], catalog);
}

function updateCartItemQuantity(
  items: CartItem[],
  sku: string,
  quantity: number,
  catalog: readonly PartProduct[]
) {
  const normalizedSku = normalizeSku(sku);
  const hasItem = items.some((item) => normalizeSku(item.sku) === normalizedSku);
  const nextItems = hasItem
    ? items.map((item) =>
        normalizeSku(item.sku) === normalizedSku ? { sku: normalizedSku, quantity } : item
      )
    : [...items, { sku: normalizedSku, quantity }];

  return normalizeCartItems(nextItems, catalog);
}

function removeCartItem(
  items: CartItem[],
  sku: string,
  catalog: readonly PartProduct[]
) {
  const normalizedSku = normalizeSku(sku);

  return normalizeCartItems(
    items.filter((item) => normalizeSku(item.sku) !== normalizedSku),
    catalog
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

function isOrderableProduct(product: PartProduct) {
  return product.status !== "Out of Stock" && product.stock >= Math.max(1, product.moq);
}

function clampQuantity(product: PartProduct, quantity: number) {
  const minimumQuantity = Math.max(1, product.moq);
  const maximumQuantity = Math.max(0, product.stock);

  if (maximumQuantity < minimumQuantity) {
    return 0;
  }

  return Math.min(maximumQuantity, Math.max(minimumQuantity, Math.trunc(quantity)));
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
