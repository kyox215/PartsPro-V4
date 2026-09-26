import Image, { type ImageProps } from "next/image";
import { canOptimizeImage } from "@/lib/partspro-image-policy.mjs";

// Existing supplier/external links remain usable without widening the optimizer's
// remote allowlist. Local and approved public product images get responsive sizes.
export default function OptimizedImage(props: ImageProps) {
  return (
    <Image
      {...props}
      alt={props.alt}
      unoptimized={props.unoptimized ?? !canOptimizeImage(
        props.src,
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://yiuxrjqexlfjtxxrkqvi.supabase.co"
      )}
    />
  );
}
