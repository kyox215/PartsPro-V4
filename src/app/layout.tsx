import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartSyncBridge } from "@/components/partspro/cart-sync-bridge";
import { I18nProvider } from "@/components/partspro/i18n-provider";
import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestI18n } from "@/i18n/request";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestI18n();
  const dictionary = getDictionary(locale);

  return {
    title: dictionary["metadata.title"],
    description: dictionary["metadata.description"],
    openGraph: {
      locale,
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
          <TooltipProvider delayDuration={120}>{children}</TooltipProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
