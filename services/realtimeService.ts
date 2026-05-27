// PHASE 3 STEP 12
import { supabase } from "../lib/supabase";

export type RealtimeStatus = "active" | "error" | "closed";

export interface RealtimeChangePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE" | string;
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
  schema?: string;
  table?: string;
  errors?: string[] | null;
}

export type RealtimeChannelRef = ReturnType<typeof supabase.channel>;

type RealtimeTable = "claims" | "votes" | "evidence" | "reports";
type RealtimeChangeHandler = (payload: RealtimeChangePayload) => void;
type RealtimeStatusHandler = (status: RealtimeStatus) => void;

function makeChannelName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function subscribeToTableChanges(
  channelName: string,
  table: RealtimeTable,
  onChange: RealtimeChangeHandler,
  onStatus?: RealtimeStatusHandler,
  filter?: string,
): RealtimeChannelRef {
  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        ...(filter ? { filter } : {}),
      },
      (payload) => {
        onChange(payload as RealtimeChangePayload);
      },
    )
    .subscribe((status, error) => {
      if (status === "SUBSCRIBED") {
        onStatus?.("active");
        return;
      }

      if (status === "CLOSED") {
        onStatus?.("closed");
        return;
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || error) {
        console.warn(`Realtime subscription failed for ${table}.`, error);
        onStatus?.("error");
      }
    });

  return channel;
}

export function subscribeToClaims(
  onChange: RealtimeChangeHandler,
  onStatus?: RealtimeStatusHandler,
): RealtimeChannelRef {
  return subscribeToTableChanges(makeChannelName("claims-feed"), "claims", onChange, onStatus);
}

export function subscribeToClaimById(
  claimId: string,
  onChange: RealtimeChangeHandler,
  onStatus?: RealtimeStatusHandler,
): RealtimeChannelRef {
  return subscribeToTableChanges(
    makeChannelName(`claim-${claimId}`),
    "claims",
    onChange,
    onStatus,
    `id=eq.${claimId}`,
  );
}

export function subscribeToVotesForClaim(
  claimId: string,
  onChange: RealtimeChangeHandler,
  onStatus?: RealtimeStatusHandler,
): RealtimeChannelRef {
  return subscribeToTableChanges(
    makeChannelName(`votes-${claimId}`),
    "votes",
    onChange,
    onStatus,
    `claim_id=eq.${claimId}`,
  );
}

export function subscribeToEvidenceForClaim(
  claimId: string,
  onChange: RealtimeChangeHandler,
  onStatus?: RealtimeStatusHandler,
): RealtimeChannelRef {
  return subscribeToTableChanges(
    makeChannelName(`evidence-${claimId}`),
    "evidence",
    onChange,
    onStatus,
    `claim_id=eq.${claimId}`,
  );
}

export function subscribeToReportsForClaim(
  claimId: string,
  onChange: RealtimeChangeHandler,
  onStatus?: RealtimeStatusHandler,
): RealtimeChannelRef {
  return subscribeToTableChanges(
    makeChannelName(`reports-${claimId}`),
    "reports",
    onChange,
    onStatus,
    `claim_id=eq.${claimId}`,
  );
}

export function unsubscribe(channel: RealtimeChannelRef | null | undefined) {
  if (!channel) {
    return;
  }

  void supabase.removeChannel(channel);
}
