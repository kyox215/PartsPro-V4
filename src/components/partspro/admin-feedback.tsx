"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DelayedPendingIndicator,
  useDelayedVisible,
} from "./pending-feedback";

type AdminBusyRegionProps = {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  label: string;
  overlayClassName?: string;
  pending: boolean;
  rows?: number;
};

export function AdminInlinePending({
  className,
  label,
  pending,
}: {
  className?: string;
  label: string;
  pending: boolean;
}) {
  const visible = useDelayedVisible(pending, 120);

  return (
    <span
      aria-live="polite"
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-primary opacity-0 transition-opacity duration-150",
        visible && "opacity-100",
        className
      )}
      role={visible ? "status" : undefined}
    >
      <DelayedPendingIndicator
        className="size-3.5 text-primary"
        pending={pending}
      />
      <span className="truncate">{visible ? label : ""}</span>
    </span>
  );
}

export function AdminBusyRegion({
  children,
  className,
  contentClassName,
  label,
  pending,
}: AdminBusyRegionProps) {
  return (
    <div
      aria-busy={pending}
      aria-live="polite"
      className={cn("min-w-0", className)}
    >
      <AdminRefreshBar label={label} pending={pending} />
      <div className={cn("min-w-0", contentClassName)}>
        {children}
      </div>
    </div>
  );
}

export function AdminRefreshBar({
  className,
  label,
  pending,
}: {
  className?: string;
  label: string;
  pending: boolean;
}) {
  const visible = useDelayedVisible(pending, 120);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={cn(
        "mb-2 overflow-hidden rounded-md border border-primary/10 bg-primary/5 text-primary",
        className
      )}
      role="status"
    >
      <div className="h-0.5 w-full overflow-hidden bg-primary/10">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-primary/70" />
      </div>
      <div className="flex min-w-0 items-center gap-1.5 px-2 py-1 text-[11px] font-bold leading-4">
        <Loader2 className="size-3 shrink-0 animate-spin" />
        <span className="truncate">{label}</span>
      </div>
    </div>
  );
}

export function AdminSkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid h-full min-h-[112px] content-start gap-2 overflow-hidden">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="grid min-h-10 grid-cols-[minmax(0,1fr)_80px] gap-3 rounded-md border border-slate-200/70 bg-white/80 p-2"
        >
          <div className="min-w-0 space-y-1.5">
            <div className="h-3 w-3/5 animate-pulse rounded bg-slate-200" />
            <div className="h-2.5 w-4/5 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-6 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
