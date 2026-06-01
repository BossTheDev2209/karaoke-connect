import { describe, it, expect } from "vitest";
import { canBroadcastClockState, expectedPosition, shouldCorrect, electClock } from "./playbackClock";
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

  it("ignores cross-device joinedAt clock skew", () => {
    const users = [user("aaaa", "player", 500_000), user("zzzz", "player", -500_000)];
    expect(electClock(users)).toBe("aaaa");
  });

  it("keeps an established clock when a fresh lower-id player joins", () => {
    const established = { ...user("zzzz"), hasAuthoritativeState: true };
    const fresh = { ...user("aaaa"), hasAuthoritativeState: false };
    expect(electClock([established, fresh])).toBe("zzzz");
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

describe("canBroadcastClockState", () => {
  it("blocks a fresh elected clock from broadcasting default state", () => {
    expect(canBroadcastClockState({ isClock: true, hasAuthoritativeState: false })).toBe(false);
  });

  it("allows only an authoritative elected clock", () => {
    expect(canBroadcastClockState({ isClock: true, hasAuthoritativeState: true })).toBe(true);
    expect(canBroadcastClockState({ isClock: false, hasAuthoritativeState: true })).toBe(false);
  });
});
