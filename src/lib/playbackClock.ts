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

/**
 * Deterministically elects the clock: the oldest player (not remote).
 * Every client computes the same answer from presence with no coordination, and
 * the clock re-elects automatically when the current one leaves the room.
 */
export function electClock(users: User[]): string | null {
  const players = users.filter((u) => (u.role ?? "player") === "player");
  if (players.length === 0) return null;
  return players.reduce((oldest, user) => {
    const oldestJoinedAt = oldest.joinedAt ?? Number.MAX_SAFE_INTEGER;
    const userJoinedAt = user.joinedAt ?? Number.MAX_SAFE_INTEGER;
    if (userJoinedAt !== oldestJoinedAt) return userJoinedAt < oldestJoinedAt ? user : oldest;
    return user.id < oldest.id ? user : oldest;
  }).id;
}
