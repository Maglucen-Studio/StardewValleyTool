import type { Metadata } from "next";
import "./globals.css";
import { LocalizationProvider, type SupportedAppLanguage } from "./i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Maglucen · Stardew Valley Companion",
  description: "A private local companion that reads your Stardew Valley save without modifying it.",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const initialLanguage: SupportedAppLanguage =
    process.env.STARDEW_TOOL_LANGUAGE === "es" ? "es" : "en";
  return (
    <html lang={initialLanguage} suppressHydrationWarning>
      <body>
        <LocalizationProvider initialLanguage={initialLanguage}>{children}</LocalizationProvider>
      </body>
    </html>
  );
}
