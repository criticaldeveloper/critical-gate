export { apiSurfaceDetector } from "./api-surface-detector.js";
export { configChangeDetector } from "./config-change-detector.js";
export { dependencyDetector } from "./dependency-detector.js";
export { runDetectors, summarizeFindings } from "./runner.js";
export { scanAddedLinesForSecretsAndPaths, secretPathDetector } from "./secret-path-detector.js";
export { testWeakeningDetector } from "./test-weakening-detector.js";
export type { Detector, DetectorContext } from "./types.js";
