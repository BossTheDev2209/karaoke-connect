# "Make It Great" — Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Take KodHard Karaoke from "works" to "great" — finish the cinematic redesign, make rooms survive reload, add real karaoke sing-aids, and pay down quality debt.

**Architecture:** Four independent phases, each shippable on its own and runnable in order. Phases A/C/D are pure frontend/edge code Codex owns end-to-end. Phase B (persistence) and the lyrics-function redeploy include **OPS HANDOFF** steps (apply a DB migration, deploy an edge function, set secrets) that require Supabase access — Codex writes the code/migration files and **stops at the handoff**; the maintainer applies them via the Supabase MCP or CLI.

**Tech Stack:** Vite + React 18 + TS, Tailwind + shadcn/ui, Supabase Realtime + Postgres + Deno edge functions, YouTube IFrame API, Vitest. Package manager **Bun**.

**Read first:** `CLAUDE.md`, `AGENTS.md`, `docs/design/2026-05-31-cinematic-stage-brief.md`. Communicate in caveman-ultra per `AGENTS.md`.

**Ground rules:** `bun run build` + `bun run test` green before any task is done; no NEW lint errors in files you touch (repo has ~34 pre-existing); preserve the realtime sync hooks in `Room.tsx` (role/clock/drift effects, `#youtube-player` div id); don't build shelved features (team-battle, scoring, vote-kick, mode-vote, in-app voice, mic indicators).

---

## File Structure

| File | Responsibility | Phase |
| --- | --- | --- |
| `src/pages/Room.tsx` | Remote control-first layout branch; a11y; reduced-motion | A |
| `src/components/ui/button.tsx`, `input.tsx` | 16px inputs, focus rings | A |
| `src/lib/lrc.ts` (new) | Single shared LRC parser (line + enhanced word-level) | C |
| `src/lib/lrc.test.ts` (new) | Unit tests for the parser | C |
| `src/hooks/useLyrics.ts`, `useLyricsPreload.ts` | Use shared parser; expose words | C |
| `src/components/LyricsDisplay.tsx` | Word-by-word fill + count-in | C |
| `src/types/karaoke.ts` | `LyricLine.words`, `RoomSnapshot` types | B, C |
| `src/lib/roomSnapshot.ts` (new) | Pure (de)serialize of room state | B |
| `src/lib/roomSnapshot.test.ts` (new) | Unit tests | B |
| `src/hooks/useRoom.ts` | Load snapshot on join; clock-only debounced write | B |
| `supabase/migrations/0001_room_state.sql` (new) | `room_state` table + RLS | B (ops apply) |
| `supabase/functions/fetch-lyrics/index.ts` | Drop Genius; LRCLIB-only | C (ops redeploy) |
| `supabase/functions/youtube-search/index.ts` | Type the `any`s | D |
| `tailwind.config.ts` | Replace `require()` with import | D |

---

# PHASE A — Finish the Cinematic Redesign

Resumes the redesign at Tasks 6–7 of `docs/superpowers/plans/2026-05-31-redesign-cinematic-stage.md` (Checkpoints 1–3 already shipped). Design tokens already live in `index.css`/`tailwind.config.ts`.

## Task A1: Remote role = control-first layout

**Files:** Modify `src/pages/Room.tsx`

Today every role renders the stage-first layout; a phone `remote` shows a "no audio here" overlay over an empty stage. Remotes have no player — they should get a thumb-reachable control surface instead.

- [ ] **Step 1: Add a remote-layout branch.** In `Room.tsx`, the component returns the stage JSX. Wrap a role check so that when `role === 'remote'` you render a dedicated stacked layout instead of the stage `<main>`. Keep ALL existing hooks/handlers above the `return` unchanged (they already compute `effectiveTime`, `effectiveIsPlaying`, `playbackState`, etc.). Add, right before the existing `return (`:

```tsx
  if (role === 'remote') {
    return (
      <div className="relative isolate min-h-screen overflow-y-auto">
        <StageBackground />
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-5">
          <header className="flex items-center justify-between">
            <RoomCodeDisplay code={code} />
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setRole('player')} title="Play audio on this device" aria-label="Switch to player">
                <Monitor className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLeave} aria-label="Leave room"><LogOut className="h-4 w-4" /></Button>
            </div>
          </header>

          <section className="rounded-[var(--radius)] border border-[hsl(var(--border)/0.6)] bg-[hsl(var(--surface)/0.6)] p-4 backdrop-blur-xl">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Now playing</p>
            {currentSong ? (
              <div className="mt-1">
                <p className="truncate font-medium text-foreground">{currentSong.title}</p>
                <p className="truncate text-sm text-muted-foreground">{currentSong.artist}</p>
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Add a song below.</p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">Audio plays on the room's screen. You're the remote.</p>
          </section>

          <PlayerControls
            isPlaying={effectiveIsPlaying}
            isMuted={isMuted}
            volume={volume}
            currentTime={effectiveTime}
            duration={duration}
            canGoPrevious={playbackState.currentSongIndex > 0}
            canGoNext={playbackState.currentSongIndex < queue.length - 1}
            onPlayPause={handlePlayPause}
            onNext={handleNext}
            onPrevious={handlePrevious}
            onSeek={handleSeek}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={isMuted ? unmute : mute}
            onSync={requestSync}
          />

          <ReactionBar onReact={sendReaction} />

          <div className="rounded-[var(--radius)] border border-[hsl(var(--border)/0.6)] bg-[hsl(var(--surface)/0.6)] p-4 backdrop-blur-xl">
            <SongSearch onAddSong={handleAddSong} userId={user.id} />
            <div className="mt-3 max-h-[40vh] overflow-y-auto scrollbar-karaoke">
              <SongQueue queue={queue} currentIndex={playbackState.currentSongIndex} onRemove={handleRemoveSong} onSelect={handleSelectSong} getLyricStatus={getStatusForSong} />
            </div>
          </div>
        </div>
        <FloatingReactions reactions={reactions} />
      </div>
    );
  }
```

- [ ] **Step 2: Verify build.** Run `bun run build`. Expected: `✓ built`, no TS errors. (`Monitor`, `LogOut`, all components/handlers are already imported in `Room.tsx`.)

- [ ] **Step 3: Verify in browser at phone width.** Run `bun run dev`. In DevTools device mode (~390px) open a room; confirm: no video stage, stacked now-playing + transport + reactions + search/queue, no horizontal scroll, transport drives `playbackState` (broadcasts). The role auto-detects `remote` on a touch/small viewport.

- [ ] **Step 4: Commit.**
```bash
git add src/pages/Room.tsx
git commit -m "feat(ui): control-first layout for remote role"
```

## Task A2: Accessibility + reduced-motion + 16px inputs

**Files:** Modify `src/components/ui/input.tsx`, `src/pages/Room.tsx`

- [ ] **Step 1: 16px inputs (prevents iOS zoom).** In `src/components/ui/input.tsx`, the base class uses `text-base` already in some shadcn versions; confirm the className contains `text-base` (16px) and NOT `text-sm`. If it has `md:text-sm` or `text-sm`, change the size portion to `text-base` so inputs are ≥16px on mobile. Concretely, ensure the class string includes `text-base` and remove any `text-sm`/`md:text-sm`.

- [ ] **Step 2: Confirm focus rings.** Verify `input.tsx` and `button.tsx` include `focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]` (amber). If missing on either, add it to the base class.

- [ ] **Step 3: Reduced-motion already gates chrome auto-hide** (`Room.tsx` keeps `chromeVisible` true under `prefers-reduced-motion`). Confirm `StageBackground` ambient drift is also disabled under reduced motion — open `src/components/StageBackground.tsx` and ensure its animated layer is wrapped so it does not animate when `(prefers-reduced-motion: reduce)` matches (CSS `motion-reduce:animate-none` on the animated element, or skip the animation class).

- [ ] **Step 4: Keyboard pass.** Run `bun run dev`. Tab through Landing and Room: every control reachable, amber focus ring visible, the queue/lyric drawers open and close via keyboard (Radix `Sheet` handles Esc/focus-trap by default — just confirm the trigger buttons are focusable, which they are as `<Button>`).

- [ ] **Step 5: Build + commit.**
```bash
bun run build
git add src/components/ui/input.tsx src/pages/Room.tsx src/components/StageBackground.tsx
git commit -m "fix(a11y): 16px inputs, amber focus rings, reduced-motion ambient"
```

🛑 **CHECKPOINT A — human reviews remote layout (phone) + a11y/reduced-motion before Phase B.**

---

# PHASE B — Minimal Persistence (rooms survive reload)

Today room state lives only in the Realtime channel — reload or last-leaver = state gone. Add a `room_state` snapshot the clock writes (debounced) and any client loads on join.

## Task B1: Migration for `room_state` + RLS

**Files:** Create `supabase/migrations/0001_room_state.sql`

- [ ] **Step 1: Write the migration.**
```sql
-- room_state: ephemeral snapshot so a room survives reload / solo presence.
create table if not exists public.room_state (
  code text primary key,
  queue jsonb not null default '[]'::jsonb,
  playback jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.room_state enable row level security;

-- Open-by-code model (no auth in this app). Anyone who knows the 4-char code
-- can read/write that room. Acceptable for ephemeral karaoke; documented trade-off.
create policy "room_state anon read"  on public.room_state for select using (true);
create policy "room_state anon write" on public.room_state for insert with check (true);
create policy "room_state anon update" on public.room_state for update using (true) with check (true);

-- Helps a future cleanup job find stale rooms.
create index if not exists room_state_updated_at_idx on public.room_state (updated_at);
```

- [ ] **Step 2: 🛑 OPS HANDOFF — do NOT proceed past this without the migration applied.** The maintainer applies it via the Supabase MCP (`apply_migration`) or CLI (`supabase db push`) to project `sfqfodqxnpakbqzwzocw`. Report that Task B1 is ready to apply, and wait for confirmation it succeeded before Task B2's verification.

- [ ] **Step 3: Commit the migration file.**
```bash
git add supabase/migrations/0001_room_state.sql
git commit -m "feat(db): room_state snapshot table with open-by-code RLS"
```

## Task B2: Snapshot (de)serialize helper (pure, TDD)

**Files:** Create `src/lib/roomSnapshot.ts`, `src/lib/roomSnapshot.test.ts`; Modify `src/types/karaoke.ts`

- [ ] **Step 1: Add the type.** In `src/types/karaoke.ts`, after `PlaybackState`, add:
```ts
export interface RoomSnapshot {
  code: string;
  queue: Song[];
  playback: PlaybackState;
}
```

- [ ] **Step 2: Write the failing test.** Create `src/lib/roomSnapshot.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toSnapshotRow, fromSnapshotRow } from "./roomSnapshot";
import type { Song, PlaybackState } from "@/types/karaoke";

const song: Song = { id: "1", videoId: "v", title: "t", artist: "a", thumbnail: "", duration: "3:00", addedBy: "u" };
const playback: PlaybackState = { isPlaying: true, currentTime: 12, currentSongIndex: 0, lastUpdate: 1000 };

describe("roomSnapshot", () => {
  it("round-trips queue + playback", () => {
    const row = toSnapshotRow("ABCD", [song], playback);
    const snap = fromSnapshotRow(row);
    expect(snap.code).toBe("ABCD");
    expect(snap.queue).toEqual([song]);
    expect(snap.playback).toEqual(playback);
  });

  it("returns null from a malformed row", () => {
    expect(fromSnapshotRow(null)).toBeNull();
    expect(fromSnapshotRow({ code: "ABCD" })).toBeNull();
  });
});
```

- [ ] **Step 3: Run it — expect FAIL.** `bun run test src/lib/roomSnapshot.test.ts` → "Failed to resolve import".

- [ ] **Step 4: Implement.** Create `src/lib/roomSnapshot.ts`:
```ts
import type { Song, PlaybackState } from "@/types/karaoke";

export interface SnapshotRow {
  code: string;
  queue: Song[];
  playback: PlaybackState;
}

export function toSnapshotRow(code: string, queue: Song[], playback: PlaybackState): SnapshotRow {
  return { code, queue, playback };
}

export function fromSnapshotRow(row: unknown): SnapshotRow | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.code !== "string" || !Array.isArray(r.queue) || !r.playback) return null;
  return { code: r.code, queue: r.queue as Song[], playback: r.playback as PlaybackState };
}
```

- [ ] **Step 5: Run — expect PASS.** `bun run test src/lib/roomSnapshot.test.ts`.

- [ ] **Step 6: Commit.**
```bash
git add src/types/karaoke.ts src/lib/roomSnapshot.ts src/lib/roomSnapshot.test.ts
git commit -m "feat: room snapshot serialize helpers"
```

## Task B3: Wire snapshot load + clock write into useRoom

**Files:** Modify `src/hooks/useRoom.ts`

- [ ] **Step 1: Import helpers.** Add near the other imports:
```ts
import { fromSnapshotRow } from '@/lib/roomSnapshot';
```

- [ ] **Step 2: Load snapshot on join.** Inside the subscribe `useEffect`, in the `SUBSCRIBED` branch, after `await channel.track({ ...user, role });`, load any persisted snapshot so a reload/solo rejoin restores state:
```ts
        if (status === 'SUBSCRIBED') {
          await channel.track({ ...user, role });
          setIsConnected(true);
          const { data } = await supabase
            .from('room_state')
            .select('code, queue, playback')
            .eq('code', roomCode)
            .maybeSingle();
          const snap = fromSnapshotRow(data);
          if (snap) {
            setQueue(snap.queue);
            setPlaybackState(snap.playback);
          }
        }
```

- [ ] **Step 3: Debounced clock-only write.** Add a ref + effect after `isClock` is computed. Only the clock persists, debounced 1.5s, so writes don't storm:
```ts
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!isClock || !roomCode) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      supabase.from('room_state').upsert({
        code: roomCode,
        queue,
        playback: playbackState,
        updated_at: new Date().toISOString(),
      });
    }, 1500);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [isClock, roomCode, queue, playbackState]);
```

- [ ] **Step 4: Build.** `bun run build` → `✓ built`.

- [ ] **Step 5: Verify (needs Task B1 applied).** `bun run dev`, open a room as a desktop player (clock), add 2 songs, play, **reload the page** → the queue + playback position restore from the snapshot. Open a second window with the same code → it loads the snapshot then goes live.

- [ ] **Step 6: Commit.**
```bash
git add src/hooks/useRoom.ts
git commit -m "feat: persist room snapshot (clock writes, all load on join)"
```

🛑 **CHECKPOINT B — human verifies reload-survival after the migration is applied.**

---

# PHASE C — Lyric Sing-Aids

Make following along easy: one shared LRC parser, word-by-word highlight when the source has enhanced (word-level) timing, a count-in before each line, LRCLIB-only.

## Task C1: Shared LRC parser with enhanced word-level support (pure, TDD)

**Files:** Create `src/lib/lrc.ts`, `src/lib/lrc.test.ts`; Modify `src/types/karaoke.ts`

Currently `parseSyncedLyrics`/`parsePlainLyrics` are **duplicated** in `useLyrics.ts` and `useLyricsPreload.ts`. Consolidate into one module and add enhanced-LRC (`<mm:ss.xx>word`) parsing.

- [ ] **Step 1: Extend the type.** In `src/types/karaoke.ts`, change `LyricLine` to:
```ts
export interface LyricWord {
  time: number;
  text: string;
}

export interface LyricLine {
  time: number;
  text: string;
  romanization?: string;
  words?: LyricWord[];
}
```

- [ ] **Step 2: Write the failing test.** Create `src/lib/lrc.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseSyncedLyrics, parsePlainLyrics } from "./lrc";

describe("parseSyncedLyrics", () => {
  it("parses line-level LRC", () => {
    const out = parseSyncedLyrics("[00:12.50]hello world\n[00:15.00]next line");
    expect(out).toHaveLength(2);
    expect(out[0].time).toBeCloseTo(12.5, 2);
    expect(out[0].text).toBe("hello world");
    expect(out[0].words).toBeUndefined();
  });

  it("parses enhanced (word-level) LRC into words", () => {
    const out = parseSyncedLyrics("[00:10.00]<00:10.00>hel <00:10.40>lo <00:10.90>world");
    expect(out).toHaveLength(1);
    expect(out[0].time).toBeCloseTo(10, 2);
    expect(out[0].text).toBe("hel lo world");
    expect(out[0].words?.map((w) => w.text)).toEqual(["hel", "lo", "world"]);
    expect(out[0].words?.[1].time).toBeCloseTo(10.4, 2);
  });

  it("skips metadata/empty lines", () => {
    expect(parseSyncedLyrics("[ar:Artist]\n[00:01.00]a\n[00:02.00]")).toHaveLength(1);
  });
});

describe("parsePlainLyrics", () => {
  it("splits non-empty lines with time 0", () => {
    const out = parsePlainLyrics("a\n\n b \n");
    expect(out).toEqual([{ time: 0, text: "a" }, { time: 0, text: "b" }]);
  });
});
```

- [ ] **Step 3: Run — expect FAIL.** `bun run test src/lib/lrc.test.ts`.

- [ ] **Step 4: Implement.** Create `src/lib/lrc.ts`:
```ts
import type { LyricLine, LyricWord } from "@/types/karaoke";

const LINE_TAG = /\[(\d{2}):(\d{2})\.(\d{2})\]/;
const WORD_TAG = /<(\d{2}):(\d{2})\.(\d{2})>/g;

function toSeconds(m: number, s: number, cs: number): number {
  return m * 60 + s + cs / 100;
}

export function parseSyncedLyrics(lrc: string): LyricLine[] {
  const out: LyricLine[] = [];
  for (const raw of lrc.split("\n")) {
    const line = raw.trimEnd();
    const tag = line.match(LINE_TAG);
    if (!tag) continue; // skip [ar:]/[ti:]/blank metadata
    const time = toSeconds(+tag[1], +tag[2], +tag[3]);
    const rest = line.slice(tag[0].length);

    if (rest.includes("<")) {
      const words: LyricWord[] = [];
      let lastTime = time;
      // split on word tags, keeping the times
      const parts = rest.split(WORD_TAG); // [pre, m,s,cs, word, m,s,cs, word, ...]
      // parts[0] is any text before the first tag (usually empty)
      for (let i = 1; i < parts.length; i += 4) {
        const wTime = toSeconds(+parts[i], +parts[i + 1], +parts[i + 2]);
        const text = (parts[i + 3] ?? "").trim();
        if (text) {
          words.push({ time: wTime, text });
          lastTime = wTime;
        }
      }
      const text = words.map((w) => w.text).join(" ");
      if (text) out.push({ time, text, words });
      void lastTime;
    } else {
      const text = rest.trim();
      if (text) out.push({ time, text });
    }
  }
  return out;
}

export function parsePlainLyrics(plain: string): LyricLine[] {
  return plain
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((text) => ({ time: 0, text }));
}
```

- [ ] **Step 5: Run — expect PASS.** `bun run test src/lib/lrc.test.ts`.

- [ ] **Step 6: De-duplicate.** In `src/hooks/useLyrics.ts` and `src/hooks/useLyricsPreload.ts`, delete the local `parseSyncedLyrics`/`parsePlainLyrics` functions and import them from `@/lib/lrc` instead. Leave all other logic untouched.

- [ ] **Step 7: Build + test + commit.**
```bash
bun run build && bun run test
git add src/types/karaoke.ts src/lib/lrc.ts src/lib/lrc.test.ts src/hooks/useLyrics.ts src/hooks/useLyricsPreload.ts
git commit -m "feat(lyrics): shared LRC parser with enhanced word-level timing"
```

## Task C2: Word-by-word highlight + count-in in LyricsDisplay

**Files:** Modify `src/components/LyricsDisplay.tsx`, `src/pages/Room.tsx`

- [ ] **Step 1: Word fill for the active line.** In `LyricsDisplay.tsx`, the active line is rendered from `lyrics[currentLineIndex]`. When that line has `.words`, render each word as a span and mark words whose `time <= currentTime` as sung (amber/filled) vs upcoming (muted). Concretely, where the active line text is rendered, branch:
```tsx
{activeLine?.words?.length ? (
  <span>
    {activeLine.words.map((w, i) => (
      <span key={i} className={w.time <= currentTime ? 'text-primary' : 'text-muted-foreground'}>
        {w.text}{i < activeLine.words!.length - 1 ? ' ' : ''}
      </span>
    ))}
  </span>
) : (
  <span>{activeLine?.text}</span>
)}
```
(Use the component's existing `currentTime` prop and whatever variable holds the active line; name it `activeLine` if not already.)

- [ ] **Step 2: Count-in dots.** Before the active line starts (gap to next line's start > 3s of silence, i.e. `currentTime` is between the previous line end and this line's `time`), show up to 3 pulsing dots that fill as `time` approaches. Add near the active-line render:
```tsx
{isSynced && nextLineStartsInSec !== null && nextLineStartsInSec <= 3 && nextLineStartsInSec > 0 && (
  <div className="mt-1 flex justify-center gap-1.5" aria-hidden="true">
    {[3, 2, 1].map((n) => (
      <span key={n} className={`h-1.5 w-1.5 rounded-full ${nextLineStartsInSec <= n ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
    ))}
  </div>
)}
```
Compute `nextLineStartsInSec` from the upcoming line's `time - currentTime` (the next line after `currentLineIndex`). Add that as a derived value inside `LyricsDisplay` from the `lyrics`/`currentLineIndex`/`currentTime` props.

- [ ] **Step 3: Build + browser-verify.** `bun run build`, then with a song that has synced lyrics confirm the active line fills word-by-word (only for enhanced-LRC songs) and count-in dots appear in instrumental gaps. Line-level songs still highlight the whole active line.

- [ ] **Step 4: Commit.**
```bash
git add src/components/LyricsDisplay.tsx src/pages/Room.tsx
git commit -m "feat(lyrics): word-by-word fill and count-in dots"
```

## Task C3: Drop Genius from fetch-lyrics (LRCLIB-only)

**Files:** Modify `supabase/functions/fetch-lyrics/index.ts`

- [ ] **Step 1: Remove the Genius path.** Delete the `searchGenius` function and the entire `// FALLBACK: Try Genius API` block in `serve()` (the `const geniusApiKey = Deno.env.get('GENIUS_API_KEY')` section through its `else` log). When LRCLIB finds nothing, return the existing empty response directly:
```ts
    console.log('No lyrics found (LRCLIB only)');
    return new Response(
      JSON.stringify({ syncedLyrics: null, plainLyrics: null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
```
Also remove the now-unused `GENIUS_API` const at the top. Leave all LRCLIB + Thai logic intact.

- [ ] **Step 2: 🛑 OPS HANDOFF — redeploy.** Codex cannot deploy edge functions. Commit the change, then the maintainer redeploys `fetch-lyrics` to `sfqfodqxnpakbqzwzocw` via Supabase MCP (`deploy_edge_function`, `verify_jwt: false`) or CLI (`supabase functions deploy fetch-lyrics --no-verify-jwt`). Report ready-to-deploy.

- [ ] **Step 3: Commit.**
```bash
git add supabase/functions/fetch-lyrics/index.ts
git commit -m "refactor(lyrics): LRCLIB-only, drop Genius fallback"
```

🛑 **CHECKPOINT C — human reviews sing-aids with real songs (word fill, count-in) after redeploy.**

---

# PHASE D — Quality Cleanup

Pay down the pre-existing lint debt in the files the app actually depends on.

## Task D1: Type the edge-function `any`s

**Files:** Modify `supabase/functions/youtube-search/index.ts`, `supabase/functions/fetch-lyrics/index.ts`

- [ ] **Step 1: Replace `(item: any)` mapping callbacks** in `youtube-search/index.ts` with a minimal local interface. Add near the top:
```ts
interface YtSearchItem { id: { videoId?: string; channelId?: string } | string; snippet: Record<string, any>; contentDetails?: { duration: string }; statistics?: Record<string, string>; }
```
and type the `.map((item: any) =>` callbacks as `(item: YtSearchItem)`. Where `item.id` is used as a string (videos detail call) vs object (search call), narrow with `typeof`. Goal: remove the `@typescript-eslint/no-explicit-any` errors flagged by `bun run lint` in this file without changing behavior.

- [ ] **Step 2: Same for `fetch-lyrics/index.ts`** — type the LRCLIB result `any`s with a local `interface LrclibResult { id: number; trackName: string; artistName: string; syncedLyrics: string | null; plainLyrics: string | null; }` and apply to the `.map`/`.filter`/`scoreResult` signatures.

- [ ] **Step 3: Lint check.** `bun run lint` — the error count must drop (those specific `no-explicit-any` lines gone), with **no new** errors. Build is not affected (edge functions aren't bundled by Vite), so just confirm lint.

- [ ] **Step 4: 🛑 OPS HANDOFF — redeploy both functions** (same as Phase C Step 2) so the typed versions are live. Behavior is identical; this is hygiene.

- [ ] **Step 5: Commit.**
```bash
git add supabase/functions
git commit -m "refactor(edge): type the YouTube/LRCLIB response shapes"
```

## Task D2: Fix the tailwind `require()`

**Files:** Modify `tailwind.config.ts`

- [ ] **Step 1: Replace the `require()`** at the flagged line (`@typescript-eslint/no-require-imports`). Add a top import:
```ts
import tailwindcssAnimate from "tailwindcss-animate";
```
and change the `plugins: [require("tailwindcss-animate")]` entry to `plugins: [tailwindcssAnimate]`.

- [ ] **Step 2: Build + lint + commit.**
```bash
bun run build && bun run lint
git add tailwind.config.ts
git commit -m "refactor: import tailwindcss-animate instead of require()"
```

---

## Self-Review

- **Spec coverage:** finish redesign → Phase A (A1 remote, A2 a11y/reduced-motion/16px) ✓; deploy fetch-lyrics → handled as OPS HANDOFF in C3/D1 (Codex can't deploy) ✓; minimal persistence → Phase B (migration + snapshot helper + useRoom wiring) ✓; lyric sing-aids → Phase C (shared parser + word fill + count-in + LRCLIB-only) ✓; quality cleanup → Phase D (`any` types, `require`) ✓.
- **Dependency note:** Phase B verification needs the migration applied (B1 handoff). Phase C word-fill only visibly differs on enhanced-LRC songs; line-level songs keep whole-line highlight (graceful). Phase A depends on the redesign tokens already shipped (Checkpoints 1–3).
- **Type consistency:** `LyricLine.words?: LyricWord[]`, `LyricWord {time,text}`, `parseSyncedLyrics`/`parsePlainLyrics` exported from `@/lib/lrc` and consumed identically in both hooks; `RoomSnapshot`/`SnapshotRow` and `toSnapshotRow`/`fromSnapshotRow` match across helper, test, and `useRoom`. `room_state` columns (`code`, `queue`, `playback`, `updated_at`) match the upsert + select.
- **Placeholders:** none — each code step shows the code; ops steps are explicitly flagged where cloud access is required.

## Ordering & shipping
Recommended order A → B → C → D. Each phase is independently mergeable. The three OPS HANDOFF points (apply migration; redeploy `fetch-lyrics`) are the only steps needing Supabase access — batch them with the maintainer.
