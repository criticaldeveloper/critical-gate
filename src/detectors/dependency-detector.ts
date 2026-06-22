import type { DiffFile, DiffLine, Finding } from "../schema/index.js";

import type { Detector } from "./types.js";

type DependencySection =
  | "dependencies"
  | "devDependencies"
  | "peerDependencies"
  | "optionalDependencies";

interface AddedDependency {
  name: string;
  version: string;
  section: DependencySection;
  path: string;
  lineNumber?: number;
}

const dependencySections = new Set<DependencySection>([
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
]);

const dependencyLinePattern = /^\s*"([^"]+)":\s*"([^"]+)"/;
const sectionLinePattern =
  /^\s*"(dependencies|devDependencies|peerDependencies|optionalDependencies)":\s*\{/;

export const dependencyDetector: Detector = {
  name: "dependency-addition",
  run: ({ task, diff }) => {
    const addedDependencies = diff.files.flatMap(extractAddedDependencies);

    return addedDependencies
      .filter((dependency) => !hasVisibleJustification(task.text, dependency.name))
      .map(toFinding);
  }
};

function extractAddedDependencies(file: DiffFile): AddedDependency[] {
  if (file.path !== "package.json" && !file.path.endsWith("/package.json")) {
    return [];
  }

  const beforeDependencies = extractManifestDependencies(file, "before");
  const afterDependencies = extractManifestDependencies(file, "after");

  return [...afterDependencies.entries()]
    .filter(([key]) => !beforeDependencies.has(key))
    .map(([, dependency]) => dependency);
}

function extractManifestDependencies(
  file: DiffFile,
  side: "before" | "after"
): Map<string, AddedDependency> {
  const dependencies = new Map<string, AddedDependency>();

  for (const hunk of file.hunks) {
    let currentSection: DependencySection | undefined;
    for (const line of hunk.lines) {
      if (!belongsToManifestSide(line, side)) {
        continue;
      }

      const section = getSection(line);

      if (section !== undefined) {
        currentSection = section;
        continue;
      }

      if (line.kind === "context" && line.content.trim() === "}") {
        currentSection = undefined;
        continue;
      }

      if (currentSection === undefined) {
        continue;
      }

      const dependency = dependencyLinePattern.exec(line.content);

      if (dependency === null) {
        continue;
      }

      const name = dependency[1] ?? "";
      dependencies.set(toDependencyKey(currentSection, name), {
        name,
        version: dependency[2] ?? "",
        section: currentSection,
        path: file.path,
        lineNumber: line.newLineNumber
      });
    }
  }

  return dependencies;
}

function belongsToManifestSide(line: DiffLine, side: "before" | "after"): boolean {
  if (line.kind === "context") {
    return true;
  }

  return side === "before" ? line.kind === "delete" : line.kind === "add";
}

function getSection(line: DiffLine): DependencySection | undefined {
  const section = sectionLinePattern.exec(line.content)?.[1];

  if (section === undefined || !dependencySections.has(section as DependencySection)) {
    return undefined;
  }

  return section as DependencySection;
}

function hasVisibleJustification(taskText: string, dependencyName: string): boolean {
  const normalizedTask = taskText.toLowerCase();
  const normalizedDependency = dependencyName.toLowerCase();

  return (
    normalizedTask.includes(normalizedDependency) ||
    normalizedTask.includes("add dependency") ||
    normalizedTask.includes("new dependency") ||
    normalizedTask.includes("install package") ||
    normalizedTask.includes("install dependency")
  );
}

function toDependencyKey(section: DependencySection, name: string): string {
  return `${section}:${name}`;
}

function toFinding(dependency: AddedDependency): Finding {
  const isProductionDependency =
    dependency.section === "dependencies" || dependency.section === "optionalDependencies";
  const severity = isProductionDependency ? "blocker" : "medium";
  const dependencyType = isProductionDependency ? "production" : "development";

  return {
    id: `dependency-addition:${dependency.path}:${dependency.section}:${dependency.name}`,
    detector: "dependency-addition",
    severity,
    confidence: 0.9,
    title: `Unjustified ${dependencyType} dependency added`,
    message: `${dependency.name}@${dependency.version} was added to ${dependency.section} without visible task justification.`,
    evidence: [
      {
        kind: "manifest",
        path: dependency.path,
        startLine: dependency.lineNumber,
        endLine: dependency.lineNumber,
        message: `${dependency.name} was added to ${dependency.section}.`,
        data: {
          dependency: dependency.name,
          version: dependency.version,
          section: dependency.section
        }
      }
    ],
    repair: `Remove ${dependency.name} unless it is required, or update the task/PR context with a clear justification and alternatives considered.`,
    tags: ["dependency"]
  };
}
