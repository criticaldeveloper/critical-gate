import type { GateResult } from "../schema/index.js";

import { renderJsonReport } from "./json-reporter.js";
import { renderMarkdownReport } from "./markdown-reporter.js";
import { renderPrCommentReport } from "./pr-comment-reporter.js";
import { renderRepairReport } from "./repair-reporter.js";
import { renderSarifReport } from "./sarif-reporter.js";

export type ReportFormat = "json" | "markdown" | "sarif" | "repair" | "pr-comment";

export function renderReport(result: GateResult, format: ReportFormat): string {
  switch (format) {
    case "json":
      return renderJsonReport(result);
    case "markdown":
      return renderMarkdownReport(result);
    case "pr-comment":
      return renderPrCommentReport(result);
    case "sarif":
      return renderSarifReport(result);
    case "repair":
      return renderRepairReport(result);
  }
}

export { renderJsonReport } from "./json-reporter.js";
export { renderMarkdownReport } from "./markdown-reporter.js";
export { renderPrCommentReport } from "./pr-comment-reporter.js";
export { renderFindingRepairContract } from "./repair-contract.js";
export { renderRepairReport } from "./repair-reporter.js";
export {
  buildReviewerChecklist,
  renderReviewerChecklist,
  type ReviewerChecklistItem
} from "./reviewer-checklist.js";
export { renderSarifReport } from "./sarif-reporter.js";
