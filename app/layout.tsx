import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MeProvider } from "@/components/MeProvider";
import { SignInSheet } from "@/components/SignInSheet";
import "@near-wallet-selector/modal-ui/styles.css";
import "./globals.css";

const schibsted = Schibsted_Grotesk({ variable: "--font-schibsted", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://privue-app.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Privue: show the record, sell the view", template: "%s · Privue" },
  description:
    "Copy trading where the trades stay private. Traders publish a record anchored on NEAR and sell a limited number of passes to watch them live, a day late, or copy them blind.",
  openGraph: { siteName: "Privue", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#0e0d0b" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${schibsted.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <MeProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <SignInSheet />
        </MeProvider>
      </body>
    </html>
  );
}
