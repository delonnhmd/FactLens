// Build the static FactLens landing page for factlens.pennyfloat.com.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const source = join(repoRoot, "client", "landing", "index.html");
const destination = join(repoRoot, "dist", "index.html");

mkdirSync(dirname(destination), { recursive: true });
copyFileSync(source, destination);

console.log("Landing page built:", destination);
