import { Suspense } from "react";
import { HomePage, HomeProductShelf, HomeShelfLoading, HomeBannerCarousel } from "@/components/partspro/home-page";
import { listActiveHomeBanners, listCatalogDepartmentGroups, pageHotCatalogProducts, pageCatalogProducts } from "@/lib/partspro-repository";
import { accountPricingCustomerId, applyAccountPriceToProduct, getCurrentAccountContext, priceVisibilityReason, storefrontCartAccess, type AccountContext } from "@/lib/partspro-account-context";
import { toStoreHeaderAccountAccess } from "@/lib/partspro-header-access";
import { listRemaxPreorderProducts } from "@/lib/partspro-preorder-server";
import type { PartProduct } from "@/lib/partspro-data";

const limit = 8;
type ShelfKind = "remax" | "hot" | "new" | "stocked";
type Shelf = { products: PartProduct[]; total: number };

// Only public, unpriced data enters this bounded process cache. Each shelf has
// its own in-flight request so a slow shelf never holds back the other sections.
const publicShelves = new Map<ShelfKind, { expiresAt: number; data: Shelf }>();
const publicRequests = new Map<ShelfKind, Promise<Shelf>>();

export default async function Home() {
  const accountPromise = getCurrentAccountContext();
  const groupsPromise = listCatalogDepartmentGroups();
  const bannersPromise = listActiveHomeBanners();
  const shelves = Object.fromEntries(
    (["remax", "hot", "new", "stocked"] as const).map((kind) => [kind, accountPromise.then((account) => readShelf(kind, account))])
  ) as Record<ShelfKind, Promise<Shelf>>;
  const [account, groups] = await Promise.all([accountPromise, groupsPromise]);
  const brandCount = new Set(groups.data.flatMap((group) => group.brands.map((brand) => brand.brand))).size;

  return (
    <HomePage
      departmentGroups={groups.data}
      initialAccountAccess={toStoreHeaderAccountAccess(account)}
      banner={<Suspense fallback={<div className="aspect-[4/1] min-h-[86px] rounded-lg bg-white sm:min-h-[150px] motion-safe:animate-pulse" />}>
        <Banner banners={bannersPromise} products={shelves.new} brandCount={brandCount} />
      </Suspense>}
    >
      {(["remax", "hot", "new", "stocked"] as const).map((kind) => (
        <Suspense key={kind} fallback={<HomeShelfLoading />}>
          <ShelfSection kind={kind} result={shelves[kind]} fallback={kind === "hot" ? shelves.stocked : undefined} account={account} />
        </Suspense>
      ))}
    </HomePage>
  );
}

async function Banner({ banners, products, brandCount }: {
  banners: ReturnType<typeof listActiveHomeBanners>;
  products: Promise<Shelf>;
  brandCount: number;
}) {
  const bannerResult = await banners;
  return <HomeBannerCarousel banners={bannerResult.data} catalogTotal={
    <Suspense fallback={<span className="inline-block w-8">…</span>}>
      <CatalogCount products={products} />
    </Suspense>
  } catalogBrandCount={brandCount} />;
}

async function CatalogCount({ products }: { products: Promise<Shelf> }) {
  return (await products).total.toLocaleString("it-IT");
}

async function ShelfSection({ kind, result, fallback, account }: {
  kind: ShelfKind; result: Promise<Shelf>; fallback?: Promise<Shelf>; account: AccountContext;
}) {
  const shelf = await result;
  const products = !shelf.products.length && fallback ? (await fallback).products : shelf.products;
  return <HomeProductShelf kind={kind} products={products.map((product) => applyAccountPriceToProduct(product, account))}
    cartAccess={storefrontCartAccess(account)} priceGateReason={priceVisibilityReason(account)} showPrices={account.canViewPrices} />;
}

function readShelf(kind: ShelfKind, account: AccountContext): Promise<Shelf> {
  if (account.canViewPrices) return fetchShelf(kind, accountPricingCustomerId(account), true);
  const cached = publicShelves.get(kind);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.data);
  const pending = publicRequests.get(kind);
  if (pending) return pending;
  const request = fetchShelf(kind, undefined, false).then((data) => {
    publicShelves.set(kind, { data, expiresAt: Date.now() + 30_000 });
    return data;
  }).finally(() => publicRequests.delete(kind));
  publicRequests.set(kind, request);
  return request;
}

async function fetchShelf(kind: ShelfKind, buyerCustomerId: string | undefined, includeBuyerPrices: boolean): Promise<Shelf> {
  const options = { buyerCustomerId, includeBuyerPrices };
  if (kind === "remax") {
    const result = await listRemaxPreorderProducts({ ...options, limit });
    return { products: result.data, total: result.data.length };
  }
  const result = kind === "hot"
    ? await pageHotCatalogProducts({ limit }, options)
    : await pageCatalogProducts({ limit, offset: 0, sort: kind === "new" ? "created_desc" : "stock_desc", ...(kind === "stocked" ? { minStock: 1 } : {}) }, options);
  return result.data;
}
