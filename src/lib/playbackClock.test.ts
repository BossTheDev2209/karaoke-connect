import { describe, it, expect } from "vitest";
import { expectedPosition, shouldCorrect, electClock } from "./playbackClock";
import type { PlaybackState, User } from "@/types/karaoke";

const baseState: PlaybackState = {
  isPlaying: true,
  currentTime: 30,
  currentSongIndex: 0,
  lastUpdate: 1_000_000,
};

const user = (id: string, role: User["role"] = "player", joinedAt?: number): User => ({
  id,
  nickname: id,
  avatarId: "",
  isSpeaking: false,
  role,
  joinedAt,
});

describe("expectedPosition", () => {
  it("advances by wall-clock elapsed time while playing", () => {
    // 2s after lastUpdate => 30 + 2 = 32
    expect(expectedPosition(baseState, 1_002_000)).toBeCloseTo(32, 5);
  });

  it("returns the frozen time when paused", () => {
    const paused = { ...baseState, isPlaying: false };
    expect(expectedPosition(paused, 1_002_000)).toBe(30);
  });

  it("never goes backwards if now precedes lastUpdate", () => {
    expect(expectedPosition(baseState, 999_000)).toBe(30);
  });
});

describe("shouldCorrect", () => {
  it("is false for small drift", () => {
    expect(shouldCorrect(30.0, 30.2)).toBe(false);
  });
  it("is true once drift exceeds the threshold", () => {
    expect(shouldCorrect(30.0, 31.0)).toBe(true);
  });
});

describe("electClock", () => {
  it("returns null when there are no players", () => {
    expect(electClock([user("a", "remote"), user("b", "remote")])).toBeNull();
  });

  it("uses id as a deterministic fallback for legacy presences", () => {
    const users = [user("zeta"), user("alpha"), user("mid")];
    expect(electClock(users)).toBe("alpha");
  });

  it("keeps the oldest player as clock when a later player has a lower id", () => {
    const users = [user("zzzz", "player", 100), user("aaaa", "player", 200)];
    expect(electClock(users)).toBe("zzzz");
  });

  it("uses id as the tie-breaker when players joined together", () => {
    const users = [user("zzzz", "player", 100), user("aaaa", "player", 100)];
    expect(electClock(users)).toBe("aaaa");
  });

  it("ignores remotes when electing", () => {
    const users = [user("aaa", "remote"), user("bbb", "player")];
    expect(electClock(users)).toBe("bbb");
  });

  it("treats missing role as player (backwards compatible)", () => {
    const legacy: User = { id: "x", nickname: "x", avatarId: "", isSpeaking: false };
    expect(electClock([legacy])).toBe("x");
  });
});
