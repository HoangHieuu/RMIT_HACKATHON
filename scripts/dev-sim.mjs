// Runs `next dev` or `next build` against SIMULATED TideCloak (no Docker, no Tide network).
//   npm run dev:sim      npm run build:sim
// Sets NEXT_PUBLIC_TIDE_MODE for the child only, so it works the same on Windows, macOS and Linux.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const cmd = process.argv[2] === "build" ? "build" : "dev";
const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
const child = spawn(process.execPath, [next, cmd, "--webpack"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_TIDE_MODE: "simulated" },
});
child.on("exit", (code) => process.exit(code ?? 0));
