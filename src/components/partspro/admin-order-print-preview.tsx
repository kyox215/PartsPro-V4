"use client";

import * as React from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { packingSlipPreview, waitForPackingSlipImages } from "@/lib/admin-order-print.mjs";
import { orderPresentationCopy } from "./admin-order-presentation";
import { AdminNotice } from "./admin-feedback";
import "./admin-order-print-preview.css";

export function OrderPrintPreview({ documents, loading, error, locale, onClose, onRetry }: {
  documents: string[]; loading: boolean; error: string; locale: string;
  onClose: () => void; onRetry: () => void;
}) {
  const copy = orderPresentationCopy(locale);
  const content = React.useMemo(() => documents.length ? packingSlipPreview(documents) : null, [documents]);
  const surface = React.useRef<HTMLDivElement>(null);
  const [readyContent, setReadyContent] = React.useState<typeof content>(null);
  const [printError, setPrintError] = React.useState("");
  const printLock = React.useRef(false);
  const cooldown = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => {
    if (!content) return;
    const controller = new AbortController();
    void waitForPackingSlipImages(Array.from(surface.current?.querySelectorAll("img") ?? []), controller.signal).then(() => {
      if (!controller.signal.aborted) setReadyContent(content);
    });
    return () => controller.abort();
  }, [content]);

  React.useEffect(() => {
    const reset = () => { printLock.current = false; };
    window.addEventListener("afterprint", reset);
    return () => { window.removeEventListener("afterprint", reset); clearTimeout(cooldown.current); };
  }, []);

  function print() {
    if (printLock.current || !content || readyContent !== content || loading) return;
    printLock.current = true;
    setPrintError("");
    try {
      // Keep the user gesture. No new window, navigation, async callback or auto-print.
      window.print();
    } catch {
      setPrintError(copy.printFailed);
    } finally {
      // Safari does not consistently block or emit afterprint. Never lock the preview.
      cooldown.current = setTimeout(() => { printLock.current = false; }, 1000);
    }
  }

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent data-order-print-preview scrollLayout="body" showCloseButton={false} className="admin-ui-panel h-[calc(100dvh-2rem)] max-w-[1100px] gap-0 overflow-hidden rounded-xl bg-slate-50 p-0">
      <DialogHeader className="order-print-toolbar shrink-0 border-b border-slate-200 bg-white p-3 text-left sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="outline" className="min-h-11 shrink-0 bg-white" onClick={onClose}><ArrowLeft className="size-4" />{copy.returnToOrder}</Button>
          <DialogTitle className="sr-only sm:not-sr-only sm:min-w-0 sm:flex-1 sm:text-base sm:font-bold">{copy.printPreview}{documents.length > 1 ? ` · ${documents.length}` : ""}</DialogTitle>
          <Button type="button" className="min-h-11" disabled={loading || !content || readyContent !== content} onClick={print}><Printer className="size-4" />{copy.print}</Button>
        </div>
        <DialogDescription className="mt-2 text-xs leading-relaxed">{copy.printHelp}</DialogDescription>
      </DialogHeader>
      <div className="order-print-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-6">
        {loading ? <p role="status" className="py-8 text-center text-sm text-slate-500">{copy.preparingPrint}</p> : error ? <div className="space-y-3"><AdminNotice tone="error" message={error} /><Button variant="outline" onClick={onRetry}>{copy.retry}</Button></div> : null}
        {printError && <AdminNotice tone="error" message={printError} />}
        {content && <><style>{content.styles}</style><div id="order-print-surface" ref={surface} className="order-print-document mx-auto max-w-[800px]" dangerouslySetInnerHTML={{ __html: content.body }} /></>}
      </div>
    </DialogContent>
  </Dialog>;
}
