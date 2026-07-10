export type ModerationBlocklistCategory = "VIOLENCE" | "SEXUAL" | "HARASSMENT";

export interface ModerationBlocklistEntry {
  phrase: string;
  category: ModerationBlocklistCategory;
}

export const MODERATION_BLOCKLIST: ModerationBlocklistEntry[] = [
  { phrase: "kill yourself", category: "VIOLENCE" },
  { phrase: "go die", category: "VIOLENCE" },
  { phrase: "end your life", category: "VIOLENCE" },
  { phrase: "hang yourself", category: "VIOLENCE" },
  { phrase: "drink bleach", category: "VIOLENCE" },
  { phrase: "slit your wrists", category: "VIOLENCE" },
  { phrase: "jump off a bridge", category: "VIOLENCE" },
  { phrase: "commit suicide", category: "VIOLENCE" },
  { phrase: "will kill you", category: "VIOLENCE" },
  { phrase: "going to shoot", category: "VIOLENCE" },
  { phrase: "stab you", category: "VIOLENCE" },
  { phrase: "murder you", category: "VIOLENCE" },
  { phrase: "hunt you down", category: "VIOLENCE" },
  { phrase: "track your house", category: "VIOLENCE" },
  { phrase: "slit your throat", category: "VIOLENCE" },
  { phrase: "beat you to death", category: "VIOLENCE" },
  { phrase: "bomb", category: "VIOLENCE" },
  { phrase: "terrorism", category: "VIOLENCE" },
  { phrase: "massacre", category: "VIOLENCE" },
  { phrase: "assassinate", category: "VIOLENCE" },
  { phrase: "shooting up the", category: "VIOLENCE" },
  { phrase: "pipe bomb", category: "VIOLENCE" },
  { phrase: "detonate", category: "VIOLENCE" },
  { phrase: "blow up", category: "VIOLENCE" },
  { phrase: "decapitate", category: "VIOLENCE" },
  { phrase: "slaughter", category: "VIOLENCE" },
  { phrase: "execute", category: "VIOLENCE" },
  { phrase: "mutilate", category: "VIOLENCE" },
  { phrase: "torture", category: "VIOLENCE" },
  { phrase: "child porn", category: "SEXUAL" },
  { phrase: "cp", category: "SEXUAL" },
  { phrase: "pedophile", category: "SEXUAL" },
  { phrase: "pedo", category: "SEXUAL" },
  { phrase: "underage sex", category: "SEXUAL" },
  { phrase: "loli", category: "SEXUAL" },
  { phrase: "rape", category: "SEXUAL" },
  { phrase: "molest", category: "SEXUAL" },
  { phrase: "forced sex", category: "SEXUAL" },
  { phrase: "non-consensual", category: "SEXUAL" },
  { phrase: "sexual assault", category: "SEXUAL" },
  { phrase: "fuck", category: "SEXUAL" },
  { phrase: "dick", category: "SEXUAL" },
  { phrase: "pussy", category: "SEXUAL" },
  { phrase: "cock", category: "SEXUAL" },
  { phrase: "tits", category: "SEXUAL" },
  { phrase: "bitch", category: "SEXUAL" },
  { phrase: "slut", category: "SEXUAL" },
  { phrase: "whore", category: "SEXUAL" },
  { phrase: "cum", category: "SEXUAL" },
  { phrase: "horny", category: "SEXUAL" },
  { phrase: "nigger", category: "HARASSMENT" },
  { phrase: "faggot", category: "HARASSMENT" },
  { phrase: "kike", category: "HARASSMENT" },
  { phrase: "chink", category: "HARASSMENT" },
  { phrase: "spic", category: "HARASSMENT" },
  { phrase: "tranny", category: "HARASSMENT" },
  { phrase: "retard", category: "HARASSMENT" },
  { phrase: "subhuman", category: "HARASSMENT" },
  { phrase: "go back to your country", category: "HARASSMENT" },
  { phrase: "worthless piece of", category: "HARASSMENT" },
  { phrase: "piece of shit", category: "HARASSMENT" },
  { phrase: "motherfucker", category: "HARASSMENT" },
  { phrase: "die slow", category: "HARASSMENT" },
  { phrase: "waste of space", category: "HARASSMENT" },
  { phrase: "hope you get cancer", category: "HARASSMENT" },
  { phrase: "kill your family", category: "HARASSMENT" },
  { phrase: "trash", category: "HARASSMENT" },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeBlocklistPhrase(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MATCHERS = MODERATION_BLOCKLIST.map((entry) => {
  const normalizedPhrase = normalizeBlocklistPhrase(entry.phrase);

  return {
    ...entry,
    matcher: new RegExp(`(?:^|\\s)${escapeRegExp(normalizedPhrase)}(?=$|\\s)`),
  };
});

export function findModerationBlocklistMatch(normalizedText: string): ModerationBlocklistEntry | null {
  const match = MATCHERS.find((entry) => entry.matcher.test(normalizedText));

  return match ? { phrase: match.phrase, category: match.category } : null;
}
