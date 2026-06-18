import { buildSolutionIndex, buildUtilityIndex, extractExportedNames } from "../src/index.js";

describe("utility index", () => {
  it("extracts exported names from declarations and named exports", () => {
    expect(
      extractExportedNames(`
export function formatDate() {}
export const parseDate = () => {};
const internal = true;
export { internal as exposedInternal, parseDate as parseAgain };
`)
    ).toEqual(["formatDate", "internal", "parseDate"]);
  });

  it("builds a utility index from tracked utility files", () => {
    const index = buildUtilityIndex({
      root: "C:/repo",
      runner: {
        execFile: (_file, args) => {
          expect(args).toEqual(["ls-files"]);
          return ["src/utils/date.ts", "src/components/button.tsx", "src/helpers/string.ts"].join(
            "\n"
          );
        },
        readFile: (path) => {
          if (path.replaceAll("\\", "/").endsWith("src/utils/date.ts")) {
            return "export function formatDate() {}";
          }

          if (path.replaceAll("\\", "/").endsWith("src/helpers/string.ts")) {
            return "export const slugify = () => {};";
          }

          return "";
        }
      }
    });

    expect(index).toEqual({
      utilities: [
        { path: "src/helpers/string.ts", exportedNames: ["slugify"] },
        { path: "src/utils/date.ts", exportedNames: ["formatDate"] }
      ]
    });
  });

  it("builds a solution index and keeps utility projection compatibility", () => {
    const index = buildSolutionIndex({
      root: "C:/repo",
      runner: {
        execFile: () =>
          [
            "src/utils/date.ts",
            "src/hooks/use-user.ts",
            "src/services/user-service.ts",
            "src/validators/email.ts",
            "src/components/button.tsx"
          ].join("\n"),
        readFile: (path) => {
          const normalizedPath = path.replaceAll("\\", "/");

          if (normalizedPath.endsWith("src/utils/date.ts")) {
            return "export function formatDate() {}";
          }

          if (normalizedPath.endsWith("src/hooks/use-user.ts")) {
            return "export function useUser() {}";
          }

          if (normalizedPath.endsWith("src/services/user-service.ts")) {
            return "export class UserService {}";
          }

          if (normalizedPath.endsWith("src/validators/email.ts")) {
            return "export const validateEmail = () => true;";
          }

          return "";
        }
      }
    });

    expect(index.solutions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "src/hooks/use-user.ts",
          class: "hook",
          normalizedName: "useuser",
          exportedName: "useUser"
        }),
        expect.objectContaining({
          path: "src/services/user-service.ts",
          class: "service",
          normalizedName: "userservice",
          exportedName: "UserService"
        }),
        expect.objectContaining({
          path: "src/validators/email.ts",
          class: "validator",
          normalizedName: "validateemail",
          exportedName: "validateEmail"
        })
      ])
    );
    expect(index.utilityIndex).toEqual({
      utilities: [{ path: "src/utils/date.ts", exportedNames: ["formatDate"] }]
    });
  });
});
