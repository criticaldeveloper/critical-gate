import { existingSolutionDetector, parseUnifiedDiff } from "../src/index.js";
import type { GateResult, KnowledgeProvider, SolutionIndex, TaskIntent } from "../src/index.js";

const task: TaskIntent = {
  source: "cli",
  text: "Add signup helpers"
};

const solutionIndex: SolutionIndex = {
  solutions: [
    {
      path: "src/utils/date.ts",
      class: "utility",
      normalizedName: "formatdate",
      exportedName: "formatDate",
      arity: 1,
      importTokens: [],
      domainTokens: ["date", "format", "src", "utils"]
    },
    {
      path: "src/hooks/use-user.ts",
      class: "hook",
      normalizedName: "useuser",
      exportedName: "useUser",
      arity: 1,
      returnType: "User",
      importTokens: ["react"],
      domainTokens: ["hooks", "src", "use", "user"]
    },
    {
      path: "src/validators/email.ts",
      class: "validator",
      normalizedName: "validateemail",
      exportedName: "validateEmail",
      arity: 1,
      returnType: "boolean",
      importTokens: ["zod"],
      domainTokens: ["email", "src", "validate", "validators"]
    },
    {
      path: "src/services/user-service.ts",
      class: "service",
      normalizedName: "userservice",
      exportedName: "UserService",
      importTokens: [],
      domainTokens: ["service", "services", "src", "user"]
    }
  ]
};

function parse(diffText: string): GateResult["diff"] {
  return {
    files: parseUnifiedDiff(diffText)
  };
}

function knowledge(index: SolutionIndex): KnowledgeProvider {
  return {
    getFileGraph: () => ({ nodes: [], edges: [] }),
    getHistoryIndex: () => ({ coChanges: [], companionRules: [] }),
    getPatternIndex: () => ({ patterns: [] }),
    getSolutionIndex: () => index
  };
}

describe("existingSolutionDetector", () => {
  it("emits for a new utility duplicating an existing utility", () => {
    const diff = parse(`diff --git a/src/helpers/date-utils.ts b/src/helpers/date-utils.ts
new file mode 100644
index 0000000..cb3e0f1
--- /dev/null
+++ b/src/helpers/date-utils.ts
@@ -0,0 +1 @@
+export function formatDateForSignup(value: Date): string { return ""; }
`);

    expect(
      existingSolutionDetector.run({ task, diff, context: { knowledge: knowledge(solutionIndex) } })
    ).toEqual([
      expect.objectContaining({
        detector: "existing-solution",
        severity: "medium",
        message:
          "formatDateForSignup was added in src/helpers/date-utils.ts, but formatDate already exists in src/utils/date.ts.",
        repair:
          "Reuse formatDate from src/utils/date.ts, or document why a separate utility is needed."
      })
    ]);
  });

  it("emits for a new hook duplicating an existing hook", () => {
    const diff = parse(`diff --git a/src/hooks/use-user-signup.ts b/src/hooks/use-user-signup.ts
new file mode 100644
index 0000000..cb3e0f1
--- /dev/null
+++ b/src/hooks/use-user-signup.ts
@@ -0,0 +1,2 @@
+import { useMemo } from "react";
+export function useUserSignup(id: string): User { return {} as User; }
`);

    expect(
      existingSolutionDetector.run({ task, diff, context: { knowledge: knowledge(solutionIndex) } })
    ).toEqual([
      expect.objectContaining({
        message:
          "useUserSignup was added in src/hooks/use-user-signup.ts, but useUser already exists in src/hooks/use-user.ts."
      })
    ]);
  });

  it("emits for a validator with matching signature and domain tokens", () => {
    const diff = parse(`diff --git a/src/validators/signup-email.ts b/src/validators/signup-email.ts
new file mode 100644
index 0000000..cb3e0f1
--- /dev/null
+++ b/src/validators/signup-email.ts
@@ -0,0 +1,2 @@
+import { z } from "zod";
+export const checkEmail = (value: string): boolean => true;
`);

    expect(
      existingSolutionDetector.run({ task, diff, context: { knowledge: knowledge(solutionIndex) } })
    ).toEqual([
      expect.objectContaining({
        message:
          "checkEmail was added in src/validators/signup-email.ts, but validateEmail already exists in src/validators/email.ts."
      })
    ]);
  });

  it("does not emit for low-confidence same-class name coincidences", () => {
    const diff = parse(`diff --git a/src/services/order-service.ts b/src/services/order-service.ts
new file mode 100644
index 0000000..cb3e0f1
--- /dev/null
+++ b/src/services/order-service.ts
@@ -0,0 +1 @@
+export class OrderService {}
`);

    expect(
      existingSolutionDetector.run({ task, diff, context: { knowledge: knowledge(solutionIndex) } })
    ).toEqual([]);
  });
});
