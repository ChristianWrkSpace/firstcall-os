#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";

const MAX_BATCH = 25;
const RUNNER_ENV = "FIRSTCALL_RECONCILE_RUNNER";

function usage() {
  return [
    "Usage: node scripts/reconcile-account-active-transitions.mjs [--dry-run|--apply] [--limit=N]",
    "",
    "Defaults to --dry-run. --apply is required to mutate provider or database state.",
  ].join("\n");
}

export function parseArgs(args) {
  let apply = false;
  let modeSeen = null;
  let limit = MAX_BATCH;
  for (const arg of args) {
    if (arg === "--help" || arg === "-h") return { help: true, apply, limit };
    if (arg === "--apply" || arg === "--dry-run") {
      const mode = arg.slice(2);
      if (modeSeen && modeSeen !== mode) throw new Error("Choose exactly one of --dry-run or --apply.");
      modeSeen = mode;
      apply = mode === "apply";
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const value = Number(arg.slice("--limit=".length));
      if (!Number.isInteger(value) || value < 1 || value > MAX_BATCH) {
        throw new Error(`--limit must be an integer from 1 to ${MAX_BATCH}.`);
      }
      limit = value;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { help: false, apply, limit };
}

async function run() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid arguments.");
    console.error(usage());
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    console.log(usage());
    return;
  }

  // `server-only` is fail-closed outside React's server condition. Re-exec the
  // exact same local script with that condition before importing orchestration.
  if (process.env[RUNNER_ENV] !== "1") {
    const child = spawnSync(
      process.execPath,
      ["--conditions=react-server", import.meta.filename, ...process.argv.slice(2)],
      {
        stdio: "inherit",
        env: { ...process.env, [RUNNER_ENV]: "1" },
      }
    );
    process.exitCode = child.status ?? 1;
    return;
  }

  try {
    const { reconcileAccountActiveTransitions } = await import(
      "../lib/account-active-transitions.ts"
    );
    const summary = await reconcileAccountActiveTransitions({
      apply: options.apply,
      limit: options.limit,
    });
    console.log(JSON.stringify(summary, null, 2));
    if (summary.errors > 0) process.exitCode = 1;
  } catch {
    console.error("Account transition reconciliation failed.");
    process.exitCode = 1;
  }
}

await run();
