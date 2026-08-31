import type { Metadata } from "next";
import "./globals.css";
import { LocalizationProvider } from "./i18n";

export const metadata: Metadata = {
  title: "Maglucen · Stardew Valley Companion",
  description: "A private local companion that reads your Stardew Valley save without modifying it.",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body><LocalizationProvider>{children}</LocalizationProvider></body></html>;
}
