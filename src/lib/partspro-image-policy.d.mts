export function productImageRemotePatterns(supabaseUrl: string): Array<{
  protocol: "https";
  hostname: string;
  port: string;
  pathname: string;
}>;
export function canOptimizeImage(src: unknown, supabaseUrl: string): boolean;
