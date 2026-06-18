import type { KnowledgeProvider } from "../knowledge/index.js";
import type { Finding, GateResult, TaskIntent } from "../schema/index.js";

export type DetectorRepoContext = NonNullable<GateResult["context"]> & {
  knowledge?: KnowledgeProvider;
};

export interface DetectorContext {
  task: TaskIntent;
  diff: GateResult["diff"];
  context?: DetectorRepoContext;
}

export interface Detector {
  name: string;
  run: (context: DetectorContext) => Finding[];
}
