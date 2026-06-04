"use client";

import * as React from "react";
import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
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
  delayMs = 120,
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
      {visible ? <Loader2 className="size-full animate-spin" /> : null}
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
