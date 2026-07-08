// CONTENT SAFETY (NEW, additive) — objectionable-content gate at submission.
// Calls the backend classifier BEFORE a claim is inserted client-side. This is
// SEPARATE from the truth/source AI analysis. Politically neutral: it only
// blocks genuine safety categories (hate/harassment/threats/sexual/spam).
//
// FAIL-OPEN: if the check can't run (no backend URL, no session, network error),
// return not-blocked so a down safety API never stops a user from posting —
// the same guarantee the backend makes. The report flow still catches misses.
import { getBackendUrl } from "../constants/apiConfig";
import { supabase } from "../lib/supabase";

export interface ContentSafetyResult {
  blocked: boolean;
  reason?: string;
  category?: string;
}

export async function checkContentSafety(title: string, description: string): Promise<ContentSafetyResult> {
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    return { blocked: false }; // fail open
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    const response = await fetch(`${backendUrl}/api/claims/safety-check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ title, description }),
    });

    const json = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      safe?: boolean;
      blocked?: boolean;
      reason?: string;
      category?: string;
    };

    // Only a definitive "blocked" (HTTP 400 + blocked:true) stops posting. Any
    // other shape (200 safe, or an unexpected error status) fails open.
    if (response.status === 400 && json.blocked) {
      return {
        blocked: true,
        reason: json.reason || "This content violates our community guidelines and cannot be posted.",
        category: json.category,
      };
    }

    return { blocked: false };
  } catch (error) {
    console.log("[content-safety] check failed — failing open:", error);
    return { blocked: false }; // fail open
  }
}
