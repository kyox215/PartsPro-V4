"use client";

import Image from "./optimized-image";
import { useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { useI18n } from "./i18n-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type ProductImagePreviewDialogProps = {
  imageAlt: string;
  imageUrl: string;
  imageUrls?: readonly string[];
  onImageError: (url: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  productName: string;
};

export function ProductImagePreviewDialog({
  imageAlt,
  imageUrl,
  imageUrls = [],
  onImageError,
  onOpenChange,
  open,
  productName,
}: ProductImagePreviewDialogProps) {
  const { locale } = useI18n();
  const zh = locale === "zh-CN";
  const images = [...new Set([imageUrl, ...imageUrls])];
  const [selectedImage, setSelectedImage] = useState(imageUrl);
  const [zoomed, setZoomed] = useState(false);
  const activeImage = images.includes(selectedImage) ? selectedImage : imageUrl;
  function selectImage(url: string) { setSelectedImage(url); setZoomed(false); }
  function step(direction: number) { selectImage(images[(images.indexOf(activeImage) + direction + images.length) % images.length]); }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pp-storefront-portal pp-product-preview max-w-[calc(100vw-1.5rem)] gap-3 p-3 sm:max-w-3xl">
        <DialogHeader className="pr-10">
          <DialogTitle className="line-clamp-2 text-sm font-black text-slate-950">
            {productName}
          </DialogTitle>
          <DialogDescription>{zh ? "查看商品细节，支持放大查看。" : "Esplora i dettagli e ingrandisci l’immagine."}</DialogDescription>
        </DialogHeader>
        <div className="pp-preview-stage relative h-[min(60dvh,560px)] overflow-hidden rounded-lg bg-white">
          <button type="button" className="pp-preview-zoom" aria-pressed={zoomed} aria-label={zh ? (zoomed ? "缩小图片" : "放大图片") : (zoomed ? "Riduci immagine" : "Ingrandisci immagine")} onClick={() => setZoomed(value => !value)}>
          <Image
            src={activeImage}
            alt={imageAlt}
            fill
            sizes="(max-width: 640px) 92vw, 760px"
            quality={88}
            onError={() => onImageError(activeImage)}
            className="object-contain p-3"
            style={{transform: zoomed ? "scale(1.6)" : undefined}}
          />
          <span className="pp-preview-zoom-icon" aria-hidden="true">{zoomed ? <ZoomOut/> : <ZoomIn/>}</span>
          </button>
          {images.length > 1 ? <><button type="button" className="pp-preview-prev" onClick={() => step(-1)} aria-label={zh ? "上一张图片" : "Immagine precedente"}><ChevronLeft/></button><button type="button" className="pp-preview-next" onClick={() => step(1)} aria-label={zh ? "下一张图片" : "Immagine successiva"}><ChevronRight/></button></> : null}
        </div>
        {images.length > 1 ? <div className="pp-preview-thumbnails" role="group" aria-label={zh ? "商品图片" : "Immagini prodotto"}>{images.map((url,index) => <button type="button" key={url} aria-pressed={url === activeImage} onClick={() => selectImage(url)} aria-label={zh ? `查看第 ${index + 1} 张图片` : `Mostra immagine ${index + 1}`}><Image src={url} alt="" fill sizes="86px" className="object-contain p-2" onError={() => onImageError(url)}/></button>)}</div> : null}
        <p className="pp-preview-hint"><ZoomIn aria-hidden="true"/>{zh ? "点击图片可放大查看。图片仅供参考，以实物为准。" : "Tocca per ingrandire. Le immagini sono indicative."}</p>
      </DialogContent>
    </Dialog>
  );
}
