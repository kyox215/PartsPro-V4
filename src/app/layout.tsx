import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartSyncBridge } from "@/components/partspro/cart-sync-bridge";
import { I18nProvider } from "@/components/partspro/i18n-provider";
import { SupportWidget } from "@/components/partspro/support-widget";
import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestI18n } from "@/i18n/request";
import { getPartsProSiteUrl } from "@/lib/partspro-site-url";
import "./globals.css";

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
      statusBarStyle: "black-translucent",
      title: "PartsPro",
    },
    title,
    description,
    icons: {
      apple: "/pwa/icon-192.png",
      icon: "/pwa/icon-192.png",
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
        <I18nProvider locale={locale} scope={scope} dictionary={dictionary}>
          <CartSyncBridge />
          <SupportWidget />
          <TooltipProvider delayDuration={120}>{children}</TooltipProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
