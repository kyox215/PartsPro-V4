"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoutePendingIndicator } from "./pending-feedback";
import { useStoredCartItems } from "./cart-state";

export type StoreCartButtonProps = {
  ariaLabel: string;
  href?: string;
  label: string;
};

export function StoreCartButton({ ariaLabel, href = "/carrello", label }: StoreCartButtonProps) {
  const items = useStoredCartItems({ preserveUnknown: true });
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const badgeLabel = itemCount > 99 ? "99+" : String(itemCount);

  return (
    <Button
      variant="outline"
      size="icon"
      asChild
      className="relative ml-auto min-w-10 bg-white shadow-sm sm:ml-0 sm:w-auto sm:max-w-36 sm:px-2.5"
    >
      <Link href={href} aria-label={ariaLabel}>
        <span className="grid size-4 place-items-center sm:shrink-0">
          <ShoppingCart className="size-4" />
        </span>
        <span className="hidden min-w-0 max-w-24 truncate sm:inline-block">{label}</span>
        <RoutePendingIndicator
          className="pointer-events-none absolute bottom-1.5 right-1.5 size-3 text-primary"
        />
        {itemCount > 0 ? (
          <span
            className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
            aria-live="polite"
          >
            {badgeLabel}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
