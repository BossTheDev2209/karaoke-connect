# Phase 1: Hybrid Roles + Music-Position Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every device in a room agree on a single authoritative playback position so the backing music stays in sync, with phones auto-acting as silent remotes and screens acting as audio players.

**Architecture:** Each client gets a `role` (`player` = mounts the YouTube player + plays audio; `remote` = no player, no audio, control-only), auto-detected from the device and overridable. A single **clock** is elected deterministically from the present players (lowest user id), so every client independently agrees who it is with no coordination, and it re-elects automatically when that client leaves. The clock re-anchors the shared `PlaybackState.currentTime` every 3 s; non-clock players seek to the expected position whenever they drift past a threshold (skipping corrections while buffering). Voice stays on Discord — this phase only syncs music.

**Tech Stack:** React 18 + TypeScript, Supabase Realtime (presence + broadcast), YouTube IFrame API, Vitest (added here for the pure logic).

**Scope note:** This is Phase 1 of 3. It ships working synced rooms on its own. Phase 2 (persistence) and Phase 3 (lyric sing-aids) are separate plans.

---

## File Structure

| File | Responsibility | Action |
| --- | --- | --- |
| `vitest.config.ts` | Vitest config (alias `@`, node env) | Create |
| `package.json` | Add `vitest` devDep + `test` scripts | Modify |
| `src/types/karaoke.ts` | Add `RoomRole` type + `role` on `User` | Modify |
| `src/lib/deviceRole.ts` | Pure role auto-detection from device env | Create |
| `src/lib/deviceRole.test.ts` | Unit tests for role detection | Create |
| `src/lib/playbackClock.ts` | Pure clock math: expected position, drift check, clock election | Create |
| `src/lib/playbackClock.test.ts` | Unit tests for clock math | Create |
| `src/hooks/useRoom.ts` | Track `role` in presence; expose `role`, `setRole`, `isClock` | Modify |
| `src/pages/Room.tsx` | Gate player/audio on role; clock heartbeat; follower drift-correct; role override button; remote time ticker | Modify |

The pure logic (`deviceRole`, `playbackClock`) is unit-tested. The realtime/UI wiring (`useRoom`, `Room.tsx`) is verified by build + manual two-device testing in the preview (Task 7), because it depends on live Supabase channels and the YouTube iframe.

---

## Task 0: Add Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json:6-12` (scripts block)

- [ ] **Step 1: Install Vitest**

Run:
```bash
bun add -d vitest
```
Expected: `vitest` appears under `devDependencies` in `package.json` and install completes.

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Add test scripts**

In `package.json`, change the `scripts` block from:
```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "lint": "eslint .",
    "preview": "vite preview"
  },
```
to:
```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 4: Verify the runner works (no tests yet)**

Run:
```bash
bun run test
```
Expected: Vitest runs and reports `No test files found, exiting with code 1` (this confirms Vitest is wired; the next task adds the first test).

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock vitest.config.ts
git commit -m "chore: add vitest for unit testing pure logic"
```

---

## Task 1: Role type + device auto-detection

**Files:**
- Modify: `src/types/karaoke.ts:3` (add `RoomRole`, extend `User`)
- Create: `src/lib/deviceRole.ts`
- Test: `src/lib/deviceRole.test.ts`

- [ ] **Step 1: Add the `RoomRole` type and `role` field**

In `src/types/karaoke.ts`, the file currently begins:
```ts
export type RoomMode = 'free-sing' | 'team-battle';
export type BattleFormat = '1v1' | '2v2' | '3v3' | '4v4' | '5v5';
```
Add a line directly below those two:
```ts
export type RoomRole = 'player' | 'remote';
```
Then, inside the existing `User` interface, add the `role` field after `audioLevel?: number;`:
```ts
  audioLevel?: number;
  role?: RoomRole;
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/deviceRole.test.ts`:
```ts
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
```

- [ ] **Step 2b: Run the test to verify it fails**

Run:
```bash
bun run test src/lib/deviceRole.test.ts
```
Expected: FAIL — `Failed to resolve import "./deviceRole"` (file does not exist yet).

- [ ] **Step 3: Implement `deviceRole.ts`**

Create `src/lib/deviceRole.ts`:
```ts
import type { RoomRole } from "@/types/karaoke";

export interface DeviceEnv {
  width: number;
  hasTouch: boolean;
  coarsePointer: boolean;
}

/** Below this width AND touch-like input => treat as a phone remote. */
export const REMOTE_MAX_WIDTH = 768;

export function detectDefaultRole(env: DeviceEnv): RoomRole {
  const isSmall = env.width < REMOTE_MAX_WIDTH;
  const isTouchLike = env.hasTouch || env.coarsePointer;
  return isSmall && isTouchLike ? "remote" : "player";
}

/** Reads the live browser environment. Falls back to a desktop player on SSR. */
export function readDeviceEnv(): DeviceEnv {
  if (typeof window === "undefined") {
    return { width: 1920, hasTouch: false, coarsePointer: false };
  }
  return {
    width: window.innerWidth,
    hasTouch: "ontouchstart" in window || navigator.maxTouchPoints > 0,
    coarsePointer: window.matchMedia?.("(pointer: coarse)").matches ?? false,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
bun run test src/lib/deviceRole.test.ts
```
Expected: PASS — 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/types/karaoke.ts src/lib/deviceRole.ts src/lib/deviceRole.test.ts
git commit -m "feat: add room role type and device-based role detection"
```

---

## Task 2: Clock math (expected position, drift, election)

**Files:**
- Create: `src/lib/playbackClock.ts`
- Test: `src/lib/playbackClock.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/playbackClock.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { expectedPosition, shouldCorrect, electClock } from "./playbackClock";
import type { PlaybackState, User } from "@/types/karaoke";

const baseState: PlaybackState = {
  isPlaying: true,
  currentTime: 30,
  currentSongIndex: 0,
  lastUpdate: 1_000_000,
};

const user = (id: string, role: User["role"] = "player"): User => ({
  id,
  nickname: id,
  avatarId: "",
  isSpeaking: false,
  role,
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

  it("picks the lowest player id deterministically", () => {
    const users = [user("zeta"), user("alpha"), user("mid")];
    expect(electClock(users)).toBe("alpha");
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
bun run test src/lib/playbackClock.test.ts
```
Expected: FAIL — `Failed to resolve import "./playbackClock"`.

- [ ] **Step 3: Implement `playbackClock.ts`**

Create `src/lib/playbackClock.ts`:
```ts
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
 * Deterministically elects the clock: the player (not remote) with the lowest id.
 * Every client computes the same answer from presence with no coordination, and
 * the clock re-elects automatically when the current one leaves the room.
 */
export function electClock(users: User[]): string | null {
  const players = users.filter((u) => (u.role ?? "player") === "player");
  if (players.length === 0) return null;
  return players.reduce((min, u) => (u.id < min.id ? u : min)).id;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
bun run test src/lib/playbackClock.test.ts
```
Expected: PASS — all groups green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/playbackClock.ts src/lib/playbackClock.test.ts
git commit -m "feat: add playback clock math (expected position, drift, election)"
```

---

## Task 3: Track role in presence + expose clock state from useRoom

**Files:**
- Modify: `src/hooks/useRoom.ts`

This wires the pure logic into the live channel. No unit test (depends on Supabase Realtime); verified by build now and by manual test in Task 7.

- [ ] **Step 1: Add imports and extend the return interface**

At the top of `src/hooks/useRoom.ts`, the imports currently are:
```ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Song, PlaybackState, RealtimePayload } from '@/types/karaoke';
import { RealtimeChannel } from '@supabase/supabase-js';
```
Add the role type + clock election import:
```ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Song, PlaybackState, RealtimePayload, RoomRole } from '@/types/karaoke';
import { RealtimeChannel } from '@supabase/supabase-js';
import { detectDefaultRole, readDeviceEnv } from '@/lib/deviceRole';
import { electClock } from '@/lib/playbackClock';
```
Then extend the `UseRoomReturn` interface — add these three members after `requestSync: () => void;`:
```ts
  requestSync: () => void;
  role: RoomRole;
  setRole: (role: RoomRole) => void;
  isClock: boolean;
```

- [ ] **Step 2: Add role state, initialised from the device**

Inside `useRoom`, after the existing `const channelRef = useRef<RealtimeChannel | null>(null);` line, add:
```ts
  const [role, setRoleState] = useState<RoomRole>(() => detectDefaultRole(readDeviceEnv()));
```

- [ ] **Step 3: Track the role in presence**

In the subscribe callback, the current code tracks the bare user:
```ts
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(user);
          setIsConnected(true);
        }
      });
```
Change `channel.track(user)` to include the role, and add `role` to the effect's dependency array (currently `[roomCode, user]`) so re-tracking happens when the role changes:
```ts
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ ...user, role });
          setIsConnected(true);
        }
      });
```
Then update the dependency array at the end of that `useEffect`:
```ts
  }, [roomCode, user, role]);
```

- [ ] **Step 4: Add `setRole` (re-tracks presence immediately)**

After the `requestSync` `useCallback`, add:
```ts
  const setRole = useCallback((next: RoomRole) => {
    setRoleState(next);
    if (channelRef.current && user) {
      channelRef.current.track({ ...user, role: next });
    }
  }, [user]);
```

- [ ] **Step 5: Compute `isClock` and return the new members**

Just before the `return {` statement, add:
```ts
  const isClock = !!user && electClock(users) === user.id;
```
Then add the three members to the returned object, after `requestSync,`:
```ts
    requestSync,
    role,
    setRole,
    isClock,
  };
```

- [ ] **Step 6: Verify it compiles**

Run:
```bash
bun run build
```
Expected: `✓ built` with no TypeScript errors. (`useRoom` consumers still work because the new return members are additive.)

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useRoom.ts
git commit -m "feat: track role in room presence and expose clock election"
```

---

## Task 4: Apply roles + drift correction in Room.tsx

**Files:**
- Modify: `src/pages/Room.tsx`

- [ ] **Step 1: Add imports**

In `src/pages/Room.tsx`, extend the lucide import (line 17) and the clock-math import. Change:
```ts
import { LogOut, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
```
to:
```ts
import { LogOut, Maximize2, Minimize2, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { expectedPosition, shouldCorrect } from '@/lib/playbackClock';
```

- [ ] **Step 2: Pull `role`, `setRole`, `isClock` out of useRoom**

Change the destructuring (currently lines 38-47):
```ts
  const {
    users,
    queue,
    playbackState,
    isConnected,
    channel,
    updatePlayback,
    updateQueue,
    requestSync,
  } = useRoom(code || '', user);
```
to:
```ts
  const {
    users,
    queue,
    playbackState,
    isConnected,
    channel,
    updatePlayback,
    updateQueue,
    requestSync,
    role,
    setRole,
    isClock,
  } = useRoom(code || '', user);
```

- [ ] **Step 3: Gate the player on role**

A `remote` mounts no player and produces no audio. Change the `useYouTubePlayer` call (line 82) so its `videoId` argument is `null` when the role is `remote`. Replace:
```ts
  const { currentTime, duration, isPlaying, play, pause, seekTo, setVolume: setPlayerVolume, mute, unmute, isMuted, enableCaptions, disableCaptions, areCaptionsEnabled, hasCaptionsAvailable } = useYouTubePlayer('youtube-player', currentSong?.videoId || null, handleStateChange, handleVideoEnded);
```
with:
```ts
  const playerVideoId = role === 'remote' ? null : (currentSong?.videoId || null);
  const { player, isReady, currentTime, duration, isPlaying, play, pause, seekTo, setVolume: setPlayerVolume, mute, unmute, isMuted, enableCaptions, disableCaptions, areCaptionsEnabled, hasCaptionsAvailable } = useYouTubePlayer('youtube-player', playerVideoId, handleStateChange, handleVideoEnded);
```

- [ ] **Step 4: Only the clock auto-broadcasts YouTube state changes**

Followers are driven by sync, so their local YT state changes must not echo back. Change `handleStateChange` (lines 69-71):
```ts
  const handleStateChange = useCallback((isPlaying: boolean) => {
    updatePlayback({ isPlaying });
  }, [updatePlayback]);
```
to:
```ts
  const handleStateChange = useCallback((playing: boolean) => {
    if (isClock) updatePlayback({ isPlaying: playing });
  }, [isClock, updatePlayback]);
```

- [ ] **Step 5: Add the effective time source (remotes tick from the shared clock)**

A `remote` has no player, so its `currentTime` is always 0. Derive the displayed time from the shared `playbackState` instead. Add this right after the `useYouTubePlayer` call from Step 3:
```ts
  // Remotes have no player; tick a local clock so lyrics + the scrubber advance.
  const [, setRemoteTick] = useState(0);
  useEffect(() => {
    if (role !== 'remote') return;
    const id = window.setInterval(() => setRemoteTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [role]);

  const effectiveTime = role === 'remote'
    ? expectedPosition(playbackState, Date.now())
    : currentTime;
```

- [ ] **Step 6: Followers obey authoritative play/pause**

Add after the `effectiveTime` block:
```ts
  // Non-clock players follow the room's authoritative play/pause.
  useEffect(() => {
    if (isClock || role === 'remote' || !isReady) return;
    if (playbackState.isPlaying && !isPlaying) play();
    if (!playbackState.isPlaying && isPlaying) pause();
  }, [isClock, role, isReady, playbackState.isPlaying, isPlaying, play, pause]);
```

- [ ] **Step 7: Followers correct drift; the clock re-anchors every 3 s**

Add directly below the Step 6 effect:
```ts
  // Followers: seek back onto the shared timeline when drift is audible.
  useEffect(() => {
    if (isClock || role === 'remote' || !isReady || !playbackState.isPlaying) return;
    const id = window.setInterval(() => {
      const expected = expectedPosition(playbackState, Date.now());
      const local = player?.getCurrentTime?.() ?? currentTime;
      const buffering = player?.getPlayerState?.() === window.YT?.PlayerState?.BUFFERING;
      if (!buffering && shouldCorrect(local, expected)) {
        seekTo(expected);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isClock, role, isReady, playbackState, player, seekTo, currentTime]);

  // Clock: broadcast the true position every 3s so followers re-anchor.
  useEffect(() => {
    if (!isClock || !isReady || !isPlaying) return;
    const id = window.setInterval(() => {
      updatePlayback({ currentTime: player?.getCurrentTime?.() ?? currentTime, isPlaying: true });
    }, 3000);
    return () => clearInterval(id);
  }, [isClock, isReady, isPlaying, player, currentTime, updatePlayback]);
```

- [ ] **Step 8: Feed `effectiveTime` to lyrics and the scrubber**

In the `useLyrics` call (line ~93), change the third argument from `currentTime` to `effectiveTime`:
```ts
  const { lyrics, currentLineIndex, isLoading: lyricsLoading, error: lyricsError, offset: lyricsOffset, setOffset: setLyricsOffset, isSynced: lyricsSynced, source: lyricsSource } = useLyrics(
    currentSong?.artist || null,
    currentSong?.title || null,
    effectiveTime,
    preloadedLyrics
  );
```
In the `<PlayerControls>` props (line ~317), change `currentTime={currentTime}` to:
```ts
            currentTime={effectiveTime}
```

- [ ] **Step 9: Add the role override button to the header**

In the header actions `<div className="flex items-center gap-2">` (line 199), add this button immediately before `<RoomSettings />` (line 210):
```tsx
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setRole(role === 'remote' ? 'player' : 'remote')}
            title={role === 'remote' ? 'Remote (control only) — tap to play audio here' : 'Player (audio on) — tap to use as remote'}
            aria-label="Toggle device role"
          >
            {role === 'remote' ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
          </Button>
```

- [ ] **Step 10: Show a placeholder on remotes instead of the empty player**

In the video stage, the current "Add songs" overlay (lines 278-282) only covers the no-song case. Add a remote overlay right after it (after line 282, inside the `videoStageRef` div):
```tsx
              {role === 'remote' && currentSong && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-card/85 rounded-lg text-center px-4">
                  <Smartphone className="w-8 h-8 text-primary" />
                  <p className="text-muted-foreground">Remote mode — audio plays on the room's screen. Tap the screen icon above to play here.</p>
                </div>
              )}
```

- [ ] **Step 11: Verify it builds**

Run:
```bash
bun run build
```
Expected: `✓ built` with no TypeScript errors.

- [ ] **Step 12: Commit**

```bash
git add src/pages/Room.tsx
git commit -m "feat: apply device roles and music-position drift correction in room"
```

---

## Task 5: Full unit-test run + lint check

**Files:** none (verification only)

- [ ] **Step 1: Run all unit tests**

Run:
```bash
bun run test
```
Expected: PASS — both `deviceRole.test.ts` and `playbackClock.test.ts` green, 0 failures.

- [ ] **Step 2: Confirm no NEW lint errors in the files we touched**

Run:
```bash
bun run lint
```
Expected: the pre-existing 37 errors / 12 warnings may remain, but there must be **no new** errors in `src/lib/deviceRole.ts`, `src/lib/playbackClock.ts`, `src/hooks/useRoom.ts`, or `src/pages/Room.tsx`. If any of those four files report a new error, fix it before continuing.

- [ ] **Step 3: Commit (only if lint fixes were needed)**

```bash
git add -A
git commit -m "fix: resolve lint issues in phase 1 files"
```

---

## Task 6: Manual two-device verification

**Files:** none (manual acceptance — use the `/verify` or `/run` skill to launch the app)

- [ ] **Step 1: Start the dev server**

Run:
```bash
bun run dev
```
Open `http://localhost:8080` in two browser windows (or use the preview tool twice).

- [ ] **Step 2: Role auto-detection**

In a normal desktop window, create a room and confirm the header shows the **Monitor** icon (player). Resize/emulate a phone (DevTools device toolbar, width < 768, touch) and reload into the same room → header shows the **Smartphone** icon (remote), the video stage shows the "Remote mode" placeholder, and no audio plays from that window.

- [ ] **Step 3: Sync across two players**

Join the same room code in two desktop windows (both players). Add a song and press play in window A. Expected: window B starts playing the same song and stays within ~0.5 s of A. Seek in whichever window is the clock (the one with the lexicographically smallest user id) → the other follows.

- [ ] **Step 4: Drift correction**

In the follower window, manually seek 10 s away using the scrubber. Within ~1 s it should snap back toward the clock's position (followers do not lead).

- [ ] **Step 5: Clock migration**

Close the clock window. The remaining player keeps playing; adding/seeking from it now drives the room (it became the clock). Re-open a second player → it follows.

- [ ] **Step 6: Remote control**

From a remote (phone-emulated) window, add a song and press play/skip. Expected: the player window(s) obey, and the remote's scrubber + lyrics still advance (driven by `effectiveTime`) even though it plays no audio.

- [ ] **Step 7: Record the result**

If all six checks pass, Phase 1 is complete. If any fail, debug before merging (see `superpowers:systematic-debugging`). Note any deviations in the PR description.

---

## Self-Review

- **Spec coverage:** auto role by device (Task 1) ✓; phone→remote/muted, big→player (Task 1 + Task 4 Step 3) ✓; clock = first present player, never a remote, with migration (Task 2 `electClock` + Task 3 `isClock`) ✓; host broadcasts authoritative time every ~3 s (Task 4 Step 7) ✓; followers seek when drift > ~0.25–0.35 s, skip while buffering (Task 4 Step 7) ✓; manual override button (Task 4 Step 9) ✓; remotes mute / no player (Task 4 Step 3 + Step 10) ✓; anyone can issue control intents (unchanged existing handlers still call `updatePlayback`/`updateQueue`) ✓.
- **Type consistency:** `RoomRole` (`'player' | 'remote'`) is used identically in `deviceRole.ts`, `playbackClock.ts`, `useRoom.ts`, and `Room.tsx`. `electClock`, `expectedPosition`, `shouldCorrect` signatures match their call sites. `useYouTubePlayer` already returns `player` and `isReady` (confirmed in `src/hooks/useYouTubePlayer.ts`), now destructured in Task 4 Step 3.
- **Deviation from grill (intentional):** the grill said "first present user = clock." This plan uses deterministic lowest-id election instead, because all clients must agree on the clock from presence with no shared join-order timestamp; lowest-id is stable, agreed, and self-heals on leave. Behaviour to the user is identical (one clock, auto-migrates), so the override button still satisfies the "override if wrong" requirement.
```
