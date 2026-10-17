"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Grid3X3, Search } from "lucide-react";
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
  onCatalogSelect?: (selection: CatalogSelection) => void;
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
      onCatalogSelect({ searchQuery: query });
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
      <header className="pp-store-header fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="pp-store-header-row mx-auto flex h-14 w-full max-w-[1500px] items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-4">
          <StoreDeferredMobileMenu
            assistedCompanyId={assistedCompanyId}
            departmentGroups={departmentGroups}
            onCatalogSelect={onCatalogSelect}
            prefetchCatalogLinks={prefetchCatalogLinks}
            selectedCatalog={selectedCatalog}
          />

          <Link
            href="/"
            aria-label={tx(t, "storefront.home.header.logoLabel", "Torna alla home PartsPro")}
            className="hidden shrink-0 items-center gap-1 rounded-lg outline-none transition active:translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex"
          >
            <PartsProLogo
              tagline={tx(
                t,
                "storefront.logo.tagline",
                "Ricambi smartphone Italia"
              )}
            />
            <RoutePendingIndicator className="size-3 text-primary" />
          </Link>
          <Link
            href="/"
            aria-label={tx(t, "storefront.home.header.logoLabel", "Torna alla home PartsPro")}
            className="flex min-w-0 shrink-0 items-center gap-1.5 rounded-lg outline-none transition active:translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50 sm:hidden"
          >
            <PartsProLogo compact />
            <span className="text-base font-black leading-none tracking-normal text-slate-950">
              PartsPro
            </span>
            <RoutePendingIndicator className="size-3 text-primary" />
          </Link>

          <Link href={hrefWithAssistedCompanyId("/catalogo", assistedCompanyId)} className="pp-header-catalog" aria-current={pathname === "/catalogo" ? "page" : undefined}>
            <Grid3X3 aria-hidden="true" className="size-4" />
            {tx(t, "nav.catalog", "Catalogo")}
          </Link>
          <form
            className="relative ml-auto hidden min-w-[260px] flex-1 xl:block xl:max-w-2xl"
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
              className="absolute right-0.5 top-1/2 size-9 -translate-y-1/2 rounded-full"
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

          <Button asChild variant="ghost" size="sm" className="hidden xl:inline-flex"><Link href="/help">{tx(t,"storefront.ux.help","Aiuto")}</Link></Button>
          <LanguageSwitcher compact className="ml-auto hidden md:inline-flex xl:ml-0" />

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

          <StoreCartButton
            ariaLabel={tx(t, "storefront.header.openCart", "Apri carrello")}
            href={hrefWithAssistedCompanyId("/carrello", assistedCompanyId)}
            label={tx(t, "nav.cart", "Carrello")}
          />
        </div>
        <form onSubmit={handleSearchSubmit} className="relative mx-3 mb-2 xl:hidden" role="search">
          <label htmlFor="store-header-search" className="sr-only">{tx(t, "storefront.header.searchFull", "Cerca SKU, brand, modello...")}</label>
          <Input key={catalogSearchValue} id="store-header-search" name="catalogSearch" defaultValue={catalogSearchValue} placeholder={tx(t, "storefront.header.searchFull", "Cerca SKU, brand, modello...")} className="h-11 rounded-full bg-white pr-14" />
          <Button type="submit" size="icon-lg" className="absolute right-0 top-0 rounded-full" aria-label={tx(t, "storefront.header.searchSubmit", "Cerca")}><Search className="size-4" /></Button>
        </form>
      </header>
      <div aria-hidden="true" className="h-[108px] sm:h-[116px] xl:h-16" />
      <StoreBottomNavigation assistedCompanyId={assistedCompanyId} />
    </>
  );
}
