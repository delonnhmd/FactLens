export const CLAIM_MENTION_LIMIT = 5;
export const EVIDENCE_MENTION_LIMIT = 3;
export const MENTION_PATTERN = /@([a-zA-Z0-9_]+)/g;

export function extractMentionUsernames(text: string, limit = Number.POSITIVE_INFINITY): string[] {
  const matches = text.matchAll(MENTION_PATTERN);
  const usernames: string[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const username = match[1]?.toLowerCase();

    if (!username || seen.has(username)) {
      continue;
    }

    seen.add(username);
    usernames.push(username);

    if (usernames.length >= limit) {
      break;
    }
  }

  return usernames;
}

export function countUniqueMentions(text: string): number {
  return extractMentionUsernames(text).length;
}

export function getMentionLimitError(text: string, limit: number, targetLabel: string): string {
  const mentionCount = countUniqueMentions(text);

  return mentionCount > limit ? `${targetLabel} can include up to ${limit} @mentions.` : "";
}
