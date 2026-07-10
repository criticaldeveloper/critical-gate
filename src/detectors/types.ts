import type { KnowledgeProvider } from "../knowledge/index.js";
import type { ApiSurfaceSnapshot } from "../repository/index.js";
import type {
  DetectorRunStatus,
  Finding,
  GateResult,
  CheckExecutionResult,
  TaskContract,
  TaskIntent
} from "../schema/index.js";

export type DetectorMaturity = "experimental" | "review" | "blocker-certified";

export type DetectorRepoContext = NonNullable<GateResult["context"]> & {
  knowledge?: KnowledgeProvider;
  apiSurfaceSnapshot?: ApiSurfaceSnapshot;
  taskContract?: TaskContract;
  checksRan?: string[];
  checkResults?: CheckExecutionResult[];
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
  getStatus?: (
    context: DetectorContext,
    findings: Finding[]
  ) => {
    status: DetectorRunStatus;
    reason?: string;
  };
}
