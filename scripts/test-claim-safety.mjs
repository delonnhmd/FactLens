import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = mkdtempSync(path.join(tmpdir(), "verifact-claim-safety-"));
const tscBin = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");

const blockedTitles = [
  // Spec must-block list
  "he need to be killed",
  "he needs to be killed",
  "she should be killed",
  "they deserve to die",
  "kill him",
  "kill her now",
  "someone should shoot him",
  "assassinate the president",
  "hang them all",
  // Additional targeted-threat coverage
  "he should be killed",
  "they should be killed",
  "kill her",
  "kill them",
  "needs to die",
  "should die",
  "shoot him",
  "shoot her",
  "stab him",
  "execute him",
  "assassinate him",
  "hang him",
  "murder him",
  "someone should murder him",
  "death threat",
  // First-person intent
  "I will kill you",
  "we are going to shoot them",
  "going to bomb the place",
  // Normalization / evasion: uppercase, extra spaces, punctuation, contractions
  "HE NEED TO BE KILLED",
  "he    need   to   be   killed",
  "he,need.to!be?killed",
  "I'll kill you",
  "we're going to shoot them",
];

const allowedTitles = [
  // Spec must-allow list
  "The victim was killed according to police.",
  "Was the bill killed in committee?",
  "This policy killed jobs.",
  "The character was killed in the movie.",
  "Did the report accurately state that someone was killed?",
  // Additional legitimate reporting
  "The movie character was killed in the story",
  "The team killed the clock",
  "The senator voted against the border bill.",
  "Did the policy kill 10,000 jobs?",
];

try {
  execFileSync(
    process.execPath,
    [
      tscBin,
      "--ignoreConfig",
      "utils/claimSafety.ts",
      "--target",
      "ES2020",
      "--module",
      "commonjs",
      "--outDir",
      outDir,
      "--skipLibCheck",
      "--esModuleInterop",
    ],
    { cwd: repoRoot, stdio: "inherit" },
  );

  const requireFromBuild = createRequire(path.join(outDir, "test.cjs"));
  const { checkClaimSafety } = requireFromBuild("./claimSafety.js");
  const { MODERATION_BLOCKLIST } = requireFromBuild("./moderationBlocklist.js");

  for (const title of blockedTitles) {
    const result = checkClaimSafety(title, "");
    assert.equal(result.allowed, false, `${title} should be blocked`);
    assert.equal(result.category, "VIOLENCE", `${title} should be VIOLENCE`);
    assert.ok(result.reason, `${title} should include a reason`);
  }

  for (const entry of MODERATION_BLOCKLIST) {
    const result = checkClaimSafety(entry.phrase, "");
    assert.equal(result.allowed, false, `${entry.phrase} should be blocked by the moderation blocklist`);
    assert.equal(result.category, entry.category, `${entry.phrase} should use the blocklist category`);
    assert.ok(result.reason, `${entry.phrase} should include a reason`);
  }

  for (const title of allowedTitles) {
    const result = checkClaimSafety(title, "");
    assert.equal(result.allowed, true, `${title} should be allowed`);
    assert.equal(result.category, null, `${title} should have no category`);
    assert.equal(result.reason, null, `${title} should have no reason`);
  }

  console.log("Claim safety frontend tests passed.");
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
