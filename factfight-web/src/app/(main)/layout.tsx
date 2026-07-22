import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AuthenticatedAppShell } from "@/components/navigation/authenticated-app-shell";
import { getVerifiedSession } from "@/lib/auth/verified-session";
import { getPublicProfile } from "@/lib/api/discovery";

export default async function MainLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await getVerifiedSession();
  if (!session.ok) redirect("/login");

  const profile = await getPublicProfile(session.userId);

  return (
    <AuthenticatedAppShell
      profile={{
        displayName: profile?.displayName ?? "FactFight",
        username: profile?.username ?? "",
        avatarUrl: profile?.avatarUrl ?? null,
      }}
    >
      {children}
    </AuthenticatedAppShell>
  );
}
