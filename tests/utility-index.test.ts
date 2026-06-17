import { buildUtilityIndex, extractExportedNames } from "../src/index.js";

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
});
