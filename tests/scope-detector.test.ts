import type {
  FileGraph,
  GateResult,
  KnowledgeProvider,
  TaskContract,
  TaskIntent
} from "../src/index.js";
import {
  parseUnifiedDiff,
  runDetectors,
  runDetectorsWithStatuses,
  scopeDetector,
  summarizeFindings
} from "../src/index.js";
import { buildRepositoryTokenIndex } from "../src/repository/index.js";

const task: TaskIntent = {
  source: "cli",
  text: "Fix signup validation"
};
const emptyTaskContract: TaskContract = {
  source: "provided",
  goal: "Fix signup validation",
  allowedPaths: [],
  forbiddenPaths: [],
  expectedArtifacts: [],
  invariants: [],
  requiredChecks: []
};

function parse(diffText: string): GateResult["diff"] {
  return {
    files: parseUnifiedDiff(diffText)
  };
}

function knowledge(graph: FileGraph): KnowledgeProvider {
  return {
    getFileGraph: () => graph,
    getHistoryIndex: () => ({ coChanges: [], companionRules: [] }),
    getPatternIndex: () => ({ patterns: [] }),
    getSolutionIndex: () => ({ solutions: [] })
  };
}

describe("scopeDetector", () => {
  it("emits high severity for config changes in small tasks", () => {
    const diff = parse(`diff --git a/webpack.config.js b/webpack.config.js
index 57b22a0..cb3e0f1 100644
--- a/webpack.config.js
+++ b/webpack.config.js
@@ -1,2 +1,3 @@
+export const cache = true;
 export default {};
`);

    const findings = scopeDetector.run({ task, diff });

    expect(findings).toEqual([
      expect.objectContaining({
        detector: "scope",
        severity: "high",
        title: "Unexpected file changed for small task",
        message:
          "webpack.config.js changed during a small task but does not align with expected scope.",
        repair:
          "Remove unrelated edits or split them into a separate task with explicit justification.",
        tags: ["scope"]
      })
    ]);
  });

  it("emits medium severity for unrelated source files in small tasks", () => {
    const diff = parse(`diff --git a/src/logger.ts b/src/logger.ts
index 57b22a0..cb3e0f1 100644
--- a/src/logger.ts
+++ b/src/logger.ts
@@ -1,2 +1,3 @@
+export const verbose = true;
 export const logger = true;
`);

    const findings = scopeDetector.run({ task, diff });

    expect(findings).toEqual([
      expect.objectContaining({
        severity: "medium",
        message: "src/logger.ts changed during a small task but does not align with expected scope."
      })
    ]);
  });

  it("emits high severity for deleted stylesheet files that do not match a small task", () => {
    const diff = parse(`diff --git a/src/styles/typography.scss b/src/styles/typography.scss
deleted file mode 100644
index 57b22a0..0000000
--- a/src/styles/typography.scss
+++ /dev/null
@@ -1,3 +0,0 @@
-.heading {
-  font-weight: 600;
-}
`);

    const findings = scopeDetector.run({
      task: {
        source: "cli",
        text: "Fixed fonts"
      },
      diff
    });

    expect(findings).toEqual([
      expect.objectContaining({
        severity: "high",
        title: "Unexpected file deleted for small task",
        message:
          "src/styles/typography.scss was deleted during a small task but does not align with expected scope."
      })
    ]);
  });

  it("does not treat casual project wording as a broad task", () => {
    const diff = parse(`diff --git a/src/styles/reset.scss b/src/styles/reset.scss
deleted file mode 100644
index 57b22a0..0000000
--- a/src/styles/reset.scss
+++ /dev/null
@@ -1,3 +0,0 @@
-* {
-  box-sizing: border-box;
-}
diff --git a/src/styles/typography.scss b/src/styles/typography.scss
deleted file mode 100644
index 57b22a0..0000000
--- a/src/styles/typography.scss
+++ /dev/null
@@ -1,3 +0,0 @@
-.heading {
-  font-weight: 600;
-}
`);

    const findings = runDetectors(
      {
        source: "cli",
        text: "Fixed fonts of the project"
      },
      diff
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detector: "scope",
          severity: "high",
          message:
            "src/styles/reset.scss was deleted during a small task but does not align with expected scope."
        }),
        expect.objectContaining({
          detector: "scope",
          severity: "high",
          message:
            "src/styles/typography.scss was deleted during a small task but does not align with expected scope."
        })
      ])
    );
    expect(
      summarizeFindings(findings, { source: "cli", text: "Fixed fonts of the project" }, diff)
    ).toMatchObject({
      decision: "fail",
      highCount: 2
    });
  });

  it("treats typography changes as aligned with font task wording", () => {
    const diff = parse(`diff --git a/src/styles/typography.scss b/src/styles/typography.scss
index 57b22a0..cb3e0f1 100644
--- a/src/styles/typography.scss
+++ b/src/styles/typography.scss
@@ -10,7 +10,7 @@
 .hero-title {
-  font-weight: 900;
+  font-weight: 700;
 }
`);

    expect(
      scopeDetector.run({
        task: {
          source: "cli",
          text: "Fixed fonts of the project"
        },
        diff
      })
    ).toEqual([]);
  });

  it("does not emit for acknowledged deleted stylesheet files", () => {
    const diff = parse(`diff --git a/src/styles/typography.scss b/src/styles/typography.scss
deleted file mode 100644
index 57b22a0..0000000
--- a/src/styles/typography.scss
+++ /dev/null
@@ -1,3 +0,0 @@
-.heading {
-  font-weight: 600;
-}
`);

    expect(
      scopeDetector.run({
        task: {
          source: "cli",
          text: "Remove typography stylesheet"
        },
        diff
      })
    ).toEqual([]);
  });

  it("does not emit for task-aligned source and test files", () => {
    const diff = parse(`diff --git a/src/signup.ts b/src/signup.ts
index 57b22a0..cb3e0f1 100644
--- a/src/signup.ts
+++ b/src/signup.ts
@@ -1,2 +1,3 @@
+export const signupValidation = true;
 export const signup = true;
diff --git a/tests/signup.test.ts b/tests/signup.test.ts
index 57b22a0..cb3e0f1 100644
--- a/tests/signup.test.ts
+++ b/tests/signup.test.ts
@@ -1,2 +1,3 @@
+expect(signupValidation).toBe(true);
 expect(signup).toBe(true);
`);

    expect(scopeDetector.run({ task, diff })).toEqual([]);
  });

  it("reports an unrelated documentation file beside a task-aligned source change", () => {
    const diff = parse(`diff --git a/src/signup.ts b/src/signup.ts
index 57b22a0..cb3e0f1 100644
--- a/src/signup.ts
+++ b/src/signup.ts
@@ -1 +1,2 @@
+export const signupValidation = true;
 export const signup = true;
diff --git a/docs/authentication.md b/docs/authentication.md
index 57b22a0..cb3e0f1 100644
--- a/docs/authentication.md
+++ b/docs/authentication.md
@@ -1 +1,2 @@
 # Authentication
+Unrelated session guidance.
`);

    expect(scopeDetector.run({ task, diff })).toEqual([
      expect.objectContaining({
        id: "scope:docs/authentication.md",
        severity: "medium",
        title: "Unexpected support file changed for small task"
      })
    ]);
  });

  it("reports an unrelated test beside a task-aligned source change", () => {
    const diff = parse(`diff --git a/src/signup.ts b/src/signup.ts
index 57b22a0..cb3e0f1 100644
--- a/src/signup.ts
+++ b/src/signup.ts
@@ -1 +1,2 @@
+export const signupValidation = true;
 export const signup = true;
diff --git a/tests/authentication.test.ts b/tests/authentication.test.ts
index 57b22a0..cb3e0f1 100644
--- a/tests/authentication.test.ts
+++ b/tests/authentication.test.ts
@@ -1 +1,2 @@
 test("session", () => {});
+test("refreshes session", () => {});
`);

    expect(scopeDetector.run({ task, diff })).toEqual([
      expect.objectContaining({
        id: "scope:tests/authentication.test.ts",
        severity: "medium",
        title: "Unexpected support file changed for small task"
      })
    ]);
  });

  it("accepts a changed test connected to a task-aligned source by the file graph", () => {
    const diff = parse(`diff --git a/src/signup.ts b/src/signup.ts
index 57b22a0..cb3e0f1 100644
--- a/src/signup.ts
+++ b/src/signup.ts
@@ -1 +1,2 @@
+export const signupValidation = true;
 export const signup = true;
diff --git a/tests/regression.test.ts b/tests/regression.test.ts
index 57b22a0..cb3e0f1 100644
--- a/tests/regression.test.ts
+++ b/tests/regression.test.ts
@@ -1 +1,2 @@
 test("works", () => {});
+test("rejects invalid input", () => {});
`);

    expect(
      scopeDetector.run({
        task,
        diff,
        context: {
          knowledge: knowledge({
            nodes: [],
            edges: [
              {
                from: "tests/regression.test.ts",
                to: "src/signup.ts",
                kind: "test",
                weight: 0.9
              }
            ]
          })
        }
      })
    ).toEqual([]);
  });

  it("marks an unaligned docs-only small task diff as insufficient context", () => {
    const diff = parse(`diff --git a/docs/authentication.md b/docs/authentication.md
index 57b22a0..cb3e0f1 100644
--- a/docs/authentication.md
+++ b/docs/authentication.md
@@ -1 +1,2 @@
 # Authentication
+Session guidance.
`);
    const result = runDetectorsWithStatuses(task, diff, undefined, [scopeDetector]);

    expect(result.findings).toEqual([]);
    expect(result.detectorRuns).toEqual([
      expect.objectContaining({
        detector: "scope",
        status: "insufficient-context",
        reason:
          "Changed docs or tests could not be aligned to a task target or a changed task-aligned anchor."
      })
    ]);
  });

  it("uses diff-bounded symbol tokens without requiring prebuilt context", () => {
    const task: TaskIntent = {
      source: "cli",
      text: "Fix email validator"
    };
    const diff = parse(`diff --git a/src/rules/user.ts b/src/rules/user.ts
index 57b22a0..cb3e0f1 100644
--- a/src/rules/user.ts
+++ b/src/rules/user.ts
@@ -1,2 +1,3 @@
+export function validateEmailAddress(value: string) { return value.includes("@"); }
 export const user = true;
`);
    const repositoryTokenIndex = buildRepositoryTokenIndex({ files: diff.files });

    expect(scopeDetector.run({ task, diff })).toEqual([]);
    expect(
      scopeDetector.run({
        task,
        diff,
        context: { repositoryTokenIndex }
      })
    ).toEqual([]);
  });

  it("does not emit for broad refactor tasks", () => {
    const diff = parse(`diff --git a/src/logger.ts b/src/logger.ts
index 57b22a0..cb3e0f1 100644
--- a/src/logger.ts
+++ b/src/logger.ts
@@ -1,2 +1,3 @@
+export const verbose = true;
 export const logger = true;
`);

    expect(
      scopeDetector.run({
        task: {
          source: "cli",
          text: "Refactor project logging architecture"
        },
        diff
      })
    ).toEqual([]);
  });

  it("marks broad refactor scope checks as insufficient context", () => {
    const diff = parse(`diff --git a/src/logger.ts b/src/logger.ts
index 57b22a0..cb3e0f1 100644
--- a/src/logger.ts
+++ b/src/logger.ts
@@ -1,2 +1,3 @@
+export const verbose = true;
 export const logger = true;
`);

    const result = runDetectorsWithStatuses(
      {
        source: "cli",
        text: "Refactor project logging architecture"
      },
      diff,
      undefined,
      [scopeDetector]
    );

    expect(result.findings).toEqual([]);
    expect(result.detectorRuns).toEqual([
      expect.objectContaining({
        detector: "scope",
        status: "insufficient-context",
        findingCount: 0,
        reason:
          "Task complexity is large; scope needs an explicit task contract or ownership context."
      })
    ]);
  });

  it("emits blocker findings for forbidden task-contract paths even on broad tasks", () => {
    const diff = parse(`diff --git a/src/auth/session.ts b/src/auth/session.ts
index 57b22a0..cb3e0f1 100644
--- a/src/auth/session.ts
+++ b/src/auth/session.ts
@@ -1,2 +1,3 @@
+export const sessionTimeout = 30;
 export const session = true;
`);

    const result = runDetectorsWithStatuses(
      {
        source: "cli",
        text: "Refactor project architecture"
      },
      diff,
      {
        taskContract: {
          ...emptyTaskContract,
          goal: "Refactor project architecture",
          forbiddenPaths: ["src/auth/**"]
        }
      },
      [scopeDetector]
    );

    expect(result.findings).toEqual([
      expect.objectContaining({
        id: "scope:forbidden-path:src/auth/session.ts",
        detector: "scope",
        severity: "blocker",
        title: "Forbidden path changed by task contract",
        message: "src/auth/session.ts changed even though the task contract forbids src/auth/**.",
        repair:
          "Remove the forbidden-path change or update the task contract with explicit reviewer approval.",
        tags: ["scope"]
      })
    ]);
    expect(result.detectorRuns).toEqual([
      expect.objectContaining({
        detector: "scope",
        status: "findings",
        findingCount: 1
      })
    ]);
  });

  it("does not emit contract findings for files inside allowed task-contract paths", () => {
    const diff = parse(`diff --git a/src/profile/heading.ts b/src/profile/heading.ts
index 57b22a0..cb3e0f1 100644
--- a/src/profile/heading.ts
+++ b/src/profile/heading.ts
@@ -1,2 +1,3 @@
+export const profileHeadingWeight = 700;
 export const profileHeading = true;
`);

    expect(
      scopeDetector.run({
        task: {
          source: "cli",
          text: "Correct profile heading font weight"
        },
        diff,
        context: {
          taskContract: {
            ...emptyTaskContract,
            goal: "Correct profile heading font weight",
            allowedPaths: ["src/profile/**"]
          }
        }
      })
    ).toEqual([]);
  });

  it("emits blocker findings for files outside allowed task-contract paths", () => {
    const diff = parse(`diff --git a/src/auth/session.ts b/src/auth/session.ts
index 57b22a0..cb3e0f1 100644
--- a/src/auth/session.ts
+++ b/src/auth/session.ts
@@ -1,2 +1,3 @@
+export const sessionTimeout = 30;
 export const session = true;
`);

    const findings = scopeDetector.run({
      task: {
        source: "cli",
        text: "Correct profile heading font weight"
      },
      diff,
      context: {
        taskContract: {
          ...emptyTaskContract,
          goal: "Correct profile heading font weight",
          allowedPaths: ["src/profile/**", "tests/profile/**"]
        }
      }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        id: "scope:outside-allowed-path:src/auth/session.ts",
        detector: "scope",
        severity: "blocker",
        title: "Path outside task contract allowed paths",
        message:
          "src/auth/session.ts changed outside the task contract allowed paths: src/profile/**, tests/profile/**.",
        repair:
          "Remove the out-of-contract change or update the task contract with explicit reviewer approval.",
        tags: ["scope"]
      })
    ]);
  });

  it("enforces allowed task-contract paths even on broad tasks", () => {
    const diff = parse(`diff --git a/src/logger.ts b/src/logger.ts
index 57b22a0..cb3e0f1 100644
--- a/src/logger.ts
+++ b/src/logger.ts
@@ -1,2 +1,3 @@
+export const verbose = true;
 export const logger = true;
`);

    const result = runDetectorsWithStatuses(
      {
        source: "cli",
        text: "Refactor project logging architecture"
      },
      diff,
      {
        taskContract: {
          ...emptyTaskContract,
          goal: "Refactor project logging architecture",
          allowedPaths: ["src/platform/**"]
        }
      },
      [scopeDetector]
    );

    expect(result.findings).toEqual([
      expect.objectContaining({
        id: "scope:outside-allowed-path:src/logger.ts",
        severity: "blocker"
      })
    ]);
    expect(result.detectorRuns).toEqual([
      expect.objectContaining({
        detector: "scope",
        status: "findings",
        findingCount: 1
      })
    ]);
  });

  it("reports forbidden path findings instead of duplicate allowed-path findings", () => {
    const diff = parse(`diff --git a/src/auth/session.ts b/src/auth/session.ts
index 57b22a0..cb3e0f1 100644
--- a/src/auth/session.ts
+++ b/src/auth/session.ts
@@ -1,2 +1,3 @@
+export const sessionTimeout = 30;
 export const session = true;
`);

    const findings = scopeDetector.run({
      task,
      diff,
      context: {
        taskContract: {
          ...emptyTaskContract,
          allowedPaths: ["src/**"],
          forbiddenPaths: ["src/auth/**"]
        }
      }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        id: "scope:forbidden-path:src/auth/session.ts",
        title: "Forbidden path changed by task contract"
      })
    ]);
    expect(findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "scope:outside-allowed-path:src/auth/session.ts"
        })
      ])
    );
  });

  it("marks medium task scope checks as insufficient context", () => {
    const diff = parse(`diff --git a/src/logger.ts b/src/logger.ts
index 57b22a0..cb3e0f1 100644
--- a/src/logger.ts
+++ b/src/logger.ts
@@ -1,2 +1,3 @@
+export const verbose = true;
 export const logger = true;
`);

    const result = runDetectorsWithStatuses(
      {
        source: "cli",
        text: "Coordinate platform observability output across backend response handling and service diagnostics"
      },
      diff,
      undefined,
      [scopeDetector]
    );

    expect(result.detectorRuns).toEqual([
      expect.objectContaining({
        detector: "scope",
        status: "insufficient-context",
        reason:
          "Task complexity is medium; scope needs an explicit task contract or ownership context."
      })
    ]);
  });

  it("passes a medium task when a provided contract fully defines its scope boundary", () => {
    const diff = parse(`diff --git a/packages/profile/src/form.ts b/packages/profile/src/form.ts
index 57b22a0..cb3e0f1 100644
--- a/packages/profile/src/form.ts
+++ b/packages/profile/src/form.ts
@@ -1 +1,2 @@
+export const validation = true;
 export const form = true;
`);
    const result = runDetectorsWithStatuses(
      { source: "cli", text: "Implement profile form component" },
      diff,
      {
        taskContract: {
          ...emptyTaskContract,
          source: "provided",
          goal: "Implement profile form component",
          allowedPaths: ["packages/profile/**"]
        }
      },
      [scopeDetector]
    );

    expect(result.findings).toEqual([]);
    expect(result.detectorRuns).toEqual([
      expect.objectContaining({ detector: "scope", status: "passed" })
    ]);
  });

  it("reports an unaligned changed package when another package matches the task", () => {
    const diff = parse(`diff --git a/packages/profile/src/form.ts b/packages/profile/src/form.ts
index 57b22a0..cb3e0f1 100644
--- a/packages/profile/src/form.ts
+++ b/packages/profile/src/form.ts
@@ -1 +1,2 @@
+export const validation = true;
 export const form = true;
diff --git a/packages/auth/docs/session.md b/packages/auth/docs/session.md
index 57b22a0..cb3e0f1 100644
--- a/packages/auth/docs/session.md
+++ b/packages/auth/docs/session.md
@@ -1 +1,2 @@
 # Session
+Unrelated note.
`);
    const findings = scopeDetector.run({
      task: { source: "cli", text: "Update profile package and document form behavior" },
      diff,
      context: {
        monorepo: {
          configFiles: ["pnpm-workspace.yaml"],
          workspaceGlobs: ["packages/*"],
          packages: [
            { path: "packages/profile", name: "@example/profile" },
            { path: "packages/auth", name: "@example/auth" }
          ]
        }
      }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        id: "scope:package-ownership:packages/auth",
        severity: "medium",
        title: "Changed package outside task-aligned ownership",
        message:
          "Package @example/auth (packages/auth) changed while the task aligns with changed package ownership: packages/profile."
      })
    ]);
  });

  it("does not report package ownership drift for explicitly allowed contract paths", () => {
    const diff =
      parse(`diff --git a/packages/components/src/context-menu.ts b/packages/components/src/context-menu.ts
new file mode 100644
index 0000000..cb3e0f1
--- /dev/null
+++ b/packages/components/src/context-menu.ts
@@ -0,0 +1 @@
+export const contextMenu = true;
diff --git a/packages/agents/src/component-hints/context-menu.json b/packages/agents/src/component-hints/context-menu.json
new file mode 100644
index 0000000..cb3e0f1
--- /dev/null
+++ b/packages/agents/src/component-hints/context-menu.json
@@ -0,0 +1 @@
+{"tagName":"ds-context-menu"}
`);
    const findings = scopeDetector.run({
      task: { source: "cli", text: "Develop a ContextMenu component and its agent metadata" },
      diff,
      context: {
        taskContract: {
          source: "provided",
          goal: "Develop ContextMenu and its agent metadata",
          allowedPaths: [
            "packages/components/src/context-menu.ts",
            "packages/agents/src/component-hints/context-menu.json"
          ],
          forbiddenPaths: [],
          expectedArtifacts: [],
          invariants: [],
          requiredChecks: []
        },
        monorepo: {
          configFiles: ["pnpm-workspace.yaml"],
          workspaceGlobs: ["packages/*"],
          packages: [
            { path: "packages/components", name: "@example/components" },
            { path: "packages/agents", name: "@example/agents" }
          ]
        }
      }
    });

    expect(findings).toEqual([]);
  });

  it("uses changed exported symbols to align a package with task targets", () => {
    const diff = parse(`diff --git a/packages/forms/src/profile.ts b/packages/forms/src/profile.ts
index 57b22a0..cb3e0f1 100644
--- a/packages/forms/src/profile.ts
+++ b/packages/forms/src/profile.ts
@@ -1 +1,2 @@
+export const profileValidator = true;
 export const form = true;
diff --git a/packages/auth/docs/session.md b/packages/auth/docs/session.md
index 57b22a0..cb3e0f1 100644
--- a/packages/auth/docs/session.md
+++ b/packages/auth/docs/session.md
@@ -1 +1,2 @@
 # Session
+Unrelated note.
`);
    const findings = scopeDetector.run({
      task: {
        source: "cli",
        text: "Update profile validator and document validation behavior"
      },
      diff,
      context: {
        repositoryTokenIndex: buildRepositoryTokenIndex({ files: diff.files }),
        monorepo: {
          configFiles: ["pnpm-workspace.yaml"],
          workspaceGlobs: ["packages/*"],
          packages: [
            { path: "packages/forms", name: "@example/forms" },
            { path: "packages/auth", name: "@example/auth" }
          ]
        }
      }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        id: "scope:package-ownership:packages/auth",
        evidence: expect.arrayContaining([
          expect.objectContaining({
            kind: "metric",
            message: expect.stringContaining("packages/forms=profileValidator")
          })
        ])
      })
    ]);
  });

  it("does not align a package from one generic changed-symbol token", () => {
    const diff = parse(`diff --git a/packages/forms/src/profile.ts b/packages/forms/src/profile.ts
index 57b22a0..cb3e0f1 100644
--- a/packages/forms/src/profile.ts
+++ b/packages/forms/src/profile.ts
@@ -1 +1,2 @@
+export const profileValidator = true;
 export const form = true;
diff --git a/packages/auth/docs/session.md b/packages/auth/docs/session.md
index 57b22a0..cb3e0f1 100644
--- a/packages/auth/docs/session.md
+++ b/packages/auth/docs/session.md
@@ -1 +1,2 @@
 # Session
+Unrelated note.
`);

    expect(
      scopeDetector.run({
        task: { source: "cli", text: "Update profile and document behavior" },
        diff,
        context: {
          repositoryTokenIndex: buildRepositoryTokenIndex({ files: diff.files }),
          monorepo: {
            configFiles: ["pnpm-workspace.yaml"],
            workspaceGlobs: ["packages/*"],
            packages: [
              { path: "packages/forms", name: "@example/forms" },
              { path: "packages/auth", name: "@example/auth" }
            ]
          }
        }
      })
    ).toEqual([]);
  });

  it("treats an import-connected package as support but keeps scope uncertain", () => {
    const diff = parse(`diff --git a/packages/profile/src/form.ts b/packages/profile/src/form.ts
index 57b22a0..cb3e0f1 100644
--- a/packages/profile/src/form.ts
+++ b/packages/profile/src/form.ts
@@ -1 +1,2 @@
+export const validation = true;
 export const form = true;
diff --git a/packages/auth/src/session.ts b/packages/auth/src/session.ts
index 57b22a0..cb3e0f1 100644
--- a/packages/auth/src/session.ts
+++ b/packages/auth/src/session.ts
@@ -1 +1,2 @@
+export const timeout = 30;
 export const session = true;
`);
    const context = {
      monorepo: {
        configFiles: ["pnpm-workspace.yaml"],
        workspaceGlobs: ["packages/*"],
        packages: [
          { path: "packages/profile", name: "@example/profile" },
          { path: "packages/auth", name: "@example/auth" }
        ]
      },
      knowledge: knowledge({
        nodes: [],
        edges: [
          {
            from: "packages/profile/src/form.ts",
            to: "packages/auth/src/session.ts",
            kind: "import",
            weight: 1,
            evidence: "Relative import."
          }
        ]
      })
    };

    expect(
      scopeDetector.run({
        task: { source: "cli", text: "Update profile package and document form behavior" },
        diff,
        context
      })
    ).toEqual([]);

    expect(
      runDetectorsWithStatuses(
        { source: "cli", text: "Update profile package and document form behavior" },
        diff,
        context,
        [scopeDetector]
      ).detectorRuns
    ).toEqual([
      expect.objectContaining({
        detector: "scope",
        status: "insufficient-context"
      })
    ]);
  });

  it("does not use an import edge unless both endpoints changed", () => {
    const diff = parse(`diff --git a/packages/profile/src/form.ts b/packages/profile/src/form.ts
index 57b22a0..cb3e0f1 100644
--- a/packages/profile/src/form.ts
+++ b/packages/profile/src/form.ts
@@ -1 +1,2 @@
+export const validation = true;
 export const form = true;
diff --git a/packages/auth/src/session.ts b/packages/auth/src/session.ts
index 57b22a0..cb3e0f1 100644
--- a/packages/auth/src/session.ts
+++ b/packages/auth/src/session.ts
@@ -1 +1,2 @@
+export const timeout = 30;
 export const session = true;
`);

    expect(
      scopeDetector.run({
        task: { source: "cli", text: "Update profile package and document form behavior" },
        diff,
        context: {
          monorepo: {
            configFiles: ["pnpm-workspace.yaml"],
            workspaceGlobs: ["packages/*"],
            packages: [
              { path: "packages/profile", name: "@example/profile" },
              { path: "packages/auth", name: "@example/auth" }
            ]
          },
          knowledge: knowledge({
            nodes: [],
            edges: [
              {
                from: "packages/profile/src/unchanged.ts",
                to: "packages/auth/src/session.ts",
                kind: "import",
                weight: 1
              }
            ]
          })
        }
      })
    ).toEqual([expect.objectContaining({ id: "scope:package-ownership:packages/auth" })]);
  });

  it("keeps a forbidden-only provided contract insufficient for broad allowed scope", () => {
    const diff = parse(`diff --git a/packages/profile/src/form.ts b/packages/profile/src/form.ts
index 57b22a0..cb3e0f1 100644
--- a/packages/profile/src/form.ts
+++ b/packages/profile/src/form.ts
@@ -1 +1,2 @@
+export const validation = true;
 export const form = true;
`);
    const result = runDetectorsWithStatuses(
      { source: "cli", text: "Implement profile form component" },
      diff,
      {
        taskContract: {
          ...emptyTaskContract,
          source: "provided",
          goal: "Implement profile form component",
          forbiddenPaths: ["packages/auth/**"]
        }
      },
      [scopeDetector]
    );

    expect(result.detectorRuns).toEqual([
      expect.objectContaining({
        detector: "scope",
        status: "insufficient-context"
      })
    ]);
  });

  it("keeps medium package-aligned scope insufficient at file level", () => {
    const diff = parse(`diff --git a/packages/profile/src/form.ts b/packages/profile/src/form.ts
index 57b22a0..cb3e0f1 100644
--- a/packages/profile/src/form.ts
+++ b/packages/profile/src/form.ts
@@ -1 +1,2 @@
+export const validation = true;
 export const form = true;
`);
    const result = runDetectorsWithStatuses(
      { source: "cli", text: "Implement profile form component" },
      diff,
      {
        monorepo: {
          configFiles: ["pnpm-workspace.yaml"],
          workspaceGlobs: ["packages/*"],
          typescriptPathAliases: ["@profile/*"],
          packages: [{ path: "packages/profile", name: "@example/profile" }]
        }
      },
      [scopeDetector]
    );

    expect(result.findings).toEqual([]);
    expect(result.detectorRuns).toEqual([
      expect.objectContaining({
        detector: "scope",
        status: "insufficient-context",
        reason:
          "Task-aligned package ownership was evaluated (packages/profile), but file-level scope still needs an explicit task contract."
      })
    ]);
  });

  it("reports when ownership exists but no changed package matches the task", () => {
    const diff = parse(`diff --git a/packages/auth/src/session.ts b/packages/auth/src/session.ts
index 57b22a0..cb3e0f1 100644
--- a/packages/auth/src/session.ts
+++ b/packages/auth/src/session.ts
@@ -1 +1,2 @@
+export const timeout = 30;
 export const session = true;
`);
    const result = runDetectorsWithStatuses(
      { source: "cli", text: "Implement profile form component" },
      diff,
      {
        monorepo: {
          configFiles: ["pnpm-workspace.yaml"],
          workspaceGlobs: ["packages/*"],
          packages: [{ path: "packages/auth", name: "@example/auth" }]
        }
      },
      [scopeDetector]
    );

    expect(result.findings).toEqual([]);
    expect(result.detectorRuns).toEqual([
      expect.objectContaining({
        detector: "scope",
        status: "insufficient-context",
        reason:
          "Changed package ownership was available, but no package matched the task targets: packages/auth."
      })
    ]);
  });

  it("does not emit for workflow changes when the task mentions CI", () => {
    const diff = parse(`diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 57b22a0..cb3e0f1 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -1,2 +1,2 @@
-node-version: 20
+node-version: 24
`);

    expect(
      scopeDetector.run({
        task: {
          source: "cli",
          text: "Fix CI Node version for pnpm"
        },
        diff
      })
    ).toEqual([]);
  });

  it("emits for config changes when the task explicitly forbids config edits", () => {
    const diff = parse(`diff --git a/.node-version b/.node-version
index 57b22a0..cb3e0f1 100644
--- a/.node-version
+++ b/.node-version
@@ -1 +1 @@
-22.12.0
+24.0.0
diff --git a/src/components/ArtistIntro.astro b/src/components/ArtistIntro.astro
index 57b22a0..cb3e0f1 100644
--- a/src/components/ArtistIntro.astro
+++ b/src/components/ArtistIntro.astro
@@ -1,3 +1,3 @@
 <section class="artist-intro">
-  <p>Original spacing</p>
+  <p class="artist-intro__lede">Original spacing</p>
 </section>
`);

    const findings = scopeDetector.run({
      task: {
        source: "cli",
        text: "Adjust ArtistIntro spacing without changing config"
      },
      diff
    });

    expect(findings).toEqual([
      expect.objectContaining({
        detector: "scope",
        severity: "high",
        message: ".node-version changed during a small task but does not align with expected scope."
      })
    ]);
  });

  it("emits for config changes when a Spanish task explicitly forbids them", () => {
    const diff = parse(`diff --git a/.node-version b/.node-version
index 57b22a0..cb3e0f1 100644
--- a/.node-version
+++ b/.node-version
@@ -1 +1 @@
-22.12.0
+24.0.0
`);

    expect(
      scopeDetector.run({
        task: {
          source: "cli",
          text: "Mejora la ventana sin modificar la configuración"
        },
        diff
      })
    ).toEqual([
      expect.objectContaining({
        detector: "scope",
        severity: "high",
        evidence: [expect.objectContaining({ path: ".node-version" })]
      })
    ]);
  });

  it("does not emit for package engine changes when the task mentions Node", () => {
    const diff = parse(`diff --git a/package.json b/package.json
index 57b22a0..cb3e0f1 100644
--- a/package.json
+++ b/package.json
@@ -1,5 +1,5 @@
 {
   "name": "example",
-  "engines": {"node": ">=20"}
+  "engines": {"node": ">=22.13"}
 }
`);

    expect(
      scopeDetector.run({
        task: {
          source: "cli",
          text: "Fix Node runtime support for pnpm"
        },
        diff
      })
    ).toEqual([]);
  });

  it("does not emit for package metadata changes when the task mentions Marketplace", () => {
    const diff = parse(`diff --git a/extensions/vscode/package.json b/extensions/vscode/package.json
index 57b22a0..cb3e0f1 100644
--- a/extensions/vscode/package.json
+++ b/extensions/vscode/package.json
@@ -1,5 +1,6 @@
 {
   "name": "critical-gate",
+  "publisher": "criticaldeveloper",
   "displayName": "Critical-Gate"
 }
`);

    expect(
      scopeDetector.run({
        task: {
          source: "cli",
          text: "Prepare VS Code Marketplace metadata"
        },
        diff
      })
    ).toEqual([]);
  });

  it("does not emit for explicitly requested package dependency upgrades", () => {
    const diff = parse(`diff --git a/package.json b/package.json
index 57b22a0..cb3e0f1 100644
--- a/package.json
+++ b/package.json
@@ -2,7 +2,7 @@
   "devDependencies": {
-    "critical-gate": "2.6.0",
+    "critical-gate": "2.7.0",
     "typescript": "^5.9.3"
   }
diff --git a/bun.lock b/bun.lock
index 57b22a0..cb3e0f1 100644
--- a/bun.lock
+++ b/bun.lock
@@ -1 +1 @@
-"critical-gate": ["critical-gate@2.6.0", "", {}, "sha512-old"]
+"critical-gate": ["critical-gate@2.7.0", "", {}, "sha512-new"]
`);

    expect(
      scopeDetector.run({
        task: {
          source: "cli",
          text: "Upgrade Critical Gate to 2.7.0 controlled dogfood calibration"
        },
        diff
      })
    ).toEqual([]);
  });

  it("does not emit for version-only release manifest changes", () => {
    const diff = parse(`diff --git a/package.json b/package.json
index 57b22a0..cb3e0f1 100644
--- a/package.json
+++ b/package.json
@@ -1,5 +1,5 @@
 {
   "name": "example",
-  "version": "1.2.2",
+  "version": "1.2.3",
   "type": "module"
 }
`);

    expect(
      scopeDetector.run({
        task: {
          source: "cli",
          text: "1.2.3"
        },
        diff
      })
    ).toEqual([]);
  });

  it("does not emit for version-only manifest changes in bugfix tasks", () => {
    const diff = parse(`diff --git a/package.json b/package.json
index 57b22a0..cb3e0f1 100644
--- a/package.json
+++ b/package.json
@@ -1,5 +1,5 @@
 {
   "name": "critical-gate",
-  "version": "2.1.0",
+  "version": "2.1.1",
   "type": "module"
 }
diff --git a/extensions/vscode/package.json b/extensions/vscode/package.json
index 57b22a0..cb3e0f1 100644
--- a/extensions/vscode/package.json
+++ b/extensions/vscode/package.json
@@ -1,5 +1,5 @@
 {
   "name": "critical-gate-vscode",
-  "version": "2.1.0",
+  "version": "2.1.1",
   "publisher": "criticaldeveloper"
 }
`);

    expect(
      scopeDetector.run({
        task: {
          source: "cli",
          text: "Fix global CLI entrypoint execution"
        },
        diff
      })
    ).toEqual([]);
  });

  it("still emits for non-version manifest changes during release tasks", () => {
    const diff = parse(`diff --git a/package.json b/package.json
index 57b22a0..cb3e0f1 100644
--- a/package.json
+++ b/package.json
@@ -1,5 +1,6 @@
 {
   "name": "example",
   "version": "1.2.3",
+  "dependencies": {"left-pad": "^1.3.0"},
   "type": "module"
 }
`);

    expect(
      scopeDetector.run({
        task: {
          source: "cli",
          text: "Release 1.2.3"
        },
        diff
      })
    ).toEqual([
      expect.objectContaining({
        detector: "scope",
        severity: "high",
        message: "package.json changed during a small task but does not align with expected scope."
      })
    ]);
  });

  it("does not flag explicitly requested multi-area UI presentation files", () => {
    const diff = parse(`diff --git a/src/views/AboutView.astro b/src/views/AboutView.astro
index 57b22a0..cb3e0f1 100644
--- a/src/views/AboutView.astro
+++ b/src/views/AboutView.astro
@@ -1 +1 @@
-<article class="about-card">
+<article class="about-card about-card--wide">
diff --git a/src/views/ProjectsView.astro b/src/views/ProjectsView.astro
index 57b22a0..cb3e0f1 100644
--- a/src/views/ProjectsView.astro
+++ b/src/views/ProjectsView.astro
@@ -1 +1 @@
-<span class="project-card__arrow">-></span>
+<span class="project-card__arrow" aria-hidden="true">-></span>
`);

    expect(
      scopeDetector.run({
        task: {
          source: "cli",
          text: "Masonry-align about cards and fix project card arrow"
        },
        diff
      })
    ).toEqual([]);
  });

  it("does not flag selector-local article hero overflow stylesheet fixes", () => {
    const diff = parse(`diff --git a/src/styles/post.scss b/src/styles/post.scss
index 57b22a0..cb3e0f1 100644
--- a/src/styles/post.scss
+++ b/src/styles/post.scss
@@ -1,8 +1,9 @@
 .post-detail__hero-title {
-  font-size: 5rem;
+  font-size: clamp(2.75rem, 9vw, 5rem);
   line-height: 0.95;
+  overflow-wrap: anywhere;
 }
 @media (max-width: 48rem) {
   .post-detail__hero-title {
-    max-width: 18rem;
+    max-width: 100%;
   }
 }
`);

    expect(
      scopeDetector.run({
        task: {
          source: "cli",
          text: "Fix article detail hero title overflow"
        },
        diff
      })
    ).toEqual([]);
  });
});

describe("detector runner with scope findings", () => {
  it("summarizes scope findings and diff cost score", () => {
    const diff = parse(`diff --git a/webpack.config.js b/webpack.config.js
index 57b22a0..cb3e0f1 100644
--- a/webpack.config.js
+++ b/webpack.config.js
@@ -1,2 +1,3 @@
+export const cache = true;
 export default {};
`);

    const findings = runDetectors(task, diff);

    expect(summarizeFindings(findings, task, diff)).toMatchObject({
      decision: "fail",
      findingCount: 2,
      highCount: 1,
      mediumCount: 1
    });
    expect(summarizeFindings(findings, task, diff).diffCostScore).toBeGreaterThan(0);
  });
});
