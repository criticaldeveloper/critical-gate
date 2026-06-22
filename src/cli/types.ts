import type { GitDiffResult, ReportFormat } from "../index.js";

export const ExitCode = {
  Pass: 0,
  FindingsFailed: 1,
  UsageError: 2,
  InternalError: 3
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

export interface CheckOptions {
  task: string;
  base?: string;
  format: ReportFormat;
  strict: boolean;
  staged: boolean;
  failOn?: "blocker" | "high" | "medium";
  output?: string;
}

export interface CliIo {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
  writeFile: (path: string, content: string) => void;
  chmodFile?: (path: string, mode: number) => void;
  now: () => Date;
  readDiff: (baseRef?: string, options?: { staged?: boolean }) => GitDiffResult;
  exists?: (path: string) => boolean;
  readFile?: (path: string) => string;
}
