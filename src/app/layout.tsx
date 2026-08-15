import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteDescription =
  "B-ZENITH restaurant, café, bar and lounge point of sale. Good food, great drinks, better moments.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000"),
  title: {
    default: "B-ZENITH POS",
    template: "%s | B-ZENITH POS",
  },
  description: siteDescription,
  applicationName: "B-ZENITH POS",
  manifest: "/manifest.webmanifest",
  keywords: ["B-ZENITH", "restaurant", "café", "bar", "lounge", "POS"],
  icons: {
    icon: [
      { url: "/icons/bzenith-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/bzenith-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "B-ZENITH",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "B-ZENITH POS",
    description: siteDescription,
    siteName: "B-ZENITH",
    locale: "en_RW",
    type: "website",
    images: [
      {
        url: "/brand/bzenith-logo.png",
        width: 1024,
        height: 1024,
        alt: "B-ZENITH restaurant, café, bar and lounge",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "B-ZENITH POS",
    description: siteDescription,
    images: [
      {
        url: "/brand/bzenith-logo.png",
        alt: "B-ZENITH restaurant, café, bar and lounge",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
