import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: true,
});

const siteUrl = "https://b-zenith.vercel.app";
const title = "B-ZENITH | Restaurant, Bar & Cafe POS";
const description =
  "B-ZENITH staff POS for restaurant, bar and cafe — take orders, print bills, manage stock and inventory.";

export const metadata: Metadata = {
  applicationName: "B-ZENITH",
  title: {
    default: title,
    template: "%s | B-ZENITH",
  },
  description,
  keywords: [
    "B-ZENITH",
    "Zenith",
    "restaurant POS",
    "bar POS",
    "cafe POS",
    "inventory",
    "Kigali",
  ],
  authors: [{ name: "B-ZENITH" }],
  creator: "B-ZENITH",
  publisher: "B-ZENITH",
  metadataBase: new URL(siteUrl),
  alternates: { canonical: "/" },
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/brand/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "B-ZENITH",
    statusBarStyle: "default",
  },
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: "B-ZENITH",
    locale: "en_RW",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  category: "business",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3d2314" },
    { media: "(prefers-color-scheme: dark)", color: "#3d2314" },
  ],
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmSans.className} h-full antialiased`}>
      <body className="min-h-full w-full max-w-full bg-zenith-bg text-zenith-cream">{children}</body>
    </html>
  );
}
