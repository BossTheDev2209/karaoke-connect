import { describe, it, expect } from "vitest";
import { detectDefaultRole } from "./deviceRole";

describe("detectDefaultRole", () => {
  it("returns 'remote' for a small touch device (phone)", () => {
    expect(detectDefaultRole({ width: 390, hasTouch: true, coarsePointer: true })).toBe("remote");
  });

  it("returns 'player' for a large mouse device (desktop)", () => {
    expect(detectDefaultRole({ width: 1920, hasTouch: false, coarsePointer: false })).toBe("player");
  });

  it("returns 'player' for a large touch device (TV / big tablet)", () => {
    expect(detectDefaultRole({ width: 1280, hasTouch: true, coarsePointer: true })).toBe("player");
  });

  it("returns 'player' for a small mouse window (resized desktop)", () => {
    expect(detectDefaultRole({ width: 500, hasTouch: false, coarsePointer: false })).toBe("player");
  });
});
