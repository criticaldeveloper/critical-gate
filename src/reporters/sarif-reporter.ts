import { createHash } from "node:crypto";

import type { Finding, GateResult } from "../schema/index.js";
import { CRITICAL_GATE_VERSION } from "../version.js";

const maxSarifResults = 500;
const maxLocationsPerResult = 20;

interface SarifResultLocation {
  physicalLocation: {
    artifactLocation: {
      uri: string;
    };
    region?: {
      startLine?: number;
      endLine?: number;
    };
  };
}

export function renderSarifReport(result: GateResult): string {
  const emittedFindings = result.findings.slice(0, maxSarifResults);
  const truncated = emittedFindings.length < result.findings.length;
  const sarif = {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "Critical Gate",
            semanticVersion: CRITICAL_GATE_VERSION,
            informationUri: "https://critical-gate.dev",
            rules: getRules(emittedFindings)
          }
        },
        results: emittedFindings.map(toSarifResult),
        invocations: [
          {
            executionSuccessful: true,
            properties: {
              resultCount: result.findings.length,
              emittedResultCount: emittedFindings.length,
              truncated
            }
          }
        ]
      }
    ]
  };

  return `${JSON.stringify(sarif, null, 2)}\n`;
}

function getRules(findings: Finding[]) {
  const rulesById = new Map<string, Finding>();

  for (const finding of findings) {
    rulesById.set(getRuleId(finding), finding);
  }

  return [...rulesById.entries()].map(([id, finding]) => ({
    id,
    name: id,
    shortDescription: {
      text: finding.title
    },
    fullDescription: {
      text: finding.message
    },
    properties: {
      detector: finding.detector,
      category: getRuleCategory(finding),
      tags: finding.tags
    }
  }));
}

function toSarifResult(finding: Finding) {
  return {
    ruleId: getRuleId(finding),
    level: toSarifLevel(finding.severity),
    message: {
      text: `${finding.title}: ${finding.message}`
    },
    locations: getLocations(finding),
    partialFingerprints: {
      criticalGateFinding: fingerprintFinding(finding)
    },
    properties: {
      id: finding.id,
      detector: finding.detector,
      category: getRuleCategory(finding),
      confidence: finding.confidence,
      evidenceStrength: finding.evidenceStrength ?? finding.confidence,
      severity: finding.severity,
      repair: finding.repair,
      tags: finding.tags
    }
  };
}

function getLocations(finding: Finding): SarifResultLocation[] {
  return finding.evidence
    .filter((evidence) => evidence.path !== undefined)
    .slice(0, maxLocationsPerResult)
    .map((evidence) => ({
      physicalLocation: {
        artifactLocation: {
          uri: evidence.path ?? ""
        },
        region:
          evidence.startLine === undefined && evidence.endLine === undefined
            ? undefined
            : {
                startLine: evidence.startLine,
                endLine: evidence.endLine
              }
      }
    }));
}

function getRuleId(finding: Finding): string {
  const prefix = `${finding.detector}:`;

  if (!finding.id.startsWith(prefix)) {
    return finding.detector;
  }

  const remainder = finding.id.slice(prefix.length);

  if (finding.detector === "expected-companions" && remainder.endsWith(":lockfile")) {
    return `${finding.detector}:lockfile`;
  }

  const firstSegment = remainder.split(":")[0] ?? "";
  const stableSegment = firstSegment.replace(/-\d+$/, "");

  return stableSegment.length === 0 ? finding.detector : `${finding.detector}:${stableSegment}`;
}

function getRuleCategory(finding: Finding): string {
  if (finding.detector === "blast-radius" || finding.detector === "scope") {
    return "scope";
  }

  if (finding.detector === "expected-companions") {
    return "history";
  }

  if (finding.detector === "existing-solution" || finding.tags.includes("utility")) {
    return "reuse";
  }

  if (finding.tags.includes("test")) {
    return "tests";
  }

  if (finding.tags.includes("dependency")) {
    return "dependencies";
  }

  if (finding.tags.includes("api")) {
    return "api";
  }

  if (finding.tags.includes("config")) {
    return "configuration";
  }

  return "integrity";
}

function fingerprintFinding(finding: Finding): string {
  const evidence = finding.evidence
    .map((item) =>
      [
        item.kind,
        item.path ?? "",
        item.startLine ?? "",
        item.endLine ?? "",
        item.symbol ?? ""
      ].join(":")
    )
    .sort()
    .join("|");

  return createHash("sha256")
    .update([getRuleId(finding), finding.id, evidence].join("|"))
    .digest("hex")
    .slice(0, 32);
}

function toSarifLevel(severity: Finding["severity"]): "error" | "warning" | "note" {
  switch (severity) {
    case "blocker":
    case "high":
      return "error";
    case "medium":
      return "warning";
    case "low":
    case "info":
      return "note";
  }
}
