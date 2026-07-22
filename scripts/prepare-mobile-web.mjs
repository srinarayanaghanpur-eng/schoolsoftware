import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDir, "..");
const mobileOutput = path.join(repositoryRoot, "apps", "web", "public", "__mobile");
const indexPath = path.join(mobileOutput, "index.html");

// Device detection now lives entirely in the Next.js middleware (server-side,
// User-Agent based), so no client-side cookie/redirect script is injected here.
// This script only rewrites the exported asset paths to their /__mobile prefix.
let html = await readFile(indexPath, "utf8");
html = html
  .replaceAll('src="/_expo/', 'src="/__mobile/_expo/')
  .replaceAll('href="/_expo/', 'href="/__mobile/_expo/');

await writeFile(indexPath, html, "utf8");
