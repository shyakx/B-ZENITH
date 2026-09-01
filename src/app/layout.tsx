import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const title = "B-ZENITH | Restaurant, Bar & Cafe POS";
const description = "B-ZENITH restaurant, bar and cafe POS and inventory management.";

export const metadata: Metadata = {
  applicationName: "B-ZENITH",
  title: {
    default: title,
    template: "%s | B-ZENITH",
  },
  description,
  metadataBase: new URL("https://b-zenith.vercel.app"),
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/brand/logo.png", type: "image/png" }],
    apple: [{ url: "/brand/logo.png" }],
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
    siteName: "B-ZENITH",
    type: "website",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#3d2314",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmSans.className} h-full antialiased`}>
      <body className="min-h-full w-full max-w-full bg-zenith-bg text-zenith-cream">{children}</body>
    </html>
  );
}
