import { parseUnifiedDiff } from "../src/diff/index.js";
import { buildRepositoryTokenIndex, extractRepositoryTokens } from "../src/repository/index.js";

function tokenValues(tokens: ReturnType<typeof extractRepositoryTokens>): string[] {
  return tokens.map((token) => `${token.value}:${token.source}`);
}

describe("repository token index", () => {
  it("normalizes path and folder tokens", () => {
    const tokens = extractRepositoryTokens("src/user-profile/email-validator.ts", "path");

    expect(tokenValues(tokens)).toEqual(
      expect.arrayContaining([
        "user:path",
        "profile:path",
        "email:path",
        "validator:path",
        "validation:path",
        "validate:path"
      ])
    );
  });

  it("indexes package names, symbols, test names, and markdown headings", () => {
    const files = parseUnifiedDiff(`diff --git a/src/rules/user.ts b/src/rules/user.ts
index 57b22a0..cb3e0f1 100644
--- a/src/rules/user.ts
+++ b/src/rules/user.ts
@@ -1,2 +1,3 @@
+export function validateEmailAddress(value: string) { return value.includes("@"); }
 export const user = true;
diff --git a/tests/rules/user.test.ts b/tests/rules/user.test.ts
index 57b22a0..cb3e0f1 100644
--- a/tests/rules/user.test.ts
+++ b/tests/rules/user.test.ts
@@ -1,2 +1,3 @@
+it("validates signup email", () => {})
 expect(user).toBe(true);
diff --git a/docs/api.md b/docs/api.md
index 57b22a0..cb3e0f1 100644
--- a/docs/api.md
+++ b/docs/api.md
@@ -1,2 +1,3 @@
+## Public API Migration
 Existing docs.
`);

    const index = buildRepositoryTokenIndex({
      files,
      packageJson: { name: "@criticaldeveloper/critical-gate" }
    });

    expect(index.files.find((file) => file.path === "src/rules/user.ts")?.tokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "criticaldeveloper", source: "package-name" }),
        expect.objectContaining({ value: "critical", source: "package-name" }),
        expect.objectContaining({ value: "gate", source: "package-name" }),
        expect.objectContaining({ value: "rule", source: "folder" }),
        expect.objectContaining({
          value: "validate",
          source: "symbol",
          raw: "validateEmailAddress"
        }),
        expect.objectContaining({
          value: "email",
          source: "symbol",
          raw: "validateEmailAddress"
        }),
        expect.objectContaining({
          value: "address",
          source: "symbol",
          raw: "validateEmailAddress"
        })
      ])
    );

    expect(index.files.find((file) => file.path === "tests/rules/user.test.ts")?.tokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "signup", source: "test-name" }),
        expect.objectContaining({ value: "email", source: "test-name" })
      ])
    );

    expect(index.files.find((file) => file.path === "docs/api.md")?.tokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "public", source: "markdown-heading" }),
        expect.objectContaining({ value: "api", source: "markdown-heading" }),
        expect.objectContaining({ value: "migration", source: "markdown-heading" })
      ])
    );
  });
});
