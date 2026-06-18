import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runTests } from "@vscode/test-electron";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

await runTests({
  extensionDevelopmentPath: join(root, "extensions", "vscode"),
  extensionTestsPath: join(root, "extensions", "vscode", "dist", "test", "suite", "index.js"),
  launchArgs: [join(root, "fixtures", "vscode-workspace"), "--disable-extensions"]
});
