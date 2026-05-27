"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Search,
  ShoppingCart,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { DeviceModelGroup } from "@/lib/partspro-data";
import type { CatalogSelection } from "./catalog-brand-tree";
import { PartsProLogo } from "./logo";
import { LanguageSwitcher } from "./language-switcher";
import { StoreMobileMenu } from "./store-mobile-menu";
import { useCart } from "./cart-state";
import { useT } from "./i18n-provider";
import { tx } from "@/i18n/dictionaries/storefront";
import { signOut } from "@/app/login/actions";

type StoreHeaderProps = {
  modelGroups?: readonly DeviceModelGroup[];
  onCatalogSelect?: (selection: CatalogSelection) => void;
  prefetchCatalogLinks?: boolean;
  selectedCatalog?: CatalogSelection;
};

type AccountAccessState = {
  status: "loading" | "ready" | "error";
  canOpenAdmin: boolean;
  authenticated: boolean;
  role: string | null;
};

export function StoreHeader({
  modelGroups,
  onCatalogSelect,
  prefetchCatalogLinks = false,
  selectedCatalog,
}: StoreHeaderProps) {
  const t = useT();
  const cart = useCart();
  const [accountAccess, setAccountAccess] = useState<AccountAccessState>({
    status: "loading",
    canOpenAdmin: false,
    authenticated: false,
    role: null,
  });

  useEffect(() => {
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
  }, []);

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

          <div className="relative ml-auto hidden min-w-0 flex-1 md:block lg:max-w-xl xl:max-w-2xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-10 rounded-full border-primary/25 bg-white pl-9 shadow-[0_0_0_3px_rgba(59,91,255,0.03)]"
              placeholder={tx(t, "storefront.header.searchFull", "Cerca SKU, brand, modello...")}
            />
          </div>

          <LanguageSwitcher compact className="hidden md:inline-flex" />

          <nav className="hidden items-center gap-1 lg:flex">
            <AccountDropdown
              access={accountAccess}
              label={tx(t, "nav.account", "Account")}
              menuLabel={tx(t, "storefront.account.menuLabel", "Area account")}
              accountLabel={tx(t, "storefront.account.openAccount", "Account cliente")}
              adminLabel={tx(t, "storefront.account.openAdmin", "Pannello admin")}
              logoutLabel={tx(t, "storefront.account.signOut", "Esci")}
              onSignOut={cart.clearCart}
              staffLabel={tx(t, "storefront.account.staffRole", "Accesso staff")}
            />
          </nav>

          <Button
            variant="outline"
            size="icon"
            asChild
            className="relative ml-auto bg-white shadow-sm sm:ml-0 sm:w-auto sm:px-2.5"
          >
            <Link href="/carrello" aria-label={tx(t, "storefront.header.openCart", "Apri carrello")}>
              <ShoppingCart className="size-4" />
              <span className="hidden sm:inline">{tx(t, "nav.cart", "Carrello")}</span>
              <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {cart.itemCount}
              </span>
            </Link>
          </Button>
          <AccountDropdown
            access={accountAccess}
            accountLabel={tx(t, "storefront.account.openAccount", "Account cliente")}
            adminLabel={tx(t, "storefront.account.openAdmin", "Pannello admin")}
            compact
            label={tx(t, "storefront.header.openAccount", "Apri account")}
            logoutLabel={tx(t, "storefront.account.signOut", "Esci")}
            menuLabel={tx(t, "storefront.account.menuLabel", "Area account")}
            onSignOut={cart.clearCart}
            staffLabel={tx(t, "storefront.account.staffRole", "Accesso staff")}
          />
        </div>
      </header>
      <div aria-hidden="true" className="h-14 sm:h-16" />
    </>
  );
}

type AccountDropdownProps = {
  access: AccountAccessState;
  accountLabel: string;
  adminLabel: string;
  compact?: boolean;
  label: string;
  logoutLabel: string;
  menuLabel: string;
  onSignOut?: () => void;
  staffLabel: string;
};

function AccountDropdown({
  access,
  accountLabel,
  adminLabel,
  compact = false,
  label,
  logoutLabel,
  menuLabel,
  onSignOut,
  staffLabel,
}: AccountDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={compact ? "outline" : "ghost"}
          size={compact ? "icon" : "default"}
          aria-label={label}
          className={
            compact
              ? "bg-white shadow-sm lg:hidden"
              : "shrink-0"
          }
        >
          <User className="size-4" />
          {!compact && <span>{label}</span>}
          {!compact && <ChevronDown className="size-4 text-slate-400" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span>{menuLabel}</span>
          {access.canOpenAdmin && access.role ? (
            <span className="text-[11px] font-medium text-primary">
              {staffLabel}: {access.role}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="h-9 cursor-pointer">
          <Link href="/account">
            <User className="size-4" />
            {accountLabel}
          </Link>
        </DropdownMenuItem>
        {access.canOpenAdmin ? (
          <DropdownMenuItem asChild className="h-9 cursor-pointer">
            <Link href="/admin">
              <LayoutDashboard className="size-4" />
              {adminLabel}
            </Link>
          </DropdownMenuItem>
        ) : null}
        {access.authenticated ? (
          <>
            <DropdownMenuSeparator />
            <form action={signOut} onSubmit={onSignOut}>
              <DropdownMenuItem asChild className="h-9 w-full cursor-pointer">
                <button type="submit">
                  <LogOut className="size-4" />
                  {logoutLabel}
                </button>
              </DropdownMenuItem>
            </form>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
