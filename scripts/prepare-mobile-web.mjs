import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDir, "..");
const mobileOutput = path.join(repositoryRoot, "apps", "web", "public", "__mobile");
const indexPath = path.join(mobileOutput, "index.html");

const desktopReturnScript = `<script>(function(){try{if(window.matchMedia("(min-width: 768px)").matches){document.cookie="erp_mobile_ui=; Path=/; Max-Age=0; SameSite=Lax";window.location.reload()}}catch(e){}})()</script>`;

let html = await readFile(indexPath, "utf8");
html = html
  .replaceAll('src="/_expo/', 'src="/__mobile/_expo/')
  .replaceAll('href="/_expo/', 'href="/__mobile/_expo/')
  .replace("</head>", `${desktopReturnScript}\n</head>`);

await writeFile(indexPath, html, "utf8");
