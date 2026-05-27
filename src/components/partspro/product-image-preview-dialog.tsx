"use client";

import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ProductImagePreviewDialogProps = {
  imageAlt: string;
  imageUrl: string;
  onImageError: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  productName: string;
};

export function ProductImagePreviewDialog({
  imageAlt,
  imageUrl,
  onImageError,
  onOpenChange,
  open,
  productName,
}: ProductImagePreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1.5rem)] gap-3 p-3 sm:max-w-3xl">
        <DialogHeader className="pr-10">
          <DialogTitle className="line-clamp-2 text-sm font-black text-slate-950">
            {productName}
          </DialogTitle>
        </DialogHeader>
        <div className="relative h-[min(72vh,620px)] min-h-[280px] overflow-hidden rounded-lg bg-slate-50">
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            sizes="(max-width: 640px) 92vw, 760px"
            quality={88}
            onError={onImageError}
            className="object-contain p-3"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
