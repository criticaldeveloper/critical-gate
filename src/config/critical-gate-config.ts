import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const CRITICAL_GATE_CONFIG_FILE = ".critical-gate.json";

export interface AcceptedFindingRule {
  id: string;
  reason: string;
  createdAt: string;
}

export interface ExpectedSupportFileRule {
  id: string;
  whenChanged: string;
  allow: string[];
  reason: string;
  createdAt: string;
}

export interface LearningConfig {
  acceptedFindings?: AcceptedFindingRule[];
  expectedSupportFiles?: ExpectedSupportFileRule[];
}

export interface CriticalGateConfig {
  frameworkPacks?: string[];
  patternAliases?: Record<string, string>;
  featureRoots?: string[];
  serviceRoots?: string[];
  validatorRoots?: string[];
  excludePatterns?: string[];
  rollout?: {
    observationDetectors?: string[];
    blockingDetectors?: string[];
  };
  learning?: LearningConfig;
}

export interface LoadCriticalGateConfigResult {
  config: CriticalGateConfig;
  warnings: string[];
}

export interface ConfigReader {
  exists?: (path: string) => boolean;
  readFile?: (path: string) => string;
}

export interface ConfigWriter {
  writeFile?: (path: string, content: string) => void;
}

export function loadCriticalGateConfig(
  root: string,
  reader: ConfigReader = {}
): LoadCriticalGateConfigResult {
  const path = join(root, CRITICAL_GATE_CONFIG_FILE);
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
      frameworkPacks: readStringArray(value, "frameworkPacks", warnings),
      patternAliases: readStringRecord(value, "patternAliases", warnings),
      featureRoots: readStringArray(value, "featureRoots", warnings),
      serviceRoots: readStringArray(value, "serviceRoots", warnings),
      validatorRoots: readStringArray(value, "validatorRoots", warnings),
      excludePatterns: readStringArray(value, "excludePatterns", warnings),
      rollout: readRolloutConfig(value, warnings),
      learning: readLearningConfig(value, warnings)
    },
    warnings
  };
}

export function updateCriticalGateConfig(
  root: string,
  updater: (config: CriticalGateConfig) => CriticalGateConfig,
  io: ConfigReader & ConfigWriter = {}
): CriticalGateConfig {
  const path = join(root, CRITICAL_GATE_CONFIG_FILE);
  const exists = io.exists ?? existsSync;
  const readFile = io.readFile ?? ((filePath: string) => readFileSync(filePath, "utf8"));
  const writeFile =
    io.writeFile ??
    ((filePath: string, content: string) => writeFileSync(filePath, content, "utf8"));
  const current = exists(path) ? validateConfig(JSON.parse(readFile(path)) as unknown).config : {};
  const updated = updater(current);

  writeFile(path, `${JSON.stringify(updated, null, 2)}\n`);

  return updated;
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

function readLearningConfig(
  value: Record<string, unknown>,
  warnings: string[]
): CriticalGateConfig["learning"] {
  const rawValue = value.learning;

  if (rawValue === undefined) {
    return undefined;
  }

  if (!isRecord(rawValue)) {
    warnings.push("learning must be an object.");
    return undefined;
  }

  return {
    acceptedFindings: readAcceptedFindings(rawValue, warnings),
    expectedSupportFiles: readExpectedSupportFiles(rawValue, warnings)
  };
}

function readAcceptedFindings(
  value: Record<string, unknown>,
  warnings: string[]
): AcceptedFindingRule[] | undefined {
  const rawValue = value.acceptedFindings;

  if (rawValue === undefined) {
    return undefined;
  }

  if (!Array.isArray(rawValue)) {
    warnings.push("learning.acceptedFindings must be an array.");
    return undefined;
  }

  const entries = rawValue.filter(isAcceptedFindingRule);

  if (entries.length !== rawValue.length) {
    warnings.push("learning.acceptedFindings entries require id, reason, and createdAt strings.");
  }

  return entries;
}

function readExpectedSupportFiles(
  value: Record<string, unknown>,
  warnings: string[]
): ExpectedSupportFileRule[] | undefined {
  const rawValue = value.expectedSupportFiles;

  if (rawValue === undefined) {
    return undefined;
  }

  if (!Array.isArray(rawValue)) {
    warnings.push("learning.expectedSupportFiles must be an array.");
    return undefined;
  }

  const entries = rawValue.filter(isExpectedSupportFileRule);

  if (entries.length !== rawValue.length) {
    warnings.push(
      "learning.expectedSupportFiles entries require id, whenChanged, allow, reason, and createdAt."
    );
  }

  return entries;
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

function isAcceptedFindingRule(value: unknown): value is AcceptedFindingRule {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.reason === "string" &&
    typeof value.createdAt === "string"
  );
}

function isExpectedSupportFileRule(value: unknown): value is ExpectedSupportFileRule {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.whenChanged === "string" &&
    Array.isArray(value.allow) &&
    value.allow.every((entry) => typeof entry === "string") &&
    typeof value.reason === "string" &&
    typeof value.createdAt === "string"
  );
}
