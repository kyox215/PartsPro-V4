"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { PartProduct } from "@/lib/partspro-data";
import { getProductImageCandidates } from "@/lib/partspro-product-images";
import { cn } from "@/lib/utils";
import { PartVisual } from "./part-visual";

type StorefrontProductImageProps = {
  alt?: string;
  className?: string;
  fallbackClassName?: string;
  imageClassName?: string;
  priority?: boolean;
  product: PartProduct;
  quality?: number;
  sizes: string;
};

export function StorefrontProductImage({
  alt,
  className,
  fallbackClassName,
  imageClassName,
  priority = false,
  product,
  quality = 75,
  sizes,
}: StorefrontProductImageProps) {
  const imageCandidates = useMemo(() => getProductImageCandidates(product), [product]);
  const [failedImageUrls, setFailedImageUrls] = useState<string[]>([]);
  const imageUrl = imageCandidates.find((candidate) => !failedImageUrls.includes(candidate));

  function markImageFailed(failedUrl: string) {
    setFailedImageUrls((current) =>
      current.includes(failedUrl) ? current : [...current, failedUrl]
    );
  }

  if (!imageUrl) {
    return (
      <PartVisual
        variant={product.visual}
        className={cn(className, fallbackClassName)}
      />
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Image
        src={imageUrl}
        alt={alt ?? product.imageAlt ?? product.name}
        fill
        sizes={sizes}
        quality={quality}
        fetchPriority={priority ? "high" : undefined}
        loading={priority ? "eager" : "lazy"}
        onError={() => markImageFailed(imageUrl)}
        className={imageClassName}
      />
    </div>
  );
}
