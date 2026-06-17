import { main } from "../src/cli.js";

describe("cli", () => {
  it("returns success for the placeholder command", () => {
    expect(main([])).toBe(0);
  });

  it("returns success for version output", () => {
    expect(main(["--version"])).toBe(0);
  });
});
