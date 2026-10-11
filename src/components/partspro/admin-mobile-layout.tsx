"use client";

import * as React from "react";
import { TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// SSR uses the desktop layout; only one editor is mounted after hydration.
const mobileQuery = "(max-width: 767px)";
function subscribeMobile(onChange: () => void) {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
export function useAdminMobile() {
  return React.useSyncExternalStore(subscribeMobile, () => window.matchMedia(mobileQuery).matches, () => false);
}
const compactQuery = "(max-width: 1023px)";
function subscribeCompact(onChange: () => void) {
  const query = window.matchMedia(compactQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function AdminMobileTabs({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const list = ref.current;
    const active = list?.querySelector<HTMLElement>('[data-state="active"]');
    if (!list || !active) return;
    const left = active.offsetLeft - list.offsetLeft;
    if (left < list.scrollLeft) list.scrollLeft = left;
    else if (left + active.offsetWidth > list.scrollLeft + list.clientWidth) list.scrollLeft = left + active.offsetWidth - list.clientWidth;
  }, [value]);
  return <TabsList ref={ref} className={cn("admin-mobile-tabs", className)}>{children}</TabsList>;
}

// Only for read-only charts/content. Form drafts must remain mounted.
export function AdminMobileDisclosure({ title, children, className }: { title: React.ReactNode; children: React.ReactNode; className?: string }) {
  const mobile = React.useSyncExternalStore(subscribeCompact, () => window.matchMedia(compactQuery).matches, () => false);
  const [expanded, setExpanded] = React.useState(false);
  const open = !mobile || expanded;
  return <details className={cn("admin-mobile-disclosure", className)} open={open} onToggle={event => { if (mobile) setExpanded(event.currentTarget.open); }}>
    <summary>{title}</summary>
    {open ? children : null}
  </details>;
}
