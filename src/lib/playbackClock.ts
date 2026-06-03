import type { PlaybackState, User } from "@/types/karaoke";

/** Seek correction fires once a follower drifts more than this many seconds. */
export const DRIFT_THRESHOLD_SEC = 0.35;

/** Where playback *should* be right now, projecting from the last authoritative anchor. */
export function expectedPosition(state: PlaybackState, now: number): number {
  if (!state.isPlaying) return state.currentTime;
  const elapsedSec = Math.max(0, (now - state.lastUpdate) / 1000);
  return state.currentTime + elapsedSec;
}

export function shouldCorrect(
  localTime: number,
  expected: number,
  threshold: number = DRIFT_THRESHOLD_SEC
): boolean {
  return Math.abs(localTime - expected) > threshold;
}

export function canBroadcastClockState({
  isClock,
  hasAuthoritativeState,
}: {
  isClock: boolean;
  hasAuthoritativeState: boolean;
}): boolean {
  return isClock && hasAuthoritativeState;
}

/**
 * Deterministically elects the clock without comparing device wall clocks.
 *
 * Established and legacy players beat fresh clients, so a joiner cannot become
 * clock until it has received or originated authoritative playback state.
 *
 * The election is *sticky*: once a player holds the clock it keeps it for as
 * long as it stays present, so a later joiner with a lexically lower id can
 * never yank playback away from the device that's actually driving the video.
 * `previousClockId` is the id currently believed to be the clock; pass it to
 * preserve stickiness. When it's absent (initial election) or has left the
 * room, we fall back to the lowest id among established players.
 */
export function electClock(users: User[], previousClockId?: string | null): string | null {
  const players = users.filter((u) => (u.role ?? "player") === "player");
  if (players.length === 0) return null;
  const established = players.filter((u) => u.hasAuthoritativeState !== false);
  const candidates = established.length > 0 ? established : players;
  if (previousClockId && candidates.some((u) => u.id === previousClockId)) {
    return previousClockId;
  }
  return candidates.reduce((clock, user) => user.id < clock.id ? user : clock).id;
}
