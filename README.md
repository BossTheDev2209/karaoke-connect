# KodHard Karaoke

Sing karaoke together in real-time rooms. One person creates a room and gets a 4-character code; everyone who joins shares the same song queue, the same YouTube playback position, and live timed lyrics (with romanization for Japanese/Korean/Chinese). Voice chat happens wherever you like (e.g. Discord) — this app keeps the **music** in sync.

## Tech stack

- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** (Radix primitives)
- **React Router** for routing, **TanStack Query** for data
- **Supabase** — Realtime channels for room state + two Deno edge functions (`youtube-search`, `fetch-lyrics`)
- **YouTube IFrame API** for playback

## Getting started

Requires [Bun](https://bun.sh) (an `npm install` also works).

```sh
bun install
bun run dev      # http://localhost:8080
```

Create a `.env` in the project root:

```sh
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start the Vite dev server on port 8080 |
| `bun run build` | Production build to `dist/` |
| `bun run build:dev` | Build in development mode |
| `bun run lint` | Run ESLint |
| `bun run preview` | Serve the built `dist/` |

## Edge functions

Deno functions live in `supabase/functions/` and deploy via the Supabase CLI:

```sh
supabase functions deploy youtube-search
supabase functions deploy fetch-lyrics
```

They read secrets from the Supabase environment (not `.env`):

- `YOUTUBE_API_KEY` — required for song search.
- Lyrics come from [LRCLIB](https://lrclib.net) (free, no key), which provides synced (timestamped) lyrics.

## How it works

- **Rooms** are ephemeral: shared state (presence, queue, playback) lives in a Supabase Realtime channel named `room:${code}`. There is no login.
- **Lyrics** are fetched per song, parsed from LRC timestamps, and the active line is found by binary search over the current playback time. Lyrics for upcoming queue songs are preloaded.
- **Romanization** of CJK lyrics is done in the browser (Kuroshiro/Wanakana for Japanese, pinyin-pro for Chinese, a Hangul decomposer for Korean), all lazy-loaded.

See [CLAUDE.md](CLAUDE.md) for a deeper architecture tour.
