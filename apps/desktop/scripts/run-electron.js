const { spawnSync } = require("child_process");

const cliPath = require.resolve("electron/cli.js");
const result = spawnSync(process.execPath, [cliPath, ...process.argv.slice(2)], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
