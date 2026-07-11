import { inferTaskContract } from "../src/index.js";

describe("inferred task contracts", () => {
  it("separates a descriptive goal from known invariants and forbidden paths", () => {
    expect(
      inferTaskContract({
        source: "cli",
        text: [
          "Update the profile form.",
          "Constraints: do not add new dependencies or change the public API.",
          "Do not modify package.json or src/auth/**."
        ].join("\n")
      })
    ).toEqual({
      source: "inferred",
      goal: "Update the profile form",
      allowedPaths: [],
      forbiddenPaths: ["package.json", "src/auth/**"],
      expectedArtifacts: [],
      invariants: ["no_new_dependencies", "no_public_api_change"],
      requiredChecks: []
    });
  });

  it("infers established invariants from explicit Spanish constraints", () => {
    expect(
      inferTaskContract({
        source: "cli",
        text: "Actualiza navegación móvil sin añadir dependencias. No modificar la configuración."
      })
    ).toMatchObject({
      goal: "Actualiza navegación móvil",
      invariants: ["no_new_dependencies", "no_config_changes"]
    });
  });

  it("keeps ambiguous descriptive prose out of inferred enforcement", () => {
    expect(
      inferTaskContract({
        source: "cli",
        text: "Review dependency choices for the profile form"
      })
    ).toMatchObject({
      goal: "Review dependency choices for the profile form",
      forbiddenPaths: [],
      invariants: []
    });
  });
});
