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
 * Established and legacy players beat fresh clients, so a joiner cannot become
 * clock until it has received or originated authoritative playback state.
 */
export function electClock(users: User[]): string | null {
  const players = users.filter((u) => (u.role ?? "player") === "player");
  if (players.length === 0) return null;
  const established = players.filter((u) => u.hasAuthoritativeState !== false);
  const candidates = established.length > 0 ? established : players;
  return candidates.reduce((clock, user) => user.id < clock.id ? user : clock).id;
}
