import {
  applyLearningPolicy,
  createDefaultPolicyConfig,
  getConfiguredExpectedSupportFiles,
  getConfiguredFailOn,
  getPolicyBlockingDetectors,
  getPolicyObservationDetectors,
  loadCriticalGateConfig,
  updateCriticalGateConfig
} from "../src/index.js";

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
            frameworkPacks: ["react", "astro"],
            featureRoots: ["src/signup"],
            serviceRoots: ["src/app-services"],
            validatorRoots: ["src/rules"],
            excludePatterns: ["generated"],
            rollout: {
              observationDetectors: ["blast-radius"],
              blockingDetectors: ["expected-companions"],
              failOn: "high"
            },
            policy: {
              failOn: "medium",
              detectorOverrides: [
                {
                  detector: "existing-solution",
                  mode: "blocking",
                  reason: "Team has tuned this detector."
                }
              ],
              expectedCompanions: [
                {
                  id: "source-tests",
                  whenChanged: "src/**/*.ts",
                  allow: ["tests/**/*.test.ts"],
                  reason: "Source changes require tests.",
                  createdAt: "2026-06-19T10:00:00.000Z"
                }
              ],
              allowedSupportFiles: [
                {
                  id: "docs-for-ci",
                  whenChanged: ".github/workflows/**",
                  allow: ["docs/**/*.md"],
                  reason: "CI changes may include docs.",
                  createdAt: "2026-06-19T10:00:00.000Z"
                }
              ]
            },
            learning: {
              acceptedFindings: [
                {
                  id: "scope:src/generated.ts",
                  reason: "Generated file is expected for this codegen task.",
                  createdAt: "2026-06-19T10:00:00.000Z"
                }
              ],
              expectedSupportFiles: [
                {
                  id: "i18n-for-ui-copy",
                  whenChanged: "src/features/**/*.tsx",
                  allow: ["src/i18n/**/*.json"],
                  reason: "UI copy changes require translations.",
                  createdAt: "2026-06-19T10:00:00.000Z"
                }
              ]
            }
          })
      })
    ).toEqual({
      config: {
        patternAliases: { modules: "features" },
        frameworkPacks: ["react", "astro"],
        featureRoots: ["src/signup"],
        serviceRoots: ["src/app-services"],
        validatorRoots: ["src/rules"],
        excludePatterns: ["generated"],
        rollout: {
          observationDetectors: ["blast-radius"],
          blockingDetectors: ["expected-companions"],
          failOn: "high"
        },
        policy: {
          failOn: "medium",
          detectorOverrides: [
            {
              detector: "existing-solution",
              mode: "blocking",
              reason: "Team has tuned this detector."
            }
          ],
          expectedCompanions: [
            {
              id: "source-tests",
              whenChanged: "src/**/*.ts",
              allow: ["tests/**/*.test.ts"],
              reason: "Source changes require tests.",
              createdAt: "2026-06-19T10:00:00.000Z"
            }
          ],
          allowedSupportFiles: [
            {
              id: "docs-for-ci",
              whenChanged: ".github/workflows/**",
              allow: ["docs/**/*.md"],
              reason: "CI changes may include docs.",
              createdAt: "2026-06-19T10:00:00.000Z"
            }
          ]
        },
        learning: {
          acceptedFindings: [
            {
              id: "scope:src/generated.ts",
              reason: "Generated file is expected for this codegen task.",
              createdAt: "2026-06-19T10:00:00.000Z"
            }
          ],
          expectedSupportFiles: [
            {
              id: "i18n-for-ui-copy",
              whenChanged: "src/features/**/*.tsx",
              allow: ["src/i18n/**/*.json"],
              reason: "UI copy changes require translations.",
              createdAt: "2026-06-19T10:00:00.000Z"
            }
          ]
        }
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
      frameworkPacks: undefined,
      featureRoots: undefined,
      serviceRoots: undefined,
      validatorRoots: undefined,
      excludePatterns: undefined,
      rollout: undefined,
      policy: undefined,
      learning: undefined
    });
    expect(result.warnings).toEqual(["featureRoots must be an array of strings."]);
  });

  it("derives policy helpers from policy-as-code and legacy rollout config", () => {
    const config = {
      rollout: {
        observationDetectors: ["blast-radius"],
        blockingDetectors: ["scope"],
        failOn: "high" as const
      },
      policy: {
        failOn: "medium" as const,
        detectorOverrides: [
          {
            detector: "existing-solution",
            mode: "blocking" as const,
            reason: "Tuned locally."
          },
          {
            detector: "expected-companions",
            mode: "observation" as const,
            reason: "Guidance only."
          }
        ],
        expectedCompanions: [
          {
            id: "source-tests",
            whenChanged: "src/**/*.ts",
            allow: ["tests/**/*.test.ts"],
            reason: "Source changes require tests.",
            createdAt: "2026-06-19T10:00:00.000Z"
          }
        ]
      },
      learning: {
        expectedSupportFiles: [
          {
            id: "docs-for-config",
            whenChanged: "tsconfig.json",
            allow: ["docs/**/*.md"],
            reason: "Config changes need docs.",
            createdAt: "2026-06-19T10:00:00.000Z"
          }
        ]
      }
    };

    expect(getConfiguredFailOn(config)).toBe("medium");
    expect(getPolicyObservationDetectors(config)).toEqual(["blast-radius", "expected-companions"]);
    expect(getPolicyBlockingDetectors(config)).toEqual(["scope", "existing-solution"]);
    expect(getConfiguredExpectedSupportFiles(config)?.map((rule) => rule.id)).toEqual([
      "docs-for-config",
      "source-tests"
    ]);
  });

  it("creates a starter policy config", () => {
    expect(createDefaultPolicyConfig(new Date("2026-06-19T10:00:00.000Z"))).toMatchObject({
      policy: {
        failOn: "high",
        detectorOverrides: [
          {
            detector: "expected-companions",
            mode: "observation"
          }
        ],
        expectedCompanions: [
          {
            id: "source-test-companion",
            createdAt: "2026-06-19T10:00:00.000Z"
          }
        ],
        allowedSupportFiles: [
          {
            id: "docs-for-config",
            createdAt: "2026-06-19T10:00:00.000Z"
          }
        ]
      }
    });
  });

  it("updates config as reviewable JSON", () => {
    const writes = new Map<string, string>();
    const updated = updateCriticalGateConfig(
      "C:/repo",
      (config) => ({
        ...config,
        learning: {
          acceptedFindings: [
            {
              id: "scope:src/generated.ts",
              reason: "Generated file is expected.",
              createdAt: "2026-06-19T10:00:00.000Z"
            }
          ]
        }
      }),
      {
        exists: () => false,
        writeFile: (path, content) => writes.set(path, content)
      }
    );

    expect(updated.learning?.acceptedFindings).toHaveLength(1);
    expect(JSON.parse([...writes.values()][0] ?? "{}")).toMatchObject({
      learning: {
        acceptedFindings: [
          {
            id: "scope:src/generated.ts"
          }
        ]
      }
    });
  });

  it("applies accepted findings and taught support-file rules", () => {
    const result = applyLearningPolicy(
      [
        {
          id: "scope:src/i18n/en.json",
          detector: "scope",
          severity: "medium",
          confidence: 0.7,
          title: "Unexpected file changed for small task",
          message: "Translation changed.",
          evidence: [{ kind: "file", path: "src/i18n/en.json", message: "scope" }],
          repair: "Split task.",
          tags: ["scope"]
        },
        {
          id: "secret-path:src/config.ts:provider-token:1",
          detector: "secret-path",
          severity: "blocker",
          confidence: 0.94,
          title: "Provider token pattern added",
          message: "Token added.",
          evidence: [{ kind: "line", path: "src/config.ts", message: "token" }],
          repair: "Remove token.",
          tags: ["secret"]
        }
      ],
      [
        {
          path: "src/features/login/LoginForm.tsx",
          status: "modified",
          role: "source",
          additions: 1,
          deletions: 0,
          hunks: []
        },
        {
          path: "src/i18n/en.json",
          status: "modified",
          role: "source",
          additions: 1,
          deletions: 0,
          hunks: []
        }
      ],
      {
        acceptedFindings: [
          {
            id: "secret-path:src/config.ts:provider-token:1",
            reason: "Test fixture token.",
            createdAt: "2026-06-19T10:00:00.000Z"
          }
        ],
        expectedSupportFiles: [
          {
            id: "i18n-for-login-ui",
            whenChanged: "src/features/**/*.tsx",
            allow: ["src/i18n/**/*.json"],
            reason: "Login UI copy requires translations.",
            createdAt: "2026-06-19T10:00:00.000Z"
          }
        ]
      }
    );

    expect(result.findings).toEqual([]);
    expect(result.appliedAcceptedFindings).toEqual(["secret-path:src/config.ts:provider-token:1"]);
    expect(result.appliedExpectedSupportRules).toEqual(["i18n-for-login-ui"]);
  });
});
