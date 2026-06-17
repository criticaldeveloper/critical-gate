import type { Finding, GateResult, TaskIntent } from "../schema/index.js";

export interface DetectorContext {
  task: TaskIntent;
  diff: GateResult["diff"];
  context?: GateResult["context"];
}

export interface Detector {
  name: string;
  run: (context: DetectorContext) => Finding[];
}
