import type { TaskContract, TaskIntent } from "../schema/index.js";
import { separateTaskText } from "./task-constraints.js";

type RawTaskContract = Record<string, unknown>;

export function inferTaskContract(task: TaskIntent): TaskContract {
  const separatedTask = separateTaskText(task.text);

  return {
    source: "inferred",
    goal: separatedTask.descriptiveText || task.text.trim(),
    allowedPaths: [],
    forbiddenPaths: separatedTask.inferredForbiddenPaths,
    expectedArtifacts: [],
    invariants: separatedTask.inferredInvariants,
    requiredChecks: []
  };
}

export function parseTaskContractJson(content: string): TaskContract {
  let rawValue: unknown;

  try {
    rawValue = JSON.parse(content);
  } catch {
    throw new Error("Task contract must be valid JSON.");
  }

  if (!isObject(rawValue)) {
    throw new Error("Task contract must be a JSON object.");
  }

  const goal = readString(rawValue, "goal");

  if (goal === undefined || goal.trim().length === 0) {
    throw new Error("Task contract requires a non-empty goal.");
  }

  return {
    source: "provided",
    goal: goal.trim(),
    allowedPaths: readStringArray(rawValue, "allowedPaths", "allowed_paths"),
    forbiddenPaths: readStringArray(rawValue, "forbiddenPaths", "forbidden_paths"),
    expectedChangedRoles: readDiffFileRoles(
      rawValue,
      "expectedChangedRoles",
      "expected_changed_roles"
    ),
    expectedArtifacts: readStringArray(rawValue, "expectedArtifacts", "expected_artifacts"),
    invariants: readStringArray(rawValue, "invariants"),
    requiredChecks: readStringArray(rawValue, "requiredChecks", "required_checks"),
    provenance: readStringArray(rawValue, "provenance", "source_provenance")
  };
}

const diffFileRoles = new Set([
  "source",
  "test",
  "config",
  "docs",
  "manifest",
  "lockfile",
  "generated",
  "unknown"
]);

function readDiffFileRoles(
  value: RawTaskContract,
  ...keys: string[]
): TaskContract["expectedChangedRoles"] {
  const roles = readStringArray(value, ...keys);

  if (!roles.every((role) => diffFileRoles.has(role))) {
    throw new Error(`Task contract field ${keys[0]} contains an unknown changed-file role.`);
  }

  return roles as NonNullable<TaskContract["expectedChangedRoles"]>;
}

function readString(value: RawTaskContract, key: string): string | undefined {
  const rawValue = value[key];

  return typeof rawValue === "string" ? rawValue : undefined;
}

function readStringArray(value: RawTaskContract, ...keys: string[]): string[] {
  const rawValue = keys.map((key) => value[key]).find((candidate) => candidate !== undefined);

  if (rawValue === undefined) {
    return [];
  }

  if (!Array.isArray(rawValue)) {
    throw new Error(`Task contract field ${keys[0]} must be an array of strings.`);
  }

  if (!rawValue.every((entry) => typeof entry === "string")) {
    throw new Error(`Task contract field ${keys[0]} must contain only strings.`);
  }

  return rawValue.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

function isObject(value: unknown): value is RawTaskContract {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
