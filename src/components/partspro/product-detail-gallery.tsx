"use client";

import { useMemo, useState } from "react";
import { ZoomIn } from "lucide-react";
import type { PartProduct } from "@/lib/partspro-data";
import { getProductImageCandidates } from "@/lib/partspro-product-images";
import { txFormat } from "@/i18n/dictionaries/storefront";
import Image from "./optimized-image";
import { useT } from "./i18n-provider";
import { PartVisual } from "./part-visual";
import { ProductImagePreviewDialog } from "./product-image-preview-dialog";

export function ProductDetailGallery({ product }: { product: PartProduct }) {
  const t = useT();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const candidates = useMemo(() => getProductImageCandidates(product), [product]);
  const primaryImage = candidates.find((url) => !failedImages.includes(url));
  const images = [...new Set([primaryImage, ...(product.galleryImageUrls ?? [])])]
    .filter((url): url is string => typeof url === "string" && !failedImages.includes(url));
  const activeImage = selectedImage && images.includes(selectedImage) ? selectedImage : images[0];
  const imageAlt = product.imageAlt || product.name;

  function markFailed(url: string) {
    setFailedImages((current) => current.includes(url) ? current : [...current, url]);
  }

  return (
    <div className="pp-product-gallery-view">
      {images.length > 1 ? (
        <div className="pp-gallery-thumbnails" role="group" aria-label={txFormat(t, "storefront.ui.product.photos", "Immagini di {name}", { name: product.name })}>
          {images.map((url, index) => (
            <button
              type="button"
              key={url}
              className="pp-gallery-thumbnail"
              aria-pressed={url === activeImage}
              aria-label={txFormat(t, "storefront.ui.product.photo", "Mostra immagine {number}", { number: index + 1 })}
              onClick={() => setSelectedImage(url)}
            >
              <Image src={url} alt="" fill sizes="76px" quality={55} className="object-contain p-2" onError={() => markFailed(url)} />
            </button>
          ))}
        </div>
      ) : null}
      {activeImage ? (
        <button
          type="button"
          className="pp-gallery-main"
          aria-haspopup="dialog"
          aria-label={txFormat(t, "storefront.product.card.previewImageAria", "Apri anteprima immagine {name}", { name: product.name })}
          onClick={() => setPreviewOpen(true)}
        >
          <Image src={activeImage} alt={imageAlt} fill sizes="(max-width: 767px) 90vw, (max-width: 1200px) 45vw, 600px" quality={88} fetchPriority="high" loading="eager" className="object-contain" onError={() => markFailed(activeImage)} />
          <span className="pp-gallery-zoom" aria-hidden="true"><ZoomIn className="size-4" /></span>
        </button>
      ) : <PartVisual variant={product.visual} className="pp-gallery-fallback" />}
      {activeImage && previewOpen ? (
        <ProductImagePreviewDialog imageAlt={imageAlt} imageUrl={activeImage} onImageError={() => markFailed(activeImage)} onOpenChange={setPreviewOpen} open={previewOpen} productName={product.name} />
      ) : null}
    </div>
  );
}
