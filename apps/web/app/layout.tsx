import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Supplying — Inventory Operations",
  description: "Human-approved inventory operations for modern cafés.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#173f35",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
