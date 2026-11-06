import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MeProvider } from "@/components/MeProvider";
import "@near-wallet-selector/modal-ui/styles.css";
import "./globals.css";

const plex = IBM_Plex_Sans({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://privue-app.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Privue: private trades, public track records", template: "%s · Privue" },
  description:
    "Traders keep every trade private, publish a verified track record, and sell a limited number of passes to watch or blind-copy them. Built on NEAR Intents and NEAR AI.",
  openGraph: { siteName: "Privue", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#0c0e13" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plex.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <MeProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </MeProvider>
      </body>
    </html>
  );
}
