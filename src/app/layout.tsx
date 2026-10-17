import { CatalogDirectoryProvider } from "@/components/partspro/catalog-directory-provider";
import type { Metadata, Viewport } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartSyncBridge } from "@/components/partspro/cart-sync-bridge";
import { I18nProvider } from "@/components/partspro/i18n-provider";
import { SupportWidget } from "@/components/partspro/support-widget";
import { PublicSiteAnalytics } from "@/components/partspro/public-site-analytics";
import { StorefrontThemeBoundary } from "@/components/partspro/storefront-theme-boundary";
import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestI18n } from "@/i18n/request";
import { getPartsProSiteUrl } from "@/lib/partspro-site-url";
import "./globals.css";
import "./storefront-ui.css";
import "./catalog-ui.css";
import "./account-ui.css";
import "./commerce-ui.css";
import "./reference-ui.css";

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestI18n();
  const dictionary = getDictionary(locale);
  const title = dictionary["metadata.title"];
  const description = dictionary["metadata.description"];

  return {
    metadataBase: new URL(getPartsProSiteUrl()),
    applicationName: "PartsPro",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "PartsPro",
    },
    title,
    description,
    icons: {
      apple: [
        {
          url: "/pwa/apple-touch-icon.png",
          sizes: "180x180",
          type: "image/png",
        },
      ],
      icon: [
        {
          url: "/pwa/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          url: "/pwa/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    },
    openGraph: {
      description,
      locale: locale === "zh-CN" ? "zh_CN" : "it_IT",
      siteName: "PartsPro",
      title,
      type: "website",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, scope } = await getRequestI18n();
  const dictionary = getDictionary(locale);

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <CatalogDirectoryProvider><I18nProvider locale={locale} scope={scope} dictionary={dictionary}>
          <CartSyncBridge />
          <PublicSiteAnalytics />
          <TooltipProvider delayDuration={120}>
            <StorefrontThemeBoundary>
              {children}
              <SupportWidget />
            </StorefrontThemeBoundary>
          </TooltipProvider>
        </I18nProvider></CatalogDirectoryProvider>
      </body>
    </html>
  );
}
