"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type StorefrontSyncStatusState = {
  message: string;
  title: string;
  tone?: "info" | "warning" | "error";
};

export function StorefrontSyncStatusBar({
  maxWidthClassName = "max-w-[1460px]",
  state,
}: {
  maxWidthClassName?: string;
  state: StorefrontSyncStatusState | null;
}) {
  if (!state) {
    return null;
  }

  const tone = state.tone ?? "info";
  const Icon = tone === "error" || tone === "warning" ? AlertTriangle : Loader2;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "sticky inset-x-0 top-14 z-40 border-b bg-white/95 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:top-16",
        tone === "info" && "border-blue-100",
        tone === "warning" && "border-amber-100",
        tone === "error" && "border-red-100"
      )}
    >
      <div className={cn("mx-auto flex items-center gap-2.5 px-3 py-2 sm:px-4", maxWidthClassName)}>
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full",
            tone === "info" && "bg-blue-50 text-primary",
            tone === "warning" && "bg-amber-50 text-amber-700",
            tone === "error" && "bg-red-50 text-red-700"
          )}
        >
          <Icon className={cn("size-4", tone === "info" && "animate-spin")} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black text-slate-950">{state.title}</div>
          <div className="truncate text-xs font-semibold text-slate-500">{state.message}</div>
        </div>
      </div>
    </div>
  );
}
