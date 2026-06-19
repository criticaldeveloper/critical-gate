import {
  API_SURFACE_SNAPSHOT_PATH,
  buildApiSurfaceSnapshot,
  extractApiSurfaceExports,
  loadApiSurfaceSnapshot,
  summarizeApiSurfaceSnapshot
} from "../src/index.js";

describe("API surface snapshots", () => {
  it("extracts declared, named, aliased, and default exports", () => {
    expect(
      extractApiSurfaceExports(
        "src/index.ts",
        [
          "export interface SignupOptions { strict: boolean }",
          "export function validateSignup(input: SignupInput): boolean { return true; }",
          "export { parseSignup, createSignup as makeSignup } from './signup';",
          "export default validateSignup;"
        ].join("\n")
      )
    ).toEqual([
      expect.objectContaining({
        path: "src/index.ts",
        name: "default",
        kind: "default"
      }),
      expect.objectContaining({
        path: "src/index.ts",
        name: "makeSignup",
        kind: "reexport",
        source: "./signup"
      }),
      expect.objectContaining({
        path: "src/index.ts",
        name: "parseSignup",
        kind: "reexport"
      }),
      expect.objectContaining({
        path: "src/index.ts",
        name: "SignupOptions",
        kind: "interface"
      }),
      expect.objectContaining({
        path: "src/index.ts",
        name: "validateSignup",
        kind: "function",
        signature: "export function validateSignup(input: SignupInput): boolean { return true; }"
      })
    ]);
  });

  it("builds a snapshot from inferred package entrypoints", () => {
    const files = new Map<string, string>([
      [
        "C:/repo/package.json",
        JSON.stringify({
          exports: {
            ".": "./src/index.ts"
          }
        })
      ],
      ["C:/repo/src/index.ts", "export function validateSignup(): boolean { return true; }\n"]
    ]);

    const snapshot = buildApiSurfaceSnapshot({
      root: "C:/repo",
      generatedAt: new Date("2026-06-19T08:00:00.000Z"),
      reader: {
        exists: (path) => files.has(path.replace(/\\/g, "/")),
        readFile: (path) => files.get(path.replace(/\\/g, "/")) ?? ""
      }
    });

    expect(snapshot).toMatchObject({
      schemaVersion: "1.0",
      generatedAt: "2026-06-19T08:00:00.000Z",
      entrypoints: ["src/index.ts"],
      exports: [
        {
          path: "src/index.ts",
          name: "validateSignup",
          kind: "function"
        }
      ]
    });
  });

  it("loads and summarizes a committed snapshot", () => {
    const snapshot = {
      schemaVersion: "1.0",
      generatedAt: "2026-06-19T08:00:00.000Z",
      entrypoints: ["src/index.ts"],
      exports: [
        {
          path: "src/index.ts",
          name: "validateSignup",
          kind: "function",
          signature: "export function validateSignup(): boolean"
        }
      ]
    };
    const files = new Map<string, string>([
      [`C:/repo/${API_SURFACE_SNAPSHOT_PATH}`, JSON.stringify(snapshot)]
    ]);
    const loaded = loadApiSurfaceSnapshot("C:/repo", {
      exists: (path) => files.has(path.replace(/\\/g, "/")),
      readFile: (path) => files.get(path.replace(/\\/g, "/")) ?? ""
    });

    expect(loaded).toEqual(snapshot);
    expect(summarizeApiSurfaceSnapshot(loaded)).toEqual({
      path: API_SURFACE_SNAPSHOT_PATH,
      schemaVersion: "1.0",
      exportCount: 1,
      entrypoints: ["src/index.ts"]
    });
  });
});
