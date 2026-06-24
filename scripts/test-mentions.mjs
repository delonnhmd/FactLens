import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const outDir = path.join(process.cwd(), ".tmp", "mentions-test");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
process.on("exit", () => {
  rmSync(outDir, { recursive: true, force: true });
});

execFileSync(
  process.execPath,
  [
    path.join("node_modules", "typescript", "bin", "tsc"),
    "--ignoreConfig",
    "--ignoreDeprecations",
    "6.0",
    "--target",
    "ES2020",
    "--module",
    "commonjs",
    "--moduleResolution",
    "node",
    "--skipLibCheck",
    "--outDir",
    outDir,
    path.join("utils", "mentions.ts"),
  ],
  { stdio: "inherit" },
);

const require = createRequire(import.meta.url);
const compiledPath = [
  path.join(outDir, "mentions.js"),
  path.join(outDir, "utils", "mentions.js"),
].find((candidate) => existsSync(candidate));

assert.ok(compiledPath, "Could not find compiled mentions helper.");

const {
  CLAIM_MENTION_LIMIT,
  EVIDENCE_MENTION_LIMIT,
  countUniqueMentions,
  extractMentionUsernames,
  getMentionLimitError,
} = require(compiledPath);

assert.deepEqual(extractMentionUsernames("@Ada @reuters @ada"), ["ada", "reuters"]);
assert.deepEqual(extractMentionUsernames("hello @one @two @three", 2), ["one", "two"]);
assert.equal(countUniqueMentions("@one @two @two"), 2);
assert.equal(getMentionLimitError("@one @two @three", EVIDENCE_MENTION_LIMIT, "Evidence note"), "");
assert.equal(
  getMentionLimitError("@one @two @three @four", EVIDENCE_MENTION_LIMIT, "Evidence note"),
  "Evidence note can include up to 3 @mentions.",
);
assert.equal(CLAIM_MENTION_LIMIT, 5);

console.log("Mention utility tests passed.");
