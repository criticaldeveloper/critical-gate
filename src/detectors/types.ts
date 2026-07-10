import type { KnowledgeProvider } from "../knowledge/index.js";
import type { ApiSurfaceSnapshot } from "../repository/index.js";
import type { Finding, GateResult, TaskIntent } from "../schema/index.js";

export type DetectorMaturity = "experimental" | "review" | "blocker-certified";

export type DetectorRepoContext = NonNullable<GateResult["context"]> & {
  knowledge?: KnowledgeProvider;
  apiSurfaceSnapshot?: ApiSurfaceSnapshot;
};

export interface DetectorContext {
  task: TaskIntent;
  diff: GateResult["diff"];
  context?: DetectorRepoContext;
}

export interface Detector {
  name: string;
  maturity?: DetectorMaturity;
  run: (context: DetectorContext) => Finding[];
}
