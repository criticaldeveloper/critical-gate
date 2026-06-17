import type { ModelInputArtifact } from "./types.js";

export const LLM_PROMPT_VERSION = "1.0" as const;

export function buildExplanationPrompt(artifact: ModelInputArtifact) {
  return {
    system: [
      "You explain Critical Gate findings for a coding agent.",
      "Use only the supplied artifact.",
      "Do not invent files, code, tests, or repository facts.",
      "Keep the response concise, repair-oriented, and evidence-backed."
    ].join(" "),
    user: [
      `Prompt version: ${LLM_PROMPT_VERSION}`,
      "Explain the highest-risk findings and the smallest safe repair plan.",
      "Return plain text with:",
      "1. Why the gate failed or passed.",
      "2. The top repairs in priority order.",
      "3. Any uncertainty caused by missing context.",
      "",
      "Artifact:",
      JSON.stringify(artifact, null, 2)
    ].join("\n")
  };
}
