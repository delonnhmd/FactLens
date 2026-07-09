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
  "he need to be killed",
  "he needs to be killed",
  "he should be killed",
  "they should be killed",
  "kill him",
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
  "death threat",
];

const allowedTitles = [
  "The movie character was killed in the story",
  "The bill was killed in committee",
  "The team killed the clock",
  "This policy killed jobs",
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

  for (const title of blockedTitles) {
    const result = checkClaimSafety(title, "");
    assert.equal(result.allowed, false, `${title} should be blocked`);
    assert.equal(result.category, "VIOLENCE", `${title} should be VIOLENCE`);
    assert.ok(result.reason, `${title} should include a reason`);
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
