import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import { AeroBackdrop } from "@/components/aero-backdrop";
import { Providers } from "@/components/providers";
import "./globals.css";

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "Serendipity", template: "%s · Serendipity" },
  description: "Everyone starts connected. You decide what disappears.",
};

export const viewport: Viewport = {
  themeColor: "#8FD8FF",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${openSans.variable} antialiased`}>
      <body className="min-h-dvh">
        <AeroBackdrop />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
