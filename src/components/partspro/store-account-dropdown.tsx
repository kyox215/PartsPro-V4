"use client";

import Link from "next/link";
import { useRef, type ReactElement } from "react";
import {
  LayoutDashboard,
  LogOut,
  User,
} from "lucide-react";
import { signOut } from "@/app/login/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StoreHeaderAccountAccess } from "@/lib/partspro-header-access";
import { RoutePendingIndicator } from "./pending-feedback";

export type StoreAccountDropdownProps = {
  access: StoreHeaderAccountAccess;
  accountLabel: string;
  adminLabel: string;
  focusFirstItem?: boolean;
  logoutLabel: string;
  menuLabel: string;
  onSignOut?: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  staffLabel: string;
  trigger: ReactElement;
};

export function StoreAccountDropdown({
  access,
  accountLabel,
  adminLabel,
  focusFirstItem = false,
  logoutLabel,
  menuLabel,
  onSignOut,
  onOpenChange,
  open,
  staffLabel,
  trigger,
}: StoreAccountDropdownProps) {
  const firstItemRef = useRef<HTMLAnchorElement>(null);
  function handleSignOut() {
    onSignOut?.();
  }

  const accountDisplay = access.displayName ?? access.email;
  const showEmail =
    access.authenticated &&
    access.email &&
    access.email.trim().toLocaleLowerCase() !==
      accountDisplay?.trim().toLocaleLowerCase();

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56"
        onFocus={(event) => {
          // The first key event can precede loading Radix's keyboard handling.
          if (focusFirstItem && event.target === event.currentTarget) {
            firstItemRef.current?.focus();
          }
        }}
      >
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span>{menuLabel}</span>
          {access.authenticated && accountDisplay ? (
            <span className="truncate text-[11px] font-medium text-slate-500">
              {accountDisplay}
            </span>
          ) : null}
          {showEmail ? (
            <span
              className="truncate text-[11px] font-medium text-slate-500"
              dir="ltr"
              title={access.email ?? undefined}
            >
              {access.email}
            </span>
          ) : null}
          {access.canOpenAdmin && access.role ? (
            <span className="text-[11px] font-medium text-primary">
              {staffLabel}: {access.role}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="h-9 cursor-pointer">
          <Link ref={firstItemRef} href="/account">
            <User className="size-4" />
            <span className="min-w-0 flex-1 truncate">{accountLabel}</span>
            <RoutePendingIndicator className="size-3 text-primary" />
          </Link>
        </DropdownMenuItem>
        {access.canOpenAdmin ? (
          <DropdownMenuItem asChild className="h-9 cursor-pointer">
            <Link href="/admin">
              <LayoutDashboard className="size-4" />
              <span className="min-w-0 flex-1 truncate">{adminLabel}</span>
              <RoutePendingIndicator className="size-3 text-primary" />
            </Link>
          </DropdownMenuItem>
        ) : null}
        {access.authenticated ? (
          <>
            <DropdownMenuSeparator />
            <form action={signOut} onSubmit={handleSignOut}>
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
