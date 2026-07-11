import {
  calibrateFindingConfidence,
  calibrateFindingEvidenceStrength,
  getEvidenceStrengthBand,
  runDetectors,
  summarizeFindings,
  type Finding
} from "../src/index.js";

const highScopeFinding: Finding = {
  id: "scope:tsconfig.json",
  detector: "scope",
  severity: "high",
  confidence: 0.84,
  title: "Unexpected config file changed",
  message: "tsconfig.json changed during a small task.",
  evidence: [{ kind: "file", path: "tsconfig.json", message: "config" }],
  repair: "Remove unrelated config edits.",
  tags: ["scope"]
};

describe("evidence strength thresholds", () => {
  it("classifies evidence strength bands", () => {
    expect(getEvidenceStrengthBand(0.95)).toBe("very-high");
    expect(getEvidenceStrengthBand(0.82)).toBe("high");
    expect(getEvidenceStrengthBand(0.7)).toBe("medium");
    expect(getEvidenceStrengthBand(0.4)).toBe("low");
  });

  it("keeps low-evidence high-severity findings observational", () => {
    expect(
      summarizeFindings([
        {
          ...highScopeFinding,
          confidence: 0.79
        }
      ])
    ).toMatchObject({
      decision: "pass",
      evidenceStrengthSummary: {
        blockingEligibleCount: 0,
        observationModeCount: 0,
        evidenceThresholdSuppressedCount: 1
      },
      confidenceCalibration: {
        blockingEligibleCount: 0,
        observationModeCount: 0,
        confidenceSuppressedCount: 1
      }
    });
  });

  it("keeps high-evidence legacy findings blocking", () => {
    const summary = summarizeFindings([highScopeFinding]);

    expect(summary).toMatchObject({
      decision: "fail",
      evidenceStrengthSummary: {
        blockingEligibleCount: 1,
        observationModeCount: 0,
        evidenceThresholdSuppressedCount: 0
      },
      confidenceCalibration: {
        blockingEligibleCount: 1,
        observationModeCount: 0,
        confidenceSuppressedCount: 0
      }
    });
    expect(summary.policyApplied?.evidenceThresholdSuppressedFindingIds).toEqual([]);
    expect(summary.policyApplied?.confidenceSuppressedFindingIds).toEqual([]);
  });

  it("does not let explicit detector promotion bypass evidence-strength thresholds", () => {
    const summary = summarizeFindings(
      [
        {
          ...highScopeFinding,
          detector: "blast-radius",
          confidence: 0.79
        }
      ],
      undefined,
      undefined,
      {
        blockingDetectors: ["blast-radius"]
      }
    );

    expect(summary).toMatchObject({
      decision: "pass",
      evidenceStrengthSummary: {
        evidenceThresholdSuppressedCount: 1
      },
      confidenceCalibration: {
        confidenceSuppressedCount: 1
      }
    });
    expect(summary.policyApplied?.evidenceThresholdSuppressedFindingIds).toEqual([
      "scope:tsconfig.json"
    ]);
    expect(summary.policyApplied?.confidenceSuppressedFindingIds).toEqual(["scope:tsconfig.json"]);
  });

  it("explains per-detector minimum blocking evidence strength", () => {
    expect(calibrateFindingEvidenceStrength(highScopeFinding)).toMatchObject({
      band: "high",
      minimumBlockingEvidenceStrength: 0.84,
      minimumBlockingConfidence: 0.84,
      blockingEligible: true
    });
  });

  it("keeps the deprecated confidence calibration export compatible", () => {
    expect(calibrateFindingConfidence(highScopeFinding)).toEqual(
      calibrateFindingEvidenceStrength(highScopeFinding)
    );
  });

  it("normalizes evidence strength while retaining legacy confidence", () => {
    const [finding] = runDetectors(
      { source: "cli", text: "Fix signup validation" },
      { files: [] },
      undefined,
      [
        {
          name: "scope",
          maturity: "review",
          run: () => [highScopeFinding]
        }
      ]
    );

    expect(finding).toMatchObject({
      confidence: 0.84,
      evidenceStrength: 0.84
    });
  });
});
