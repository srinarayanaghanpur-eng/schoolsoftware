// Permanent hydration guard (BUG-005 class).
// Fails (exit 1) if ANY page logs a hydration warning, across viewports and
// browser-storage states. Fresh profiles hide these bugs — seeded localStorage
// (cached years, selected year, dark theme) reproduces returning users.
// Run: node scripts/hydration-guard.mjs  (or: npm run test:hydration)
// Requires dev server on http://localhost:3000.
import { createRequire } from "module";
const require = createRequire(process.cwd() + "/package.json");
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SEED = {
  "sriNarayana.selectedAcademicYear": JSON.stringify({ id: "seed-year", name: "Seed 2026-27" }),
  "sriNarayana.publicAcademicYears": JSON.stringify({
    years: [{ id: "seed-year", name: "Seed 2026-27", isActive: true }],
    cachedAt: Date.now()
  }),
  "sriNarayana.academicYears": JSON.stringify({
    years: [{ id: "seed-year", name: "Seed 2026-27", isActive: true }],
    cachedAt: Date.now(), expiresAt: Date.now() + 300000
  }),
  "erp-theme": "dark"
};

const CASES = [
  { viewport: { width: 1366, height: 900 }, storage: null, routes: ["/login", "/portal"] },
  { viewport: { width: 390, height: 844 }, storage: null, routes: ["/login", "/portal"] },
  { viewport: { width: 1366, height: 900 }, storage: "seeded", routes: ["/login", "/portal"] },
  { viewport: { width: 390, height: 844 }, storage: "seeded", routes: ["/login", "/portal"] }
];

const browser = await chromium.launch({ headless: true });
let failures = 0;
for (const c of CASES) {
  const ctx = await browser.newContext({ viewport: c.viewport });
  if (c.storage === "seeded") {
    await ctx.addInitScript((seed) => {
      for (const [k, v] of Object.entries(seed)) {
        try { window.localStorage.setItem(k, v); } catch {}
      }
    }, SEED);
  }
  const page = await ctx.newPage();
  for (const route of c.routes) {
    const hits = [];
    const onC = (m) => { if (/hydrat/i.test(m.text())) hits.push(m.text().slice(0, 160)); };
    const onP = (e) => { if (/hydrat/i.test(String(e))) hits.push("pageerror: " + String(e).split("\n")[0].slice(0, 160)); };
    page.on("console", onC);
    page.on("pageerror", onP);
    try {
      await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(12000);
    } catch (e) {
      console.log(`ERROR ${c.viewport.width}/${c.storage}/${route}: nav failed`);
      failures++;
    }
    page.removeListener("console", onC);
    page.removeListener("pageerror", onP);
    if (hits.length) {
      failures++;
      console.log(`FAIL ${c.viewport.width}px/${c.storage}/${route}: ${hits.length} hydration warnings`);
      hits.slice(0, 2).forEach((h) => console.log("   " + h));
    } else {
      console.log(`ok ${c.viewport.width}px/${c.storage}/${route}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(failures ? `\nHYDRATION GUARD: ${failures} FAILURES` : "\nHYDRATION GUARD: PASS");
process.exit(failures ? 1 : 0);
