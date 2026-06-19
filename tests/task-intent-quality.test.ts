import { analyzeTaskIntentQuality, getTaskIntentQualityWarnings } from "../src/index.js";

describe("task intent quality", () => {
  it("warns on vague task text", () => {
    expect(
      analyzeTaskIntentQuality({
        source: "cli",
        text: "fix bug"
      })
    ).toEqual({
      score: 20,
      warnings: [
        expect.objectContaining({
          code: "too-short"
        }),
        expect.objectContaining({
          code: "vague-task",
          message: 'Task intent uses vague wording: "fix bug".'
        }),
        expect.objectContaining({
          code: "generic-only"
        })
      ]
    });
  });

  it("warns on generic-only maintenance wording", () => {
    expect(
      getTaskIntentQualityWarnings({
        source: "cli",
        text: "update code"
      }).map((warning) => warning.code)
    ).toEqual(["too-short", "vague-task", "generic-only"]);
  });

  it("accepts specific task intent without warnings", () => {
    expect(
      analyzeTaskIntentQuality({
        source: "cli",
        text: "Fix signup form font weight in typography styles"
      })
    ).toEqual({
      score: 100,
      warnings: []
    });
  });
});
