import { buildRepairContract, type DiffFile, type Finding } from "../src/index.js";

const files: DiffFile[] = [
  {
    path: "package.json",
    status: "modified",
    role: "manifest",
    additions: 1,
    deletions: 0,
    language: "json",
    hunks: []
  },
  {
    path: "src/signup.ts",
    status: "modified",
    role: "source",
    additions: 2,
    deletions: 1,
    language: "typescript",
    hunks: []
  }
];

const finding: Finding = {
  id: "dependency-addition:package.json:dependencies:axios",
  detector: "dependency",
  severity: "blocker",
  confidence: 0.94,
  title: "Unjustified production dependency added",
  message: "axios was added without visible task justification.",
  evidence: [
    {
      kind: "manifest",
      path: "package.json",
      startLine: 10,
      message: "axios"
    }
  ],
  repair: "Remove axios unless it is required.",
  tags: ["dependency"]
};

describe("repair contracts", () => {
  it("limits agent repair scope to evidence-backed files", () => {
    const contract = buildRepairContract(finding, files);

    expect(contract.instructions).toEqual(
      expect.arrayContaining([
        "Remove axios unless it is required.",
        "Keep the repair limited to the allowed files unless the task intent explicitly requires more."
      ])
    );
    expect(contract.allowedFiles).toEqual(["package.json"]);
    expect(contract.forbiddenFiles).toEqual(["src/signup.ts"]);
    expect(contract.successCriteria).toEqual(
      expect.arrayContaining([
        "The finding dependency-addition:package.json:dependencies:axios no longer appears after rerunning Critical Gate."
      ])
    );
  });
});
