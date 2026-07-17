import type { MetadataRoute } from "next";

import { publicEnvironment } from "@/lib/validation/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/claim/", "/topic/"],
      disallow: ["/auth/", "/confirmed", "/feed", "/login", "/signup"],
    },
    sitemap: new URL("/sitemap.xml", publicEnvironment.siteUrl).toString(),
    host: publicEnvironment.siteUrl,
  };
}
