import { fileURLToPath } from "node:url";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "../..");
const fixtureRoot = path.join(repoRoot, "acceptance", "fixtures", "kovaaks");
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "refleks-acceptance-"));
const tempProfile = path.join(tempRoot, "profile");
const tempHome = path.join(tempRoot, "home");
const verifyIsolation = process.argv[2] === "--verify-isolation";
const probePath = path.join(tempProfile, "isolation-probe.txt");
const command = verifyIsolation ? process.execPath : (process.argv[2] ?? "wails");
const args = verifyIsolation
  ? [
      "-e",
      `const fs=require("node:fs");const path=require("node:path");const root=process.env.REFLEKS_ACCEPTANCE_TEMP_ROOT;const profile=process.env.USERPROFILE;const home=process.env.HOME;if(!profile.startsWith(root)||!home.startsWith(root))process.exit(2);if(process.env.REFLEKS_KOVAAKS_INSTALL_DIR!==${JSON.stringify(fixtureRoot)})process.exit(3);if(!process.env.REFLEKS_STEAM_ID||!process.env.REFLEKS_PERSONA_NAME)process.exit(4);fs.writeFileSync(path.join(profile,"isolation-probe.txt"),"isolated","ascii");`,
    ]
  : process.argv.slice(3);

await Promise.all([
  mkdir(tempProfile, { recursive: true }),
  mkdir(tempHome, { recursive: true }),
]);
await writeFile(
  path.join(tempRoot, "README.txt"),
  "Temporary acceptance profile.\n",
  "ascii",
);

const env = {
  ...process.env,
  USERPROFILE: tempProfile,
  HOME: tempHome,
  REFLEKS_KOVAAKS_INSTALL_DIR: fixtureRoot,
  REFLEKS_STEAM_ID: "76561190000000000",
  REFLEKS_PERSONA_NAME: "Acceptance Fixture",
  REFLEKS_ACCEPTANCE_TEMP_ROOT: tempRoot,
};

console.log(JSON.stringify({ tempRoot, fixtureRoot, command, args }, null, 2));
const child = spawn(command, args, {
  cwd: repoRoot,
  env,
  stdio: "inherit",
  shell: process.platform === "win32" && !verifyIsolation,
});

const cleanup = async () => {
  await rm(tempRoot, { recursive: true, force: true });
};

process.on("SIGINT", async () => {
  child.kill("SIGINT");
  await cleanup();
  process.exit(130);
});

const { code, signal } = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (exitCode, exitSignal) =>
    resolve({ code: exitCode, signal: exitSignal }),
  );
});

if (verifyIsolation && code === 0) {
  const probe = await readFile(probePath, "ascii");
  if (probe !== "isolated") throw new Error("isolation probe was not written");
  console.log("acceptance isolation verified");
}

await cleanup();
if (signal) process.kill(process.pid, signal);
process.exit(code ?? 1);
