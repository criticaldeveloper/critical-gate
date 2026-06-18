import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildKnowledgeCacheKey,
  createFileKnowledgeCache,
  createLazyKnowledgeProvider
} from "../src/index.js";

describe("knowledge cache", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "critical-gate-cache-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("changes cache keys when tracked configuration fingerprints change", () => {
    const baseRunner = {
      execFile: () => "100644 abc src/index.ts\n",
      readFile: (path: string) => (path.endsWith("package.json") ? '{"dependencies":{}}' : "")
    };
    const changedRunner = {
      ...baseRunner,
      readFile: (path: string) =>
        path.endsWith("package.json") ? '{"dependencies":{"left-pad":"1.0.0"}}' : ""
    };

    expect(
      buildKnowledgeCacheKey({
        root,
        baseRef: "main",
        headRef: "feature/cache",
        runner: baseRunner
      })
    ).not.toEqual(
      buildKnowledgeCacheKey({
        root,
        baseRef: "main",
        headRef: "feature/cache",
        runner: changedRunner
      })
    );
  });

  it("reuses cached history and solution indexes on warm runs", () => {
    const cache = createFileKnowledgeCache(root);
    const firstRunner = createRunner({
      logOutput: "__COMMIT__\nsrc/signup.ts\ntests/signup.test.ts\n",
      utilityFiles: "src/utils/date.ts\n"
    });

    const firstProvider = createLazyKnowledgeProvider({
      root,
      baseRef: "main",
      headRef: "feature/cache",
      runner: firstRunner,
      cache
    });

    expect(firstProvider.getHistoryIndex().profile?.commitCount).toBe(1);
    expect(firstProvider.getSolutionIndex().utilityIndex?.utilities).toEqual([
      { path: "src/utils/date.ts", exportedNames: ["formatDate"] }
    ]);

    const warmRunner = createRunner({
      logOutput: "throw",
      utilityFiles: "throw"
    });
    const warmProvider = createLazyKnowledgeProvider({
      root,
      baseRef: "main",
      headRef: "feature/cache",
      runner: warmRunner,
      cache
    });

    expect(warmProvider.getHistoryIndex().profile?.commitCount).toBe(1);
    expect(warmProvider.getSolutionIndex().utilityIndex?.utilities).toEqual([
      { path: "src/utils/date.ts", exportedNames: ["formatDate"] }
    ]);
  });

  it("can disable cache for debugging", () => {
    const cache = createFileKnowledgeCache(root);
    const firstProvider = createLazyKnowledgeProvider({
      root,
      runner: createRunner({
        logOutput: "__COMMIT__\nsrc/signup.ts\n",
        utilityFiles: ""
      }),
      cache
    });
    firstProvider.getHistoryIndex();

    const uncachedProvider = createLazyKnowledgeProvider({
      root,
      runner: createRunner({
        logOutput: "__COMMIT__\nsrc/signup.ts\n__COMMIT__\nsrc/signup.ts\n",
        utilityFiles: ""
      }),
      cache,
      useCache: false
    });

    expect(uncachedProvider.getHistoryIndex().profile?.commitCount).toBe(2);
  });
});

function createRunner(options: { logOutput: string; utilityFiles: string }) {
  return {
    execFile: (_file: string, args: string[]) => {
      if (args.join(" ") === "ls-files -s -- src packages lib tests") {
        return "100644 abc src/signup.ts\n";
      }

      if (args[0] === "log") {
        if (options.logOutput === "throw") {
          throw new Error("history should come from cache");
        }
        return options.logOutput;
      }

      if (args.join(" ") === "ls-files") {
        if (options.utilityFiles === "throw") {
          throw new Error("solutions should come from cache");
        }
        return options.utilityFiles;
      }

      throw new Error(`Unexpected git args: ${args.join(" ")}`);
    },
    readFile: (path: string) => {
      const normalizedPath = path.replaceAll("\\", "/");

      if (normalizedPath.endsWith("package.json")) {
        return '{"name":"fixture"}';
      }

      if (normalizedPath.endsWith("src/utils/date.ts")) {
        return "export function formatDate() {}";
      }

      return "";
    }
  };
}
