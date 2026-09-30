import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: { default: "Data Kepegawaian | Diskominfo Parepare", template: "%s | Data Kepegawaian" },
  description: "Sistem informasi data kepegawaian Dinas Komunikasi dan Informatika Kota Parepare.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", colorScheme: "light dark", themeColor: "#07364c" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id" suppressHydrationWarning><body><ThemeProvider>{children}</ThemeProvider></body></html>;
}
