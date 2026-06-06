# Saved Playlists (localStorage) — Design

**Date:** 2026-06-06
**Status:** Approved design pending user review, pre-implementation
**Batch:** 4 of 4 (remote/UX backlog). Covers #3 (playlist bar — save/search/reuse playlists).

## Context

The app has no auth and no per-user DB (Discord login is mocked). Grill decision: saved playlists live in **localStorage** (device-local), no accounts. The room queue is ephemeral; today there is no way to save a set of songs and reuse it across sessions.

Goal: let a user **save the current queue as a named playlist**, **find** a saved playlist (the "search bar"), and **load it back into the queue** later — all stored locally on that device/browser.

## Scope (MVP — 80/20)

In:
- Save the current queue as a named playlist.
- List saved playlists; **filter by name** (the search bar).
- Load a playlist into the queue (append its songs to the shared queue).
- Rename and delete a playlist; remove a song from a playlist; view a playlist's songs.
- Persist in `localStorage`; survive reload; private-mode safe.

Out (future):
- Pre-curated/app-provided playlists (no backend to host them).
- Cross-device sync / accounts (needs real auth).
- Adding arbitrary individual search results directly into a playlist (MVP saves whole queues; per-song add can come later).
- Sharing playlists between users in a room.

## Storage model

`localStorage` key `karaoke_playlists`, JSON array. All access wrapped in try/catch (mirrors the existing `karaoke_volume` guard) so private mode never throws.

```ts
interface SavedPlaylist {
  id: string;        // crypto.randomUUID()
  name: string;
  createdAt: number;
  updatedAt: number;
  songs: Song[];     // reuse existing Song type from types/karaoke
}
```

## Components

### `src/lib/playlistStore.ts` (new, pure + side-effecting split)
- Pure helpers (unit-testable, no DOM): `addPlaylist(list, name, songs)`, `renamePlaylist(list, id, name)`, `deletePlaylist(list, id)`, `removeSongFromPlaylist(list, id, songId)`, `filterPlaylists(list, query)`. Each takes and returns a `SavedPlaylist[]`.
- IO wrappers: `loadPlaylists(): SavedPlaylist[]` and `savePlaylists(list): void`, both try/catch-guarded around `localStorage`.
- Keep parsing defensive (bad/old JSON → `[]`).

### `src/hooks/usePlaylists.ts` (new)
- Loads once from `playlistStore`, exposes `playlists` + actions (`create(name, songs)`, `rename`, `remove`, `removeSong`) that update state **and** persist. Thin wrapper so components don't touch storage directly.

### `src/components/Playlists.tsx` (new)
Props: `{ queue: Song[]; onQueueSongs: (songs: Song[]) => void }`.
- **Search/filter input** at top (filters saved playlists by name) — this is the "playlist search bar."
- "Save current queue" action → prompts for a name (inline input or simple dialog), saves `queue` as a new playlist. Disabled when the queue is empty.
- List of playlists: name, song count, updatedAt. Row actions: **Load** (`onQueueSongs(playlist.songs)`), **Open** (expand to see songs, remove individual songs), **Rename**, **Delete** (with confirm).
- Empty state when there are no playlists ("Save the current queue to start a playlist.").
- Reuse shadcn/ui primitives (Input, Button, AlertDialog for delete confirm if available — note: AlertDialog wrapper is being added in batch 2/#4; if not yet merged, use a simple inline confirm).

### `src/pages/Room.tsx`
- Add a third tab **"Playlists"** to `renderUtilityContent` (alongside "Up Next" / "Lyrics"), so it appears in both the desktop sidebar and the mobile utility sheet.
- Wire `<Playlists queue={queue} onQueueSongs={(songs) => updateQueue([...queue, ...songs])} />`.
- (Remote layout: optional follow-up — not required for MVP. Keep MVP to the shared utility panel.)

## Data flow

```
Save:  current queue ──create(name)──► usePlaylists ──savePlaylists──► localStorage
Load:  playlist.songs ──onQueueSongs──► updateQueue([...queue, ...songs]) ──broadcast queue_update──► room
```
Loading appends to the shared queue and broadcasts via the existing `updateQueue` (so the whole room gets the songs). Saving is purely local.

## Edge cases & decisions

- **Append vs replace on load:** MVP **appends** (never nukes the live queue). A "replace" option is future.
- **Empty queue:** "Save current queue" disabled.
- **Duplicate names:** allowed (id is the key); no uniqueness enforcement.
- **Private mode / quota:** all storage IO try/catch-guarded; on failure, actions no-op with a toast ("Couldn't save playlist on this device").
- **Large playlists:** loading many songs hits the lyrics-preload pipeline; acceptable (same as adding many songs manually). No special cap in MVP.
- **Device-local reality:** surfaced in copy (e.g. "Saved on this device") so users don't expect cross-device sync.

## Testing / verification

- Unit-test the pure helpers in `playlistStore` (add/rename/delete/removeSong/filter) — fits the existing vitest setup.
- Manual: save current queue → appears in list; reload page → still there; filter by name; Load → songs append to queue and propagate to a second client; rename/delete work; empty state shows with no playlists.

## Out of scope

Batches 1 (shipped), 2 (#4), 3 (shipped). #1/#8 parked. UVR engine separate. #11 dropped. No accounts, no cross-device sync, no curated presets in MVP.
