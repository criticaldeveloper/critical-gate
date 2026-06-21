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

export interface DetectorPolicyOverride {
  detector: string;
  mode: "blocking" | "observation";
  reason: string;
}

export interface CriticalGatePolicy {
  failOn?: "blocker" | "high" | "medium";
  detectorOverrides?: DetectorPolicyOverride[];
  expectedCompanions?: ExpectedSupportFileRule[];
  allowedSupportFiles?: ExpectedSupportFileRule[];
  publicApi?: {
    entrypoints?: string[];
  };
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
    failOn?: "blocker" | "high" | "medium";
  };
  policy?: CriticalGatePolicy;
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

export function getConfiguredFailOn(
  config: CriticalGateConfig
): "blocker" | "high" | "medium" | undefined {
  return config.policy?.failOn ?? config.rollout?.failOn;
}

export function getPolicyObservationDetectors(config: CriticalGateConfig): string[] | undefined {
  const policyObservation = config.policy?.detectorOverrides
    ?.filter((override) => override.mode === "observation")
    .map((override) => override.detector);

  return mergeUnique(config.rollout?.observationDetectors, policyObservation);
}

export function getPolicyBlockingDetectors(config: CriticalGateConfig): string[] | undefined {
  const policyBlocking = config.policy?.detectorOverrides
    ?.filter((override) => override.mode === "blocking")
    .map((override) => override.detector);

  return mergeUnique(config.rollout?.blockingDetectors, policyBlocking);
}

export function getConfiguredExpectedSupportFiles(
  config: CriticalGateConfig
): ExpectedSupportFileRule[] | undefined {
  return mergeRules(
    config.learning?.expectedSupportFiles,
    config.policy?.expectedCompanions,
    config.policy?.allowedSupportFiles
  );
}

export function getConfiguredPublicApiEntrypoints(
  config: CriticalGateConfig
): string[] | undefined {
  return config.policy?.publicApi?.entrypoints;
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
      policy: readPolicyConfig(value, warnings),
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

export function createDefaultPolicyConfig(now: Date): CriticalGateConfig {
  return {
    policy: {
      failOn: "high",
      detectorOverrides: [
        {
          detector: "expected-companions",
          mode: "observation",
          reason: "Companion rules are useful guidance during rollout but should not block yet."
        }
      ],
      expectedCompanions: [
        {
          id: "source-test-companion",
          whenChanged: "src/**/*.ts",
          allow: ["tests/**/*.test.ts", "src/**/*.test.ts"],
          reason: "Source changes commonly require corresponding behavior tests.",
          createdAt: now.toISOString()
        }
      ],
      allowedSupportFiles: [
        {
          id: "docs-for-config",
          whenChanged: ".github/workflows/**",
          allow: ["docs/**/*.md", "README.md", "CHANGELOG.md"],
          reason: "CI or workflow changes may include visible operational documentation.",
          createdAt: now.toISOString()
        }
      ]
    },
    learning: {
      acceptedFindings: [],
      expectedSupportFiles: []
    }
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
    blockingDetectors: readStringArray(rawValue, "blockingDetectors", warnings),
    failOn: readFailOn(rawValue, "rollout.failOn", warnings)
  };
}

function readPolicyConfig(
  value: Record<string, unknown>,
  warnings: string[]
): CriticalGateConfig["policy"] {
  const rawValue = value.policy;

  if (rawValue === undefined) {
    return undefined;
  }

  if (!isRecord(rawValue)) {
    warnings.push("policy must be an object.");
    return undefined;
  }

  return {
    failOn: readFailOn(rawValue, "policy.failOn", warnings),
    detectorOverrides: readDetectorPolicyOverrides(rawValue, warnings),
    expectedCompanions: readSupportRules(rawValue, "expectedCompanions", warnings),
    allowedSupportFiles: readSupportRules(rawValue, "allowedSupportFiles", warnings),
    publicApi: readPublicApiConfig(rawValue, warnings)
  };
}

function readPublicApiConfig(
  value: Record<string, unknown>,
  warnings: string[]
): CriticalGatePolicy["publicApi"] {
  const rawValue = value.publicApi;

  if (rawValue === undefined) {
    return undefined;
  }

  if (!isRecord(rawValue)) {
    warnings.push("policy.publicApi must be an object.");
    return undefined;
  }

  return {
    entrypoints: readStringArray(rawValue, "entrypoints", warnings)
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
    expectedSupportFiles: readSupportRules(rawValue, "expectedSupportFiles", warnings)
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

function readSupportRules(
  value: Record<string, unknown>,
  key: "expectedSupportFiles" | "expectedCompanions" | "allowedSupportFiles",
  warnings: string[]
): ExpectedSupportFileRule[] | undefined {
  const rawValue = value[key];

  if (rawValue === undefined) {
    return undefined;
  }

  if (!Array.isArray(rawValue)) {
    warnings.push(`${key} must be an array.`);
    return undefined;
  }

  const entries = rawValue.filter(isExpectedSupportFileRule);

  if (entries.length !== rawValue.length) {
    warnings.push(`${key} entries require id, whenChanged, allow, reason, and createdAt strings.`);
  }

  return entries;
}

function readDetectorPolicyOverrides(
  value: Record<string, unknown>,
  warnings: string[]
): DetectorPolicyOverride[] | undefined {
  const rawValue = value.detectorOverrides;

  if (rawValue === undefined) {
    return undefined;
  }

  if (!Array.isArray(rawValue)) {
    warnings.push("policy.detectorOverrides must be an array.");
    return undefined;
  }

  const entries = rawValue.filter(isDetectorPolicyOverride);

  if (entries.length !== rawValue.length) {
    warnings.push("policy.detectorOverrides entries require detector, mode, and reason strings.");
  }

  return entries;
}

function readFailOn(
  value: Record<string, unknown>,
  key: string,
  warnings: string[]
): CriticalGatePolicy["failOn"] {
  const property = key.split(".").at(-1) ?? key;
  const rawValue = value[property];

  if (rawValue === undefined) {
    return undefined;
  }

  if (rawValue !== "blocker" && rawValue !== "high" && rawValue !== "medium") {
    warnings.push(`${key} must be blocker, high, or medium.`);
    return undefined;
  }

  return rawValue;
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

function mergeUnique(...entries: Array<string[] | undefined>): string[] | undefined {
  const merged = entries.flatMap((entry) => entry ?? []);
  return merged.length === 0 ? undefined : [...new Set(merged)];
}

function mergeRules(
  ...entries: Array<ExpectedSupportFileRule[] | undefined>
): ExpectedSupportFileRule[] | undefined {
  const merged = new Map<string, ExpectedSupportFileRule>();

  for (const entry of entries.flatMap((rules) => rules ?? [])) {
    merged.set(entry.id, entry);
  }

  return merged.size === 0 ? undefined : [...merged.values()];
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

function isDetectorPolicyOverride(value: unknown): value is DetectorPolicyOverride {
  return (
    isRecord(value) &&
    typeof value.detector === "string" &&
    (value.mode === "blocking" || value.mode === "observation") &&
    typeof value.reason === "string"
  );
}
