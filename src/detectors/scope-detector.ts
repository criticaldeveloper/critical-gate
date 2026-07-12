import { analyzeTaskIntent } from "../intent/index.js";
import type { FileGraph } from "../knowledge/index.js";
import { buildRepositoryTokenIndex } from "../repository/index.js";
import type {
  DiffFile,
  Finding,
  MonorepoContext,
  RepositoryTokenIndex,
  TaskContract
} from "../schema/index.js";

import type { Detector } from "./types.js";
import { isExplicitPackageUpgradeDiff } from "./package-upgrade-intent.js";
import { isExplicitlyAllowedByContract } from "./task-contract-authority.js";

const broadTaskTerms = ["repo", "all", "setup", "scaffold", "architecture", "refactor"];
const configTaskTerms = [
  "build",
  "ci",
  "config",
  "configuration",
  "github action",
  "github actions",
  "lint",
  "test runner",
  "workflow"
];
const manifestTaskTerms = [
  "dependency",
  "dependencies",
  "engine",
  "engines",
  "extension",
  "manifest",
  "marketplace",
  "metadata",
  "node",
  "package",
  "publish",
  "publisher",
  "pnpm",
  "runtime"
];
const dependencyLinePattern = /^\s*"([^"]+)":\s*"([^"]+)"/;
const dependencySectionPattern =
  /^\s*"(dependencies|devDependencies|peerDependencies|optionalDependencies)":\s*\{/;
const maxFocusedUiPresentationFiles = 12;
const uiPresentationTaskPattern =
  /\b(?:style|styles|styling|visual|redesign|polish|spacing|sizing|grid|layout|align|masonry|card|cards|cta|arrow|icon|indicator|vinyl|animation|animated|mobile|responsive|css|scss|typography|display|view|mode|hero|title|overflow|section|sections|navigator|navigation|background|clip|clipping|video|youtube|seo|metadata|favicon)\b/i;
const uiPresentationPathPattern =
  /(^|\/)(components?|views?|pages?|screens?|styles?|theme|themes|scripts?)\/|\.astro$|\.(?:css|scss|sass|less)$/i;

export const scopeDetector: Detector = {
  name: "scope",
  maturity: "review",
  run: ({ task, diff, context }) => {
    const analysis = analyzeTaskIntent(task);
    const tokenIndex =
      context?.repositoryTokenIndex ?? buildRepositoryTokenIndex({ files: diff.files });
    const forbiddenPathFindings = diff.files
      .map((file) => {
        const matchingPatterns = getMatchingForbiddenPatterns(
          file.path,
          context?.taskContract?.forbiddenPaths ?? []
        );

        return matchingPatterns.length > 0
          ? toForbiddenPathFinding(file, matchingPatterns)
          : undefined;
      })
      .filter((finding): finding is Finding => finding !== undefined);
    const forbiddenPaths = new Set(
      forbiddenPathFindings.map((finding) => finding.evidence[0]?.path)
    );
    const outsideAllowedPathFindings = diff.files
      .filter((file) => !forbiddenPaths.has(file.path))
      .map((file) => {
        const allowedPatterns = context?.taskContract?.allowedPaths ?? [];

        return isOutsideAllowedPaths(file.path, allowedPatterns)
          ? toOutsideAllowedPathFinding(file, allowedPatterns)
          : undefined;
      })
      .filter((finding): finding is Finding => finding !== undefined);
    const contractScopePaths = new Set(
      [...forbiddenPathFindings, ...outsideAllowedPathFindings].map(
        (finding) => finding.evidence[0]?.path
      )
    );

    if (analysis.complexity !== "small" || isBroadTask(task.text)) {
      const ownershipFindings = getPackageOwnershipFindings(
        diff.files.filter(
          (file) =>
            !contractScopePaths.has(file.path) &&
            !isExplicitlyAllowedByContract(file.path, context?.taskContract)
        ),
        analysis.keywords,
        context?.monorepo,
        tokenIndex,
        context?.knowledge?.getFileGraph()
      );

      return [...forbiddenPathFindings, ...outsideAllowedPathFindings, ...ownershipFindings];
    }

    const supportGraph = diff.files.some((file) => file.role === "docs" || file.role === "test")
      ? context?.knowledge?.getFileGraph()
      : undefined;
    const unexpectedScopeFindings = diff.files
      .filter((file) => !contractScopePaths.has(file.path))
      .filter((file) =>
        isUnexpectedForSmallTask(
          file,
          diff.files,
          analysis.keywords,
          task.text,
          tokenIndex,
          supportGraph
        )
      )
      .map((file) => toFinding(file, analysis.keywords, context?.repositoryTokenIndex));

    return [...forbiddenPathFindings, ...outsideAllowedPathFindings, ...unexpectedScopeFindings];
  },
  getStatus: ({ task, diff, context }, findings) => {
    if (findings.length > 0) {
      return { status: "findings" };
    }

    const analysis = analyzeTaskIntent(task);
    const tokenIndex =
      context?.repositoryTokenIndex ?? buildRepositoryTokenIndex({ files: diff.files });

    if (hasProvidedScopeBoundary(context?.taskContract)) {
      return { status: "passed" };
    }

    if (analysis.complexity !== "small") {
      const ownership = analyzePackageOwnership(
        diff.files,
        analysis.keywords,
        context?.monorepo,
        tokenIndex,
        context?.knowledge?.getFileGraph()
      );

      if (ownership.alignedPackageRoots.length > 0) {
        return {
          status: "insufficient-context",
          reason:
            "Task-aligned package ownership was evaluated (" +
            ownership.alignedPackageRoots.join(", ") +
            "), but file-level scope still needs an explicit task contract."
        };
      }

      if (ownership.changedPackageRoots.length > 0) {
        return {
          status: "insufficient-context",
          reason:
            "Changed package ownership was available, but no package matched the task targets: " +
            ownership.changedPackageRoots.join(", ") +
            "."
        };
      }

      return {
        status: "insufficient-context",
        reason: `Task complexity is ${analysis.complexity}; scope needs an explicit task contract or ownership context.`
      };
    }

    if (isBroadTask(task.text)) {
      return {
        status: "insufficient-context",
        reason:
          "Task wording is broad; path-keyword scope validation is not enough to prove changed files are in scope."
      };
    }

    if (hasAmbiguousSupportFiles(diff.files, analysis.keywords, task.text, tokenIndex)) {
      return {
        status: "insufficient-context",
        reason:
          "Changed docs or tests could not be aligned to a task target or a changed task-aligned anchor."
      };
    }

    return { status: "passed" };
  }
};

interface PackageOwnershipAnalysis {
  changedPackageRoots: string[];
  alignedPackageRoots: string[];
  unalignedPackageRoots: string[];
  importSupportedPackageRoots: string[];
  symbolMatchesByPackage: Map<string, string[]>;
}

const genericOwnershipTokens = new Set([
  "app",
  "apps",
  "lib",
  "libs",
  "package",
  "packages",
  "src",
  "source",
  "workspace",
  "workspaces"
]);

function getPackageOwnershipFindings(
  files: DiffFile[],
  keywords: string[],
  monorepo?: MonorepoContext,
  tokenIndex?: RepositoryTokenIndex,
  graph?: FileGraph
): Finding[] {
  const ownership = analyzePackageOwnership(files, keywords, monorepo, tokenIndex, graph);

  if (ownership.alignedPackageRoots.length === 0 || ownership.unalignedPackageRoots.length === 0) {
    return [];
  }

  return ownership.unalignedPackageRoots
    .filter((packageRoot) => !ownership.importSupportedPackageRoots.includes(packageRoot))
    .map((packageRoot) => {
      const owner = monorepo?.packages.find((candidate) => candidate.path === packageRoot);
      const ownedFiles = files.filter(
        (file) => getOwningPackage(file.path, monorepo)?.path === packageRoot
      );

      return owner === undefined || ownedFiles.length === 0
        ? undefined
        : toPackageOwnershipFinding(
            ownedFiles,
            owner,
            ownership.alignedPackageRoots,
            ownership.symbolMatchesByPackage,
            keywords
          );
    })
    .filter((finding): finding is Finding => finding !== undefined);
}

function analyzePackageOwnership(
  files: DiffFile[],
  keywords: string[],
  monorepo?: MonorepoContext,
  tokenIndex?: RepositoryTokenIndex,
  graph?: FileGraph
): PackageOwnershipAnalysis {
  const changedPackages = [
    ...new Map(
      files
        .map((file) => getOwningPackage(file.path, monorepo))
        .filter((owner): owner is NonNullable<typeof owner> => owner !== undefined)
        .map((owner) => [owner.path, owner])
    ).values()
  ];
  const symbolMatchesByPackage = new Map(
    changedPackages.map((owner) => [
      owner.path,
      getChangedSymbolMatches(owner, files, keywords, tokenIndex)
    ])
  );
  const alignedPackageRoots = changedPackages
    .filter(
      (owner) =>
        isPackageAligned(owner, keywords, monorepo) ||
        (symbolMatchesByPackage.get(owner.path)?.length ?? 0) > 0
    )
    .map((owner) => owner.path);
  const unalignedPackageRoots = changedPackages
    .filter((owner) => !alignedPackageRoots.includes(owner.path))
    .map((owner) => owner.path);

  return {
    changedPackageRoots: changedPackages.map((owner) => owner.path),
    alignedPackageRoots,
    unalignedPackageRoots,
    importSupportedPackageRoots: unalignedPackageRoots.filter((packageRoot) =>
      hasImportConnection(
        packageRoot,
        alignedPackageRoots,
        new Set(files.map((file) => file.path)),
        graph
      )
    ),
    symbolMatchesByPackage
  };
}

function getChangedSymbolMatches(
  owner: MonorepoContext["packages"][number],
  files: DiffFile[],
  keywords: string[],
  tokenIndex?: RepositoryTokenIndex
): string[] {
  const keywordSet = new Set(keywords.map(normalizeOwnershipToken));
  const ownedPaths = new Set(
    files
      .filter((file) => file.path === owner.path || file.path.startsWith(owner.path + "/"))
      .map((file) => file.path)
  );

  const tokensBySymbol = new Map<string, Set<string>>();

  for (const token of (tokenIndex?.files ?? [])
    .filter((file) => ownedPaths.has(file.path))
    .flatMap((file) => file.tokens)
    .filter((token) => token.source === "symbol")) {
    const matches = tokensBySymbol.get(token.raw) ?? new Set<string>();
    if (keywordSet.has(normalizeOwnershipToken(token.value))) {
      matches.add(normalizeOwnershipToken(token.value));
    }
    tokensBySymbol.set(token.raw, matches);
  }

  return [...tokensBySymbol.entries()]
    .filter(
      ([symbol, matches]) => keywordSet.has(normalizeOwnershipToken(symbol)) || matches.size >= 2
    )
    .map(([symbol]) => symbol)
    .sort();
}

function hasImportConnection(
  packageRoot: string,
  alignedPackageRoots: string[],
  changedPaths: Set<string>,
  graph?: FileGraph
): boolean {
  return (graph?.edges ?? []).some(
    (edge) =>
      edge.kind === "import" &&
      changedPaths.has(edge.from) &&
      changedPaths.has(edge.to) &&
      alignedPackageRoots.some(
        (alignedRoot) =>
          (isInsideRoot(edge.from, packageRoot) && isInsideRoot(edge.to, alignedRoot)) ||
          (isInsideRoot(edge.to, packageRoot) && isInsideRoot(edge.from, alignedRoot))
      )
  );
}

function isInsideRoot(path: string, root: string): boolean {
  return path === root || path.startsWith(root + "/");
}

function getOwningPackage(
  path: string,
  monorepo?: MonorepoContext
): MonorepoContext["packages"][number] | undefined {
  return monorepo?.packages
    .filter((candidate) => path === candidate.path || path.startsWith(candidate.path + "/"))
    .sort((left, right) => right.path.length - left.path.length)[0];
}

function isPackageAligned(
  owner: MonorepoContext["packages"][number],
  keywords: string[],
  monorepo?: MonorepoContext
): boolean {
  const ownerPathTokens = tokenizeOwnership(owner.path);
  const ownershipTokens = new Set([
    ...ownerPathTokens,
    ...tokenizeOwnership(owner.name ?? ""),
    ...(monorepo?.typescriptPathAliases ?? []).flatMap((alias) => {
      const aliasTokens = tokenizeOwnership(alias);
      return aliasTokens.some((token) => ownerPathTokens.includes(token)) ? aliasTokens : [];
    })
  ]);

  return keywords.some((keyword) => ownershipTokens.has(normalizeOwnershipToken(keyword)));
}

function tokenizeOwnership(value: string): string[] {
  return (
    value
      .toLocaleLowerCase("und")
      .match(/[\p{L}\p{N}]+/gu)
      ?.map(normalizeOwnershipToken)
      .filter((token) => token.length >= 3 && !genericOwnershipTokens.has(token)) ?? []
  );
}

function normalizeOwnershipToken(value: string): string {
  const normalized = value.toLocaleLowerCase("und");
  return normalized.endsWith("s") && normalized.length > 4 ? normalized.slice(0, -1) : normalized;
}

function hasProvidedScopeBoundary(contract?: TaskContract): boolean {
  return contract?.source === "provided" && contract.allowedPaths.length > 0;
}

function toPackageOwnershipFinding(
  files: DiffFile[],
  owner: MonorepoContext["packages"][number],
  alignedPackageRoots: string[],
  symbolMatchesByPackage: Map<string, string[]>,
  keywords: string[]
): Finding {
  const ownerLabel = owner.name === undefined ? owner.path : owner.name + " (" + owner.path + ")";

  return {
    id: "scope:package-ownership:" + owner.path,
    detector: "scope",
    severity: "medium",
    confidence: 0.78,
    evidenceStrength: 0.78,
    title: "Changed package outside task-aligned ownership",
    message:
      "Package " +
      ownerLabel +
      " changed while the task aligns with changed package ownership: " +
      alignedPackageRoots.join(", ") +
      ".",
    evidence: [
      {
        kind: "metric",
        message:
          "Task-aligned changed symbols by package: " +
          alignedPackageRoots
            .map(
              (packageRoot) =>
                packageRoot + "=" + (symbolMatchesByPackage.get(packageRoot)?.join(", ") || "none")
            )
            .join("; ") +
          ". No import edge connects the unaligned package to those package roots.",
        data: {
          alignedPackageRoots,
          alignedChangedSymbols: Object.fromEntries(
            alignedPackageRoots.map((packageRoot) => [
              packageRoot,
              symbolMatchesByPackage.get(packageRoot) ?? []
            ])
          ),
          importConnected: false
        }
      },
      ...files.map((file) => {
        const firstChangedLine = file.hunks
          .flatMap((hunk) => hunk.lines)
          .find((line) => line.kind === "add" || line.kind === "delete");
        const lineNumber = firstChangedLine?.newLineNumber ?? firstChangedLine?.oldLineNumber;

        return {
          kind: "file" as const,
          path: file.path,
          startLine: lineNumber,
          endLine: lineNumber,
          message:
            "Package owner " +
            ownerLabel +
            " does not match task targets; aligned changed package roots: " +
            alignedPackageRoots.join(", ") +
            ".",
          data: {
            packageRoot: owner.path,
            packageName: owner.name,
            alignedPackageRoots,
            taskKeywords: keywords,
            role: file.role
          }
        };
      })
    ],
    repair:
      "Remove or split the cross-package change, or provide a task contract that explicitly authorizes this package boundary.",
    tags: ["scope"]
  };
}

function getMatchingForbiddenPatterns(path: string, patterns: string[]): string[] {
  return patterns.filter((pattern) => matchesContractPath(path, pattern));
}

function isOutsideAllowedPaths(path: string, patterns: string[]): boolean {
  return patterns.length > 0 && !patterns.some((pattern) => matchesContractPath(path, pattern));
}

function matchesContractPath(path: string, pattern: string): boolean {
  const normalizedPath = normalizeContractPath(path);
  const normalizedPattern = normalizeContractPath(pattern);

  if (normalizedPattern.length === 0) {
    return false;
  }

  if (normalizedPattern.endsWith("/**")) {
    const root = normalizedPattern.slice(0, -3);
    return normalizedPath === root || normalizedPath.startsWith(`${root}/`);
  }

  if (!normalizedPattern.includes("*")) {
    return normalizedPath === normalizedPattern;
  }

  const source = normalizedPattern
    .split("**")
    .map((part) => part.split("*").map(escapeRegExp).join("[^/]*"))
    .join(".*");

  return new RegExp(`^${source}$`).test(normalizedPath);
}

function normalizeContractPath(path: string): string {
  return path
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+/g, "/")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isBroadTask(taskText: string): boolean {
  const normalizedTask = taskText.toLowerCase();
  return broadTaskTerms.some((term) => normalizedTask.includes(term));
}

function isUnexpectedForSmallTask(
  file: DiffFile,
  files: DiffFile[],
  keywords: string[],
  taskText: string,
  tokenIndex?: RepositoryTokenIndex,
  graph?: FileGraph
): boolean {
  if (file.role === "docs" || file.role === "test") {
    if (hasFileKeywordAlignment(file, keywords, tokenIndex)) {
      return false;
    }

    const anchors = getTaskAlignedAnchors(file, files, keywords, taskText, tokenIndex);

    return (
      anchors.length > 0 &&
      !hasChangedGraphConnection(
        file.path,
        anchors.map((anchor) => anchor.path),
        graph
      )
    );
  }

  if (file.role === "manifest" && isPackageVersionOnlyChange(file)) {
    return false;
  }

  if (file.role === "manifest" && isAlignedDependencyRemoval(file, taskText)) {
    return false;
  }

  if (file.role === "lockfile" && hasAlignedDependencyRemovalManifest(files, taskText)) {
    return false;
  }

  if (
    (file.role === "manifest" || file.role === "lockfile") &&
    isExplicitPackageUpgradeDiff(taskText, files)
  ) {
    return false;
  }

  if (isRoleAlignedConfigOrManifestChange(file, taskText, keywords)) {
    return false;
  }

  if (file.role === "config" || file.role === "manifest" || file.role === "lockfile") {
    return true;
  }

  if (file.role !== "source") {
    return false;
  }

  if (isFocusedUiPresentationSourceChange(file, files, taskText)) {
    return false;
  }

  if (file.status === "deleted" && !isDeletionAcknowledged(file, taskText, keywords)) {
    return true;
  }

  return keywords.length > 0 && !hasFileKeywordAlignment(file, keywords, tokenIndex);
}

function getTaskAlignedAnchors(
  candidate: DiffFile,
  files: DiffFile[],
  keywords: string[],
  taskText: string,
  tokenIndex?: RepositoryTokenIndex
): DiffFile[] {
  return files
    .filter((file) => file.path !== candidate.path)
    .filter(
      (file) =>
        hasFileKeywordAlignment(file, keywords, tokenIndex) ||
        isRoleAlignedConfigOrManifestChange(file, taskText, keywords)
    );
}

function hasChangedGraphConnection(
  candidatePath: string,
  anchorPaths: string[],
  graph?: FileGraph
): boolean {
  const anchorSet = new Set(anchorPaths);

  return (graph?.edges ?? []).some(
    (edge) =>
      (edge.kind === "import" || edge.kind === "test" || edge.kind === "history") &&
      ((edge.from === candidatePath && anchorSet.has(edge.to)) ||
        (edge.to === candidatePath && anchorSet.has(edge.from)))
  );
}

function hasAmbiguousSupportFiles(
  files: DiffFile[],
  keywords: string[],
  taskText: string,
  tokenIndex?: RepositoryTokenIndex
): boolean {
  return files
    .filter((file) => file.role === "docs" || file.role === "test")
    .some(
      (file) =>
        !hasFileKeywordAlignment(file, keywords, tokenIndex) &&
        getTaskAlignedAnchors(file, files, keywords, taskText, tokenIndex).length === 0
    );
}

function hasAlignedDependencyRemovalManifest(files: DiffFile[], taskText: string): boolean {
  return files.some(
    (file) => file.role === "manifest" && isAlignedDependencyRemoval(file, taskText)
  );
}

function hasPathKeywordAlignment(path: string, keywords: string[]): boolean {
  const normalizedPath = path.toLowerCase();
  return keywords.some((keyword) => normalizedPath.includes(keyword));
}

function hasFileKeywordAlignment(
  file: DiffFile,
  keywords: string[],
  tokenIndex?: RepositoryTokenIndex
): boolean {
  return (
    hasPathKeywordAlignment(file.path, keywords) ||
    getTokenKeywordMatches(file.path, keywords, tokenIndex).length > 0
  );
}

function isRoleAlignedConfigOrManifestChange(
  file: DiffFile,
  taskText: string,
  keywords: string[]
): boolean {
  if (file.role === "config") {
    if (hasConfigProhibition(taskText)) {
      return false;
    }

    return (
      hasAnyTaskTerm(taskText, configTaskTerms) || hasPathKeywordAlignment(file.path, keywords)
    );
  }

  if (file.role === "manifest" || file.role === "lockfile") {
    return hasAnyTaskTerm(taskText, manifestTaskTerms);
  }

  return false;
}

function hasAnyTaskTerm(taskText: string, terms: string[]): boolean {
  const normalizedTask = taskText.toLowerCase();
  return terms.some((term) => normalizedTask.includes(term));
}

function isFocusedUiPresentationSourceChange(
  file: DiffFile,
  files: DiffFile[],
  taskText: string
): boolean {
  if (
    files.length === 0 ||
    files.length > maxFocusedUiPresentationFiles ||
    !uiPresentationTaskPattern.test(taskText) ||
    !uiPresentationPathPattern.test(file.path)
  ) {
    return false;
  }

  return files.every(
    (candidate) =>
      candidate.status !== "deleted" &&
      (candidate.role === "source" || candidate.role === "unknown") &&
      isUiPresentationOrAssetPath(candidate.path)
  );
}

function isUiPresentationOrAssetPath(path: string): boolean {
  return (
    uiPresentationPathPattern.test(path) ||
    /(^|\/)(public|assets?)\/.+\.(?:png|jpe?g|webp|gif|svg|avif)$/i.test(path)
  );
}

function hasConfigProhibition(taskText: string): boolean {
  return (
    /\b(?:without|no|avoid|do not|don't|dont|must not|never)\s+(?:(?:touching|changing|editing|modify|modifying)\s+)?(?:config|configuration|settings|runtime|node|tooling)\b/i.test(
      taskText
    ) ||
    /\b(?:sin\s+(?:cambiar|modificar|tocar)|no\s+(?:cambiar|modificar|tocar))\s+(?:la\s+)?(?:configuración|ajustes|entorno)\b/iu.test(
      taskText
    )
  );
}

function isDeletionAcknowledged(file: DiffFile, taskText: string, keywords: string[]): boolean {
  return (
    hasAnyTaskTerm(taskText, ["delete", "deleted", "remove", "removed", "drop", "cleanup"]) &&
    hasPathKeywordAlignment(file.path, keywords)
  );
}

function isPackageVersionOnlyChange(file: DiffFile): boolean {
  if (file.path !== "package.json" && !file.path.endsWith("/package.json")) {
    return false;
  }

  const changedLines = file.hunks
    .flatMap((hunk) => hunk.lines)
    .filter((line) => line.kind === "add" || line.kind === "delete");

  return (
    changedLines.length > 0 &&
    changedLines.every((line) => /^\s*"version":\s*"[^"]+"\s*,?\s*$/.test(line.content))
  );
}

function isAlignedDependencyRemoval(file: DiffFile, taskText: string): boolean {
  if (file.path !== "package.json" && !file.path.endsWith("/package.json")) {
    return false;
  }

  const beforeDependencies = extractChangedDependencyNames(file, "before");
  const afterDependencies = extractChangedDependencyNames(file, "after");
  const removedDependencies = [...beforeDependencies].filter(
    (name) => !afterDependencies.has(name)
  );
  const addedDependencies = [...afterDependencies].filter((name) => !beforeDependencies.has(name));

  return (
    removedDependencies.length > 0 &&
    addedDependencies.length === 0 &&
    removedDependencies.some((dependency) => taskMentionsDependency(taskText, dependency))
  );
}

function extractChangedDependencyNames(file: DiffFile, side: "before" | "after"): Set<string> {
  const dependencies = new Set<string>();

  for (const hunk of file.hunks) {
    let inDependencySection = false;

    for (const line of hunk.lines) {
      if (!belongsToManifestSide(line.kind, side)) {
        continue;
      }

      if (dependencySectionPattern.test(line.content)) {
        inDependencySection = true;
        continue;
      }

      if (line.kind === "context" && line.content.trim() === "}") {
        inDependencySection = false;
        continue;
      }

      if (!inDependencySection) {
        continue;
      }

      const dependency = dependencyLinePattern.exec(line.content)?.[1];

      if (dependency !== undefined) {
        dependencies.add(dependency);
      }
    }
  }

  return dependencies;
}

function belongsToManifestSide(kind: "add" | "delete" | "context", side: "before" | "after") {
  return kind === "context" || (side === "before" ? kind === "delete" : kind === "add");
}

function taskMentionsDependency(taskText: string, dependencyName: string): boolean {
  const normalizedTask = normalizeDependencyText(taskText);
  const normalizedDependency = normalizeDependencyText(dependencyName);

  return (
    normalizedTask.includes(normalizedDependency) ||
    normalizedDependency
      .split(" ")
      .filter((part) => part.length > 2)
      .every((part) => normalizedTask.includes(part))
  );
}

function normalizeDependencyText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[@/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toFinding(file: DiffFile, keywords: string[], tokenIndex?: RepositoryTokenIndex): Finding {
  const firstChangedLine = file.hunks
    .flatMap((hunk) => hunk.lines)
    .find((line) => line.kind === "add" || line.kind === "delete");
  const lineNumber = firstChangedLine?.newLineNumber ?? firstChangedLine?.oldLineNumber;
  const tokenMatches = getTokenKeywordMatches(file.path, keywords, tokenIndex);
  const isSupportFile = file.role === "docs" || file.role === "test";

  return {
    id: `scope:${file.path}`,
    detector: "scope",
    severity:
      isSupportFile || (file.role === "source" && file.status !== "deleted") ? "medium" : "high",
    confidence: isSupportFile || (file.role === "source" && file.status !== "deleted") ? 0.7 : 0.84,
    title: isSupportFile
      ? "Unexpected support file changed for small task"
      : file.status === "deleted"
        ? "Unexpected file deleted for small task"
        : "Unexpected file changed for small task",
    message: `${file.path} ${file.status === "deleted" ? "was deleted" : "changed"} during a small task but does not align with expected scope${isSupportFile ? " or a changed task-aligned support relationship" : ""}.`,
    evidence: [
      {
        kind: "file",
        path: file.path,
        startLine: lineNumber,
        endLine: lineNumber,
        message: `Changed file role: ${file.role}. Task keywords: ${keywords.join(", ") || "none"}.`,
        data: {
          role: file.role,
          additions: file.additions,
          deletions: file.deletions,
          keywords,
          tokenMatches
        }
      }
    ],
    repair:
      "Remove unrelated edits or split them into a separate task with explicit justification.",
    tags: ["scope"]
  };
}

function toForbiddenPathFinding(file: DiffFile, matchingPatterns: string[]): Finding {
  const firstChangedLine = file.hunks
    .flatMap((hunk) => hunk.lines)
    .find((line) => line.kind === "add" || line.kind === "delete");
  const lineNumber = firstChangedLine?.newLineNumber ?? firstChangedLine?.oldLineNumber;

  return {
    id: `scope:forbidden-path:${file.path}`,
    detector: "scope",
    severity: "blocker",
    confidence: 0.95,
    evidenceStrength: 0.95,
    title: "Forbidden path changed by task contract",
    message: `${file.path} changed even though the task contract forbids ${matchingPatterns.join(", ")}.`,
    evidence: [
      {
        kind: "file",
        path: file.path,
        startLine: lineNumber,
        endLine: lineNumber,
        message: `Changed file matches forbidden task contract path: ${matchingPatterns.join(", ")}.`,
        data: {
          forbiddenPatterns: matchingPatterns,
          role: file.role,
          additions: file.additions,
          deletions: file.deletions
        }
      }
    ],
    repair:
      "Remove the forbidden-path change or update the task contract with explicit reviewer approval.",
    tags: ["scope"]
  };
}

function toOutsideAllowedPathFinding(file: DiffFile, allowedPatterns: string[]): Finding {
  const firstChangedLine = file.hunks
    .flatMap((hunk) => hunk.lines)
    .find((line) => line.kind === "add" || line.kind === "delete");
  const lineNumber = firstChangedLine?.newLineNumber ?? firstChangedLine?.oldLineNumber;

  return {
    id: `scope:outside-allowed-path:${file.path}`,
    detector: "scope",
    severity: "blocker",
    confidence: 0.95,
    evidenceStrength: 0.95,
    title: "Path outside task contract allowed paths",
    message: `${file.path} changed outside the task contract allowed paths: ${allowedPatterns.join(", ")}.`,
    evidence: [
      {
        kind: "file",
        path: file.path,
        startLine: lineNumber,
        endLine: lineNumber,
        message: `Changed file does not match any allowed task contract path: ${allowedPatterns.join(", ")}.`,
        data: {
          allowedPatterns,
          role: file.role,
          additions: file.additions,
          deletions: file.deletions
        }
      }
    ],
    repair:
      "Remove the out-of-contract change or update the task contract with explicit reviewer approval.",
    tags: ["scope"]
  };
}

function getTokenKeywordMatches(
  path: string,
  keywords: string[],
  tokenIndex?: RepositoryTokenIndex
): Array<{ token: string; source: string; raw: string }> {
  const fileTokens = tokenIndex?.files.find((file) => file.path === path)?.tokens ?? [];
  const keywordSet = new Set(keywords.map((keyword) => keyword.toLowerCase()));

  return fileTokens
    .filter((token) => keywordSet.has(token.value))
    .map((token) => ({
      token: token.value,
      source: token.source,
      raw: token.raw
    }));
}
