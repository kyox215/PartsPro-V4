"use client";

import * as React from "react";
import {
  BadgeEuro,
  Boxes,
  ChevronDown,
  ClipboardCheck,
  Flag,
  MessageSquarePlus,
  RotateCcw,
  Search,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
  createdAt: string;
  important?: boolean;
  metadata?: Record<string, number | string | undefined>;
};

export type AdminActivityTimelineProps = {
  className?: string;
  description?: string;
  initialActivities?: AdminActivity[];
  title?: string;
};

type ActivityFilterValue = "all" | AdminActivityType;

const activityTypeOptions = [
  { value: "all", label: "Tutti i tipi" },
  { value: "order-status", label: "Stato ordine" },
  { value: "customer-tier", label: "Listino cliente" },
  { value: "rma-created", label: "RMA" },
  { value: "inventory-update", label: "Magazzino" },
  { value: "payment-posted", label: "Pagamento" },
  { value: "note", label: "Note interne" },
] as const satisfies readonly { value: ActivityFilterValue; label: string }[];

const activityTypeConfig = {
  "order-status": {
    badgeClass: "border-sky-200 bg-sky-50 text-sky-700",
    icon: ClipboardCheck,
    iconClass: "bg-sky-50 text-sky-600 ring-sky-100",
    label: "Stato ordine",
  },
  "customer-tier": {
    badgeClass: "border-violet-200 bg-violet-50 text-violet-700",
    icon: UserCog,
    iconClass: "bg-violet-50 text-violet-600 ring-violet-100",
    label: "Listino cliente",
  },
  "rma-created": {
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
    icon: RotateCcw,
    iconClass: "bg-amber-50 text-amber-600 ring-amber-100",
    label: "RMA",
  },
  "inventory-update": {
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: Boxes,
    iconClass: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    label: "Magazzino",
  },
  "payment-posted": {
    badgeClass: "border-cyan-200 bg-cyan-50 text-cyan-700",
    icon: BadgeEuro,
    iconClass: "bg-cyan-50 text-cyan-600 ring-cyan-100",
    label: "Pagamento",
  },
  note: {
    badgeClass: "border-slate-200 bg-slate-50 text-slate-700",
    icon: MessageSquarePlus,
    iconClass: "bg-slate-50 text-slate-600 ring-slate-100",
    label: "Nota",
  },
} as const satisfies Record<
  AdminActivityType,
  {
    badgeClass: string;
    icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
    label: string;
  }
>;

export const defaultAdminActivities: AdminActivity[] = [];

export function AdminActivityTimeline({
  className,
  description = "Cronologia operativa con filtri, ricerca e note locali.",
  initialActivities = defaultAdminActivities,
  title = "Timeline attivita admin",
}: AdminActivityTimelineProps) {
  const [activities, setActivities] = React.useState<AdminActivity[]>(() =>
    sortActivities(initialActivities)
  );
  const [query, setQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<ActivityFilterValue>("all");
  const [showImportantOnly, setShowImportantOnly] = React.useState(false);
  const [noteText, setNoteText] = React.useState("");
  const [noteImportant, setNoteImportant] = React.useState(false);
  const [isNoteComposerOpen, setIsNoteComposerOpen] = React.useState(false);
  const noteComposerId = React.useId();

  const filteredActivities = React.useMemo(
    () =>
      activities.filter((activity) => {
        const matchesType = typeFilter === "all" || activity.type === typeFilter;
        const matchesImportance = !showImportantOnly || activity.important;
        const matchesSearch =
          query.trim().length === 0 || getActivitySearchText(activity).includes(query.trim().toLowerCase());

        return matchesType && matchesImportance && matchesSearch;
      }),
    [activities, query, showImportantOnly, typeFilter]
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

    if (!trimmedNote) {
      return;
    }

    const noteActivity = createNoteActivity(trimmedNote, noteImportant);

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
        "overflow-hidden border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]",
        className
      )}
    >
      <CardHeader className="gap-3 p-3 sm:gap-4 sm:p-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <CardDescription className="hidden sm:block">{description}</CardDescription>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row xl:w-auto xl:justify-end">
          <div className="relative min-w-0 flex-1 xl:w-[260px] xl:flex-none">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-9 bg-white pl-9"
              placeholder="Cerca evento, SKU, cliente..."
            />
          </div>
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
            Importanti
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-3 pt-0 sm:space-y-4 sm:p-6 sm:pt-0">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span className="sm:hidden">
            {filteredActivities.length} eventi · {importantCount} importanti
          </span>
          <span className="hidden sm:inline">
            Vista {filteredActivities.length} di {activities.length} eventi
          </span>
          <span className="hidden text-slate-300 sm:inline">/</span>
          <span className="hidden sm:inline">{importantCount} marcati importanti</span>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-4">
          <div className="min-w-0 space-y-2 sm:space-y-3">
            {filteredActivities.length > 0 ? (
              filteredActivities.map((activity) => (
                <ActivityItem
                  key={activity.id}
                  activity={activity}
                  onToggleImportant={toggleImportant}
                />
              ))
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500 sm:p-6">
                Nessun evento corrisponde ai filtri correnti.
              </div>
            )}
          </div>

          <aside className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2.5 lg:p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="hidden min-w-0 lg:block">
                <div className="text-sm font-bold text-slate-900">Nota locale</div>
                <div className="mt-1 text-xs text-slate-500">
                  Aggiunta in questa sessione, senza persistenza remota.
                </div>
              </div>
              <div className="flex w-full shrink-0 items-center gap-2 lg:w-auto">
                <Button
                  type="button"
                  variant={noteImportant ? "default" : "outline"}
                  size="icon-sm"
                  className={cn("hidden lg:inline-flex", noteImportant ? "" : "bg-white")}
                  aria-label="Marca la nota come importante"
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
                  {isNoteComposerOpen ? "Chiudi nota" : "+ Nota"}
                </Button>
              </div>
            </div>

            <div
              id={noteComposerId}
              className={cn("mt-3", isNoteComposerOpen ? "block" : "hidden", "lg:block")}
            >
              <div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
                <span className="text-xs font-medium text-slate-600">
                  Marca importante
                </span>
                <Button
                  type="button"
                  variant={noteImportant ? "default" : "outline"}
                  size="icon-sm"
                  className={noteImportant ? "" : "bg-white"}
                  aria-label="Marca la nota come importante"
                  aria-pressed={noteImportant}
                  onClick={() => setNoteImportant((value) => !value)}
                >
                  <Star className="size-4" />
                </Button>
              </div>

              <Textarea
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                className="min-h-24 bg-white lg:min-h-28"
                placeholder="Scrivi una nota per il team operativo..."
              />

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-slate-500">
                  {noteText.trim().length} caratteri
                </span>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={handleAddNote}
                  disabled={!noteText.trim()}
                >
                  <MessageSquarePlus className="size-4" />
                  Aggiungi nota
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
  onToggleImportant,
}: {
  activity: AdminActivity;
  onToggleImportant: (activityId: string) => void;
}) {
  const config = activityTypeConfig[activity.type];
  const Icon = config.icon;
  const metadataEntries = getActivityMetadataEntries(activity);

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
              {config.label}
            </Badge>
            {activity.important && (
              <Badge variant="outline" className="hidden border-primary/30 bg-white text-primary sm:inline-flex">
                <Star className="size-3" />
                Importante
              </Badge>
            )}
            <span className="text-xs font-medium text-slate-500">
              {formatActivityDate(activity.createdAt)}
            </span>
          </div>

          <h3 className="mt-1.5 break-words text-sm font-bold text-slate-950">
            {activity.title}
          </h3>

          <div className="mt-1.5 min-w-0 text-xs text-slate-500">
            <span className="min-w-0 max-w-full break-all font-mono leading-5">
              {activity.subject}
            </span>
          </div>

          <details className="group mt-3 border-t border-slate-100 pt-2">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md py-1 text-xs font-semibold text-slate-600 outline-none transition hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
              <span>Dettagli</span>
              <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
            </summary>

            <div className="mt-2 space-y-2">
              <p className="break-words text-sm leading-6 text-slate-600">
                {activity.description}
              </p>

              <div className="flex min-w-0 flex-wrap gap-1.5 text-xs text-slate-500">
                <span className="min-w-0 max-w-full break-words rounded-md bg-slate-100 px-2 py-1 font-medium leading-5">
                  Attore: {activity.actor}
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
              ? "Rimuovi marcatore importante"
              : "Marca evento come importante"
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

function createNoteActivity(noteText: string, important: boolean): AdminActivity {
  const createdAt = new Date().toISOString();

  return {
    id: `note-${Date.now()}`,
    type: "note",
    title: "Nota amministrativa",
    description: noteText,
    actor: "Admin",
    subject: "Timeline",
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

function getActivitySearchText(activity: AdminActivity): string {
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
    activityTypeConfig[activity.type].label,
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

function formatActivityDate(value: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

export default AdminActivityTimeline;
