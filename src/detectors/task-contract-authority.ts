import { matchesPathPattern } from "../frameworks/index.js";
import type { TaskContract } from "../schema/index.js";

export function isExplicitlyAllowedByContract(
  path: string,
  contract: TaskContract | undefined
): boolean {
  return (
    contract?.source === "provided" &&
    contract.allowedPaths.length > 0 &&
    contract.allowedPaths.some((pattern) => matchesPathPattern(pattern, path)) &&
    !contract.forbiddenPaths.some((pattern) => matchesPathPattern(pattern, path))
  );
}

export function isOutsideProvidedContract(
  path: string,
  contract: TaskContract | undefined
): boolean {
  if (contract?.source !== "provided") {
    return false;
  }

  if (contract.forbiddenPaths.some((pattern) => matchesPathPattern(pattern, path))) {
    return true;
  }

  return (
    contract.allowedPaths.length > 0 &&
    !contract.allowedPaths.some((pattern) => matchesPathPattern(pattern, path))
  );
}
