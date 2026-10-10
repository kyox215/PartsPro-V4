"use client";

import * as React from "react";
import { CheckCircle2, CircleAlert, Inbox, Info, Loader2, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DelayedPendingIndicator,
  useDelayedVisible,
} from "./pending-feedback";

const noticeIcons = { info: Info, success: CheckCircle2, warning: TriangleAlert, error: CircleAlert };

export function AdminNotice({ tone, title, children, message, action, onDismiss, dismissLabel = "关闭提示 / Chiudi avviso", className, icon: CustomIcon, role = tone === "error" ? "alert" : "status" }: {
  tone: keyof typeof noticeIcons;
  title?: string;
  children?: React.ReactNode;
  message?: React.ReactNode;
  action?: React.ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
  icon?: React.ComponentType<{ className?: string }>;
  role?: "alert" | "status";
}) {
  const Icon = CustomIcon ?? noticeIcons[tone];
  return <div data-admin-notice={tone} role={role} aria-live={role === "status" ? "polite" : undefined} className={cn("flex min-w-0 items-start gap-2.5 rounded-lg border p-3 text-sm", className)}>
    <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
    <div className="min-w-0 flex-1 break-words">
      {title && <p className="font-semibold leading-5">{title}</p>}
      {(children ?? message) && <div className={cn("leading-5", title && "mt-1")}>{children ?? message}</div>}
      {action && <div className="mt-2 flex flex-wrap items-center gap-2">{action}</div>}
    </div>
    {onDismiss && <Button type="button" variant="ghost" size="icon-sm" aria-label={dismissLabel} onClick={onDismiss} className="-mr-1 -mt-1 shrink-0"><X aria-hidden="true" className="size-4" /></Button>}
  </div>;
}

export function AdminEmptyState({ title, description, action, icon: Icon = Inbox, className }: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return <div data-admin-empty="true" className={cn("flex min-w-0 flex-col items-center rounded-lg border border-dashed border-slate-300 bg-slate-50/70 px-4 py-6 text-center", className)}>
    <span aria-hidden="true" className="mb-2 rounded-full bg-white p-2 text-slate-500"><Icon className="size-5" /></span>
    <p className="max-w-full break-words text-sm font-semibold text-slate-700">{title}</p>
    {description && <div className="mt-1 max-w-prose break-words text-xs leading-5 text-slate-600">{description}</div>}
    {action && <div className="mt-3 flex max-w-full flex-wrap justify-center gap-2">{action}</div>}
  </div>;
}

export function AdminActionButton({ pending, pendingLabel, children, disabled, ...props }: Omit<React.ComponentProps<typeof Button>, "asChild"> & { pending: boolean; pendingLabel?: string }) {
  return <Button {...props} disabled={pending || disabled} aria-busy={pending} data-admin-pending={pending || undefined}>
    {pending && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
    {pending && pendingLabel ? pendingLabel : children}
  </Button>;
}

export function AdminErrorSummary({ title, issues, className, focusKey }: {
  title: string;
  issues: Array<{ id: string; message: string }>;
  className?: string;
  focusKey?: number | string;
}) {
  const summaryRef = React.useRef<HTMLDivElement>(null);
  const hasIssues = issues.length > 0;
  // Announce each failed submission, without stealing focus while fields are edited.
  React.useEffect(() => { if (hasIssues) summaryRef.current?.focus(); }, [hasIssues, focusKey]);
  if (!issues.length) return null;
  return <div ref={summaryRef} tabIndex={-1} role="alert" data-admin-notice="error" className={cn("rounded-lg border p-3 text-sm outline-none", className)}>
    <p className="flex items-center gap-2 font-semibold"><CircleAlert aria-hidden="true" className="size-4 shrink-0" />{title}</p>
    <ul className="mt-2 space-y-1 pl-6 list-disc">
      {issues.map((issue, index) => <li key={`${issue.id}:${index}`}><a className="font-medium underline underline-offset-2" href={`#${issue.id}`} onClick={event => {
        event.preventDefault();
        const field = document.getElementById(issue.id);
        field?.focus({ preventScroll: true });
        field?.scrollIntoView({ block: "center", behavior: "instant" });
      }}>{issue.message}</a></li>)}
    </ul>
  </div>;
}

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
