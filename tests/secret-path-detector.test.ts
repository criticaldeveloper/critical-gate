import {
  parseUnifiedDiff,
  runDetectors,
  secretPathDetector,
  summarizeFindings
} from "../src/index.js";
import type { GateResult, TaskIntent } from "../src/index.js";

const task: TaskIntent = {
  source: "cli",
  text: "Add signup validation"
};

function parse(diffText: string): GateResult["diff"] {
  return {
    files: parseUnifiedDiff(diffText)
  };
}

describe("secretPathDetector", () => {
  it("emits a blocker with redacted evidence for secret-like assignments", () => {
    const fakeSecret = ["super", "secretvalue12345"].join("");
    const diff = parse(`diff --git a/src/config.ts b/src/config.ts
index 57b22a0..cb3e0f1 100644
--- a/src/config.ts
+++ b/src/config.ts
@@ -1,2 +1,3 @@
+export const API_SECRET = "${fakeSecret}";
 export const enabled = true;
`);

    const findings = secretPathDetector.run({ task, diff });

    expect(findings).toEqual([
      expect.objectContaining({
        detector: "secret-path",
        severity: "blocker",
        title: "Possible hardcoded secret added",
        message: "The diff adds a secret-like assignment.",
        repair:
          "Move the value to a secret manager or environment variable and rotate it if it was real.",
        tags: ["secret"]
      })
    ]);
    expect(findings[0]?.evidence[0]).toMatchObject({
      kind: "line",
      path: "src/config.ts",
      message: 'export const API_SECRET = "sup...[redacted]...45";',
      data: {
        signal: "secret-assignment"
      }
    });
    expect(findings[0]?.evidence[0]?.message).not.toContain(fakeSecret);
  });

  it("emits a blocker for provider token patterns", () => {
    const fakeToken = ["sk-", "abcdefghijklmnopqrstuvwxyz"].join("");
    const diff = parse(`diff --git a/.env.example b/.env.example
index 57b22a0..cb3e0f1 100644
--- a/.env.example
+++ b/.env.example
@@ -1 +1,2 @@
+OPENAI_API_KEY=${fakeToken}
`);

    const findings = secretPathDetector.run({ task, diff });

    expect(findings).toEqual([
      expect.objectContaining({
        severity: "blocker",
        title: "Possible hardcoded secret added"
      }),
      expect.objectContaining({
        severity: "blocker",
        title: "Provider token pattern added"
      })
    ]);
    expect(findings.map((finding) => finding.evidence[0]?.message).join("\n")).not.toContain(
      fakeToken
    );
  });

  it("emits medium severity for absolute local filesystem paths", () => {
    const diff = parse(`diff --git a/src/config.ts b/src/config.ts
index 57b22a0..cb3e0f1 100644
--- a/src/config.ts
+++ b/src/config.ts
@@ -1 +1,2 @@
+export const cachePath = "/Users/marc/project/tmp/cache";
`);

    const findings = secretPathDetector.run({ task, diff });

    expect(findings).toEqual([
      expect.objectContaining({
        severity: "medium",
        title: "Environment-specific absolute path added",
        message: "The diff adds an absolute local filesystem path."
      })
    ]);
    expect(findings[0]?.evidence[0]?.message).not.toContain("/Users/marc/project/tmp/cache");
  });

  it("emits medium severity for internal or local URLs", () => {
    const diff = parse(`diff --git a/src/config.ts b/src/config.ts
index 57b22a0..cb3e0f1 100644
--- a/src/config.ts
+++ b/src/config.ts
@@ -1 +1,2 @@
+export const apiUrl = "http://service.internal:8080/api";
`);

    const findings = secretPathDetector.run({ task, diff });

    expect(findings).toEqual([
      expect.objectContaining({
        severity: "medium",
        title: "Internal or local URL added",
        repair:
          "Move environment-specific URLs to configuration and document the expected variable."
      })
    ]);
    expect(findings[0]?.evidence[0]?.message).not.toContain("service.internal");
  });

  it("ignores local URL examples in documentation", () => {
    const diff = parse(`diff --git a/readme.md b/readme.md
index 57b22a0..cb3e0f1 100644
--- a/readme.md
+++ b/readme.md
@@ -1 +1,2 @@
+const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
`);

    expect(secretPathDetector.run({ task, diff })).toEqual([]);
  });

  it("ignores local URL examples in tests", () => {
    const diff = parse(`diff --git a/tests/config.test.ts b/tests/config.test.ts
index 57b22a0..cb3e0f1 100644
--- a/tests/config.test.ts
+++ b/tests/config.test.ts
@@ -1 +1,2 @@
+expect(getBaseUrl()).toBe('http://localhost:3000');
`);

    expect(secretPathDetector.run({ task, diff })).toEqual([]);
  });

  it("still emits blocker token findings in documentation", () => {
    const fakeToken = ["ghp_", "abcdefghijklmnopqrstuvwxyz123456"].join("");
    const diff = parse(`diff --git a/readme.md b/readme.md
index 57b22a0..cb3e0f1 100644
--- a/readme.md
+++ b/readme.md
@@ -1 +1,2 @@
+GITHUB_TOKEN=${fakeToken}
`);

    expect(secretPathDetector.run({ task, diff })).toEqual([
      expect.objectContaining({
        severity: "blocker",
        title: "Possible hardcoded secret added"
      }),
      expect.objectContaining({
        severity: "blocker",
        title: "Provider token pattern added"
      })
    ]);
  });

  it("ignores deleted secret-like lines", () => {
    const fakeSecret = ["super", "secretvalue12345"].join("");
    const diff = parse(`diff --git a/src/config.ts b/src/config.ts
index 57b22a0..cb3e0f1 100644
--- a/src/config.ts
+++ b/src/config.ts
@@ -1,2 +1 @@
-export const API_SECRET = "${fakeSecret}";
 export const enabled = true;
`);

    expect(secretPathDetector.run({ task, diff })).toEqual([]);
  });
});

describe("detector runner with secret and path findings", () => {
  it("summarizes blocker secret findings into a failing gate decision", () => {
    const fakeToken = ["ghp_", "abcdefghijklmnopqrstuvwxyz123456"].join("");
    const diff = parse(`diff --git a/src/config.ts b/src/config.ts
index 57b22a0..cb3e0f1 100644
--- a/src/config.ts
+++ b/src/config.ts
@@ -1 +1,2 @@
+export const token = "${fakeToken}";
`);

    const findings = runDetectors(task, diff);

    expect(summarizeFindings(findings)).toMatchObject({
      decision: "fail",
      blockerCount: 2
    });
  });
});
