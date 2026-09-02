import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ActLayer — EU AI Act & GDPR compliance scanner",
  description: "Scan your site for EU AI Act and GDPR/cookie compliance gaps in under a minute, and get the exact fix for each one.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
