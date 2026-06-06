# Remote → Player Command Layer — Design

**Date:** 2026-06-06
**Status:** Approved design, pre-implementation
**Batch:** 1 of 4 (remote/UX backlog). Covers #2 (cinema fullscreen from remote), #9 (lyrics toggle from remote), #10 (mobile seek bug).

## Context

Rooms are serverless-of-state: all shared state lives in a Supabase Realtime channel `room:${code}`. Devices are either `player` (owns the YouTube IFrame, the "stage"/TV) or `remote` (phone controller, no player, drives the room via broadcast). See `useRoom.ts`, `Room.tsx`.

User goal: someone on the sofa, holding only a phone (remote), wants to control the TV's **fullscreen** and **lyrics**, and **scrub** the song — without touching the TV. Today none of these work from a remote.

### Why these three are one batch

All three are the same missing primitive: a remote telling the player device to *do something to its display/playback* that is **not** part of the shared `PlaybackState`. We add one broadcast event that carries all three.

## Problems (confirmed in code)

1. **#10 — mobile seek is dead from a remote.** Remote `handleSeek` calls `seekTo` (a no-op on a remote — its player is `null`) and `updatePlayback({ currentTime })`. The TV is the elected **clock**; the clock never seeks *itself*: the play/pause follow-effect (`Room.tsx` ~L203) only syncs `isPlaying`, and the drift-correction loop (~L210) is skipped when `isClock`. So a remote's scrub is broadcast but the TV silently ignores it. Clip won't move.
2. **#2 — no way to fullscreen the TV from a remote.** Real `requestFullscreen()` is gesture-locked to the TV itself; a broadcast can't satisfy it on a cast/smart-TV nobody touches.
3. **#9 — no way to toggle the TV's on-video lyrics from a remote.** `showStageLyrics` is local player state only.

## Approach

Add a single broadcast event, `player_command`. Remotes **send** it; **player-role** devices **act** on it; remotes ignore inbound copies.

Chosen because: (a) these signals are transient display/playback intents, not durable shared state — putting them in `PlaybackState` would pollute the clock and persist into the room snapshot; (b) one event with an `action` discriminator keeps the surface area small and powers all three with one handler.

**Cinema instead of real fullscreen (#2):** an in-app CSS "cinema" state — stage fills the viewport (`fixed inset-0`), chrome hidden — needs **no** Fullscreen API and **no** user gesture, so a remote can toggle it freely. On cast/smart-TV the browser chrome is already hidden, so the real Fullscreen API adds nothing worth its gesture restriction. (Scenario confirmed: smart-TV/cast, nobody touches the TV after setup.)

### Event shape

```ts
// types/karaoke.ts — add to RealtimePayload.type union
'player_command'

// payload
interface PlayerCommand {
  action: 'seek_to' | 'cinema' | 'lyrics';
  value?: number | boolean; // seek_to: number (seconds); cinema/lyrics: boolean
}
```

### Data flow

```
remote button ──sendPlayerCommand()──► channel broadcast 'room_event' {type:'player_command'}
                                              │
                          ┌───────────────────┴───────────────────┐
                   remote devices                          player devices
                   (ignore: role==='remote')        onPlayerCommand(cmd) fires:
                                                       seek_to → seekTo(value) + clock update
                                                       cinema  → setCinema(value)
                                                       lyrics  → setShowStageLyrics(value)
```

## Components

### `types/karaoke.ts`
- Add `'player_command'` to the `RealtimePayload.type` union.
- Export `PlayerCommand` interface.

### `hooks/useRoom.ts`
- New param: `onPlayerCommand?: (cmd: PlayerCommand) => void`, stored in a ref (same pattern as `getClockPlaybackRef`).
- In the `room_event` broadcast switch, add `case 'player_command'`: if `data.senderId !== user.id` **and** this device is not a remote (`roleRef.current !== 'remote'`), call `onPlayerCommandRef.current?.(data.payload)`. (Ignore self-echo and remote receivers.)
- Return a new `sendPlayerCommand(cmd: PlayerCommand)` that broadcasts `{ type:'player_command', payload: cmd, senderId: user.id }`.

### `pages/Room.tsx`
- Add `const [cinema, setCinema] = useState(false)` (player-side display state).
- Define `handlePlayerCommand(cmd)`:
  - `seek_to` → `seekTo(cmd.value as number)`; if `isClock`, also `updatePlayback({ currentTime })` so followers track.
  - `cinema` → `setCinema(!!cmd.value)`.
  - `lyrics` → `setShowStageLyrics(!!cmd.value)`.
  Pass it into `useRoom`.
- **Remote seek reroute (#10):** in `handleSeek`, when `role === 'remote'`, call `sendPlayerCommand({ action:'seek_to', value:time })` (keep the existing `updatePlayback({ currentTime })` for follower clocks). The player's `seek_to` handler does the actual `seekTo`.
- **Cinema rendering (#2):** when `cinema` is true, the stage container gets `fixed inset-0 z-[60]` fill classes and the header / control ribbon / sidebar are hidden. Pure CSS; reuse/extend existing `karaoke-fullscreen-stage` styling in `index.css` if helpful.
- **Remote buttons (#2/#9):** in the remote layout add two toggles — Cinema and Lyrics — each calling `sendPlayerCommand`. Track their on/off label locally on the remote (optimistic; remotes don't receive the echo).

### `index.css` (only if needed)
- A `.cinema-stage` helper (fill + hide-chrome) if Tailwind utilities get unwieldy inline.

## Edge cases & decisions

- **Multiple player devices:** cinema/lyrics are per-display local UI — every player device applies them independently (fine). `seek_to` is applied by all non-remote devices; followers re-seek toward the clock anyway, so this is safe.
- **Self-echo:** `broadcast.self = true`, so guard on `senderId !== user.id`.
- **Late joiner:** a player joining mid-session does not inherit current cinema/lyrics state. Accepted (YAGNI) — these are one-tap to re-toggle and not safety-critical.
- **Phone-as-player seek:** unchanged — local `seekTo` already works; the reroute only fires for `role === 'remote'`.
- **Reduced motion:** cinema is a layout change, not an animation; respect existing `prefersReducedMotion` for any transition.

## Testing / verification

No test runner or typecheck script in this repo (`CLAUDE.md`). Verify manually with two browser contexts against the same room code:
- Context A = player (default). Context B = `/join?code=XXXX&role=remote`.
- From B: scrub → A's video jumps to the new position (#10).
- From B: tap Cinema → A fills the screen / hides chrome; tap again → restores (#2).
- From B: tap Lyrics → A's on-video lyrics show/hide (#9).
- Confirm B (remote) ignores its own commands and A's other state still syncs.

## Out of scope

- **#1 audio bitrate / #8 EQ — parked.** Structurally blocked: YouTube audio is a cross-origin (and any licensed source is DRM) media element; Web Audio cannot tap it (`createMediaElementSource` blocked), so no EQ; and embed bitrate (~128k) can't be raised without swapping the audio source (yt-dlp = ToS + infra + maintenance + loses the karaoke video; Spotify SDK = legal + higher bitrate but DRM-no-EQ, original vocals, no video, Premium-only, catalog-matching). Both deferred unless the product pivots off YouTube audio. Reversible.
- **#4** leave-room confirm, **#3** saved playlists (localStorage), **#5/#6/#7** remote search/voice/feedback — separate batches/specs.
- **#11** word-by-word lyrics — dropped (no word-level source covers the Thai catalog).
