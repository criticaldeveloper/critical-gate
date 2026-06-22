import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function isCliEntrypoint(importMetaUrl: string, argvPath = process.argv[1]): boolean {
  return (
    argvPath !== undefined &&
    normalizeExecutablePath(fileURLToPath(importMetaUrl)) === normalizeExecutablePath(argvPath)
  );
}

function normalizeExecutablePath(path: string): string {
  let normalized = resolve(path);

  try {
    normalized = realpathSync.native(normalized);
  } catch {
    // Fall back to the resolved path when the target is virtual or has already been removed.
  }

  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}
