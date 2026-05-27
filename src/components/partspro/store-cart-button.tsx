"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "./cart-state";

export type StoreCartButtonProps = {
  ariaLabel: string;
  label: string;
};

export function StoreCartButton({ ariaLabel, label }: StoreCartButtonProps) {
  const cart = useCart();

  return (
    <Button
      variant="outline"
      size="icon"
      asChild
      className="relative ml-auto bg-white shadow-sm sm:ml-0 sm:w-auto sm:px-2.5"
    >
      <Link href="/carrello" aria-label={ariaLabel}>
        <ShoppingCart className="size-4" />
        <span className="hidden sm:inline">{label}</span>
        <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {cart.itemCount}
        </span>
      </Link>
    </Button>
  );
}
