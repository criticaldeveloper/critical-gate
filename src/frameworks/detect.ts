import type { CriticalGateConfig } from "../config/index.js";
import type { DiffFile } from "../schema/index.js";
import { frameworkPacks } from "./packs.js";
import type { FrameworkPack, FrameworkPackId } from "./types.js";

export interface DetectFrameworkPacksOptions {
  files: DiffFile[];
  packageJson?: unknown;
  config?: CriticalGateConfig;
}

export function detectFrameworkPacks(options: DetectFrameworkPacksOptions): FrameworkPack[] {
  const configured = new Set(options.config?.frameworkPacks ?? []);
  const dependencies = getPackageDependencies(options.packageJson);
  const paths = new Set(options.files.map((file) => file.path));

  return frameworkPacks.filter(
    (pack) =>
      configured.has(pack.id) ||
      pack.packageHints.some((hint) => dependencies.has(hint)) ||
      pack.fileHints.some((hint) => paths.has(hint))
  );
}

export function isFrameworkPackId(value: string): value is FrameworkPackId {
  return frameworkPacks.some((pack) => pack.id === value);
}

function getPackageDependencies(packageJson: unknown): Set<string> {
  if (!isRecord(packageJson)) {
    return new Set();
  }

  return new Set([
    ...Object.keys(readRecord(packageJson.dependencies)),
    ...Object.keys(readRecord(packageJson.devDependencies)),
    ...Object.keys(readRecord(packageJson.peerDependencies))
  ]);
}

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
