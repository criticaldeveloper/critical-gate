import { detectMonorepoContext, type DiffFile } from "../src/index.js";

const files: DiffFile[] = [
  {
    path: "apps/web/src/App.tsx",
    status: "modified",
    role: "source",
    additions: 2,
    deletions: 1,
    language: "typescript",
    hunks: []
  },
  {
    path: "packages/ui/src/Button.tsx",
    status: "modified",
    role: "source",
    additions: 1,
    deletions: 0,
    language: "typescript",
    hunks: []
  }
];

describe("detectMonorepoContext", () => {
  it("detects pnpm workspaces and changed package owners", () => {
    const repoFiles = new Map<string, string>([
      ["C:/repo/pnpm-workspace.yaml", ["packages:", "  - apps/*", "  - packages/*"].join("\n")],
      ["C:/repo/turbo.json", "{}"],
      [
        "C:/repo/tsconfig.json",
        '{"compilerOptions":{"paths":{"@repo/ui/*":["packages/ui/src/*"]}}}'
      ],
      ["C:/repo/apps/web/package.json", '{"name":"@repo/web"}'],
      ["C:/repo/packages/ui/package.json", '{"name":"@repo/ui"}']
    ]);

    expect(
      detectMonorepoContext("C:/repo", files, {
        exists: (path) => repoFiles.has(path.replaceAll("\\", "/")),
        readFile: (path) => repoFiles.get(path.replaceAll("\\", "/")) ?? ""
      })
    ).toEqual({
      tools: ["pnpm", "turbo"],
      configFiles: ["pnpm-workspace.yaml", "turbo.json", "tsconfig.json"],
      workspaceGlobs: ["apps/*", "packages/*"],
      typescriptPathAliases: ["@repo/ui/*"],
      packages: [
        {
          path: "apps/web",
          name: "@repo/web"
        },
        {
          path: "packages/ui",
          name: "@repo/ui"
        }
      ]
    });
  });

  it("detects package.json object workspace declarations", () => {
    const repoFiles = new Map<string, string>([
      ["C:/repo/package.json", '{"workspaces":{"packages":["services/*"]}}'],
      ["C:/repo/services/api/package.json", '{"name":"api"}']
    ]);

    expect(
      detectMonorepoContext(
        "C:/repo",
        [
          {
            ...files[0]!,
            path: "services/api/src/index.ts"
          }
        ],
        {
          exists: (path) => repoFiles.has(path.replaceAll("\\", "/")),
          readFile: (path) => repoFiles.get(path.replaceAll("\\", "/")) ?? ""
        }
      )
    ).toMatchObject({
      workspaceGlobs: ["services/*"],
      packages: [
        {
          path: "services/api",
          name: "api"
        }
      ]
    });
  });

  it("returns undefined when no workspace evidence exists", () => {
    expect(
      detectMonorepoContext("C:/repo", files, {
        exists: () => false
      })
    ).toBeUndefined();
  });
});
