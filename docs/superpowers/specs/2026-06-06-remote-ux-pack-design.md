# Remote UX Pack — Design

**Date:** 2026-06-06
**Status:** Approved design, pre-implementation
**Batch:** 3 of 4 (remote/UX backlog). Covers #6 (search hidden behind keyboard), #5 (voice search), #7 (state-change feedback).

## Context

The remote (phone) adds songs via an "Add Song" button → bottom `Sheet` containing `SongSearch` (Room.tsx remote block; `SongSearch.tsx`). Three problems:

- **#6** On mobile, opening the search sheet raises the on-screen keyboard, which **covers the search results** (bottom sheet + bottom keyboard collide). Confirmed: search input sits inside a `side="bottom"` sheet with results below it.
- **#5** No voice input — must type every query on a phone.
- **#7** Actions give no confirmation. `handleAddSong` deliberately does nothing visible ("Don't close anything - let user continue browsing/adding"), so adding a song feels dead.

## Approach

Three independent, small changes. No new infra.

### #6 — Top-anchored search (keyboard-safe)

Convert the remote search from a bottom sheet to a **top-anchored, full-height search view**: the input + tabs are **pinned at the top**, results scroll **below** them. The on-screen keyboard rises from the bottom and therefore never covers the input or the first results.

- Container: full dynamic viewport height (`100dvh`/`100svh`), `flex flex-col`, honoring `env(safe-area-inset-top/bottom)`.
- `SongSearch` gains a layout that makes input+tabs a non-scrolling header and the results a `flex-1 min-h-0 overflow-y-auto` region (drop the fixed `max-h-96` in this mode so results fill remaining space).
- Add `enterKeyHint="search"` and `inputMode="search"` to the input.
- Implement by switching the remote search `Sheet` to `side="top"` full-height (or a dedicated full-screen overlay) with the sticky-header layout. Player-side (desktop sidebar / utility sheet) usage of `SongSearch` is unchanged.

### #5 — Voice search

Add a mic button inside the `SongSearch` input row. Uses the Web Speech API (`window.SpeechRecognition || window.webkitSpeechRecognition`).

- Tap mic → start recognition → on final transcript, `setQuery(transcript)` then trigger `handleSearch()`.
- Show a listening state (mic pulsing) while active; stop on result/error/second tap.
- **Feature-detect**: if the API is missing, do not render the mic button. Best-effort (Chrome/Android, Safari iOS); requires HTTPS + mic permission.
- Language hint: set `recognition.lang` from the browser locale (helps Thai). Keep `interimResults` off for simplicity.

### #7 — State-change feedback

Add visible confirmation to the three actions that currently feel dead, scoped small:

1. **Add to queue** (`SongSearch.handleAddSong`): on add, briefly swap the row's `Plus` icon for a success `Check` (e.g. 1s) and/or fire a lightweight toast "Added to queue". Keep the panel open (current behavior preserved).
2. **Play/pause** (remote transport): the button already exists; add a quick scale/icon transition on state change (respect `prefers-reduced-motion`).
3. **Sync** (remote `handleResync`): spin the `RefreshCw` icon briefly on tap so the user sees the request fired (toast already exists; add the spin).

No haptics, no global ripple system — just these three confirmations.

## Components

### `src/components/SongSearch.tsx`
- **#5**: mic button (feature-detected) in the input row; recognition handler; listening state.
- **#6**: optional `fill` layout (sticky input+tabs header, `flex-1` scroll results, no `max-h-96`) selected when used in the remote full-height view. Add `enterKeyHint`/`inputMode` to the `Input`.
- **#7**: per-row added-state (track last-added videoId or a short-lived set) to show the `Check` swap; optional toast.

### `src/pages/Room.tsx` (remote block)
- **#6**: replace the bottom search `Sheet` with the top-anchored full-height search view using the `SongSearch` `fill` layout.
- **#7**: play/pause transition + sync-icon spin (or pass through to `PlayerControls`).

### `src/components/PlayerControls.tsx` (only if needed for #7)
- Add the sync-spin / play-pause transition if that's where the remote transport lives (the remote uses `PlayerControls`). Keep desktop ribbon behavior unchanged.

## Edge cases & decisions

- **Speech API unsupported / denied** → no mic button (or a one-time toast on permission denial). Never block typing.
- **#6 desktop**: unchanged — only the remote (mobile) search becomes top-anchored.
- **Reduced motion**: all #7 animations gated by `prefers-reduced-motion`.
- **Added-state cleanup**: the `Check` swap auto-reverts (timeout) so the panel can keep being used.

## Testing / verification

No UI test runner beyond vitest units. Manual:
- **#6**: on a phone (or devtools device + soft keyboard), open remote search → input stays at top, results scroll, keyboard covers neither the input nor the first result.
- **#5**: tap mic (HTTPS) → speak → query fills + search runs. On an unsupported browser, the mic button is absent.
- **#7**: add a song → row shows a check / toast, panel stays open; play/pause animates; sync spins.

## Out of scope

Batches 1 (shipped), 2 (#4), 4 (#3 playlists). #1/#8 parked (UVR engine stub may revisit #8). #11 dropped. No haptics / global feedback framework.
