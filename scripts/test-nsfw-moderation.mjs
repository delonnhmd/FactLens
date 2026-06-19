import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = mkdtempSync(path.join(tmpdir(), "verifact-nsfw-"));
const tscBin = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");

try {
  execFileSync(
    process.execPath,
    [
      tscBin,
      "--ignoreConfig",
      "utils/nsfwModeration.ts",
      "utils/claimQuality.ts",
      "utils/contentValidation.ts",
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
  const { moderateNsfwContent } = requireFromBuild("./utils/nsfwModeration.js");
  const { analyzeClaimDraft } = requireFromBuild("./utils/claimQuality.js");
  const { validateClaimContent } = requireFromBuild("./utils/contentValidation.js");

  const cases = [
    {
      title: "The Great Wall of China is visible from the Moon with the naked eye.",
      blocked: false,
    },
    {
      title: "Visible to the naked eye",
      blocked: false,
    },
    {
      title: "naked mole rat populations increased in the zoo",
      blocked: false,
    },
    {
      title: "nude photo",
      blocked: true,
    },
    {
      title: "porn video",
      blocked: true,
    },
    {
      title: "naked body",
      blocked: true,
    },
  ];

  for (const testCase of cases) {
    const moderation = moderateNsfwContent(testCase.title);
    const draft = analyzeClaimDraft({
      title: testCase.title,
      description: "Source context.",
      sourceUrl: "https://example.com",
      category: "Science",
    });
    const validation = validateClaimContent({
      title: testCase.title,
      description: "Source context.",
      sourceUrl: "https://example.com",
      category: "Science",
    });

    assert.equal(
      moderation.blocked,
      testCase.blocked,
      `${testCase.title} moderation.blocked should be ${testCase.blocked}`,
    );
    assert.equal(
      draft.canSubmit,
      !testCase.blocked,
      `${testCase.title} draft canSubmit should be ${!testCase.blocked}`,
    );
    assert.equal(
      validation.ok,
      !testCase.blocked,
      `${testCase.title} form validation ok should be ${!testCase.blocked}`,
    );

    if (moderation.blocked) {
      assert.ok(
        moderation.confidence >= 0.95,
        `${testCase.title} blocked confidence should be at least 0.95`,
      );
    }
  }

  console.log("NSFW moderation regression tests passed.");
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
