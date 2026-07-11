import { isAbsolute, join } from "node:path";

import {
  GATE_RESULT_SCHEMA_VERSION,
  applyLearningPolicy,
  analyzeTaskIntentQuality,
  buildRepositoryTokenIndex,
  detectFrameworkPacks,
  detectMonorepoContext,
  getConfiguredDefaultInvariants,
  getConfiguredExpectedSupportFiles,
  getConfiguredFailOn,
  getConfiguredPublicApiEntrypoints,
  getPolicyBlockingDetectors,
  getPolicyObservationDetectors,
  loadApiSurfaceSnapshot,
  loadCriticalGateConfig,
  inferTaskContract,
  parseTaskContractJson,
  resolvePublicApiEntrypoints,
  runDetectorsWithStatuses,
  summarizeApiSurfaceSnapshot,
  summarizeFindings,
  summarizeIntentVerification,
  type CheckExecutionResult,
  type GateResult,
  type GitDiffResult
} from "../index.js";
import type { CheckOptions, CliIo } from "./types.js";
import { CRITICAL_GATE_VERSION } from "../version.js";

export function createGateResult(
  options: CheckOptions,
  generatedAt: Date,
  diffResult: GitDiffResult,
  io: Pick<CliIo, "exists" | "readFile"> = {}
): GateResult {
  const configResult = loadCriticalGateConfig(diffResult.root, {
    exists: io.exists,
    readFile: io.readFile
  });
  const taskContract = options.taskContract
    ? loadTaskContract(diffResult.root, options.taskContract, io)
    : undefined;
  const checkResults = options.checksReport
    ? loadCheckResults(diffResult.root, options.checksReport, io)
    : undefined;
  const taskText = taskContract?.goal ?? options.task;
  const task = {
    source: "cli" as const,
    text: taskText
  };
  const defaultInvariants = getConfiguredDefaultInvariants(configResult.config);
  const baseTaskContract = taskContract ?? inferTaskContract(task);
  const resolvedTaskContract = {
    ...baseTaskContract,
    invariants: [...new Set([...defaultInvariants, ...baseTaskContract.invariants])],
    provenance:
      defaultInvariants.length === 0
        ? baseTaskContract.provenance
        : [...new Set([...(baseTaskContract.provenance ?? []), ".critical-gate.json policy"])]
  };
  const diff = {
    baseRef: diffResult.baseRef,
    headRef: diffResult.headRef,
    files: diffResult.files
  };
  const packageJson = readOptionalPackageJson(diffResult.root, io);
  const frameworkPacks = detectFrameworkPacks({
    files: diff.files,
    packageJson,
    config: configResult.config
  });
  const monorepo = detectMonorepoContext(diffResult.root, diff.files, io);
  const repositoryTokenIndex = buildRepositoryTokenIndex({
    files: diff.files,
    packageJson
  });
  const publicApiEntrypoints = resolvePublicApiEntrypoints(
    diffResult.root,
    io,
    getConfiguredPublicApiEntrypoints(configResult.config)
  );
  const publicApiEntrypointContext =
    publicApiEntrypoints.length > 0 ? publicApiEntrypoints : undefined;
  const apiSnapshot = loadApiSurfaceSnapshot(diffResult.root, io);
  const context: GateResult["context"] = {
    root: diffResult.root,
    packageManager: "pnpm",
    monorepo,
    apiSnapshot: summarizeApiSurfaceSnapshot(apiSnapshot),
    publicEntrypoints: publicApiEntrypointContext?.map((entrypoint) => entrypoint.path),
    publicApiEntrypoints: publicApiEntrypointContext,
    frameworkPacks: frameworkPacks.map((pack) => pack.id),
    repositoryProfile: diffResult.repositoryProfile,
    utilityIndex: diffResult.utilityIndex,
    repositoryTokenIndex,
    git: {
      baseRef: diffResult.baseRef,
      headRef: diffResult.headRef
    }
  };
  const detectorContext = {
    ...context,
    apiSurfaceSnapshot: apiSnapshot,
    publicApiEntrypoints: publicApiEntrypointContext,
    taskContract: resolvedTaskContract,
    checksRan: options.checksRan,
    checkResults,
    knowledge: diffResult.knowledge
  };
  const detectorResult = runDetectorsWithStatuses(task, diff, detectorContext);
  const detectorFindings = detectorResult.findings;
  const learningResult = applyLearningPolicy(detectorFindings, diff.files, {
    ...configResult.config.learning,
    expectedSupportFiles: getConfiguredExpectedSupportFiles(configResult.config)
  });
  const findings = learningResult.findings;
  const loadedHistoryIndex = diffResult.knowledge?.getLoadedHistoryIndex?.();
  const loadedSolutionIndex = diffResult.knowledge?.getLoadedSolutionIndex?.();

  context.repositoryProfile ??= loadedHistoryIndex?.profile;
  context.utilityIndex ??= loadedSolutionIndex?.utilityIndex;

  return {
    schemaVersion: GATE_RESULT_SCHEMA_VERSION,
    generatedAt: generatedAt.toISOString(),
    task,
    diff,
    context,
    findings,
    summary: summarizeFindings(findings, task, diff, {
      observationDetectors: getPolicyObservationDetectors(configResult.config),
      blockingDetectors: getPolicyBlockingDetectors(configResult.config),
      failOn: options.failOn ?? getConfiguredFailOn(configResult.config),
      acceptedFindingIds: learningResult.appliedAcceptedFindings,
      detectorRuns: detectorResult.detectorRuns
    }),
    taskContract: resolvedTaskContract,
    intentVerification: summarizeIntentVerification(task, diff.files),
    intentQuality: analyzeTaskIntentQuality(task),
    metadata: {
      cliVersion: CRITICAL_GATE_VERSION,
      strict: options.strict,
      staged: options.staged,
      failOn: options.failOn ?? getConfiguredFailOn(configResult.config) ?? "high",
      taskContractPath: options.taskContract,
      checksRan: options.checksRan ?? [],
      checksReportPath: options.checksReport,
      checkResults: checkResults ?? [],
      rolloutPolicy: configResult.config.rollout,
      policy: configResult.config.policy,
      frameworkPacks: frameworkPacks.map((pack) => pack.id),
      learning: {
        acceptedFindingsApplied: learningResult.appliedAcceptedFindings,
        expectedSupportRulesApplied: learningResult.appliedExpectedSupportRules
      },
      configWarnings: configResult.warnings
    }
  };
}

function loadTaskContract(
  root: string,
  path: string,
  io: Pick<CliIo, "exists" | "readFile">
): ReturnType<typeof parseTaskContractJson> {
  const resolvedPath = isAbsolute(path) ? path : join(root, path);

  if (io.exists?.(resolvedPath) !== true) {
    throw new Error(`Task contract file not found: ${path}`);
  }

  return parseTaskContractJson(io.readFile?.(resolvedPath) ?? "");
}

function loadCheckResults(
  root: string,
  path: string,
  io: Pick<CliIo, "exists" | "readFile">
): CheckExecutionResult[] {
  const resolvedPath = isAbsolute(path) ? path : join(root, path);

  if (io.exists?.(resolvedPath) !== true) {
    throw new Error(`Checks report file not found: ${path}`);
  }

  return parseCheckResultsJson(io.readFile?.(resolvedPath) ?? "");
}

function parseCheckResultsJson(content: string): CheckExecutionResult[] {
  const parsed = JSON.parse(content) as unknown;
  const rawChecks = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.checks)
      ? parsed.checks
      : undefined;

  if (rawChecks === undefined) {
    throw new Error("Checks report must be an array or an object with a checks array.");
  }

  return rawChecks.map((rawCheck, index) => parseCheckResult(rawCheck, index));
}

function parseCheckResult(rawCheck: unknown, index: number): CheckExecutionResult {
  if (!isRecord(rawCheck)) {
    throw new Error(`Invalid checks report entry at index ${index}.`);
  }

  const command = rawCheck.command;
  const status = rawCheck.status;
  const exitCode = rawCheck.exitCode;

  if (typeof command !== "string" || command.trim().length === 0) {
    throw new Error(`Invalid checks report command at index ${index}.`);
  }

  if (status !== "passed" && status !== "failed") {
    throw new Error(`Invalid checks report status at index ${index}. Expected passed or failed.`);
  }

  if (
    exitCode !== undefined &&
    (typeof exitCode !== "number" || !Number.isInteger(exitCode) || exitCode < 0)
  ) {
    throw new Error(`Invalid checks report exitCode at index ${index}.`);
  }

  return {
    command,
    status,
    exitCode
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOptionalPackageJson(root: string, io: Pick<CliIo, "exists" | "readFile">): unknown {
  const path = join(root, "package.json");

  if (io.exists?.(path) !== true) {
    return undefined;
  }

  try {
    return JSON.parse(io.readFile?.(path) ?? "");
  } catch {
    return undefined;
  }
}
