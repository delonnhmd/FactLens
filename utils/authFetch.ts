// Shared 401 recovery for authenticated backend calls. A 401 on a request
// that was built with a token the client believed was valid usually means
// the token went stale (e.g. autoRefreshToken's timer stalled while the app
// was backgrounded) rather than the user actually being signed out. Retry
// once with a freshly refreshed token before treating the caller as logged
// out, matching Supabase's recommended reactive-refresh pattern.
import { supabase } from "../lib/supabase";

export async function fetchWithAuthRetry(
  url: string,
  buildInit: (accessToken: string) => RequestInit,
  accessToken: string,
): Promise<Response> {
  const response = await fetch(url, buildInit(accessToken));

  if (response.status !== 401) {
    return response;
  }

  const { data, error } = await supabase.auth.refreshSession();
  const refreshedToken = data.session?.access_token;

  if (error || !refreshedToken) {
    return response;
  }

  return fetch(url, buildInit(refreshedToken));
}
