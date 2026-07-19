import { z } from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url().refine(
    (value) => new URL(value).hostname.toLowerCase().endsWith(".supabase.co"),
    "Must be the Supabase project URL.",
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(1),
  NEXT_PUBLIC_RENDER_BACKEND_URL: z.url(),
  NEXT_PUBLIC_SITE_URL: z.url(),
});

const result = publicEnvironmentSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_RENDER_BACKEND_URL: process.env.NEXT_PUBLIC_RENDER_BACKEND_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

if (!result.success) {
  const invalidNames = [...new Set(result.error.issues.map((issue) => issue.path[0]))]
    .filter((name): name is string => typeof name === "string")
    .join(", ");

  throw new Error(
    `Missing or invalid public environment configuration: ${invalidNames || "unknown variable"}.`,
  );
}

export const publicEnvironment = Object.freeze({
  supabaseUrl: result.data.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: result.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  renderBackendUrl: result.data.NEXT_PUBLIC_RENDER_BACKEND_URL,
  siteUrl: result.data.NEXT_PUBLIC_SITE_URL,
});
