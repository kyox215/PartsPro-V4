"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Menu,
  Search,
  ShoppingCart,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DeviceModelGroup } from "@/lib/partspro-data";
import type { StoreHeaderAccountAccess } from "@/lib/partspro-header-access";
import { cn } from "@/lib/utils";
import type { CatalogSelection } from "./catalog-brand-tree";
import { PartsProLogo } from "./logo";
import { LanguageSwitcher } from "./language-switcher";
import type { StoreAccountDropdownProps } from "./store-account-dropdown";
import type { StoreCartButtonProps } from "./store-cart-button";
import type { StoreMobileMenuProps } from "./store-mobile-menu";
import { useT } from "./i18n-provider";
import { tx } from "@/i18n/dictionaries/storefront";

type StoreHeaderProps = {
  initialAccountAccess?: StoreHeaderAccountAccess;
  modelGroups?: readonly DeviceModelGroup[];
  onCatalogSelect?: (selection: CatalogSelection) => void;
  prefetchCatalogLinks?: boolean;
  selectedCatalog?: CatalogSelection;
};

type AccountAccessState = StoreHeaderAccountAccess;

const loadingAccountAccess: AccountAccessState = {
  authenticated: false,
  canOpenAdmin: false,
  role: null,
  status: "loading",
};

const StoreAccountDropdown = dynamic<StoreAccountDropdownProps>(
  () =>
    import("./store-account-dropdown").then(
      (module) => module.StoreAccountDropdown
    ),
  {
    loading: () => <AccountDropdownFallback />,
    ssr: false,
  }
);

const StoreMobileMenu = dynamic<StoreMobileMenuProps>(
  () => import("./store-mobile-menu").then((module) => module.StoreMobileMenu),
  {
    loading: () => <StoreMobileMenuFallback />,
    ssr: false,
  }
);

const StoreCartButton = dynamic<StoreCartButtonProps>(
  () => import("./store-cart-button").then((module) => module.StoreCartButton),
  {
    loading: () => <StoreCartButtonFallback />,
    ssr: false,
  }
);

export function StoreHeader({
  initialAccountAccess,
  modelGroups,
  onCatalogSelect,
  prefetchCatalogLinks = false,
  selectedCatalog,
}: StoreHeaderProps) {
  const t = useT();
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
          authenticated?: boolean;
          admin?: { allowed?: boolean; role?: string | null };
        };

        if (!cancelled) {
          setAccountAccess({
            status: "ready",
            canOpenAdmin: Boolean(data.admin?.allowed),
            authenticated: Boolean(data.authenticated),
            role: data.admin?.role ?? null,
          });
        }
      } catch {
        if (!cancelled) {
          setAccountAccess({
            status: "error",
            canOpenAdmin: false,
            authenticated: false,
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

    if (!query) {
      return;
    }

    if (onCatalogSelect) {
      onCatalogSelect({ searchQuery: query });
      return;
    }

    window.location.assign(`/catalogo?q=${encodeURIComponent(query)}`);
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1500px] items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-4">
          <StoreMobileMenu
            modelGroups={modelGroups}
            onCatalogSelect={onCatalogSelect}
            prefetchCatalogLinks={prefetchCatalogLinks}
            selectedCatalog={selectedCatalog}
          />

          <Link
            href="/"
            aria-label={tx(t, "storefront.home.header.logoLabel", "Torna alla home PartsPro")}
            className="hidden shrink-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex"
          >
            <PartsProLogo
              tagline={tx(
                t,
                "storefront.logo.tagline",
                "Ricambi smartphone Italia"
              )}
            />
          </Link>
          <Link
            href="/"
            aria-label={tx(t, "storefront.home.header.logoLabel", "Torna alla home PartsPro")}
            className="flex min-w-0 shrink-0 items-center gap-1.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:hidden"
          >
            <PartsProLogo compact />
            <span className="text-base font-black leading-none tracking-normal text-slate-950">
              PartsPro
            </span>
          </Link>

          <form
            className="relative ml-auto hidden min-w-0 flex-1 md:block lg:max-w-xl xl:max-w-2xl"
            onSubmit={handleSearchSubmit}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              key={catalogSearchValue}
              className="h-10 rounded-full border-primary/25 bg-white pl-9 shadow-[0_0_0_3px_rgba(59,91,255,0.03)]"
              defaultValue={catalogSearchValue}
              name="catalogSearch"
              placeholder={tx(t, "storefront.header.searchFull", "Cerca SKU, brand, modello...")}
            />
          </form>

          <LanguageSwitcher compact className="hidden md:inline-flex" />

          <nav className="hidden items-center gap-1 lg:flex">
            <StoreAccountDropdown
              access={accountAccess}
              label={tx(t, "nav.account", "Account")}
              menuLabel={tx(t, "storefront.account.menuLabel", "Area account")}
              accountLabel={tx(t, "storefront.account.openAccount", "Centro personale")}
              adminLabel={tx(t, "storefront.account.openAdmin", "Pannello admin")}
              logoutLabel={tx(t, "storefront.account.signOut", "Esci")}
              staffLabel={tx(t, "storefront.account.staffRole", "Accesso staff")}
            />
          </nav>

          <StoreCartButton
            ariaLabel={tx(t, "storefront.header.openCart", "Apri carrello")}
            label={tx(t, "nav.cart", "Carrello")}
          />
          <StoreAccountDropdown
            access={accountAccess}
            accountLabel={tx(t, "storefront.account.openAccount", "Centro personale")}
            adminLabel={tx(t, "storefront.account.openAdmin", "Pannello admin")}
            compact
            label={tx(t, "storefront.header.openAccount", "Apri centro personale")}
            logoutLabel={tx(t, "storefront.account.signOut", "Esci")}
            menuLabel={tx(t, "storefront.account.menuLabel", "Area account")}
            staffLabel={tx(t, "storefront.account.staffRole", "Accesso staff")}
          />
        </div>
      </header>
      <div aria-hidden="true" className="h-14 sm:h-16" />
    </>
  );
}

function StoreCartButtonFallback() {
  return (
    <Button
      variant="outline"
      size="icon"
      asChild
      className="relative ml-auto bg-white shadow-sm sm:ml-0 sm:w-auto sm:px-2.5"
    >
      <Link href="/carrello" aria-label="Apri carrello">
        <ShoppingCart className="size-4" />
        <span className="hidden sm:inline">Carrello</span>
        <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          0
        </span>
      </Link>
    </Button>
  );
}

function StoreMobileMenuFallback({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className={cn("bg-white shadow-sm lg:hidden", className)}
      aria-label="Apri menu"
      disabled
    >
      <Menu className="size-4" />
    </Button>
  );
}

function AccountDropdownFallback() {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Account"
      className="bg-white shadow-sm lg:hidden"
      disabled
    >
      <User className="size-4" />
    </Button>
  );
}
