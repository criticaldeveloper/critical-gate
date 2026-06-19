import { loadCriticalGateConfig } from "../src/index.js";

describe("loadCriticalGateConfig", () => {
  it("returns empty config when .critical-gate.json is missing", () => {
    expect(
      loadCriticalGateConfig("C:/repo", {
        exists: () => false
      })
    ).toEqual({ config: {}, warnings: [] });
  });

  it("loads valid optional config", () => {
    expect(
      loadCriticalGateConfig("C:/repo", {
        exists: () => true,
        readFile: () =>
          JSON.stringify({
            patternAliases: { modules: "features" },
            featureRoots: ["src/signup"],
            serviceRoots: ["src/app-services"],
            validatorRoots: ["src/rules"],
            excludePatterns: ["generated"]
          })
      })
    ).toEqual({
      config: {
        patternAliases: { modules: "features" },
        featureRoots: ["src/signup"],
        serviceRoots: ["src/app-services"],
        validatorRoots: ["src/rules"],
        excludePatterns: ["generated"]
      },
      warnings: []
    });
  });

  it("reports invalid config without throwing", () => {
    const result = loadCriticalGateConfig("C:/repo", {
      exists: () => true,
      readFile: () => JSON.stringify({ featureRoots: [123] })
    });

    expect(result.config).toEqual({
      patternAliases: undefined,
      featureRoots: undefined,
      serviceRoots: undefined,
      validatorRoots: undefined,
      excludePatterns: undefined
    });
    expect(result.warnings).toEqual(["featureRoots must be an array of strings."]);
  });
});
