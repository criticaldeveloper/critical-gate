import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface CriticalGateConfig {
  patternAliases?: Record<string, string>;
  featureRoots?: string[];
  serviceRoots?: string[];
  validatorRoots?: string[];
  excludePatterns?: string[];
  rollout?: {
    observationDetectors?: string[];
    blockingDetectors?: string[];
  };
}

export interface LoadCriticalGateConfigResult {
  config: CriticalGateConfig;
  warnings: string[];
}

export interface ConfigReader {
  exists?: (path: string) => boolean;
  readFile?: (path: string) => string;
}

export function loadCriticalGateConfig(
  root: string,
  reader: ConfigReader = {}
): LoadCriticalGateConfigResult {
  const path = join(root, ".critical-gate.json");
  const exists = reader.exists ?? existsSync;
  const readFile = reader.readFile ?? ((filePath: string) => readFileSync(filePath, "utf8"));

  if (!exists(path)) {
    return { config: {}, warnings: [] };
  }

  try {
    return validateConfig(JSON.parse(readFile(path)) as unknown);
  } catch (error) {
    return {
      config: {},
      warnings: [
        `Invalid .critical-gate.json: ${error instanceof Error ? error.message : "unknown error"}.`
      ]
    };
  }
}

function validateConfig(value: unknown): LoadCriticalGateConfigResult {
  const warnings: string[] = [];

  if (!isRecord(value)) {
    return {
      config: {},
      warnings: [".critical-gate.json must contain an object."]
    };
  }

  return {
    config: {
      patternAliases: readStringRecord(value, "patternAliases", warnings),
      featureRoots: readStringArray(value, "featureRoots", warnings),
      serviceRoots: readStringArray(value, "serviceRoots", warnings),
      validatorRoots: readStringArray(value, "validatorRoots", warnings),
      excludePatterns: readStringArray(value, "excludePatterns", warnings),
      rollout: readRolloutConfig(value, warnings)
    },
    warnings
  };
}

function readRolloutConfig(
  value: Record<string, unknown>,
  warnings: string[]
): CriticalGateConfig["rollout"] {
  const rawValue = value.rollout;

  if (rawValue === undefined) {
    return undefined;
  }

  if (!isRecord(rawValue)) {
    warnings.push("rollout must be an object.");
    return undefined;
  }

  return {
    observationDetectors: readStringArray(rawValue, "observationDetectors", warnings),
    blockingDetectors: readStringArray(rawValue, "blockingDetectors", warnings)
  };
}

function readStringArray(
  value: Record<string, unknown>,
  key: string,
  warnings: string[]
): string[] | undefined {
  const rawValue = value[key];

  if (rawValue === undefined) {
    return undefined;
  }

  if (!Array.isArray(rawValue) || !rawValue.every((item) => typeof item === "string")) {
    warnings.push(`${key} must be an array of strings.`);
    return undefined;
  }

  return rawValue;
}

function readStringRecord(
  value: Record<string, unknown>,
  key: keyof CriticalGateConfig,
  warnings: string[]
): Record<string, string> | undefined {
  const rawValue = value[key];

  if (rawValue === undefined) {
    return undefined;
  }

  if (!isRecord(rawValue) || !Object.values(rawValue).every((item) => typeof item === "string")) {
    warnings.push(`${key} must be an object of string values.`);
    return undefined;
  }

  return rawValue as Record<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
