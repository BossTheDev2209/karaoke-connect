# AGENTS.md

Operating guide for AI coding agents working in this repo. For the full architecture tour, read `CLAUDE.md` — this file is the short operational contract.

## Communication style — caveman ultra (always on)

Respond in **caveman ultra** mode in every reply, and do not drop it (exceptions below). If you are Claude Code, invoke the `/caveman ultra` skill; any other agent, follow these rules directly.

- Terse like a smart caveman. Keep ALL technical substance — only fluff dies.
- Drop: articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries (sure/of course/happy to), hedging.
- Fragments OK. Short synonyms (big not extensive, fix not "implement a solution for"). Abbreviate common terms (DB/auth/config/req/res/fn). Use arrows for causality (X -> Y). One word when one word enough.
- **Keep exact, unchanged:** code blocks, file paths, commands, type/function names, and quoted error messages. Never compress those.
- Pattern: `[thing] [action] [reason]. [next step].`

**Drop caveman temporarily (resume right after) only for:** security warnings, irreversible-action confirmations (deletes, force-push, data loss), multi-step sequences where fragment order could be misread, or when the user asks you to clarify/repeats a question. Turn off entirely only if the user says "stop caveman" / "normal mode".

## Project

KodHard Karaoke — a real-time collaborative karaoke web app. One person creates a room (4-char code); everyone who joins shares the same song queue, the same YouTube playback position, and live timed lyrics. Voice chat lives outside the app (Discord); this app only syncs the music.

**Stack:** Vite + React 18 + TypeScript · Tailwind + shadcn/ui (Radix) · Supabase Realtime (presence + broadcast) for room state · two Supabase/Deno edge functions (`youtube-search`, `fetch-lyrics`) · YouTube IFrame API.

## Setup & commands

Package manager is **Bun** — use `bun`, never npm/yarn.

```sh
bun install
bun run dev        # Vite dev server on http://localhost:8080
bun run build      # production build to dist/ — must pass before a change is "done"
bun run test       # Vitest (unit tests for pure logic in src/lib)
bun run lint       # ESLint
```

Run a single test file: `bun run test src/lib/playbackClock.test.ts`

Environment: a `.env` provides `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`. Edge functions read `YOUTUBE_API_KEY` from the Supabase environment (not `.env`). Lyrics come from LRCLIB (free, no key).

## Conventions

- Import alias `@/` → `src/`.
- shadcn/ui primitives live in `src/components/ui/` (managed via `components.json`). Compose these instead of adding new primitives.
- Conventional commit messages (`feat:`, `fix:`, `chore:`, …).
- Put pure, testable logic in `src/lib/` with a colocated `*.test.ts`. Realtime/UI wiring is verified by build + manual testing, not unit tests.
- Match the surrounding style. This codebase was AI-generated (originally by Lovable) so some files are rough — follow local patterns, don't unilaterally restructure.

## Guardrails

- **tsconfig is intentionally loose** (`strictNullChecks: false`, `noImplicitAny: false`). Don't tighten it.
- **Pre-existing lint debt:** `bun run lint` reports ~37 errors / 12 warnings that predate current work (mostly `any` in `supabase/functions/youtube-search` and a `require()` in `tailwind.config.ts`). Do **not** fix these as part of an unrelated change — only ensure you add no *new* lint errors in files you touch.
- **Rooms are ephemeral and have no server authority:** all shared state lives in a Supabase Realtime channel `room:${code}` (presence + broadcast, last-writer-wins). There is no auth and no rooms table. The Discord "sign in" on the landing page is mocked. Don't assume persistence unless a plan adds it.
- **Shelved features — do not build:** team-battle / scoring, vote-kick, mode-vote, in-app voice/WebRTC, mic/speaking indicators. Their types may exist in `src/types/karaoke.ts` but they are intentionally out of scope.
- Keep changes scoped to what the task/plan names.

## Working from a plan

Implementation plans live in `docs/superpowers/plans/`. When asked to implement one, follow it task-by-task in order: complete every step including the "run the test/build" verification steps, and commit as the plan specifies. `bun run test` and `bun run build` must be green before a task is done. If a plan step has a Unix-shell idiom that fails (this is a Windows machine), translate it while keeping the intent identical.

Tasks marked as **manual verification** (e.g. multi-device sync testing) require a human — complete the automatable tasks, then stop and report rather than fabricating a result.
