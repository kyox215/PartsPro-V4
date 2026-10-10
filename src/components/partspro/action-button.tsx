"use client";

import type { ComponentProps } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ActionButtonProps = ComponentProps<typeof Button> & {
  state?: "idle" | "pending" | "success" | "unknown";
  pendingLabel?: string;
};

export function ActionButton({ state = "idle", pendingLabel, disabled, children, className, asChild, onClick, ...props }: ActionButtonProps) {
  const locked = state === "pending" || state === "unknown";
  return <Button {...props} asChild={asChild} disabled={disabled || locked} aria-disabled={disabled || locked || undefined} aria-busy={state === "pending"} tabIndex={asChild && (disabled || locked) ? -1 : props.tabIndex} onClick={event => { if (disabled || locked) {event.preventDefault();event.stopPropagation();return;} onClick?.(event); }} data-action-state={state} className={cn("motion-reduce:transition-none data-[variant=default]:enabled:hover:bg-primary/90", className)}>
    {asChild ? children : <>
    {state === "pending" && <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}
    {state === "success" && <Check aria-hidden="true" className="size-4" />}
    {state === "pending" && pendingLabel ? pendingLabel : children}
    </>}
  </Button>;
}
