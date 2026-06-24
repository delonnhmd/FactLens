import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const outDir = path.join(process.cwd(), ".tmp", "contributor-review-test");
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
    path.join("utils", "username.ts"),
  ],
  { stdio: "inherit" },
);

const require = createRequire(import.meta.url);
const compiledPath = [
  path.join(outDir, "username.js"),
  path.join(outDir, "utils", "username.js"),
].find((candidate) => existsSync(candidate));

assert.ok(compiledPath, "Could not find compiled username helper.");

const {
  generateFallbackUsername,
  getReviewSafeUsername,
  isGeneratedPlaceholderUsername,
} = require(compiledPath);

const fallbackUsername = generateFallbackUsername(
  "verifact@example.com",
  "59df4a7a-78ac-4c6e-82a9-498f27a8f857",
);

assert.match(fallbackUsername, /^user_\d{4}$/);
assert.equal(fallbackUsername.includes("verifact"), false);
assert.equal(isGeneratedPlaceholderUsername("verifact_a8f857"), true);
assert.equal(isGeneratedPlaceholderUsername("factlens_abc123"), true);
assert.match(getReviewSafeUsername("verifact_a8f857", "59df4a7a-78ac-4c6e-82a9-498f27a8f857"), /^user_\d{4}$/);
assert.match(getReviewSafeUsername("factlens_abc123", "abc123"), /^user_\d{4}$/);
assert.equal(getReviewSafeUsername("kimho", "abc123"), "kimho");

console.log("Contributor review username tests passed.");
