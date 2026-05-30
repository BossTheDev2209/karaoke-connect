# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **Bun** (`bun.lockb` present), but npm also works.

```sh
bun install          # install deps
bun run dev          # Vite dev server on http://localhost:8080 (host "::")
bun run build        # production build to dist/
bun run build:dev    # build in development mode
bun run lint         # eslint over the repo
bun run preview      # serve the built dist/
```

There is **no test runner and no typecheck script** configured. `tsconfig` is intentionally loose (`strictNullChecks: false`, `noImplicitAny: false`, `noUnusedLocals: false`) — do not assume strict-mode guarantees.

Supabase edge functions live in `supabase/functions/` and run on Deno (not bundled by Vite). They are deployed via the Supabase CLI (`supabase functions deploy <name>`), not built locally.

## Environment

Frontend reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` from `.env`. Edge functions read secrets from the Deno env (set via Supabase, not `.env`): `YOUTUBE_API_KEY` (required for search) and `GENIUS_API_KEY` (optional lyrics fallback).

## Architecture

A real-time collaborative karaoke web app. Vite + React 18 + TypeScript, shadcn/ui (Radix) components, Tailwind, React Router. Supabase provides realtime channels and two edge functions. **There is no auth and no database table for rooms** — the Discord "sign in" on the landing page is mocked.

### Rooms are ephemeral and serverless-of-state

This is the most important thing to understand before changing playback or queue logic:

- A room has no backing row anywhere. All shared state (who's present, the song queue, playback position) lives only inside a Supabase Realtime channel named `room:${code}` — see [useRoom.ts](src/hooks/useRoom.ts).
- **Presence** (`channel.track(user)`) tracks the user list. **Broadcast** events (`event: 'room_event'`) carry `playback_update` and `queue_update` payloads. The `RealtimePayload` union in [karaoke.ts](src/types/karaoke.ts) lists more event types (vote-kick, mode-vote, team-update) that the type system anticipates but `useRoom` does not yet handle.
- There is **no host / no server authority**. Any client can call `updatePlayback` / `updateQueue`; it's last-writer-wins, and `broadcast: { self: true }` means the sender also receives its own event. State does not survive a page reload or the last participant leaving.
- The local user is stored in `sessionStorage` under `karaoke_user` (set in [Index.tsx](src/pages/Index.tsx), read in [Room.tsx](src/pages/Room.tsx)). No persistence beyond the tab.
- Room codes are 4-char, generated client-side from a confusable-free alphabet — [roomCode.ts](src/lib/roomCode.ts).

### Playback: YouTube IFrame + manual broadcast sync

[Room.tsx](src/pages/Room.tsx) is the single orchestrator page. It drives a hidden YouTube IFrame player via [useYouTubePlayer.ts](src/hooks/useYouTubePlayer.ts), which loads the IFrame API once, reuses one player instance across songs (`loadVideoById`, never recreated per song), polls `currentTime` every 100ms, and exposes caption controls. The `currentSong` is `queue[playbackState.currentSongIndex]`.

When the local user plays/pauses/seeks/skips, Room calls the player method **and** broadcasts the new `PlaybackState` so peers update. Incoming broadcasts set state but the player follows React state, so cross-client sync is best-effort, not frame-accurate. `handleVideoEnded` auto-advances the queue.

### Lyrics pipeline (two-layer: preload + active)

- [useLyricsPreload.ts](src/hooks/useLyricsPreload.ts) eagerly fetches lyrics for the current song, the next song, then up to ~5 ahead, keyed by `song.id`, with a `pending|loading|loaded|error|not_found` status map.
- [useLyrics.ts](src/hooks/useLyrics.ts) consumes that preloaded data for the current song (falling back to a direct fetch only if no preload exists). It parses LRC synced timestamps (`[mm:ss.xx]`) vs. plain text, and finds the active line via **binary search** over `currentTime`, adjusted by a user `offset`. Plain (unsynced) lyrics get `time: 0` and won't highlight.
- Both call the **`fetch-lyrics`** edge function ([supabase/functions/fetch-lyrics/index.ts](supabase/functions/fetch-lyrics/index.ts)): LRCLIB is primary, Genius is fallback. It contains a large Thai-artist romanization mapping table and Thai/non-Thai text splitting to improve matching of Thai songs.
- Song search hits the **`youtube-search`** edge function ([supabase/functions/youtube-search/index.ts](supabase/functions/youtube-search/index.ts)).

### Client-side CJK romanization

[romanization.ts](src/lib/romanization.ts) romanizes lyric lines in the browser. Japanese uses Kuroshiro (lazy-loaded, with a Kuromoji analyzer reading dictionaries from `/dict/` in `public/`) and falls back to Wanakana for kana when Kuroshiro init fails; Chinese uses `pinyin-pro`; Korean uses a hand-rolled Hangul-decomposition romanizer. All heavy libs are dynamically `import()`ed to keep them out of the initial bundle. `initRomanization` is a guarded singleton — don't add a second init path.

### Theming derives from the video

[ThemeContext.tsx](src/contexts/ThemeContext.tsx) wraps the app. Besides fixed presets, the `auto` preset extracts a color palette from the current YouTube thumbnail (canvas pixel sampling → RGB→HSL) and writes it into CSS custom properties that Tailwind consumes. `Room` pushes the current `videoId` into the theme via `setVideoId`. Tailwind colors like `neon-green`, `text-gradient`, `btn-neon`, `card-karaoke` are defined in [tailwind.config.ts](tailwind.config.ts) / `src/index.css`, not arbitrary.

## Conventions

- Import alias `@/` → `src/` (configured in both `vite.config.ts` and `tsconfig`).
- shadcn/ui components live in `src/components/ui/` and are generated/managed via `components.json` (style "default", base color slate, no prefix). Prefer composing these over new primitives.
- This codebase was originally generated by Lovable (an AI app builder); the Lovable-specific tooling has been removed. Expect some generated-code rough edges, especially in older components.
- `src/integrations/supabase/client.ts` and `types.ts` are auto-generated; don't hand-edit (regenerate types from the Supabase schema instead).
