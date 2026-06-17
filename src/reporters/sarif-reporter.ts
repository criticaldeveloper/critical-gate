import type { Finding, GateResult } from "../schema/index.js";

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
  const sarif = {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "Critical Gate",
            informationUri: "https://critical-gate.dev",
            rules: getRules(result.findings)
          }
        },
        results: result.findings.map(toSarifResult)
      }
    ]
  };

  return `${JSON.stringify(sarif, null, 2)}\n`;
}

function getRules(findings: Finding[]) {
  const rulesById = new Map<string, Finding>();

  for (const finding of findings) {
    rulesById.set(finding.detector, finding);
  }

  return [...rulesById.entries()].map(([id, finding]) => ({
    id,
    name: finding.detector,
    shortDescription: {
      text: finding.title
    },
    fullDescription: {
      text: finding.message
    },
    properties: {
      tags: finding.tags
    }
  }));
}

function toSarifResult(finding: Finding) {
  return {
    ruleId: finding.detector,
    level: toSarifLevel(finding.severity),
    message: {
      text: `${finding.title}: ${finding.message}`
    },
    locations: getLocations(finding),
    properties: {
      id: finding.id,
      confidence: finding.confidence,
      severity: finding.severity,
      repair: finding.repair,
      tags: finding.tags
    }
  };
}

function getLocations(finding: Finding): SarifResultLocation[] {
  return finding.evidence
    .filter((evidence) => evidence.path !== undefined)
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
