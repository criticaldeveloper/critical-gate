import type { GateResult } from "../schema/index.js";
import { createModelInputArtifact, resolveModelBudget } from "./artifact.js";
import { MemoryLlmCache, stableHash } from "./cache.js";
import { LLM_PROMPT_VERSION, buildExplanationPrompt } from "./prompt.js";
import type { ExplainFindingsOptions, LlmExplanation, LlmProvider } from "./types.js";

const defaultCache = new MemoryLlmCache();

export async function explainFindingsWithModel(
  result: GateResult,
  provider: LlmProvider,
  options: ExplainFindingsOptions = {}
): Promise<LlmExplanation> {
  const budget = resolveModelBudget(options.budget);
  const artifact = createModelInputArtifact(result, budget);
  const prompt = buildExplanationPrompt(artifact);
  const cacheKey = stableHash({
    provider: provider.name,
    promptVersion: LLM_PROMPT_VERSION,
    artifact
  });
  const cache = options.cache ?? defaultCache;
  const cached = cache.get(cacheKey);

  if (cached !== undefined) {
    return {
      text: cached.text,
      provider: provider.name,
      model: cached.model,
      cacheKey,
      cached: true,
      inputTokens: cached.inputTokens,
      outputTokens: cached.outputTokens
    };
  }

  const response = await provider.complete({
    ...prompt,
    cacheKey,
    maxOutputTokens: budget.maxOutputTokens
  });

  cache.set(cacheKey, response);

  return {
    text: response.text,
    provider: provider.name,
    model: response.model,
    cacheKey,
    cached: false,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens
  };
}
