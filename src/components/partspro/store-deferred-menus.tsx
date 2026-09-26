"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, Menu, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tx } from "@/i18n/dictionaries/storefront";
import { useT } from "./i18n-provider";
import { createMenuLoader } from "./store-menu-loader";
import type { StoreAccountDropdownProps } from "./store-account-dropdown";
import type { StoreMobileMenuProps } from "./store-mobile-menu";

const accountMenu = createMenuLoader(() =>
  import("./store-account-dropdown").then((module) => module.StoreAccountDropdown)
);
const mobileMenu = createMenuLoader(() =>
  import("./store-mobile-menu").then((module) => module.StoreMobileMenu)
);
const desktopQuery = "(min-width: 1024px)";

function subscribeToMobile(callback: () => void) {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function isMobileViewport() {
  return !window.matchMedia(desktopQuery).matches;
}

function serverIsMobileViewport() {
  return false;
}

// A resolved module replaces the plain button with the Radix trigger. Preserve
// focus only when it belonged to that button; preloading must not steal focus.
function useMenuTriggerRef() {
  const previous = useRef<HTMLButtonElement | null>(null);
  const restoreFocus = useRef(false);
  return useCallback((button: HTMLButtonElement | null) => {
    if (!button) {
      restoreFocus.current = previous.current === document.activeElement;
    } else if (restoreFocus.current) {
      restoreFocus.current = false;
      button.focus();
    }
    previous.current = button;
  }, []);
}

type DeferredAccountMenuProps = Omit<
  StoreAccountDropdownProps,
  "trigger" | "open" | "onOpenChange" | "focusFirstItem"
> & { label: string; triggerLabel: string };

export function StoreDeferredAccountMenu({
  label,
  triggerLabel,
  ...props
}: DeferredAccountMenuProps) {
  const t = useT();
  const { Component, status } = useSyncExternalStore(
    accountMenu.subscribe,
    accountMenu.getSnapshot,
    accountMenu.getServerSnapshot
  );
  const [activated, setActivated] = useState(false);
  const [open, setOpen] = useState(false);
  const [focusFirstItem, setFocusFirstItem] = useState(false);
  const triggerRef = useMenuTriggerRef();
  // Hover/focus may download the module, but keep the focused lightweight
  // button in place until an actual activation completes its click/key event.
  const ready = activated && Component !== null;
  const retryLabel = tx(t, "storefront.common.retry", "Riprova");

  function requestOpen(keyboard: boolean) {
    setActivated(true);
    setFocusFirstItem(keyboard);
    setOpen(true);
    void accountMenu.load();
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setFocusFirstItem(false);
  }

  const trigger = (
    <Button
      ref={triggerRef}
      type="button"
      variant="outline"
      size="icon"
      aria-label={status === "error" ? `${triggerLabel} — ${retryLabel}` : triggerLabel}
      aria-haspopup="menu"
      aria-expanded={ready && open}
      aria-busy={status === "loading" || undefined}
      className="bg-white shadow-sm lg:w-auto lg:gap-1.5 lg:border-transparent lg:bg-transparent lg:px-3 lg:shadow-none"
      onMouseEnter={() => void accountMenu.load()}
      onFocus={() => void accountMenu.load()}
      onClick={ready ? undefined : (event) => requestOpen(event.detail === 0)}
      onKeyDown={ready ? undefined : (event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          requestOpen(true);
        } else if (event.key === "Escape") {
          handleOpenChange(false);
        }
      }}
      onBlur={ready ? undefined : () => handleOpenChange(false)}
    >
      <User className="size-4" />
      <span className="hidden lg:inline">{status === "error" ? retryLabel : label}</span>
      <ChevronDown className="hidden size-4 text-slate-400 lg:block" />
    </Button>
  );

  return (
    <div className="order-2 lg:order-none">
      {ready && Component ? (
        <Component
          {...props}
          trigger={trigger}
          open={open}
          onOpenChange={handleOpenChange}
          focusFirstItem={focusFirstItem}
        />
      ) : trigger}
    </div>
  );
}

type DeferredMobileMenuProps = Omit<StoreMobileMenuProps, "trigger" | "open" | "onOpenChange">;

export function StoreDeferredMobileMenu(props: DeferredMobileMenuProps) {
  const t = useT();
  const isMobile = useSyncExternalStore(
    subscribeToMobile,
    isMobileViewport,
    serverIsMobileViewport
  );

  // The CSS-sized shell reserves space during hydration. The sheet, catalog
  // tree and their imports only exist after entering the mobile breakpoint.
  return isMobile ? <MobileMenuLoader {...props} /> : (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className="bg-white shadow-sm lg:hidden"
      aria-label={tx(t, "storefront.header.openMenu", "Apri menu")}
      aria-haspopup="dialog"
      aria-expanded={false}
    >
      <Menu className="size-4" />
    </Button>
  );
}

function MobileMenuLoader(props: DeferredMobileMenuProps) {
  const t = useT();
  const { Component, status } = useSyncExternalStore(
    mobileMenu.subscribe,
    mobileMenu.getSnapshot,
    mobileMenu.getServerSnapshot
  );
  const [activated, setActivated] = useState(false);
  const [open, setOpen] = useState(false);
  const triggerRef = useMenuTriggerRef();
  const ready = activated && Component !== null;

  useEffect(() => {
    void mobileMenu.load();
  }, []);

  const label = tx(t, "storefront.header.openMenu", "Apri menu");
  const trigger = (
    <Button
      ref={triggerRef}
      type="button"
      variant="outline"
      size="icon-sm"
      className="bg-white shadow-sm lg:hidden"
      aria-label={status === "error" ? `${label} — ${tx(t, "storefront.common.retry", "Riprova")}` : label}
      aria-haspopup="dialog"
      aria-expanded={ready && open}
      aria-busy={status === "loading" || undefined}
      onClick={ready ? undefined : () => {
        setActivated(true);
        setOpen(true);
        void mobileMenu.load();
      }}
      onKeyDown={ready ? undefined : (event) => {
        if (event.key === "Escape") setOpen(false);
      }}
      onBlur={ready ? undefined : () => setOpen(false)}
    >
      <Menu className="size-4" />
    </Button>
  );

  return ready && Component ? (
    <Component {...props} trigger={trigger} open={open} onOpenChange={setOpen} />
  ) : trigger;
}
