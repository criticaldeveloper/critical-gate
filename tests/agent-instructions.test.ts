import {
  initAgentInstructions,
  mergeCriticalGateAgentBlock,
  renderCriticalGateAgentBlock
} from "../src/index.js";

describe("agent onboarding instructions", () => {
  it("creates a managed Critical Gate block", () => {
    const block = renderCriticalGateAgentBlock("pnpm critical-gate");

    expect(block).toContain("<!-- critical-gate:start -->");
    expect(block).toContain("## Critical Gate Agent Instructions");
    expect(block).toContain('pnpm critical-gate check --task "<task intent>" --base <base-ref>');
    expect(block).toContain("<!-- critical-gate:end -->");
  });

  it("preserves existing AGENTS.md content when appending the managed block", () => {
    const existing = "# AGENTS.md\n\nKeep local instructions.\n";
    const next = mergeCriticalGateAgentBlock(existing, renderCriticalGateAgentBlock());

    expect(next).toContain("# AGENTS.md\n\nKeep local instructions.");
    expect(next).toContain("## Critical Gate Agent Instructions");
    expect(next).toContain('npx critical-gate check --task "<task intent>" --base <base-ref>');
  });

  it("replaces only the managed block on repeated runs", () => {
    const existing = [
      "# AGENTS.md",
      "",
      "Keep local instructions.",
      "",
      "<!-- critical-gate:start -->",
      "old generated content",
      "<!-- critical-gate:end -->",
      "",
      "Keep trailing instructions.",
      ""
    ].join("\n");
    const next = mergeCriticalGateAgentBlock(
      existing,
      renderCriticalGateAgentBlock("node dist/cli.js")
    );

    expect(next).toContain("Keep local instructions.");
    expect(next).toContain("Keep trailing instructions.");
    expect(next).not.toContain("old generated content");
    expect(next).toContain('node dist/cli.js check --task "<task intent>" --base <base-ref>');
  });

  it("does not write when AGENTS.md already has the current managed block", () => {
    const existing = renderCriticalGateAgentBlock();
    const writes: string[] = [];
    const result = initAgentInstructions({
      root: "C:/repo",
      io: {
        exists: () => true,
        readFile: () => existing,
        writeFile: (_path, content) => writes.push(content)
      }
    });

    expect(result.updated).toBe(false);
    expect(writes).toEqual([]);
  });
});
