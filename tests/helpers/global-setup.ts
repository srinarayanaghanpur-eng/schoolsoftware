import { execSync } from "child_process";
import path from "path";

async function globalSetup() {
  const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";
  if (!useEmulator) {
    console.warn("⚠️  Tests should use Firebase Emulator. Set NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true");
  }

  // Seed test data
  console.log("🌱 Seeding test data...");
  try {
    execSync("npx tsx tests/seed/seed-test-data.ts", {
      cwd: path.resolve(__dirname, "../.."),
      stdio: "inherit",
      timeout: 60000,
    });
    console.log("✅ Test data seeded");
  } catch (e) {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  }
}

export default globalSetup;
