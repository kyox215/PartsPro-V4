"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { hasStorefrontMobileNavigation, isStorefrontPath } from "./storefront-navigation";
import { StoreFooter } from "./store-footer";

export function StorefrontThemeBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const storefront = isStorefrontPath(pathname);

  return (
    <div
      className={storefront ? "pp-storefront" : "contents"}
      data-mobile-navigation={storefront && hasStorefrontMobileNavigation(pathname) ? "true" : undefined}
    >
      {children}
      {storefront && <StoreFooter />}
    </div>
  );
}
