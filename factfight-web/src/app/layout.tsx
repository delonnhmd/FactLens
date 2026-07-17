import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SITE_NAME } from "@/lib/constants/public-site";
import { publicEnvironment } from "@/lib/validation/env";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnvironment.siteUrl),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Community-powered claim verification built around evidence, transparency, and responsible participation.",
  applicationName: SITE_NAME,
  openGraph: {
    siteName: SITE_NAME,
    images: [{ url: "/opengraph-image", alt: "FactFight community verification" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
