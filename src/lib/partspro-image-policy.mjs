export function productImageRemotePatterns(supabaseUrl) {
  return [
    { protocol: "https", hostname: new URL(supabaseUrl).hostname, port: "", pathname: "/storage/v1/object/public/product-images/**" },
    { protocol: "https", hostname: "apiv2.mobilax.fr", port: "", pathname: "/v1.0/assets/images/products/id-image/**" },
  ];
}

export function canOptimizeImage(src, supabaseUrl) {
  if (typeof src !== "string") return true;
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  try {
    const url = new URL(src);
    return productImageRemotePatterns(supabaseUrl).some((pattern) =>
      url.protocol === `${pattern.protocol}:` && url.hostname === pattern.hostname &&
      url.port === pattern.port && !url.username && !url.password &&
      url.pathname.startsWith(pattern.pathname.slice(0, -2))
    );
  } catch {
    return false;
  }
}
