import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, LoaderCircle, PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export type AsyncFeedbackProps = {
  state: "loading" | "empty" | "error" | "success" | "unknown" | "info";
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function AsyncFeedback({ state, title, description, actions, className }: AsyncFeedbackProps) {
  const Icon = state === "loading" ? LoaderCircle : state === "success" ? CheckCircle2 : state === "empty" ? PackageOpen : state === "error" || state === "unknown" ? AlertCircle : Info;
  return (
    <section data-state={state} role={state === "error" || state === "unknown" ? "alert" : "status"} aria-live={state === "error" || state === "unknown" ? "assertive" : "polite"} aria-busy={state === "loading"} className={cn("rounded-lg border p-4 text-sm", state === "error" ? "border-destructive/30 bg-destructive/5" : state === "success" ? "border-emerald-200 bg-emerald-50" : state === "unknown" ? "border-amber-200 bg-amber-50" : "border-border bg-muted/40", className)}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className={cn("mt-0.5 size-5 shrink-0", state === "loading" && "animate-spin motion-reduce:animate-none", state === "error" ? "text-destructive" : "text-primary")} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{title}</p>
          {description && <div className="mt-1 break-words leading-6 text-muted-foreground">{description}</div>}
          {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>
    </section>
  );
}
