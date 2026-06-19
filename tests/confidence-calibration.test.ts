import {
  calibrateFindingConfidence,
  getConfidenceBand,
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

describe("confidence calibration", () => {
  it("classifies confidence bands", () => {
    expect(getConfidenceBand(0.95)).toBe("very-high");
    expect(getConfidenceBand(0.82)).toBe("high");
    expect(getConfidenceBand(0.7)).toBe("medium");
    expect(getConfidenceBand(0.4)).toBe("low");
  });

  it("keeps low-confidence high-severity findings observational", () => {
    expect(
      summarizeFindings([
        {
          ...highScopeFinding,
          confidence: 0.79
        }
      ])
    ).toMatchObject({
      decision: "pass",
      confidenceCalibration: {
        blockingEligibleCount: 0,
        observationModeCount: 0,
        confidenceSuppressedCount: 1
      }
    });
  });

  it("keeps calibrated high-confidence legacy findings blocking", () => {
    expect(summarizeFindings([highScopeFinding])).toMatchObject({
      decision: "fail",
      confidenceCalibration: {
        blockingEligibleCount: 1,
        observationModeCount: 0,
        confidenceSuppressedCount: 0
      }
    });
  });

  it("does not let explicit detector promotion bypass confidence thresholds", () => {
    expect(
      summarizeFindings(
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
      )
    ).toMatchObject({
      decision: "pass",
      confidenceCalibration: {
        confidenceSuppressedCount: 1
      }
    });
  });

  it("explains per-detector minimum blocking confidence", () => {
    expect(calibrateFindingConfidence(highScopeFinding)).toMatchObject({
      band: "high",
      minimumBlockingConfidence: 0.84,
      blockingEligible: true
    });
  });
});
