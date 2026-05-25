"use client";

import * as React from "react";
import {
  cartItems,
  products,
  type PartProduct,
} from "@/lib/partspro-data";

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

const CART_STORAGE_KEY = "partspro.cart.v1";
const CART_CHANGED_EVENT = "partspro-cart-changed";
const EMPTY_CART_ITEMS: CartItem[] = [];

let cartSnapshotRaw = "";
let cartSnapshotItems: CartItem[] = EMPTY_CART_ITEMS;

export function useCart({ consumeUrlIntent = false }: UseCartOptions = {}) {
  const items = React.useSyncExternalStore(
    subscribeToCart,
    readStoredCartItems,
    getServerCartSnapshot
  );
  const isHydrated = React.useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot
  );

  React.useEffect(() => {
    const intent = consumeUrlIntent ? consumeCartIntentFromUrl() : null;

    if (intent) {
      const nextItems = mergeCartItems(readStoredCartItems(), intent);
      writeStoredCartItems(nextItems);
    }
  }, [consumeUrlIntent]);

  const setItems = React.useCallback((nextItems: CartItem[]) => {
    const normalizedItems = normalizeCartItems(nextItems);
    writeStoredCartItems(normalizedItems);
  }, []);

  const addItem = React.useCallback((sku: string, quantity = 1) => {
    setItems(mergeCartItems(readStoredCartItems(), { sku, quantity }));
  }, [setItems]);

  const updateQuantity = React.useCallback((sku: string, quantity: number) => {
    setItems(updateCartItemQuantity(readStoredCartItems(), sku, quantity));
  }, [setItems]);

  const removeItem = React.useCallback((sku: string) => {
    setItems(removeCartItem(readStoredCartItems(), sku));
  }, [setItems]);

  const clearCart = React.useCallback(() => {
    setItems([]);
  }, [setItems]);

  const loadDemoCart = React.useCallback(() => {
    setItems(getDemoCartItems());
  }, [setItems]);

  const totals = React.useMemo(() => calculateCartTotalsFromItems(items), [items]);
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
    loadDemoCart,
    removeItem,
    totals,
    updateQuantity,
  };
}

export function addCartItem(sku: string, quantity = 1) {
  if (!isBrowser()) {
    return;
  }

  const nextItems = mergeCartItems(readStoredCartItems(), { sku, quantity });
  writeStoredCartItems(nextItems);
}

export function getDemoCartItems() {
  return normalizeCartItems(cartItems);
}

export function calculateCartTotalsFromItems(items: CartItem[]): CartTotals {
  const lines = normalizeCartItems(items).flatMap((item) => {
    const product = getProductBySku(item.sku);

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

export function areCartItemsEqual(left: CartItem[], right: CartItem[]) {
  const normalizedLeft = normalizeCartItems(left);
  const normalizedRight = normalizeCartItems(right);

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((item, index) => {
    const other = normalizedRight[index];

    return other?.sku === item.sku && other.quantity === item.quantity;
  });
}

function readStoredCartItems() {
  if (!isBrowser()) {
    return EMPTY_CART_ITEMS;
  }

  const rawCart = window.localStorage.getItem(CART_STORAGE_KEY) ?? "";

  if (rawCart === cartSnapshotRaw) {
    return cartSnapshotItems;
  }

  try {
    const normalizedItems = normalizeCartItems(JSON.parse(rawCart || "[]"));
    cartSnapshotRaw = rawCart;
    cartSnapshotItems = normalizedItems.length > 0 ? normalizedItems : EMPTY_CART_ITEMS;

    return cartSnapshotItems;
  } catch {
    cartSnapshotRaw = rawCart;
    cartSnapshotItems = EMPTY_CART_ITEMS;

    return cartSnapshotItems;
  }
}

function writeStoredCartItems(items: CartItem[]) {
  if (!isBrowser()) {
    return;
  }

  const normalizedItems = normalizeCartItems(items);

  if (normalizedItems.length === 0) {
    window.localStorage.removeItem(CART_STORAGE_KEY);
    cartSnapshotRaw = "";
    cartSnapshotItems = EMPTY_CART_ITEMS;
  } else {
    const serializedItems = JSON.stringify(normalizedItems);
    window.localStorage.setItem(CART_STORAGE_KEY, serializedItems);
    cartSnapshotRaw = serializedItems;
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

function normalizeCartItems(value: unknown): CartItem[] {
  const rawItems = Array.isArray(value) ? value : [];
  const quantities = new Map<string, number>();

  for (const item of rawItems) {
    if (!isCartItemLike(item)) {
      continue;
    }

    const sku = normalizeSku(item.sku);
    const product = getProductBySku(sku);
    const quantity = normalizeQuantity(item.quantity);

    if (!product || quantity === null || !isOrderableProduct(product)) {
      continue;
    }

    quantities.set(sku, (quantities.get(sku) ?? 0) + quantity);
  }

  return Array.from(quantities.entries())
    .map(([sku, quantity]) => {
      const product = getProductBySku(sku);

      if (!product) {
        return null;
      }

      const clampedQuantity = clampQuantity(product, quantity);

      return clampedQuantity > 0 ? { sku, quantity: clampedQuantity } : null;
    })
    .filter((item): item is CartItem => Boolean(item))
    .sort((left, right) => left.sku.localeCompare(right.sku));
}

function mergeCartItems(items: CartItem[], item: CartItem) {
  return normalizeCartItems([...items, item]);
}

function updateCartItemQuantity(items: CartItem[], sku: string, quantity: number) {
  const normalizedSku = normalizeSku(sku);
  const hasItem = items.some((item) => normalizeSku(item.sku) === normalizedSku);
  const nextItems = hasItem
    ? items.map((item) =>
        normalizeSku(item.sku) === normalizedSku ? { sku: normalizedSku, quantity } : item
      )
    : [...items, { sku: normalizedSku, quantity }];

  return normalizeCartItems(nextItems);
}

function removeCartItem(items: CartItem[], sku: string) {
  const normalizedSku = normalizeSku(sku);

  return normalizeCartItems(items.filter((item) => normalizeSku(item.sku) !== normalizedSku));
}

function consumeCartIntentFromUrl() {
  if (!isBrowser()) {
    return null;
  }

  const url = new URL(window.location.href);
  const sku = url.searchParams.get("sku");

  if (!sku) {
    return null;
  }

  const quantity = normalizeQuantity(url.searchParams.get("qty") ?? 1) ?? 1;
  const [intent] = normalizeCartItems([{ sku, quantity }]);

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
  return value.trim().toUpperCase();
}

function getProductBySku(sku: string) {
  const normalizedSku = normalizeSku(sku);

  return products.find((product) => product.sku === normalizedSku);
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
