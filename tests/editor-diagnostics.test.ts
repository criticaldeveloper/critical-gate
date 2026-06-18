import {
  findingsToEditorDiagnostics,
  groupEditorDiagnosticsByPath,
  toEditorSeverity,
  type Finding
} from "../src/index.js";

const findings: Finding[] = [
  {
    id: "test-weakening-001",
    detector: "test-weakening",
    severity: "high",
    confidence: 0.93,
    title: "Assertion removed",
    message: "A behavioral assertion was removed.",
    repair: "Restore the assertion.",
    tags: ["test"],
    evidence: [
      {
        kind: "line",
        path: "tests/signup.test.ts",
        startLine: 24,
        endLine: 24,
        message: "Removed expect call."
      }
    ]
  },
  {
    id: "scope-001",
    detector: "scope",
    severity: "medium",
    confidence: 0.82,
    title: "Unexpected file",
    message: "The changed file is outside the task scope.",
    repair: "Revert or justify the unrelated change.",
    tags: ["scope"],
    evidence: [
      {
        kind: "file",
        path: "src/analytics.ts",
        message: "File role does not match task keywords."
      }
    ]
  }
];

describe("editor diagnostics", () => {
  it("maps findings into zero-based editor diagnostics", () => {
    const diagnostics = findingsToEditorDiagnostics(findings);

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0]).toMatchObject({
      path: "tests/signup.test.ts",
      severity: "error",
      source: "critical-gate",
      code: "test-weakening-001",
      detector: "test-weakening",
      findingTitle: "Assertion removed",
      range: {
        startLine: 23,
        startColumn: 0,
        endLine: 23
      }
    });
    expect(diagnostics[0]?.message).toContain("Repair: Restore the assertion.");
  });

  it("groups diagnostics by file path for editor collections", () => {
    const grouped = groupEditorDiagnosticsByPath(findingsToEditorDiagnostics(findings));

    expect(grouped.get("tests/signup.test.ts")).toHaveLength(1);
    expect(grouped.get("src/analytics.ts")).toHaveLength(1);
  });

  it("maps Critical Gate severity to editor severity", () => {
    expect(toEditorSeverity("blocker")).toBe("error");
    expect(toEditorSeverity("high")).toBe("error");
    expect(toEditorSeverity("medium")).toBe("warning");
    expect(toEditorSeverity("low")).toBe("information");
    expect(toEditorSeverity("info")).toBe("hint");
  });
});
