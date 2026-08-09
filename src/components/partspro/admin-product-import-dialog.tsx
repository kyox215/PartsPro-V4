"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  Download,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  Upload,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type PreviewRow = {
  compatibilityReview: {
    fingerprint: string;
    reasonCodes: string[];
    required: boolean;
    signalCount: number;
    signals: unknown[];
    structuredModelCount: number;
  };
  changes: Array<{ currentValue: string; field: string; nextValue: string }>;
  issues: string[];
  normalized: Record<string, string>;
  operation: "create" | "update" | "skip";
  rowNumber: number;
  sku: string;
  status: "ready" | "draft" | "blocked" | "skipped";
  warnings: string[];
};

type ProductImportPreview = {
  counts: {
    blocked: number;
    compatibilityReviewRequired: number;
    create: number;
    draft: number;
    ready: number;
    skipped: number;
    total: number;
    update: number;
  };
  detectedHeaders: string[];
  ignoredHeaders: string[];
  previewHash: string;
  rows: PreviewRow[];
  sourceFileName: string;
};

type ApplyResult = {
  counts: { applied: number; failed: number; skipped: number; total: number };
  failures: Array<{ message: string; rowNumber: number; sku: string }>;
  partial: boolean;
};

type AdminProductImportDialogProps = {
  locale: string;
  onImported: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

const endpoints = {
  apply: "/api/admin/products/import/apply",
  preview: "/api/admin/products/import/preview",
  previewExport: "/api/admin/products/import/preview-export",
  template: "/api/admin/products/import/template",
};

export function AdminProductImportDialog({
  locale,
  onImported,
  onOpenChange,
  open,
}: AdminProductImportDialogProps) {
  const italian = locale.toLowerCase().startsWith("it");
  const copy = italian ? itCopy : zhCopy;
  const [mode, setMode] = React.useState<"file" | "paste">("file");
  const [file, setFile] = React.useState<File | null>(null);
  const [pasteText, setPasteText] = React.useState("");
  const [preview, setPreview] = React.useState<ProductImportPreview | null>(null);
  const [confirmed, setConfirmed] = React.useState(false);
  const [compatibilityConfirmations, setCompatibilityConfirmations] = React.useState<Record<number, string>>({});
  const [pending, setPending] = React.useState<"template" | "preview" | "export" | "apply" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ApplyResult | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setFile(null);
      setPasteText("");
      setPreview(null);
      setConfirmed(false);
      setCompatibilityConfirmations({});
      setPending(null);
      setError(null);
      setResult(null);
      setMode("file");
    }
    onOpenChange(nextOpen);
  }

  const sourceFile = React.useMemo(() => {
    if (mode === "file") return file;
    const value = pasteText.trim();
    return value
      ? new File([value], "partspro-pasted-products.csv", { type: "text/csv;charset=utf-8" })
      : null;
  }, [file, mode, pasteText]);

  async function downloadTemplate() {
    setPending("template");
    setError(null);
    try {
      const response = await fetch(endpoints.template, { cache: "no-store" });
      await downloadResponse(response, "partspro-product-import-template.xlsx");
    } catch (cause) {
      setError(errorMessage(cause, copy.genericError));
    } finally {
      setPending(null);
    }
  }

  async function generatePreview() {
    if (!sourceFile) {
      setError(copy.chooseSource);
      return;
    }
    setPending("preview");
    setError(null);
    setResult(null);
    setConfirmed(false);
    setCompatibilityConfirmations({});
    try {
      const form = new FormData();
      form.set("file", sourceFile);
      const response = await fetch(endpoints.preview, { method: "POST", body: form });
      const body = await readJson(response);
      setPreview(body.data as ProductImportPreview);
    } catch (cause) {
      setPreview(null);
      setError(errorMessage(cause, copy.genericError));
    } finally {
      setPending(null);
    }
  }

  async function exportPreview() {
    if (!sourceFile || !preview) return;
    setPending("export");
    setError(null);
    try {
      const form = new FormData();
      form.set("file", sourceFile);
      const response = await fetch(endpoints.previewExport, { method: "POST", body: form });
      await downloadResponse(response, "partspro-product-import-preview.xlsx");
    } catch (cause) {
      setError(errorMessage(cause, copy.genericError));
    } finally {
      setPending(null);
    }
  }

  async function applyImport() {
    const requiredReviews = preview?.rows.filter((row) => row.compatibilityReview.required) ?? [];
    const allCompatibilityReviewsConfirmed = requiredReviews.every(
      (row) => compatibilityConfirmations[row.rowNumber] === row.compatibilityReview.fingerprint
    );
    if (!sourceFile || !preview || !confirmed || !allCompatibilityReviewsConfirmed || preview.counts.blocked > 0) return;
    setPending("apply");
    setError(null);
    try {
      const form = new FormData();
      form.set("file", sourceFile);
      form.set("previewHash", preview.previewHash);
      form.set("confirmed", "true");
      if (requiredReviews.length > 0) {
        form.set(
          "compatibilityReviewConfirmations",
          JSON.stringify(
            requiredReviews.map((row) => ({
              fingerprint: row.compatibilityReview.fingerprint,
              rowNumber: row.rowNumber,
            }))
          )
        );
      }
      const response = await fetch(endpoints.apply, { method: "POST", body: form });
      const body = await readJson(response);
      const nextResult = body.data as ApplyResult;
      setResult(nextResult);
      if (nextResult.counts.applied > 0) onImported();
      if (nextResult.failures.length > 0) {
        setError(copy.partialFailure.replace("{count}", String(nextResult.counts.applied)));
      }
    } catch (cause) {
      setError(errorMessage(cause, copy.genericError));
    } finally {
      setPending(null);
    }
  }

  function setCompatibilityReviewConfirmation(row: PreviewRow, checked: boolean) {
    setCompatibilityConfirmations((current) => {
      const next = { ...current };
      if (checked) next[row.rowNumber] = row.compatibilityReview.fingerprint;
      else delete next[row.rowNumber];
      return next;
    });
  }

  const step = result ? 4 : preview ? 3 : sourceFile ? 2 : 1;
  const requiredReviews = preview?.rows.filter((row) => row.compatibilityReview.required) ?? [];
  const allCompatibilityReviewsConfirmed = requiredReviews.every(
    (row) => compatibilityConfirmations[row.rowNumber] === row.compatibilityReview.fingerprint
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[94dvh] w-[calc(100vw-1rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100vw-2rem)]">
        <DialogHeader className="border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <FileSpreadsheet className="size-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle>{copy.title}</DialogTitle>
              <DialogDescription className="mt-1">{copy.description}</DialogDescription>
            </div>
          </div>
          <StepBar step={step} labels={copy.steps} />
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {error && (
            <div className="mb-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
              <XCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result ? (
            <ResultPanel result={result} copy={copy} />
          ) : preview ? (
            <PreviewPanel
              compatibilityConfirmations={compatibilityConfirmations}
              onCompatibilityReviewConfirm={setCompatibilityReviewConfirmation}
              preview={preview}
              copy={copy}
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <h3 className="font-bold text-slate-950">{copy.templateTitle}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{copy.templateHelp}</p>
                <Button className="mt-4 w-full" variant="outline" onClick={() => void downloadTemplate()} disabled={pending !== null}>
                  {pending === "template" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  {copy.downloadTemplate}
                </Button>
                <div className="mt-4 space-y-2 text-xs text-slate-600">
                  <p>• {copy.limit}</p>
                  <p>• {copy.blankRule}</p>
                  <p>• {copy.draftRule}</p>
                </div>
              </div>

              <Tabs value={mode} onValueChange={(value) => { setMode(value === "paste" ? "paste" : "file"); setPreview(null); setCompatibilityConfirmations({}); setError(null); }}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="file"><Upload className="size-4" />{copy.uploadTab}</TabsTrigger>
                  <TabsTrigger value="paste"><ClipboardPaste className="size-4" />{copy.pasteTab}</TabsTrigger>
                </TabsList>
                <TabsContent value="file" className="mt-4">
                  <Label htmlFor="product-import-file">{copy.fileLabel}</Label>
                  <div className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
                    <Input
                      id="product-import-file"
                      type="file"
                      accept=".xlsx,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values"
                      onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); setCompatibilityConfirmations({}); setError(null); }}
                    />
                    <p className="mt-2 text-xs text-slate-500">{file ? `${file.name} · ${formatBytes(file.size)}` : copy.fileHint}</p>
                  </div>
                </TabsContent>
                <TabsContent value="paste" className="mt-4">
                  <Label htmlFor="product-import-paste">{copy.pasteLabel}</Label>
                  <Textarea
                    id="product-import-paste"
                    className="mt-2 min-h-64 font-mono text-xs"
                    value={pasteText}
                    onChange={(event) => { setPasteText(event.target.value); setPreview(null); setCompatibilityConfirmations({}); setError(null); }}
                    placeholder={copy.pastePlaceholder}
                  />
                  <p className="mt-2 text-xs leading-5 text-slate-500">{copy.pasteHint}</p>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
          {result ? (
            <>
              <Button variant="outline" onClick={() => { setPreview(null); setResult(null); setConfirmed(false); setCompatibilityConfirmations({}); setError(null); }}>
                <RotateCcw className="size-4" />{copy.importAnother}
              </Button>
              <Button onClick={() => handleOpenChange(false)}>{copy.done}</Button>
            </>
          ) : preview ? (
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className={cn("flex items-start gap-2 text-sm", (preview.counts.blocked > 0 || !allCompatibilityReviewsConfirmed) && "text-slate-400")}>
                <Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} disabled={preview.counts.blocked > 0 || pending !== null} />
                <span>{copy.confirm}</span>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => void exportPreview()} disabled={pending !== null}>
                  {pending === "export" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  {copy.exportPreview}
                </Button>
                <Button variant="outline" onClick={() => { setPreview(null); setConfirmed(false); setCompatibilityConfirmations({}); setError(null); }} disabled={pending !== null}>
                  {copy.backToEdit}
                </Button>
                <Button onClick={() => void applyImport()} disabled={!confirmed || !allCompatibilityReviewsConfirmed || preview.counts.blocked > 0 || pending !== null}>
                  {pending === "apply" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  {copy.apply}
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => void generatePreview()} disabled={!sourceFile || pending !== null}>
              {pending === "preview" ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
              {copy.preview}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepBar({ step, labels }: { step: number; labels: readonly string[] }) {
  return (
    <div className="mt-4 grid grid-cols-4 gap-1">
      {labels.map((label, index) => {
        const value = index + 1;
        return (
          <div key={label} className="min-w-0">
            <div className={cn("h-1.5 rounded-full", value <= step ? "bg-emerald-600" : "bg-slate-200")} />
            <div className={cn("mt-1 truncate text-[10px] font-semibold sm:text-xs", value <= step ? "text-emerald-700" : "text-slate-400")}>{value}. {label}</div>
          </div>
        );
      })}
    </div>
  );
}

function PreviewPanel({
  compatibilityConfirmations,
  onCompatibilityReviewConfirm,
  preview,
  copy,
}: {
  compatibilityConfirmations: Record<number, string>;
  onCompatibilityReviewConfirm: (row: PreviewRow, checked: boolean) => void;
  preview: ProductImportPreview;
  copy: typeof zhCopy;
}) {
  const cards = [
    [copy.total, preview.counts.total, "slate"],
    [copy.create, preview.counts.create, "blue"],
    [copy.update, preview.counts.update, "violet"],
    [copy.draft, preview.counts.draft, "amber"],
    [copy.ready, preview.counts.ready, "emerald"],
    [copy.blocked, preview.counts.blocked, "red"],
    [copy.compatibilityReviewCount, preview.counts.compatibilityReviewRequired, "orange"],
  ] as const;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
        {cards.map(([label, value, tone]) => <MetricCard key={label} label={label} value={value} tone={tone} />)}
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span className="font-semibold text-slate-900">{copy.detected}：</span>{preview.detectedHeaders.join("、")}
        {preview.ignoredHeaders.length > 0 && <span className="ml-3 text-amber-700"><span className="font-semibold">{copy.ignored}：</span>{preview.ignoredHeaders.join("、")}</span>}
      </div>
      {preview.counts.compatibilityReviewRequired > 0 && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <div className="font-semibold">{copy.compatibilityReviewTitle.replace("{count}", String(preview.counts.compatibilityReviewRequired))}</div>
            <div className="mt-1 text-xs leading-5">{copy.compatibilityReviewHelp}</div>
          </div>
        </div>
      )}

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">{copy.status}</th><th className="px-3 py-2">{copy.operation}</th><th className="px-3 py-2">SKU</th><th className="px-3 py-2">{copy.product}</th><th className="px-3 py-2">{copy.changes}</th><th className="px-3 py-2">{copy.issues}</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{preview.rows.map((row) => <PreviewTableRow key={row.rowNumber} compatibilityConfirmed={compatibilityConfirmations[row.rowNumber] === row.compatibilityReview.fingerprint} onCompatibilityReviewConfirm={onCompatibilityReviewConfirm} row={row} copy={copy} />)}</tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">{preview.rows.map((row) => <PreviewMobileCard key={row.rowNumber} compatibilityConfirmed={compatibilityConfirmations[row.rowNumber] === row.compatibilityReview.fingerprint} onCompatibilityReviewConfirm={onCompatibilityReviewConfirm} row={row} copy={copy} />)}</div>
    </div>
  );
}

function PreviewTableRow({
  compatibilityConfirmed,
  onCompatibilityReviewConfirm,
  row,
  copy,
}: {
  compatibilityConfirmed: boolean;
  onCompatibilityReviewConfirm: (row: PreviewRow, checked: boolean) => void;
  row: PreviewRow;
  copy: typeof zhCopy;
}) {
  return <tr className="align-top"><td className="px-3 py-3 font-mono text-xs">{row.rowNumber}</td><td className="px-3 py-3"><StatusBadge status={row.status} copy={copy} /></td><td className="px-3 py-3">{operationLabel(row.operation, copy)}</td><td className="px-3 py-3 font-mono text-xs">{row.sku}</td><td className="px-3 py-3"><div className="max-w-xs font-semibold text-slate-900">{row.normalized.name || "—"}</div><div className="mt-1 text-xs text-slate-500">{[row.normalized.brand, row.normalized.category].filter(Boolean).join(" · ")}</div></td><td className="px-3 py-3 text-xs text-slate-600">{row.changes.length ? row.changes.slice(0, 3).map((change) => change.field).join("、") : "—"}{row.changes.length > 3 ? ` +${row.changes.length - 3}` : ""}</td><td className="max-w-sm px-3 py-3 text-xs"><IssueList compatibilityConfirmed={compatibilityConfirmed} onCompatibilityReviewConfirm={onCompatibilityReviewConfirm} row={row} copy={copy} /></td></tr>;
}

function PreviewMobileCard({
  compatibilityConfirmed,
  onCompatibilityReviewConfirm,
  row,
  copy,
}: {
  compatibilityConfirmed: boolean;
  onCompatibilityReviewConfirm: (row: PreviewRow, checked: boolean) => void;
  row: PreviewRow;
  copy: typeof zhCopy;
}) {
  return <div className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-2"><div><div className="font-semibold text-slate-950">{row.normalized.name || row.sku}</div><div className="mt-1 font-mono text-xs text-slate-500">#{row.rowNumber} · {row.sku}</div></div><StatusBadge status={row.status} copy={copy} /></div><div className="mt-3 flex flex-wrap gap-2"><Badge variant="outline">{operationLabel(row.operation, copy)}</Badge>{row.changes.length > 0 && <Badge variant="outline">{copy.changes} {row.changes.length}</Badge>}</div><div className="mt-3"><IssueList compatibilityConfirmed={compatibilityConfirmed} onCompatibilityReviewConfirm={onCompatibilityReviewConfirm} row={row} copy={copy} /></div></div>;
}

function IssueList({
  compatibilityConfirmed,
  onCompatibilityReviewConfirm,
  row,
  copy,
}: {
  compatibilityConfirmed: boolean;
  onCompatibilityReviewConfirm: (row: PreviewRow, checked: boolean) => void;
  row: PreviewRow;
  copy: typeof zhCopy;
}) {
  if (row.issues.length === 0 && row.warnings.length === 0) return <span className="text-emerald-700">✓</span>;
  return <div className="space-y-1">{row.issues.map((issue) => <div key={issue} className="flex gap-1 text-red-700"><XCircle className="mt-0.5 size-3 shrink-0" /><span>{issue}</span></div>)}{row.warnings.map((warning) => <div key={warning} className="flex gap-1 text-amber-700"><AlertTriangle className="mt-0.5 size-3 shrink-0" /><span>{warning}</span></div>)}{row.compatibilityReview.required && <CompatibilityReviewBlock compatibilityConfirmed={compatibilityConfirmed} onCompatibilityReviewConfirm={onCompatibilityReviewConfirm} row={row} copy={copy} />}</div>;
}

function CompatibilityReviewBlock({
  compatibilityConfirmed,
  onCompatibilityReviewConfirm,
  row,
  copy,
}: {
  compatibilityConfirmed: boolean;
  onCompatibilityReviewConfirm: (row: PreviewRow, checked: boolean) => void;
  row: PreviewRow;
  copy: typeof zhCopy;
}) {
  const review = row.compatibilityReview;
  return <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-950"><div className="font-semibold">{copy.compatibilityReviewEvidence}</div><div className="mt-1">{copy.compatibilityReviewReasons}: {review.reasonCodes.join("、") || "—"}</div><div className="mt-1">{copy.compatibilityReviewSignals}: {review.signals.join("；") || "—"}</div><label className="mt-2 flex items-start gap-2"><Checkbox checked={compatibilityConfirmed} onCheckedChange={(value) => onCompatibilityReviewConfirm(row, value === true)} /><span>{copy.compatibilityReviewConfirm}</span></label></div>;
}

function StatusBadge({ status, copy }: { status: PreviewRow["status"]; copy: typeof zhCopy }) {
  return <Badge className={cn("border", status === "blocked" ? "border-red-200 bg-red-50 text-red-700" : status === "ready" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "draft" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-600")}>{copy.statusLabels[status]}</Badge>;
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  const tones: Record<string, string> = { slate: "bg-slate-50 text-slate-800", blue: "bg-blue-50 text-blue-800", violet: "bg-violet-50 text-violet-800", amber: "bg-amber-50 text-amber-800", emerald: "bg-emerald-50 text-emerald-800", red: "bg-red-50 text-red-800", orange: "bg-orange-50 text-orange-800" };
  return <div className={cn("rounded-lg p-2.5", tones[tone])}><div className="text-lg font-bold">{value}</div><div className="text-[11px] font-semibold">{label}</div></div>;
}

function ResultPanel({ result, copy }: { result: ApplyResult; copy: typeof zhCopy }) {
  const success = result.failures.length === 0;
  return <div className={cn("mx-auto max-w-xl rounded-2xl border p-6 text-center", success ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50")}><div className={cn("mx-auto flex size-12 items-center justify-center rounded-full", success ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{success ? <CheckCircle2 className="size-6" /> : <AlertTriangle className="size-6" />}</div><h3 className="mt-3 text-lg font-bold text-slate-950">{success ? copy.successTitle : copy.partialTitle}</h3><p className="mt-2 text-sm text-slate-600">{copy.resultSummary.replace("{applied}", String(result.counts.applied)).replace("{total}", String(result.counts.total))}</p>{result.failures.length > 0 && <div className="mt-4 space-y-2 text-left">{result.failures.map((failure) => <div key={`${failure.rowNumber}-${failure.sku}`} className="rounded-lg border border-amber-200 bg-white p-3 text-sm"><div className="font-semibold">#{failure.rowNumber} · {failure.sku}</div><div className="mt-1 text-amber-800">{failure.message}</div></div>)}</div>}</div>;
}

function operationLabel(operation: PreviewRow["operation"], copy: typeof zhCopy) { return copy.operationLabels[operation]; }
async function readJson(response: Response) { const body = await response.json().catch(() => null) as { data?: unknown; error?: { message?: string } } | null; if (!response.ok || !body?.data) throw new Error(body?.error?.message || `HTTP ${response.status}`); return body; }
async function downloadResponse(response: Response, fallbackName: string) { if (!response.ok) { const body = await response.json().catch(() => null) as { error?: { message?: string } } | null; throw new Error(body?.error?.message || `HTTP ${response.status}`); } const blob = await response.blob(); const disposition = response.headers.get("content-disposition") ?? ""; const match = disposition.match(/filename="?([^";]+)"?/i); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = match?.[1] ?? fallbackName; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url); }
function errorMessage(error: unknown, fallback: string) { return error instanceof Error && error.message ? error.message : fallback; }
function formatBytes(bytes: number) { return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

const zhCopy = {
  title: "Excel 批量导入商品",
  description: "下载模板或直接粘贴资料，先检查预览，确认后才写入商品资料。",
  steps: ["准备资料", "检查字段", "确认预览", "完成"],
  templateTitle: "第一次使用？先下载模板",
  templateHelp: "模板已经写好字段说明、可选值和示例。填写完成后返回这里上传即可。",
  downloadTemplate: "下载 Excel 模板",
  limit: "单次最多 500 行、5MB",
  blankRule: "更新商品时，空白单元格保持原值",
  draftRule: "新商品默认草稿，不会自动展示到商城",
  uploadTab: "上传文件",
  pasteTab: "粘贴表格",
  fileLabel: "选择 Excel、CSV 或 TSV",
  fileHint: "支持 .xlsx、.csv、.tsv",
  pasteLabel: "粘贴你已经整理好的资料",
  pastePlaceholder: "从 Excel 或 Numbers 复制包含表头的区域，然后粘贴到这里…",
  pasteHint: "支持中文、意大利语和标准英文字段名。第一行必须是表头；修改内容后重新生成预览即可。",
  chooseSource: "请先选择文件或粘贴表格资料。",
  genericError: "操作失败，请稍后重试。",
  preview: "生成导入预览",
  total: "总行数",
  create: "新增",
  update: "更新",
  draft: "草稿",
  ready: "可更新",
  blocked: "阻断",
  compatibilityReviewCount: "兼容候选",
  compatibilityReviewTitle: "有 {count} 行需要兼容性人工复核",
  compatibilityReviewHelp: "请查看每行标题证据、原因和结构化字段，再逐行勾选。确认仅表示已人工检查，不会自动建立兼容关系。",
  compatibilityReviewEvidence: "兼容性候选证据",
  compatibilityReviewReasons: "原因",
  compatibilityReviewSignals: "信号",
  compatibilityReviewConfirm: "我已人工检查此行候选提示",
  detected: "已识别字段",
  ignored: "未识别字段",
  status: "状态",
  operation: "操作",
  product: "商品",
  changes: "变更",
  issues: "检查结果",
  confirm: "我已核对预览，确认按以上内容导入。",
  exportPreview: "导出预览 Excel",
  backToEdit: "返回修正",
  apply: "确认导入",
  importAnother: "继续导入",
  done: "完成",
  successTitle: "商品导入完成",
  partialTitle: "部分商品已导入",
  resultSummary: "已处理 {applied}/{total} 行。",
  partialFailure: "已经成功导入 {count} 行，后续行停止处理。请重新生成预览后继续。",
  statusLabels: { ready: "可更新", draft: "可新建草稿", blocked: "需要修正", skipped: "跳过" },
  operationLabels: { create: "新增", update: "更新", skip: "跳过" },
};

const itCopy: typeof zhCopy = {
  title: "Importazione prodotti da Excel",
  description: "Scarica il modello o incolla i dati, controlla l'anteprima e conferma solo alla fine.",
  steps: ["Prepara", "Controlla", "Conferma", "Completato"],
  templateTitle: "Prima volta? Scarica il modello",
  templateHelp: "Il modello contiene campi, valori ammessi ed esempi pronti da compilare.",
  downloadTemplate: "Scarica modello Excel",
  limit: "Massimo 500 righe e 5 MB",
  blankRule: "In aggiornamento le celle vuote mantengono il valore attuale",
  draftRule: "I nuovi prodotti partono come bozza",
  uploadTab: "Carica file",
  pasteTab: "Incolla tabella",
  fileLabel: "Seleziona Excel, CSV o TSV",
  fileHint: "Supporta .xlsx, .csv e .tsv",
  pasteLabel: "Incolla i dati già preparati",
  pastePlaceholder: "Copia da Excel o Numbers includendo la riga delle intestazioni…",
  pasteHint: "Sono riconosciute intestazioni italiane, cinesi e inglesi. La prima riga deve contenere i nomi delle colonne.",
  chooseSource: "Seleziona un file o incolla una tabella.",
  genericError: "Operazione non riuscita. Riprova.",
  preview: "Genera anteprima",
  total: "Totale",
  create: "Nuovi",
  update: "Aggiornamenti",
  draft: "Bozze",
  ready: "Aggiornabili",
  blocked: "Bloccati",
  compatibilityReviewCount: "Candidati compatibilità",
  compatibilityReviewTitle: "{count} righe richiedono una verifica manuale della compatibilità",
  compatibilityReviewHelp: "Controlla per ogni riga le evidenze del titolo, i motivi e i campi strutturati, poi seleziona la casella. La conferma indica solo una verifica manuale: non crea automaticamente relazioni di compatibilità.",
  compatibilityReviewEvidence: "Evidenza candidato compatibilità",
  compatibilityReviewReasons: "Motivi",
  compatibilityReviewSignals: "Segnali",
  compatibilityReviewConfirm: "Ho controllato manualmente il candidato di questa riga",
  detected: "Campi riconosciuti",
  ignored: "Campi ignorati",
  status: "Stato",
  operation: "Operazione",
  product: "Prodotto",
  changes: "Modifiche",
  issues: "Controlli",
  confirm: "Ho controllato l'anteprima e confermo questa importazione.",
  exportPreview: "Esporta anteprima Excel",
  backToEdit: "Correggi dati",
  apply: "Conferma importazione",
  importAnother: "Nuova importazione",
  done: "Fine",
  successTitle: "Importazione completata",
  partialTitle: "Importazione parziale",
  resultSummary: "Elaborate {applied}/{total} righe.",
  partialFailure: "Importate {count} righe; l'elaborazione si è fermata. Rigenera l'anteprima per continuare.",
  statusLabels: { ready: "Aggiornabile", draft: "Nuova bozza", blocked: "Da correggere", skipped: "Ignora" },
  operationLabels: { create: "Nuovo", update: "Aggiorna", skip: "Ignora" },
};
