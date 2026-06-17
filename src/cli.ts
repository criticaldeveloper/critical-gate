#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function main(argv = process.argv.slice(2)): number {
  if (argv.includes("--version")) {
    console.log("critical-gate 0.1.0");
    return 0;
  }

  console.log("critical-gate repository setup complete");
  return 0;
}

const isDirectRun =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectRun) {
  process.exitCode = main();
}
