"use client";
import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function AdminFieldGroup({ label, children, className, invalid = false }: { label: string; children: React.ReactNode; className?: string; invalid?: boolean }) {
  const id = React.useId(); const root = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const control = root.current?.querySelector<HTMLElement>('input:not([type="hidden"]):not([type="checkbox"]),textarea,select,button[role="combobox"]');
    const visibleLabel = root.current?.querySelector<HTMLLabelElement>('label[data-admin-field-label]');
    if (!control || !visibleLabel) return;
    if (!control.id) control.id = `${id}-control`;
    visibleLabel.htmlFor = control.id;
    if (!control.hasAttribute("aria-label")) {
      const labelledBy = new Set((control.getAttribute("aria-labelledby") ?? "").split(" ").filter(Boolean)); labelledBy.add(`${id}-label`);
      control.setAttribute("aria-labelledby", [...labelledBy].join(" "));
    }
  }, [id, children]);
  return <div ref={root} role="group" aria-label={label} data-field-error={invalid} className={cn("min-w-0 space-y-1.5", className)}><Label id={`${id}-label`} data-admin-field-label>{label}</Label>{children}</div>;
}
