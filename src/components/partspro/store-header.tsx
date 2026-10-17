"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Grid3X3, Search, Home, ShoppingBag, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogDepartmentGroup } from "@/lib/partspro-data";
import { hrefWithAssistedCompanyId } from "@/lib/partspro-assisted-order";
import type { StoreHeaderAccountAccess } from "@/lib/partspro-header-access";
import type { CatalogSelection } from "./catalog-brand-tree";
import { PartsProLogo } from "./logo";
import { LanguageSwitcher } from "./language-switcher";
import {
  DelayedPendingIndicator,
  RoutePendingIndicator,
  RoutePendingIcon,
} from "./pending-feedback";
import { StoreCartButton } from "./store-cart-button";
import { StoreBottomNavigation } from "./store-bottom-navigation";
import { StoreDeferredAccountMenu, StoreDeferredMobileMenu } from "./store-deferred-menus";
import { useT } from "./i18n-provider";
import { tx } from "@/i18n/dictionaries/storefront";

type StoreHeaderProps = {
  assistedCompanyId?: string | null;
  departmentGroups?: readonly CatalogDepartmentGroup[];
  initialAccountAccess?: StoreHeaderAccountAccess;
  onCatalogSelect?: (selection: CatalogSelection) => void | Promise<boolean>;
  prefetchCatalogLinks?: boolean;
  selectedCatalog?: CatalogSelection;
};

type AccountAccessState = StoreHeaderAccountAccess;

const loadingAccountAccess: AccountAccessState = {
  accountType: null,
  authenticated: false,
  canOpenAdmin: false,
  displayName: null,
  email: null,
  role: null,
  status: "loading",
};

export function StoreHeader({
  assistedCompanyId,
  departmentGroups,
  initialAccountAccess,
  onCatalogSelect,
  prefetchCatalogLinks = false,
  selectedCatalog,
}: StoreHeaderProps) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const accountPage = pathname === "/account" || pathname.startsWith("/account/");
  const [isSearchPending, startSearchTransition] = useTransition();
  const [accountAccess, setAccountAccess] = useState<AccountAccessState>(
    () => initialAccountAccess ?? loadingAccountAccess
  );
  const catalogSearchValue = selectedCatalog?.searchQuery ?? selectedCatalog?.model ?? "";

  useEffect(() => {
    if (initialAccountAccess) {
      return;
    }

    let cancelled = false;

    async function loadAccountAccess() {
      try {
        const response = await fetch("/api/me", {
          cache: "no-store",
          credentials: "same-origin",
        });

        if (!response.ok) {
          throw new Error("Unable to read account access");
        }

        const data = (await response.json()) as {
          accountType?: StoreHeaderAccountAccess["accountType"];
          authenticated?: boolean;
          admin?: { allowed?: boolean; role?: string | null };
          displayName?: string | null;
          email?: string | null;
        };

        if (!cancelled) {
          setAccountAccess({
            accountType: data.accountType ?? null,
            status: "ready",
            canOpenAdmin: Boolean(data.admin?.allowed),
            authenticated: Boolean(data.authenticated),
            displayName: data.displayName ?? data.email ?? null,
            email: data.email ?? null,
            role: data.admin?.role ?? null,
          });
        }
      } catch {
        if (!cancelled) {
          setAccountAccess({
            accountType: null,
            status: "error",
            canOpenAdmin: false,
            authenticated: false,
            displayName: null,
            email: null,
            role: null,
          });
        }
      }
    }

    void loadAccountAccess();

    return () => {
      cancelled = true;
    };
  }, [initialAccountAccess]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const query = String(formData.get("catalogSearch") ?? "").trim();



    if (onCatalogSelect) {
      startSearchTransition(async () => { await onCatalogSelect({ searchQuery: query }); });
      return;
    }

    startSearchTransition(() => {
      router.push(
        hrefWithAssistedCompanyId(
          `/catalogo?${new URLSearchParams({ q: query }).toString()}`,
          assistedCompanyId
        )
      );
    });
  }

  return (
    <>
      <header data-account-page={accountPage || undefined} className="pp-store-header fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="pp-store-header-row mx-auto flex h-14 w-full max-w-[1500px] items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-4">
          <Link
            href="/"
            aria-label={tx(t, "storefront.home.header.logoLabel", "Torna alla home PartsPro")}
            className="pp-header-logo shrink-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <PartsProLogo />
            <RoutePendingIndicator className="size-3 text-primary" />
          </Link>

          <Link href={hrefWithAssistedCompanyId("/catalogo", assistedCompanyId)} className="pp-header-catalog" aria-current={pathname === "/catalogo" ? "page" : undefined}>
            <Grid3X3 aria-hidden="true" className="size-4" />
            {tx(t, "nav.catalog", "Catalogo")}<RoutePendingIndicator className="size-3" />
          </Link>
          <form
            className="pp-header-search relative ml-auto hidden min-w-[180px] flex-1 md:block"
            role="search"
            onSubmit={handleSearchSubmit}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              key={catalogSearchValue}
              className="h-10 rounded-full border-primary/25 bg-white pl-9 pr-12 shadow-[0_0_0_3px_rgba(59,91,255,0.03)]"
              defaultValue={catalogSearchValue}
              name="catalogSearch"
              aria-label={tx(t, "storefront.header.searchFull", "Cerca SKU, brand, modello...")}
              placeholder={tx(t, "storefront.header.searchFull", "Cerca SKU, brand, modello...")}
            />
            <Button
              type="submit"
              size="icon-sm"
              className="pp-header-search-submit absolute right-0.5 top-1/2 size-9 -translate-y-1/2 rounded-full"
              aria-label={tx(t, "storefront.header.searchSubmit", "Cerca")}
            >
              <span className="relative grid size-4 place-items-center">
                <Search className="size-4" />
                <DelayedPendingIndicator
                  className="absolute size-4 text-white"
                  label={tx(t, "storefront.header.searchLoading", "Ricerca in corso...")}
                  pending={isSearchPending}
                />
              </span>
            </Button>
          </form>

          {accountPage ? <Link href="/catalogo" className="pp-header-return"><ArrowLeft aria-hidden="true" />{tx(t, "storefront.reference.backToStore", "Torna allo shop")}<RoutePendingIndicator className="size-3" /></Link> : null}
          <StoreCartButton
            ariaLabel={tx(t, "storefront.header.openCart", "Apri carrello")}
            href={hrefWithAssistedCompanyId("/carrello", assistedCompanyId)}
            label={tx(t, "nav.cart", "Carrello")}
          />
          <LanguageSwitcher presentation="menu" className="pp-header-language" />

          <StoreDeferredAccountMenu
            access={accountAccess}
            label={tx(t, "nav.account", "Account")}
            triggerLabel={tx(t, "storefront.header.openAccount", "Apri centro personale")}
            menuLabel={tx(t, "storefront.account.menuLabel", "Area account")}
            accountLabel={tx(t, "storefront.account.openAccount", "Centro personale")}
            adminLabel={tx(t, "storefront.account.openAdmin", "Pannello admin")}
            logoutLabel={tx(t, "storefront.account.signOut", "Esci")}
            staffLabel={tx(t, "storefront.account.staffRole", "Accesso staff")}
          />

          <div className="pp-header-menu">
            <StoreDeferredMobileMenu
              assistedCompanyId={assistedCompanyId}
              departmentGroups={departmentGroups}
              onCatalogSelect={onCatalogSelect}
              prefetchCatalogLinks={prefetchCatalogLinks}
              selectedCatalog={selectedCatalog}
            />
          </div>
        </div>
        <form onSubmit={handleSearchSubmit} className="pp-header-mobile-search relative mx-3 mb-2 xl:hidden" role="search">
          <label htmlFor="store-header-search" className="sr-only">{tx(t, "storefront.header.searchFull", "Cerca SKU, brand, modello...")}</label>
          <Input key={catalogSearchValue} id="store-header-search" name="catalogSearch" defaultValue={catalogSearchValue} placeholder={tx(t, "storefront.header.searchFull", "Cerca SKU, brand, modello...")} className="h-11 rounded-full bg-white pr-14" />
          <Button type="submit" size="icon-lg" className="absolute right-0 top-0 rounded-full" aria-label={tx(t, "storefront.header.searchSubmit", "Cerca")}><Search className="size-4" /></Button>
        </form>
        <nav className="pp-desktop-primary-nav" aria-label={tx(t, "nav.catalog", "Catalogo")}>
          <Link href="/" aria-current={pathname === "/" ? "page" : undefined}><RoutePendingIcon><Home /></RoutePendingIcon>{tx(t,"nav.home","Home")}</Link>
          <Link href={hrefWithAssistedCompanyId("/catalogo",assistedCompanyId)} aria-current={pathname === "/catalogo" || pathname.startsWith("/prodotto/") ? "page" : undefined}><RoutePendingIcon><Grid3X3 /></RoutePendingIcon>{tx(t,"nav.catalog","Catalogo")}</Link>
          <Link href="/#remax-preorders"><RoutePendingIcon><ShoppingBag /></RoutePendingIcon>{tx(t,"storefront.reference.preorderNav","REMAX preordini")}</Link>
          <Link href="/professionale" aria-current={pathname === "/professionale" ? "page" : undefined}><RoutePendingIcon><UserRound /></RoutePendingIcon>{tx(t,"storefront.reference.professionalNav","Professionisti")}</Link>
        </nav>
      </header>
      <div aria-hidden="true" data-account-page={accountPage || undefined} className="pp-store-header-spacer h-[108px] sm:h-[116px] xl:h-16" />
      <StoreBottomNavigation assistedCompanyId={assistedCompanyId} />
    </>
  );
}
