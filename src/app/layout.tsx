import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "./globals.css";
import { I18nProvider } from "@/i18n/client";
import { dictFor, getLocale } from "@/i18n/server";
import { dirOf } from "@/i18n/core";
import { appUrl } from "@/server/urls";

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(appUrl()),
    title: { default: "EVNT — Everything for your kids. One destination.", template: "%s · EVNT" },
    description: "Discover, book and enjoy the best kids' activities, birthdays, family restaurants and shopping in Lebanon.",
    applicationName: "EVNT",
    icons: { icon: "/brand/icon.svg" },
    openGraph: { siteName: "EVNT", type: "website", images: [{ url: "/brand/og-family.jpg", width: 1200, height: 630 }] },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dict = await dictFor(locale);
  return (
    <html lang={locale} dir={dirOf(locale)}>
      <body>
        <I18nProvider locale={locale} dict={dict}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
