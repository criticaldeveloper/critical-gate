import type { GateResult } from "../schema/index.js";

export function renderJsonReport(result: GateResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}
