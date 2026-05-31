"use client";

import Link from "next/link";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  User,
} from "lucide-react";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StoreHeaderAccountAccess } from "@/lib/partspro-header-access";

export type StoreAccountDropdownProps = {
  access: StoreHeaderAccountAccess;
  accountLabel: string;
  adminLabel: string;
  compact?: boolean;
  label: string;
  logoutLabel: string;
  menuLabel: string;
  onSignOut?: () => void;
  staffLabel: string;
};

export function StoreAccountDropdown({
  access,
  accountLabel,
  adminLabel,
  compact = false,
  label,
  logoutLabel,
  menuLabel,
  onSignOut,
  staffLabel,
}: StoreAccountDropdownProps) {
  function handleSignOut() {
    onSignOut?.();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={compact ? "outline" : "ghost"}
          size={compact ? "icon" : "default"}
          aria-label={label}
          className={compact ? "bg-white shadow-sm lg:hidden" : "shrink-0"}
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
