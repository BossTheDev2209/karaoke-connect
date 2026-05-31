import { describe, it, expect } from "vitest";
import { parseSyncedLyrics, parsePlainLyrics } from "./lrc";

describe("parseSyncedLyrics", () => {
  it("parses line-level LRC", () => {
    const out = parseSyncedLyrics("[00:12.50]hello world\n[00:15.00]next line");
    expect(out).toHaveLength(2);
    expect(out[0].time).toBeCloseTo(12.5, 2);
    expect(out[0].text).toBe("hello world");
    expect(out[0].words).toBeUndefined();
  });

  it("parses enhanced (word-level) LRC into words", () => {
    const out = parseSyncedLyrics("[00:10.00]<00:10.00>hel <00:10.40>lo <00:10.90>world");
    expect(out).toHaveLength(1);
    expect(out[0].time).toBeCloseTo(10, 2);
    expect(out[0].text).toBe("hel lo world");
    expect(out[0].words?.map((w) => w.text)).toEqual(["hel", "lo", "world"]);
    expect(out[0].words?.[1].time).toBeCloseTo(10.4, 2);
  });

  it("skips metadata/empty lines", () => {
    expect(parseSyncedLyrics("[ar:Artist]\n[00:01.00]a\n[00:02.00]")).toHaveLength(1);
  });
});

describe("parsePlainLyrics", () => {
  it("splits non-empty lines with time 0", () => {
    const out = parsePlainLyrics("a\n\n b \n");
    expect(out).toEqual([{ time: 0, text: "a" }, { time: 0, text: "b" }]);
  });
});
