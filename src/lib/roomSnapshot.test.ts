import { describe, it, expect } from "vitest";
import { toSnapshotRow, fromSnapshotRow } from "./roomSnapshot";
import type { Song, PlaybackState } from "@/types/karaoke";

const song: Song = { id: "1", videoId: "v", title: "t", artist: "a", thumbnail: "", duration: "3:00", addedBy: "u" };
const playback: PlaybackState = { isPlaying: true, currentTime: 12, currentSongIndex: 0, lastUpdate: 1000 };

describe("roomSnapshot", () => {
  it("round-trips queue + playback", () => {
    const row = toSnapshotRow("ABCD", [song], playback);
    const snap = fromSnapshotRow(row);
    expect(snap.code).toBe("ABCD");
    expect(snap.queue).toEqual([song]);
    expect(snap.playback).toEqual(playback);
  });

  it("returns null from a malformed row", () => {
    expect(fromSnapshotRow(null)).toBeNull();
    expect(fromSnapshotRow({ code: "ABCD" })).toBeNull();
  });
});
