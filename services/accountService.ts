// PHASE 5 STEP 2
import { getBackendUrl } from "../constants/apiConfig";
import { supabase } from "../lib/supabase";

export async function deleteCurrentAccount(): Promise<{ ok: boolean; error?: string }> {
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    return { ok: false, error: "Could not delete account right now." };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    return { ok: false, error: "Please log in to delete your account." };
  }

  try {
    const response = await fetch(`${backendUrl}/account`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const json = (await response.json().catch(() => ({}))) as { ok?: boolean; detail?: string; error?: string };

    if (!response.ok || !json.ok) {
      return {
        ok: false,
        error: "Could not delete account right now.",
      };
    }

    await supabase.auth.signOut();
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not delete account right now." };
  }
}
