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
  overlayClassName,
  pending,
  rows = 4,
}: AdminBusyRegionProps) {
  const showStatus = useDelayedVisible(pending, 120);
  const showOverlay = useDelayedVisible(pending, 300);

  return (
    <div
      aria-busy={pending}
      aria-live="polite"
      className={cn("relative min-w-0", className)}
    >
      <div
        className={cn(
          "min-w-0 transition-opacity duration-150",
          showOverlay && "opacity-60",
          contentClassName
        )}
      >
        {children}
      </div>
      {showStatus ? (
        <div className="pointer-events-none absolute right-2 top-2 z-20 inline-flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-full border border-primary/15 bg-white/95 px-2 py-1 text-[11px] font-bold text-primary shadow-sm">
          <Loader2 className="size-3 animate-spin" />
          <span className="truncate">{label}</span>
        </div>
      ) : null}
      {showOverlay ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-10 rounded-md border border-primary/10 bg-white/65 p-3 backdrop-blur-[1px]",
            overlayClassName
          )}
        >
          <AdminSkeletonRows rows={rows} />
        </div>
      ) : null}
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
