import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  dependencyDetector,
  parseUnifiedDiff,
  runDetectors,
  summarizeFindings
} from "../src/index.js";
import type { GateResult, TaskIntent } from "../src/index.js";

const task: TaskIntent = {
  source: "cli",
  text: "Add signup validation"
};

describe("dependencyDetector", () => {
  it("emits a blocker for unjustified production dependencies", () => {
    const diff = {
      files: parseUnifiedDiff(
        readFileSync(join(process.cwd(), "fixtures", "diffs", "basic-ts.diff"), "utf8")
      )
    };

    const findings = dependencyDetector.run({ task, diff });

    expect(findings).toEqual([
      expect.objectContaining({
        detector: "dependency-addition",
        severity: "blocker",
        title: "Unjustified production dependency added",
        message: "axios@^1.7.0 was added to dependencies without visible task justification.",
        repair:
          "Remove axios unless it is required, or update the task/PR context with a clear justification and alternatives considered.",
        tags: ["dependency"]
      })
    ]);
    expect(findings[0]?.evidence[0]).toMatchObject({
      kind: "manifest",
      path: "package.json",
      message: "axios was added to dependencies.",
      data: {
        dependency: "axios",
        version: "^1.7.0",
        section: "dependencies"
      }
    });
  });

  it("does not emit a finding when the task visibly justifies the package", () => {
    const diff = {
      files: parseUnifiedDiff(
        readFileSync(join(process.cwd(), "fixtures", "diffs", "basic-ts.diff"), "utf8")
      )
    };

    const findings = dependencyDetector.run({
      task: {
        source: "cli",
        text: "Install axios for the signup API client"
      },
      diff
    });

    expect(findings).toEqual([]);
  });

  it("emits medium severity for unjustified dev dependencies", () => {
    const diff = {
      files: parseUnifiedDiff(`diff --git a/package.json b/package.json
index 57b22a0..cb3e0f1 100644
--- a/package.json
+++ b/package.json
@@ -10,5 +10,6 @@
   "devDependencies": {
+    "tsx": "^4.19.0",
     "vitest": "^4.1.9"
   }
 }
`)
    };

    const findings = dependencyDetector.run({ task, diff });

    expect(findings).toEqual([
      expect.objectContaining({
        severity: "medium",
        message: "tsx@^4.19.0 was added to devDependencies without visible task justification."
      })
    ]);
  });
});

describe("detector runner", () => {
  it("summarizes blocker findings into a failing gate decision", () => {
    const diff: GateResult["diff"] = {
      files: parseUnifiedDiff(
        readFileSync(join(process.cwd(), "fixtures", "diffs", "basic-ts.diff"), "utf8")
      )
    };

    const findings = runDetectors(task, diff);

    expect(summarizeFindings(findings)).toMatchObject({
      decision: "fail",
      findingCount: 2,
      blockerCount: 1,
      highCount: 1,
      mediumCount: 0
    });
  });
});
