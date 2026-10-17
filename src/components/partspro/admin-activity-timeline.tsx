"use client";

import { englishUiCopy } from "@/i18n/english-ui-copy";


import { AdminSearchField } from "./admin-ui-controls";

import * as React from "react";
import { AdminEmptyState, AdminNotice } from "./admin-feedback";
import Link from "next/link";
import { AdminListPager } from "./admin-list-pager";
import { useAdminWorkspaceUserId, usePersistentAdminValue } from "./admin-workspace-state";
import {
  BadgeEuro,
  Boxes,
  ChevronDown,
  ClipboardCheck,
  Flag,
  MessageSquarePlus,
  RotateCcw,
  Star,
  StarOff,
  UserCog,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatAdminMessage, getAdminDictionary } from "@/i18n/dictionaries/admin";
import { cn } from "@/lib/utils";
import { useI18n } from "./i18n-provider";

export type AdminActivityType =
  | "order-status"
  | "customer-tier"
  | "rma-created"
  | "inventory-update"
  | "payment-posted"
  | "note";

export type AdminActivity = {
  id: string;
  type: AdminActivityType;
  title: string;
  description: string;
  actor: string;
  subject: string;
  entityType?: string;
  entityId?: string | null;
  sku?: string | null;
  createdAt: string;
  important?: boolean;
  metadata?: Record<string, number | string | undefined>;
};

export type AdminActivityTimelineProps = {
  className?: string;
  description?: string;
  initialActivities?: AdminActivity[];
  permissions?: readonly string[];
  title?: string;
};

type ActivityFilterValue = "all" | AdminActivityType;
type ActivityCopy = ReturnType<typeof getAdminDictionary>["admin"]["activity"];

const activityTypeValues = [
  "all",
  "order-status",
  "customer-tier",
  "rma-created",
  "inventory-update",
  "payment-posted",
  "note",
] as const satisfies readonly ActivityFilterValue[];

const activityTypeConfig = {
  "order-status": {
    badgeClass: "border-sky-200 bg-sky-50 text-sky-700",
    icon: ClipboardCheck,
    iconClass: "bg-sky-50 text-sky-600 ring-sky-100",
  },
  "customer-tier": {
    badgeClass: "border-violet-200 bg-violet-50 text-violet-700",
    icon: UserCog,
    iconClass: "bg-violet-50 text-violet-600 ring-violet-100",
  },
  "rma-created": {
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
    icon: RotateCcw,
    iconClass: "bg-amber-50 text-amber-600 ring-amber-100",
  },
  "inventory-update": {
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: Boxes,
    iconClass: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  },
  "payment-posted": {
    badgeClass: "border-cyan-200 bg-cyan-50 text-cyan-700",
    icon: BadgeEuro,
    iconClass: "bg-cyan-50 text-cyan-600 ring-cyan-100",
  },
  note: {
    badgeClass: "border-slate-200 bg-slate-50 text-slate-700",
    icon: MessageSquarePlus,
    iconClass: "bg-slate-50 text-slate-600 ring-slate-100",
  },
} as const satisfies Record<
  AdminActivityType,
  {
    badgeClass: string;
    icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
  }
>;

export const defaultAdminActivities: AdminActivity[] = [];

function activityTarget(activity: AdminActivity, permissions: readonly string[]) {
  if (activity.type === "note" || !activity.entityType) return null;
  const allowed = (...required: string[]) => required.every(permission => permissions.includes(permission));
  const entityId = activity.entityId;
  const uuid = typeof entityId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entityId);
  switch (activity.entityType) {
    case "order":
      return uuid && allowed("panel.orders", "orders.read") ? { href: `/admin?panel=orders&orderId=${encodeURIComponent(entityId!)}`, label: "order" } : null;
    case "product":
      return activity.sku?.trim() && allowed("panel.catalog", "product.read_admin") ? { href: `/admin?panel=catalog&sku=${encodeURIComponent(activity.sku)}`, label: "product" } : null;
    case "customer":
      // Audit customer IDs identify customer records, never authentication accounts.
      return uuid && allowed("customers.read", "panel.orders", "orders.read") ? { href: `/admin?panel=orders&customerId=${encodeURIComponent(entityId!)}`, label: "customerOrders" } : null;
    case "supplier_batch":
      return allowed("panel.catalog", "product.read_admin") ? { href: "/admin?panel=catalog&catalogView=batches", label: "batches" } : null;
    case "rma":
    case "rma_request":
      return allowed("rma.read") ? { href: "/admin?panel=rma", label: "rma" } : null;
    case "finance_expense":
    case "finance_expense_entry":
    case "supplier_batch_payment":
    case "finance_export":
      return allowed("panel.finance", "finance.read") ? { href: "/admin?panel=finance", label: "finance" } : null;
    default:
      return null;
  }
}

export function AdminActivityTimeline({
  className,
  description,
  initialActivities = defaultAdminActivities,
  permissions = [],
  title,
}: AdminActivityTimelineProps) {
  const { locale } = useI18n();
  const copy = getAdminDictionary(locale).admin.activity;
  const [activities, setActivities] = React.useState<AdminActivity[]>(() =>
    sortActivities(initialActivities)
  );
  const userId = useAdminWorkspaceUserId();
  const [page, setPage] = usePersistentAdminValue("activity.page", 0);
  const [total, setTotal] = React.useState(0);
  const [readError, setReadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [noteStorageError, setNoteStorageError] = React.useState("");
  const [notesRestored, setNotesRestored] = React.useState(false);
  const [query, setQuery] = usePersistentAdminValue("activity.search", "");
  const [typeFilter, setTypeFilter] = React.useState<ActivityFilterValue>("all");
  const [showImportantOnly, setShowImportantOnly] = React.useState(false);
  const [noteText, setNoteText] = React.useState("");
  const [noteImportant, setNoteImportant] = React.useState(false);
  const [isNoteComposerOpen, setIsNoteComposerOpen] = React.useState(false);
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = userId ? localStorage.getItem(`partspro:admin-notes:v1:${userId}`) : null;
        const notes: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(notes)) setActivities(current => sortActivities([...current.filter(item => item.type !== "note"), ...notes.filter((item): item is AdminActivity => Boolean(item && typeof item === "object" && item.type === "note" && typeof item.id === "string" && typeof item.description === "string" && item.description.length <= 2000 && typeof item.createdAt === "string")).slice(0, 500)]));
      } catch { /* Personal browser notes may be unavailable. */ }
      setNotesRestored(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [userId]);
  React.useEffect(() => {
    if (!userId || !notesRestored) return;
    try { localStorage.setItem(`partspro:admin-notes:v1:${userId}`, JSON.stringify(activities.filter(item => item.type === "note").slice(0, 500))); } catch { /* No shared record is written. */ }
  }, [activities, notesRestored, userId]);
  React.useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true); setReadError(null);
      void fetch(`/api/admin/activity?limit=50&offset=${page * 50}`, { cache: "no-store", signal: controller.signal }).then(async response => {
        const payload = await response.json();
        if (!response.ok || !Array.isArray(payload.data)) throw new Error((locale.startsWith("en") ? englishUiCopy("Lettura attività non riuscita.") : locale.startsWith("zh") ? "活动读取失败，请重试。" : "Lettura attività non riuscita."));
        if (controller.signal.aborted) return;
        const data: AdminActivity[] = payload.data.map((row: Record<string, unknown>) => {
          const entity = String(row.entity_type); const action = String(row.action);
          const type: AdminActivityType = entity === "customer" ? "customer-tier" : entity.startsWith("rma") ? "rma-created" : entity.startsWith("finance") || entity === "supplier_batch_payment" ? "payment-posted" : entity === "product" || entity === "supplier_batch" ? "inventory-update" : "order-status";
          return { id: String(row.id), type, title: copy.typeOptions[type], description: `${action} · ${row.result === "success" ? ((locale.startsWith("en") ? englishUiCopy("Completato") : locale.startsWith("zh") ? "成功" : "Completato")) : ((locale.startsWith("en") ? englishUiCopy("Non riuscito") : locale.startsWith("zh") ? "失败" : "Non riuscito"))}`, subject: String(row.sku_code ?? row.entity_id ?? "—"), entityType: entity, entityId: typeof row.entity_id === "string" ? row.entity_id : null, sku: typeof row.sku_code === "string" ? row.sku_code : null, actor: String(row.actor_role ?? "—"), createdAt: String(row.created_at) };
        });
        setActivities(current => sortActivities([...current.filter(item => item.type === "note"), ...data])); setTotal(Number(payload.meta?.total) || 0);
      }).catch(error => { if (!controller.signal.aborted) setReadError(error instanceof Error ? error.message : "Error"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [page, locale, copy.typeOptions]);
  const noteComposerId = React.useId();
  const activityTypeOptions = React.useMemo(
    () =>
      activityTypeValues.map((value) => ({
        value,
        label: copy.typeOptions[value],
      })),
    [copy]
  );
  const resolvedTitle = title ?? copy.defaultTitle;
  const resolvedDescription = description ?? copy.defaultDescription;

  const filteredActivities = React.useMemo(
    () =>
      activities.filter((activity) => {
        const matchesType = typeFilter === "all" || activity.type === typeFilter;
        const matchesImportance = !showImportantOnly || activity.important;
        const matchesSearch =
          query.trim().length === 0 ||
          getActivitySearchText(activity, copy).includes(query.trim().toLowerCase());

        return matchesType && matchesImportance && matchesSearch;
      }),
    [activities, copy, query, showImportantOnly, typeFilter]
  );

  const importantCount = activities.filter((activity) => activity.important).length;

  function toggleImportant(activityId: string) {
    setActivities((currentActivities) =>
      currentActivities.map((activity) =>
        activity.id === activityId
          ? { ...activity, important: !activity.important }
          : activity
      )
    );
  }

  function handleAddNote() {
    const trimmedNote = noteText.trim();

    if (!trimmedNote || trimmedNote.length > 2000 || !notesRestored) {
      return;
    }

    const noteActivity = createNoteActivity(trimmedNote, noteImportant, copy);
    const notes = activities.filter(activity => activity.type === "note");
    if (!userId || notes.length >= 500) { setNoteStorageError((locale.startsWith("en") ? englishUiCopy("Account non disponibile o limite di 500 note raggiunto. Il testo è conservato.") : locale.startsWith("zh") ? "当前账号不可用或便签已达500条，内容仍保留在输入框。" : "Account non disponibile o limite di 500 note raggiunto. Il testo è conservato.")); return; }
    try { localStorage.setItem(`partspro:admin-notes:v1:${userId}`, JSON.stringify([noteActivity, ...notes])); setNoteStorageError(""); }
    catch { setNoteStorageError((locale.startsWith("en") ? englishUiCopy("Il browser non ha salvato la nota. Il testo resta: copialo prima di continuare.") : locale.startsWith("zh") ? "浏览器未能保存便签，内容仍保留，请先复制备份。" : "Il browser non ha salvato la nota. Il testo resta: copialo prima di continuare.")); return; }

    setActivities((currentActivities) =>
      sortActivities([noteActivity, ...currentActivities])
    );
    setNoteText("");
    setNoteImportant(false);
    setIsNoteComposerOpen(false);
  }

  return (
    <Card
      className={cn(
        "admin-ui-panel overflow-hidden border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]",
        className
      )}
    >
      <CardHeader className="gap-3 p-3 sm:gap-4 sm:p-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <CardTitle>{resolvedTitle}</CardTitle>
          <CardDescription className="block">{resolvedDescription}</CardDescription>
        </div>

        <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex xl:w-auto xl:justify-end">
          <AdminSearchField containerClassName="col-span-2 min-w-0 flex-1 xl:w-[260px] xl:flex-none" value={query} onValueChange={setQuery} className="bg-white" aria-label={copy.searchPlaceholder} placeholder={copy.searchPlaceholder} clearLabel={(locale.startsWith("en") ? englishUiCopy("Cancella ricerca") : locale.startsWith("zh") ? "清除搜索" : "Cancella ricerca")} />
          <Select
            value={typeFilter}
            onValueChange={(value) => setTypeFilter(value as ActivityFilterValue)}
          >
            <SelectTrigger size="sm" className="w-full min-w-0 bg-white sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {activityTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant={showImportantOnly ? "default" : "outline"}
            className={cn("w-full sm:w-auto", showImportantOnly ? "" : "bg-white")}
            onClick={() => setShowImportantOnly((value) => !value)}
          >
            <Flag className="size-4" />
            {copy.importantOnly}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-3 pt-0 sm:space-y-4 sm:p-6 sm:pt-0">
        <p className="text-xs text-slate-500">{(locale.startsWith("en") ? englishUiCopy("Attività reali paginate secondo i permessi. Le note sono personali e salvate solo nel browser di questo account; non sono condivise. I filtri agiscono sulla pagina corrente.") : locale.startsWith("zh") ? "真实活动按当前权限分页读取。备注仅保存在当前账号的本机浏览器中，不是团队共享记录；设备或浏览器清理后会丢失。筛选作用于当前页。" : "Attività reali paginate secondo i permessi. Le note sono personali e salvate solo nel browser di questo account; non sono condivise. I filtri agiscono sulla pagina corrente.")}</p>
        {noteStorageError && <AdminNotice tone="warning" message={noteStorageError} />}
        {readError && <AdminNotice tone="error" message={readError} />}
        <AdminListPager page={page} pageSize={50} total={total} returned={activities.filter(item => item.type !== "note").length} pending={loading} onPageChange={setPage} />
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span className="sm:hidden">
            {formatAdminMessage(copy.showCountMobile, {
              important: importantCount,
              shown: filteredActivities.length,
            })}
          </span>
          <span className="hidden sm:inline">
            {formatAdminMessage(copy.showCount, {
              shown: filteredActivities.length,
              total: activities.length,
            })}
          </span>
          <span className="hidden text-slate-300 sm:inline">/</span>
          <span className="hidden sm:inline">
            {formatAdminMessage(copy.importantCount, { count: importantCount })}
          </span>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-4">
          <div className="min-w-0 space-y-2 sm:space-y-3">
            {filteredActivities.length > 0 ? (
              filteredActivities.map((activity) => (
                <ActivityItem
                  key={activity.id}
                  activity={activity}
                  copy={copy}
                  locale={locale}
                  permissions={permissions}
                  onToggleImportant={toggleImportant}
                />
              ))
            ) : (
              <AdminEmptyState title={copy.noEvents} />
            )}
          </div>

          <aside className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2.5 lg:p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900">{copy.localNoteTitle}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {copy.localNoteDescription}
                </div>
              </div>
              <div className="flex w-full shrink-0 items-center gap-2 lg:w-auto">
                <Button
                  type="button"
                  variant={noteImportant ? "default" : "outline"}
                  size="icon-sm"
                  className={cn("hidden lg:inline-flex", noteImportant ? "" : "bg-white")}
                  aria-label={copy.markNoteImportant}
                  aria-pressed={noteImportant}
                  onClick={() => setNoteImportant((value) => !value)}
                >
                  <Star className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-center bg-white lg:hidden"
                  aria-controls={noteComposerId}
                  aria-expanded={isNoteComposerOpen}
                  onClick={() => setIsNoteComposerOpen((value) => !value)}
                >
                  <MessageSquarePlus className="size-4" />
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform",
                      isNoteComposerOpen && "rotate-180"
                    )}
                  />
                  {isNoteComposerOpen ? copy.closeNote : copy.openNote}
                </Button>
              </div>
            </div>

            <div
              id={noteComposerId}
              className={cn("mt-3", isNoteComposerOpen ? "block" : "hidden", "lg:block")}
            >
              <div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
                <span className="text-xs font-medium text-slate-600">
                  {copy.markNoteImportant}
                </span>
                <Button
                  type="button"
                  variant={noteImportant ? "default" : "outline"}
                  size="icon-sm"
                  className={noteImportant ? "" : "bg-white"}
                  aria-label={copy.markNoteImportant}
                  aria-pressed={noteImportant}
                  onClick={() => setNoteImportant((value) => !value)}
                >
                  <Star className="size-4" />
                </Button>
              </div>

              <Textarea maxLength={2000}
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                className="min-h-24 bg-white lg:min-h-28"
                placeholder={copy.note.placeholder}
              />

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-slate-500">
                  {formatAdminMessage(copy.chars, { count: noteText.trim().length })}
                </span>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={handleAddNote}
                  disabled={!noteText.trim()}
                >
                  <MessageSquarePlus className="size-4" />
                  {copy.addNote}
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityItem({
  activity,
  copy,
  locale,
  permissions,
  onToggleImportant,
}: {
  activity: AdminActivity;
  copy: ActivityCopy;
  locale: string;
  permissions: readonly string[];
  onToggleImportant: (activityId: string) => void;
}) {
  const config = activityTypeConfig[activity.type];
  const Icon = config.icon;
  const metadataEntries = getActivityMetadataEntries(activity);
  const target = activityTarget(activity, permissions);
  const linkLabels: Record<string, string> = (locale.startsWith("en") ? englishUiCopy({ order: "Apri ordine", product: "Apri prodotto", customerOrders: "Ordini del cliente", batches: "Apri lotti fornitori", rma: "Apri gestione resi", finance: "Apri gestione finanze" }) : locale.startsWith("zh")
    ? { order: "查看此订单", product: "查看此商品", customerOrders: "查看此客户的订单", batches: "进入到货批次", rma: "进入售后工作台", finance: "进入财务工作台" }
    : { order: "Apri ordine", product: "Apri prodotto", customerOrders: "Ordini del cliente", batches: "Apri lotti fornitori", rma: "Apri gestione resi", finance: "Apri gestione finanze" });

  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border p-2.5 transition sm:p-4",
        activity.important
          ? "border-primary/25 bg-primary/5"
          : "border-slate-200 bg-white"
      )}
    >
      <div className="flex min-w-0 gap-2.5 sm:gap-3">
        <div
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full ring-1 sm:size-9",
            config.iconClass
          )}
        >
          <Icon className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
            <Badge variant="outline" className={config.badgeClass}>
              {copy.typeOptions[activity.type]}
            </Badge>
            {activity.important && (
              <Badge variant="outline" className="hidden border-primary/30 bg-white text-primary sm:inline-flex">
                <Star className="size-3" />
                {copy.importantBadge}
              </Badge>
            )}
            <span className="text-xs font-medium text-slate-500">
              {formatActivityDate(activity.createdAt, locale)}
            </span>
          </div>

          <h3 className="mt-1.5 break-words text-sm font-bold text-slate-950">
            {activity.title}
          </h3>

          <div className="mt-1.5 min-w-0 text-xs text-slate-500">
            <span className="min-w-0 max-w-full break-all font-mono leading-5">
              {activity.subject}
            </span>
            {target && <Link href={target.href} prefetch={false} className="mt-1 block w-fit text-xs font-semibold text-primary underline underline-offset-2">{linkLabels[target.label]}</Link>}
          </div>

          <details className="group mt-3 border-t border-slate-100 pt-2">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md py-1 text-xs font-semibold text-slate-600 outline-none transition hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
              <span>{copy.details}</span>
              <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
            </summary>

            <div className="mt-2 space-y-2">
              <p className="break-words text-sm leading-6 text-slate-600">
                {activity.description}
              </p>

              <div className="flex min-w-0 flex-wrap gap-1.5 text-xs text-slate-500">
                <span className="min-w-0 max-w-full break-words rounded-md bg-slate-100 px-2 py-1 font-medium leading-5">
                  {copy.actor}: {activity.actor}
                </span>
                {metadataEntries.map(([key, value]) => (
                  <span
                    key={key}
                    className="min-w-0 max-w-full break-words rounded-md bg-slate-100 px-2 py-1 leading-5"
                  >
                    {key}: {value}
                  </span>
                ))}
              </div>
            </div>
          </details>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label={
            activity.important
              ? copy.removeImportant
              : copy.markImportant
          }
          aria-pressed={Boolean(activity.important)}
          onClick={() => onToggleImportant(activity.id)}
        >
          {activity.important ? (
            <StarOff className="size-4" />
          ) : (
            <Star className="size-4" />
          )}
        </Button>
      </div>
    </article>
  );
}

function createNoteActivity(
  noteText: string,
  important: boolean,
  copy: ActivityCopy
): AdminActivity {
  const createdAt = new Date().toISOString();

  return {
    id: `note-${Date.now()}`,
    type: "note",
    title: copy.note.title,
    description: noteText,
    actor: "Admin",
    subject: copy.note.subject,
    createdAt,
    important,
  };
}

function getActivityMetadataEntries(
  activity: AdminActivity
): Array<[string, number | string]> {
  if (!activity.metadata) {
    return [];
  }

  return Object.entries(activity.metadata).filter(
    (entry): entry is [string, number | string] =>
      entry[1] !== undefined && entry[1] !== ""
  );
}

function getActivitySearchText(activity: AdminActivity, copy: ActivityCopy): string {
  const metadataText = activity.metadata
    ? Object.entries(activity.metadata)
        .map(([key, value]) => `${key} ${value ?? ""}`)
        .join(" ")
    : "";

  return [
    activity.title,
    activity.description,
    activity.actor,
    activity.subject,
    copy.typeOptions[activity.type],
    metadataText,
  ]
    .join(" ")
    .toLowerCase();
}

function sortActivities(activities: AdminActivity[]): AdminActivity[] {
  return [...activities].sort(
    (activityA, activityB) =>
      new Date(activityB.createdAt).getTime() - new Date(activityA.createdAt).getTime()
  );
}

function formatActivityDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

export default AdminActivityTimeline;
