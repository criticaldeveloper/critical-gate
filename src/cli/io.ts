import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { getApiSnapshotOutputDirectory, readGitDiff } from "../index.js";
import type { CliIo } from "./types.js";

export const defaultIo: CliIo = {
  stdout: (message) => console.log(message),
  stderr: (message) => console.error(message),
  writeFile: (path, content) => {
    mkdirSync(getApiSnapshotOutputDirectory(path), { recursive: true });
    writeFileSync(path, content, "utf8");
  },
  now: () => new Date(),
  exists: (path) => existsSync(path),
  readFile: (path) => readFileSync(path, "utf8"),
  chmodFile: (path, mode) => chmodSync(path, mode),
  readDiff: (baseRef, options) => readGitDiff({ baseRef, staged: options?.staged })
};
