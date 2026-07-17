import type { MetadataRoute } from "next";

import { getSitemapClaimEntries } from "@/lib/api/claims";
import { getSitemapTopics } from "@/lib/api/topics";
import { publicEnvironment } from "@/lib/validation/env";

export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [claims, topics] = await Promise.all([
    getSitemapClaimEntries().catch(() => []),
    getSitemapTopics().catch(() => []),
  ]);
  const homeUrl = new URL("/", publicEnvironment.siteUrl).toString();

  return [
    {
      url: homeUrl,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: new URL("/privacy", publicEnvironment.siteUrl).toString(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: new URL("/terms", publicEnvironment.siteUrl).toString(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    ...claims.map((claim) => ({
      url: new URL(`/claim/${claim.slug ?? claim.id}`, publicEnvironment.siteUrl).toString(),
      lastModified: claim.updatedAt ? new Date(claim.updatedAt) : undefined,
      changeFrequency: "hourly" as const,
      priority: 0.9,
    })),
    ...topics.map((topic) => ({
      url: new URL(`/topic/${topic.slug}`, publicEnvironment.siteUrl).toString(),
      lastModified: topic.updatedAt ? new Date(topic.updatedAt) : undefined,
      changeFrequency: "daily" as const,
      priority: 0.75,
    })),
  ];
}
