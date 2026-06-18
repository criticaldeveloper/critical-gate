import {
  buildSolutionIndex,
  extractExportedNames,
  solutionIndexToUtilityIndex,
  type BuildSolutionIndexOptions,
  type SolutionIndexRunner
} from "../knowledge/index.js";
import type { UtilityIndex } from "../schema/index.js";

export type { SolutionIndexRunner as UtilityIndexRunner };
export type BuildUtilityIndexOptions = BuildSolutionIndexOptions;

export function buildUtilityIndex(options: BuildUtilityIndexOptions): UtilityIndex {
  return solutionIndexToUtilityIndex(buildSolutionIndex(options));
}

export { extractExportedNames };
