import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "BorderPulse — Live Border Wait Times",
  description:
    "Real-time US-Mexico border crossing wait times, predictions, and best-time suggestions.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BorderPulse",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#060E1A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppShell>{children}</AppShell>
        <Analytics />
      </body>
    </html>
  );
}
