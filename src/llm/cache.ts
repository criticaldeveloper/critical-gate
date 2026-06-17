import { createHash } from "node:crypto";

import type { LlmCache, LlmProviderResponse } from "./types.js";

export class MemoryLlmCache implements LlmCache {
  private readonly entries = new Map<string, LlmProviderResponse>();

  constructor(private readonly maxEntries = 50) {}

  get(key: string): LlmProviderResponse | undefined {
    return this.entries.get(key);
  }

  set(key: string, response: LlmProviderResponse): void {
    if (this.entries.size >= this.maxEntries) {
      const firstKey = this.entries.keys().next().value;

      if (firstKey !== undefined) {
        this.entries.delete(firstKey);
      }
    }

    this.entries.set(key, response);
  }
}

export function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
