const productImagesBucket = "product-images";
const defaultSupabaseUrl = "https://yiuxrjqexlfjtxxrkqvi.supabase.co";
const mobilaxImageBaseUrl =
  "https://apiv2.mobilax.fr/v1.0/assets/images/products/id-image";

type ProductImageSource = {
  galleryImagePaths?: readonly (string | null | undefined)[];
  galleryImageUrls?: readonly (string | null | undefined)[];
  imagePath?: string | null;
  imageUrl?: string | null;
};

export function resolveProductImageUrl(value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  const supabaseUrl = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? defaultSupabaseUrl
  ).replace(/\/+$/, "");
  const publicPrefix = `${supabaseUrl}/storage/v1/object/public/${productImagesBucket}/`;

  return `${publicPrefix}${normalized.replace(/^\/+/, "")}`;
}

export function getExternalProductImageFallbackUrl(
  value: string | null | undefined
) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  const directApiMatch = normalized.match(/\/id-image\/(\d+)(?:$|[?#/])/i);
  const importedAssetMatch = normalized.match(
    /-(\d+)\.(?:png|jpe?g|webp|gif)(?:$|[?#])/i
  );
  const imageId = directApiMatch?.[1] ?? importedAssetMatch?.[1];

  return imageId ? `${mobilaxImageBaseUrl}/${imageId}?size=bg` : null;
}

export function getProductImageCandidates(source: ProductImageSource) {
  const rawValues = [
    source.imageUrl,
    source.imagePath,
    ...(source.galleryImageUrls ?? []),
    ...(source.galleryImagePaths ?? []),
  ];
  const candidates = rawValues.flatMap((value) => {
    const resolved = resolveProductImageUrl(value);
    const externalFallback = getExternalProductImageFallbackUrl(value);
    const resolvedExternalFallback = getExternalProductImageFallbackUrl(resolved);

    return [resolved, externalFallback, resolvedExternalFallback];
  });

  return Array.from(
    new Set(candidates.filter((value): value is string => Boolean(value)))
  );
}
