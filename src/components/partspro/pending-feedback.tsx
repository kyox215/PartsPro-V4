"use client";

import * as React from "react";
import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { useT } from "./i18n-provider";
import { cn } from "@/lib/utils";

type DelayedPendingIndicatorProps = {
  className?: string;
  delayMs?: number;
  label?: string;
  pending: boolean;
};

export function useDelayedVisible(active: boolean, delayMs = 120) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(active);
    }, active ? delayMs : 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [active, delayMs]);

  return active && visible;
}

export function DelayedPendingIndicator({
  className,
  delayMs = 80,
  label,
  pending,
}: DelayedPendingIndicatorProps) {
  const visible = useDelayedVisible(pending, delayMs);

  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={visible ? label : undefined}
      aria-live={label ? "polite" : undefined}
      className={cn(
        "inline-grid size-4 shrink-0 place-items-center opacity-0 transition-opacity duration-150",
        visible && "opacity-100",
        className
      )}
      role={label && visible ? "status" : undefined}
    >
      {visible ? <Loader2 className="size-full animate-spin motion-reduce:animate-none" /> : null}
    </span>
  );
}

export function RoutePendingIndicator({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  const { pending } = useLinkStatus();

  return (
    <DelayedPendingIndicator
      className={className}
      label={label}
      pending={pending}
    />
  );
}

// A stable local placeholder without replacing surrounding content or visible waiting copy.
export function InlinePending() {
  const t = useT();
  return <span role="status" aria-busy="true" className="inline-flex items-center"><Loader2 aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none"/><span className="sr-only">{t("common.loading")}</span></span>;
}

export function RoutePendingIcon({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  const visible = useDelayedVisible(pending, 80);
  return visible ? <Loader2 aria-hidden="true" style={{ display: "inline-block" }} className="size-4 animate-spin motion-reduce:animate-none"/> : children;
}
