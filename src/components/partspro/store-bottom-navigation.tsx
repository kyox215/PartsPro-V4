"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Grid3X3, Home, ShoppingCart, UserRound } from "lucide-react";
import { hrefWithAssistedCompanyId } from "@/lib/partspro-assisted-order";
import { useStoredCartItems } from "./cart-state";
import { RoutePendingIcon } from "./pending-feedback";
import { useT } from "./i18n-provider";
import { hasStorefrontMobileNavigation } from "./storefront-navigation";

const items = [
  { href: "/", key: "nav.home", icon: Home },
  { href: "/catalogo", key: "nav.catalog", icon: Grid3X3 },
  { href: "/carrello", key: "nav.cart", icon: ShoppingCart },
  { href: "/account", key: "nav.account", icon: UserRound },
] as const;

export function StoreBottomNavigation({ assistedCompanyId }: { assistedCompanyId?: string | null }) {
  const pathname = usePathname();
  const t = useT();
  const cart = useStoredCartItems({ preserveUnknown: true });
  const count = cart.reduce((total, item) => total + item.quantity, 0);

  if (!hasStorefrontMobileNavigation(pathname)) return null;

  return (
    <nav className="pp-bottom-navigation" aria-label={t("nav.home")} data-support-offset="mobile-action-bar">
      {items.map(({ href, key, icon: Icon }) => (
        <Link
          key={href}
          href={hrefWithAssistedCompanyId(href, assistedCompanyId)}
          aria-current={pathname === href ? "page" : undefined}
          className="pp-bottom-navigation-item"
        >
          <span className="pp-bottom-navigation-icon">
            <RoutePendingIcon><Icon aria-hidden="true" /></RoutePendingIcon>
            {href === "/carrello" && count > 0 && <span className="pp-cart-count">{count > 99 ? "99+" : count}</span>}
          </span>
          <span>{t(key)}</span>
        </Link>
      ))}
    </nav>
  );
}
