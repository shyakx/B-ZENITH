import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "B-ZENITH",
  description: "B-ZENITH bar and hospitality POS",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dmSans.variable} ${playfair.variable} h-full antialiased`}>
      <body className="min-h-full w-full max-w-full bg-zenith-bg text-zenith-cream">{children}</body>
    </html>
  );
}
