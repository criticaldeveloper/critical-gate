#!/usr/bin/env node

import { isCliEntrypoint } from "./cli/entrypoint.js";
import { main } from "./cli/main.js";
import { ExitCode as ExitCodeValue } from "./cli/types.js";
import type { CheckOptions, CliIo, ExitCode as ExitCodeTypeInternal } from "./cli/types.js";

export { isCliEntrypoint } from "./cli/entrypoint.js";
export { CLI_VERSION, main } from "./cli/main.js";
export const ExitCode = ExitCodeValue;
export type { CheckOptions, CliIo };
export type ExitCode = ExitCodeTypeInternal;

if (isCliEntrypoint(import.meta.url)) {
  process.exitCode = main();
}
