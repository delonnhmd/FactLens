// Build the static FactLens landing page for factlens.pennyfloat.com.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const pages = [
  { source: "index.html", destination: join(repoRoot, "dist", "index.html") },
  { source: "privacy.html", destination: join(repoRoot, "dist", "privacy", "index.html") },
  { source: "terms.html", destination: join(repoRoot, "dist", "terms", "index.html") },
  {
    source: "community-guidelines.html",
    destination: join(repoRoot, "dist", "community-guidelines", "index.html"),
  },
  { source: "ai-disclaimer.html", destination: join(repoRoot, "dist", "ai-disclaimer", "index.html") },
];

pages.forEach((page) => {
  const source = join(repoRoot, "client", "landing", page.source);

  mkdirSync(dirname(page.destination), { recursive: true });
  copyFileSync(source, page.destination);
  console.log("Landing page built:", page.destination);
});
