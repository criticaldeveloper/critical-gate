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

  it("keeps repair contract scope fields stable for multi-file findings", () => {
    const multiFileFinding: Finding = {
      id: "expected-companions:src/signup.ts:tests/signup.test.ts",
      detector: "expected-companions",
      severity: "medium",
      confidence: 0.78,
      title: "Expected companion file missing",
      message: "Source changes usually move with signup tests.",
      evidence: [
        {
          kind: "file",
          path: "src/signup.ts",
          message: "Changed source file.",
          data: {
            expectedPath: "tests/signup.test.ts",
            changedPath: "src/signup.ts"
          }
        }
      ],
      repair: "Add or update the expected signup test, or document why it is not needed.",
      tags: ["scope"]
    };
    const changedFiles: DiffFile[] = [
      ...files,
      {
        path: "README.md",
        status: "modified",
        role: "docs",
        additions: 1,
        deletions: 0,
        language: "markdown",
        hunks: []
      },
      {
        path: "docs/rollout.md",
        status: "modified",
        role: "docs",
        additions: 1,
        deletions: 0,
        language: "markdown",
        hunks: []
      }
    ];

    expect(buildRepairContract(multiFileFinding, changedFiles)).toEqual({
      instructions: [
        "Add or update the expected signup test, or document why it is not needed.",
        "Keep the repair limited to the allowed files unless the task intent explicitly requires more.",
        "Do not broaden scope, add dependencies, weaken tests, or rewrite unrelated code while repairing this finding."
      ],
      allowedFiles: ["src/signup.ts", "tests/signup.test.ts"],
      forbiddenFiles: ["package.json", "README.md", "docs/rollout.md"],
      successCriteria: [
        "The finding expected-companions:src/signup.ts:tests/signup.test.ts no longer appears after rerunning Critical Gate.",
        "The original task intent is still satisfied.",
        "No new blocker or high-severity Critical Gate finding is introduced."
      ]
    });
  });
});
