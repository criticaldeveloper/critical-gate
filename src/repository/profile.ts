import {
  buildHistoryIndex,
  buildRepositoryProfileFromHistoryIndex,
  parseNameOnlyLog,
  type BuildHistoryIndexOptions,
  type HistoryCommandRunner
} from "../knowledge/index.js";
import type { RepositoryProfile } from "../schema/index.js";

export type { HistoryCommandRunner };
export type BuildRepositoryProfileOptions = BuildHistoryIndexOptions;

export function buildRepositoryProfile(options: BuildRepositoryProfileOptions): RepositoryProfile {
  return buildRepositoryProfileFromHistoryIndex(buildHistoryIndex(options));
}

export { parseNameOnlyLog };
