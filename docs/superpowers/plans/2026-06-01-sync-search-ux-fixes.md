# Sync, Search & UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax. **You MUST follow superpowers:systematic-debugging for every bug phase: reproduce + instrument + confirm the hypothesis BEFORE writing the fix.** Communication: caveman-ultra (see AGENTS.md).

**Goal:** Fix five confirmed bugs (dead sync button, new-joiner desync, duplicate users, wrong lyric matches, no karaoke surfacing) and then the top UX issues, without hardcoded lyric tables.

**Architecture:** Rooms are ephemeral Supabase Realtime channels (`room:${code}`) with presence + broadcast; one elected "clock" client is authoritative for playback position (`src/lib/playbackClock.ts`). Two Deno edge functions: `youtube-search`, `fetch-lyrics`. Pure logic is extracted into testable modules with Vitest; edge-function logic is put in sibling `.ts` modules imported by Vitest tests (the repo already does this in `supabase/functions/youtube-search/videoSearchParams.ts` + `src/lib/youtubeSearchParams.test.ts`).

**Tech Stack:** Vite + React 18 + TS, Supabase Realtime + Deno edge functions, Vitest. Package manager: Bun.

**Maintainer-only actions (OPS HANDOFF):** edge-function deploys go through the maintainer via Supabase MCP (`deploy_edge_function`, project `sfqfodqxnpakbqzwzocw`, `verify_jwt:false`). Commit the function source and STOP at each OPS HANDOFF; the maintainer deploys and reports back. Two-device sync tests are human CHECKPOINTs (you cannot run them).

**Confirmed root causes (do not re-investigate from scratch; confirm with instrumentation, then fix):**
- **Sync button dead:** `requestSync()` broadcasts `{type:'sync_request'}` (`src/hooks/useRoom.ts:110`) but the broadcast handler only switches on `playback_update`/`queue_update` (`useRoom.ts:55-64`). No responder exists.
- **New-joiner desync:** joiner only loads the DB snapshot (`useRoom.ts:70-79`), which is debounced 1.5s and stores a frozen `currentTime`; no live handshake, no extrapolation.
- **Duplicate users:** presence handler flattens one entry per connection (`useRoom.ts:51-52`) and the subscribe effect re-runs on `role` (`useRoom.ts:89`), churning connections.
- **Wrong lyrics:** in `supabase/functions/fetch-lyrics/index.ts`, `extractFirstPart` searches LRCLIB by the pre-dash token (often the artist), the strategy loop `break`s on the first strategy with ANY synced result, and `scoreResult` adds `+0.5` for `hasSynced` (vs `0.4` per name) with no minimum-similarity floor.
- **No karaoke surfacing:** `youtube-search` has no karaoke awareness or provider ranking.

**Locked decisions (from grilling):**
1. Sync: auto-sync (heartbeat + on-change + join handshake) PLUS a manual "Resync" that works.
2. Remove ALL hardcoded lyric maps (drop the Thai artist table); pure-algorithmic matching. Thai match rate may dip; accepted.
3. No confident lyric match -> return "no lyrics found" above a similarity threshold, never a wrong guess.
4. Karaoke: opt-in toggle in search that biases the query and boosts known karaoke-provider channels to the top.

---

## File Structure

- `src/hooks/useRoom.ts` (modify) - sync handshake + heartbeat + presence dedupe + stable subscription.
- `src/lib/presence.ts` (create) - pure `dedupePresence`.
- `src/lib/presence.test.ts` (create).
- `src/lib/playbackClock.ts` (modify if needed) - reuse `expectedPosition`; add `livePlayback` helper if missing.
- `src/pages/Room.tsx` (modify) - provide live clock position to `useRoom`; verify drift seek; UX phase edits.
- `src/types/karaoke.ts` (modify) - add `sync_request` already exists in `RealtimePayload`; confirm.
- `supabase/functions/fetch-lyrics/lyricMatch.ts` (create) - pure parse + score + pick.
- `supabase/functions/fetch-lyrics/index.ts` (modify) - use the module; drop hardcoded maps + early break.
- `src/lib/lyricMatch.test.ts` (create) - imports the edge module, tests scoring/parsing.
- `supabase/functions/youtube-search/karaokeRank.ts` (create) - providers + pure re-rank.
- `supabase/functions/youtube-search/index.ts` (modify) - accept `karaoke` flag, re-rank.
- `src/lib/karaokeRank.test.ts` (create).
- `src/components/SongSearch.tsx` (modify) - karaoke toggle + "no lyrics" already handled downstream.

---

## Phase 1: Working sync (bugs: dead button + new-joiner desync)

These share one root cause: there is no live position handshake. Fix once, both resolve.

**Approach:** The elected clock answers `sync_request` and emits a heartbeat with its *live* position. Non-clock peers already extrapolate + drift-correct via `playbackClock`; we just need to feed them fresh data. New joiners fire `sync_request` right after subscribing so they catch up immediately instead of waiting for the snapshot.

### Task 1.1: Instrument to confirm (systematic-debugging, do not skip)

- [ ] **Step 1: Add temporary logging** in `src/hooks/useRoom.ts` broadcast handler and `subscribe` callback:

```ts
.on('broadcast', { event: 'room_event' }, ({ payload }) => {
  const data = payload as RealtimePayload;
  console.log('[sync] recv', data.type, data.payload);
  // ...existing switch
})
```
And after snapshot load: `console.log('[sync] joiner snapshot', snap);`

- [ ] **Step 2: Reproduce.** Open two tabs in one room, play a song in tab A, click Sync in tab B, then reload tab B.
- [ ] **Step 3: Confirm** the console shows `[sync] recv sync_request` arriving but no responder reacting, and the joiner snapshot is stale/absent. Record the evidence in the commit message. Remove the logs before committing the fix (or keep behind a `DEBUG` flag).

### Task 1.2: Add a live-position provider + sync responder + heartbeat

**Files:** Modify `src/hooks/useRoom.ts`, `src/pages/Room.tsx`.

- [ ] **Step 1: Extend the hook signature** to accept a live-playback getter. In `useRoom.ts`:

```ts
export const useRoom = (
  roomCode: string,
  user: User | null,
  getClockPlayback?: () => PlaybackState,
): UseRoomReturn => {
```

- [ ] **Step 2: Add refs** (after the existing state, before the effect) so the broadcast closure never goes stale:

```ts
const isClockRef = useRef(false);
const getClockPlaybackRef = useRef(getClockPlayback);
useEffect(() => { getClockPlaybackRef.current = getClockPlayback; }, [getClockPlayback]);
```

- [ ] **Step 3: Add the `sync_request` responder** inside the broadcast handler switch:

```ts
case 'sync_request':
  if (isClockRef.current) {
    const live = getClockPlaybackRef.current?.();
    if (live) {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'room_event',
        payload: { type: 'playback_update', payload: { ...live, lastUpdate: Date.now() } },
      });
    }
  }
  break;
```

- [ ] **Step 4: Fire a sync request on join.** In the `subscribe` callback, after the snapshot load block, request the live position so the joiner is not stuck on the debounced snapshot:

```ts
channel.send({ type: 'broadcast', event: 'room_event', payload: { type: 'sync_request', payload: null } });
```

- [ ] **Step 5: Heartbeat.** Add an effect that, while this client is the clock, rebroadcasts the live position every 5s so drifters and late joiners self-correct:

```ts
useEffect(() => {
  isClockRef.current = isClock;
  if (!isClock) return;
  const id = window.setInterval(() => {
    const live = getClockPlaybackRef.current?.();
    if (live) channelRef.current?.send({
      type: 'broadcast', event: 'room_event',
      payload: { type: 'playback_update', payload: { ...live, lastUpdate: Date.now() } },
    });
  }, 5000);
  return () => window.clearInterval(id);
}, [isClock]);
```

- [ ] **Step 6: Provide the getter from Room.** In `src/pages/Room.tsx`, build a stable getter that reads the live player position and pass it to `useRoom`. Near the other refs:

```ts
const livePlaybackRef = useRef<() => PlaybackState>(() => playbackState);
livePlaybackRef.current = () => ({
  ...playbackState,
  currentTime: currentTimeRef.current,
  lastUpdate: Date.now(),
});
const getClockPlayback = useCallback(() => livePlaybackRef.current(), []);
```
Then update the `useRoom` call: `useRoom(code || '', user, getClockPlayback)`.

- [ ] **Step 7: Verify drift-seek runs for non-clock.** Confirm the existing effect using `expectedPosition`/`shouldCorrect` seeks the local player toward the broadcasted position when `!isClock`. If it only runs on user action, make it run on `playbackState.lastUpdate` change. (Read the current effect first; do not duplicate it.)

- [ ] **Step 8: Build + typecheck.**

Run: `bun run build && bunx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "useRoom|Room.tsx" || echo clean`
Expected: `clean`, build passes.

- [ ] **Step 9: Commit.**

```bash
git add src/hooks/useRoom.ts src/pages/Room.tsx
git commit -m "fix(sync): answer sync_request with live clock position + heartbeat + join handshake"
```

### 🛑 CHECKPOINT 1 (human, two devices)
Maintainer runs: two devices/tabs in one room. (a) Play in A, confirm B follows within ~1s. (b) Seek in A, B catches up. (c) Reload B mid-song, confirm it rejoins at the correct position (not 0, not paused). (d) Click manual Resync on B, confirm it snaps to A. Report pass/fail before Phase 2.

---

## Phase 2: Stop duplicate users

**Approach:** Dedupe presence to one entry per user id, and stop re-subscribing the whole channel when role toggles.

### Task 2.1: Confirm the dup shape (instrument)

- [ ] **Step 1:** Temporarily log in the presence sync handler: `console.log('[presence] keys', Object.keys(state), 'flat', Object.values(state).flat().length);`
- [ ] **Step 2: Reproduce** the duplicate (try: two tabs same user; and: toggle player<->remote a few times in one tab).
- [ ] **Step 3: Confirm** whether duplicates are multiple presences under one key (→ dedupe fixes it) or churn from re-subscribe (→ dep fix). Record evidence. Both fixes below are safe regardless.

### Task 2.2: Pure `dedupePresence` + test

**Files:** Create `src/lib/presence.ts`, `src/lib/presence.test.ts`.

- [ ] **Step 1: Failing test** `src/lib/presence.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { dedupePresence } from './presence';
import type { User } from '@/types/karaoke';

const u = (id: string, nickname = id): User => ({ id, nickname } as User);

describe('dedupePresence', () => {
  it('returns one user per presence key, keeping the latest', () => {
    const state = { a: [u('a', 'old'), u('a', 'new')], b: [u('b')] };
    const out = dedupePresence(state);
    expect(out).toHaveLength(2);
    expect(out.find((x) => x.id === 'a')?.nickname).toBe('new');
  });
  it('dedupes by id even across keys', () => {
    const state = { a: [u('a')], 'a-2': [u('a')] };
    expect(dedupePresence(state)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run, expect fail.** `bunx vitest run src/lib/presence.test.ts`
- [ ] **Step 3: Implement** `src/lib/presence.ts`:

```ts
import type { User } from '@/types/karaoke';

// Presence emits one entry per connection under each key; collapse to one
// user per id (latest wins) so a user with multiple tabs/connections shows once.
export function dedupePresence(state: Record<string, User[]>): User[] {
  const byId = new Map<string, User>();
  for (const presences of Object.values(state)) {
    for (const p of presences) {
      if (p && typeof p.id === 'string') byId.set(p.id, p);
    }
  }
  return Array.from(byId.values());
}
```

- [ ] **Step 4: Run, expect pass.** `bunx vitest run src/lib/presence.test.ts`

### Task 2.3: Wire it + stabilize subscription

**Files:** Modify `src/hooks/useRoom.ts`.

- [ ] **Step 1:** Import + use it in the presence handler:

```ts
.on('presence', { event: 'sync' }, () => {
  const state = channel.presenceState<User>();
  setUsers(dedupePresence(state as Record<string, User[]>));
})
```

- [ ] **Step 2: Remove `role` from the subscribe effect deps.** Change `}, [roomCode, user, role]);` to `}, [roomCode, user]);`. Role updates already propagate via `setRole`'s `channel.track` (line ~121); the initial `track` should read the current role from a ref:

```ts
const roleRef = useRef(role);
useEffect(() => { roleRef.current = role; }, [role]);
// in subscribe: await channel.track({ ...user, role: roleRef.current });
```

- [ ] **Step 3: Build + typecheck + full test.**

Run: `bun run build && bunx vitest run`
Expected: build passes, all tests green.

- [ ] **Step 4: Commit.**

```bash
git add src/hooks/useRoom.ts src/lib/presence.ts src/lib/presence.test.ts
git commit -m "fix(presence): dedupe users by id and stop re-subscribing on role change"
```

### 🛑 CHECKPOINT 2 (human)
Maintainer: confirm one user shows once across tabs and after toggling player/remote repeatedly.

---

## Phase 3: Accurate lyric matching (no hardcoded maps)

**Approach:** Extract a pure matching module. Parse the YouTube title into candidate (artist, title) guesses trying BOTH dash orderings and the channel name; gather LRCLIB results from a few queries WITHOUT early-breaking; score by name similarity with synced-lyrics as a tiny tiebreaker only; return the best ONLY if it clears a similarity floor, else null. Delete the Thai artist table and Thai-specific strategy generator.

### Task 3.1: Pure `lyricMatch.ts` + tests

**Files:** Create `supabase/functions/fetch-lyrics/lyricMatch.ts`, `src/lib/lyricMatch.test.ts`.

- [ ] **Step 1: Failing test** `src/lib/lyricMatch.test.ts` (imports the edge module directly, like `youtubeSearchParams.test.ts` does):

```ts
import { describe, it, expect } from 'vitest';
import { parseArtistTitle, scoreCandidate, pickBest } from '../../supabase/functions/fetch-lyrics/lyricMatch';

describe('parseArtistTitle', () => {
  it('handles "Artist - Song" and "Song - Artist" by offering both', () => {
    const guesses = parseArtistTitle('TATTOO COLOUR - พระอาทิตย์ (Official MV)', 'TATTOO COLOUR');
    const pairs = guesses.map((g) => `${g.artist}|${g.title}`);
    expect(pairs.some((p) => p.startsWith('TATTOO COLOUR|'))).toBe(true); // channel as artist
    expect(guesses.length).toBeGreaterThanOrEqual(2);
  });
});

describe('scoreCandidate', () => {
  it('does NOT let an unrelated synced track beat a matching unsynced one', () => {
    const query = { artist: 'Tattoo Colour', title: 'Some Song' };
    const wrongButSynced = { artistName: 'Dept', trackName: 'I feel like that', syncedLyrics: '[00:01.0]x' };
    const rightUnsynced = { artistName: 'Tattoo Colour', trackName: 'Some Song', plainLyrics: 'x' };
    expect(scoreCandidate(rightUnsynced, query)).toBeGreaterThan(scoreCandidate(wrongButSynced, query));
  });
});

describe('pickBest', () => {
  it('returns null when nothing clears the similarity floor', () => {
    const query = { artist: 'Tattoo Colour', title: 'Some Song' };
    const garbage = [{ artistName: 'Dept', trackName: 'I feel like that', syncedLyrics: '[00:01.0]x' }];
    expect(pickBest(garbage, query)).toBeNull();
  });
  it('returns a genuine match', () => {
    const query = { artist: 'Coldplay', title: 'Yellow' };
    const ok = [{ id: 1, artistName: 'Coldplay', trackName: 'Yellow', syncedLyrics: '[00:01.0]x' }];
    expect(pickBest(ok, query)?.trackName).toBe('Yellow');
  });
});
```

- [ ] **Step 2: Run, expect fail.** `bunx vitest run src/lib/lyricMatch.test.ts`

- [ ] **Step 3: Implement** `supabase/functions/fetch-lyrics/lyricMatch.ts`:

```ts
export interface Query { artist: string; title: string; }
export interface Candidate {
  id?: number | string;
  artistName?: string;
  trackName?: string;
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
}

// 0..1 token-overlap similarity, case/space-insensitive.
export function similarity(a: string, b: string): number {
  const x = (a || '').toLowerCase().trim();
  const y = (b || '').toLowerCase().trim();
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.85;
  const wx = x.split(/\s+/), wy = y.split(/\s+/);
  const common = wx.filter((w) => wy.some((v) => v.includes(w) || w.includes(v)));
  return common.length / Math.max(wx.length, wy.length);
}

const NOISE = /\[[^\]]*\]|\((?:official|lyric|audio|mv|m\/v|hd|4k|visualizer|live)[^)]*\)|official|music video|lyric video|\bMV\b/gi;
export function cleanText(s: string): string {
  return (s || '').replace(NOISE, '').replace(/\s+/g, ' ').trim();
}

// Offer (artist,title) guesses for both "A - B" orderings + channel as artist.
export function parseArtistTitle(rawTitle: string, channelTitle?: string): Query[] {
  const t = cleanText(rawTitle);
  const ch = cleanText((channelTitle || '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, ''));
  const out: Query[] = [];
  const parts = t.split(/\s*[-–—]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    out.push({ artist: parts[0], title: parts.slice(1).join(' ') }); // Artist - Song
    out.push({ artist: parts.slice(1).join(' '), title: parts[0] }); // Song - Artist
  } else {
    out.push({ artist: ch, title: t });
  }
  if (ch) out.push({ artist: ch, title: parts.length >= 2 ? parts.slice(1).join(' ') : t });
  // de-dupe
  const seen = new Set<string>();
  return out.filter((g) => { const k = `${g.artist}|${g.title}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

// Name match dominates; synced is a small tiebreaker only (NOT a 0.5 bonus).
export function scoreCandidate(c: Candidate, q: Query): number {
  const artist = similarity(c.artistName || '', q.artist);
  const title = similarity(c.trackName || '', q.title);
  const synced = c.syncedLyrics ? 0.05 : 0;
  return artist * 0.45 + title * 0.55 + synced;
}

export const MATCH_FLOOR = 0.5;

// Best candidate, but only if it actually resembles the query.
export function pickBest(cands: Candidate[], q: Query, floor = MATCH_FLOOR): Candidate | null {
  let best: Candidate | null = null;
  let bestScore = -1;
  for (const c of cands) {
    const s = scoreCandidate(c, q);
    if (s > bestScore) { bestScore = s; best = c; }
  }
  // Require BOTH a decent overall score and a non-trivial title match,
  // so an artist-only coincidence can't carry a wrong song.
  if (!best || bestScore < floor) return null;
  if (similarity(best.trackName || '', q.title) < 0.34) return null;
  return best;
}
```

- [ ] **Step 4: Run, expect pass.** `bunx vitest run src/lib/lyricMatch.test.ts`

### Task 3.2: Rewrite `fetch-lyrics/index.ts` to use the module

**Files:** Modify `supabase/functions/fetch-lyrics/index.ts`.

- [ ] **Step 1: Delete** the `THAI_ARTIST_MAPPINGS` table, `getThaiArtistVariations`, `generateThaiSearchStrategies`, the in-file `similarity`/`scoreResult`/`cleanTitle`/`extractFirstPart`/`extractSongName` helpers, and the early-`break` strategy loop. Import from the module instead:

```ts
import { parseArtistTitle, pickBest, cleanText, type Candidate } from "./lyricMatch.ts";
```

- [ ] **Step 2: New flow** inside `serve`, replacing the old strategy/scoring block:

```ts
const guesses = parseArtistTitle(title, artist);
const seen = new Set<string | number>();
const all: Candidate[] = [];
for (const g of guesses) {
  if (!g.title || g.title.length < 2) continue;
  // query with artist, then title-only as a fallback for this guess
  for (const withArtist of [true, false]) {
    const results = await searchLRCLIB(g.title, withArtist ? g.artist : undefined);
    for (const r of results) {
      if (r.id != null && seen.has(r.id)) continue;
      if (r.id != null) seen.add(r.id);
      all.push(r);
    }
  }
}
// Score against the strongest guess (channel-as-artist + cleaned title).
const primary = { artist: cleanText(artist), title: cleanText(title) };
const best = pickBest(all, primary);
if (!best) {
  console.log('No confident lyric match; returning empty.');
  return new Response(JSON.stringify({ syncedLyrics: null, plainLyrics: null }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
return new Response(JSON.stringify({
  syncedLyrics: best.syncedLyrics || null,
  plainLyrics: best.plainLyrics || null,
  trackName: best.trackName, artistName: best.artistName, source: 'lrclib',
}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
```
Keep `searchLRCLIB` as-is. Keep CORS/OPTIONS. The function no longer references any Thai map.

- [ ] **Step 3: Type-check the edge module locally.**

Run: `deno check supabase/functions/fetch-lyrics/index.ts`
Expected: passes (install Deno if needed; this is the same check used previously).

- [ ] **Step 4: Full test + build.** `bunx vitest run && bun run build` -> green.

- [ ] **Step 5: Commit.**

```bash
git add supabase/functions/fetch-lyrics/ src/lib/lyricMatch.test.ts
git commit -m "fix(lyrics): algorithmic matching with similarity floor; drop hardcoded Thai map and early-break"
```

### 🛑 OPS HANDOFF 3 (maintainer deploys)
Commit, then STOP. Maintainer deploys `fetch-lyrics` via Supabase MCP (`deploy_edge_function`, `verify_jwt:false`) and spot-checks: a Tattoo Colour song no longer returns "I feel like that"; a clearly-wrong/obscure query returns empty rather than a wrong song; Coldplay - Yellow still resolves. Maintainer reports results, then continue.

---

## Phase 4: Opt-in karaoke surfacing

**Approach:** A `karaoke` flag on the search request. When true, bias the query toward karaoke/instrumental and re-rank results so known karaoke-provider channels and karaoke/instrumental titles float to the top. Provider list is a soft ranking signal (allowed; not a lyric hardcode).

### Task 4.1: Pure `karaokeRank.ts` + test

**Files:** Create `supabase/functions/youtube-search/karaokeRank.ts`, `src/lib/karaokeRank.test.ts`.

- [ ] **Step 1: Failing test** `src/lib/karaokeRank.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { karaokeScore, rankForKaraoke } from '../../supabase/functions/youtube-search/karaokeRank';

const r = (title: string, channelTitle: string) => ({ title, channelTitle, videoId: title });

describe('karaokeScore', () => {
  it('boosts known providers and karaoke/instrumental titles', () => {
    expect(karaokeScore(r('Yellow (Karaoke Version)', 'Sing King'))).toBeGreaterThan(karaokeScore(r('Yellow', 'Coldplay')));
    expect(karaokeScore(r('Yellow Instrumental', 'Random'))).toBeGreaterThan(karaokeScore(r('Yellow', 'Random')));
  });
});

describe('rankForKaraoke', () => {
  it('moves karaoke results to the top without dropping others', () => {
    const input = [r('Yellow', 'Coldplay'), r('Yellow (Karaoke)', 'KaraFun')];
    const out = rankForKaraoke(input);
    expect(out[0].channelTitle).toBe('KaraFun');
    expect(out).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run, expect fail.** `bunx vitest run src/lib/karaokeRank.test.ts`

- [ ] **Step 3: Implement** `supabase/functions/youtube-search/karaokeRank.ts`:

```ts
export interface RankItem { videoId: string; title: string; channelTitle: string; [k: string]: unknown; }

// Well-known karaoke / instrumental YouTube channels (lowercased substrings).
export const KARAOKE_PROVIDERS = [
  'sing king', 'karafun', 'zzang', 'sing2piano', 'karaoke mugen', 'kakttv',
  'lucky voice', 'karaoke version', 'singking', 'musisi karaoke', 'aff karaoke',
  'midas karaoke', 'genie music karaoke', 'kpop karaoke', 'pkr karaoke',
];
const TITLE_HINT = /\b(karaoke|instrumental|backing track|sing along|off vocal|minus one)\b/i;

export function karaokeScore(item: RankItem): number {
  let s = 0;
  const ch = (item.channelTitle || '').toLowerCase();
  if (KARAOKE_PROVIDERS.some((p) => ch.includes(p))) s += 2;
  if (TITLE_HINT.test(item.title || '')) s += 1;
  return s;
}

// Stable sort: karaoke-relevant first, original API order preserved within ties.
export function rankForKaraoke<T extends RankItem>(items: T[]): T[] {
  return items
    .map((item, i) => ({ item, i, s: karaokeScore(item) }))
    .sort((a, b) => (b.s - a.s) || (a.i - b.i))
    .map((x) => x.item);
}
```

- [ ] **Step 4: Run, expect pass.** `bunx vitest run src/lib/karaokeRank.test.ts`

### Task 4.2: Wire the flag into the edge function

**Files:** Modify `supabase/functions/youtube-search/index.ts`.

- [ ] **Step 1:** Import + read the flag:

```ts
import { rankForKaraoke } from "./karaokeRank.ts";
// in serve():
const { query, type = 'video', channelId, karaoke = false } = await req.json();
```

- [ ] **Step 2:** In `searchVideos`, when `karaoke` is true, append intent to the query before calling the API, and re-rank the final `results`:

```ts
async function searchVideos(apiKey: string, query: string, karaoke = false) {
  const q = karaoke ? `${query} karaoke` : query;
  // ...build searchUrl with q (not query)...
  // after building `results`:
  const ranked = karaoke ? rankForKaraoke(results) : results;
  return new Response(JSON.stringify({ results: ranked }), { headers: { ... } });
}
```
Thread `karaoke` from `serve` -> `searchVideos(apiKey, query, karaoke)`. Leave channel search untouched.

- [ ] **Step 3:** `deno check supabase/functions/youtube-search/index.ts` -> passes.

- [ ] **Step 4: Frontend toggle.** In `src/components/SongSearch.tsx`, add a "Karaoke" toggle (state `karaoke`, default false) and include it in the `supabase.functions.invoke('youtube-search', { body: { query, karaoke } })` call. Keep it visually minimal; icon/polish can hand off to `/impeccable` later.

- [ ] **Step 5: Build + test.** `bun run build && bunx vitest run` -> green.

- [ ] **Step 6: Commit.**

```bash
git add supabase/functions/youtube-search/ src/lib/karaokeRank.test.ts src/components/SongSearch.tsx
git commit -m "feat(search): opt-in karaoke toggle with provider-aware re-ranking"
```

### 🛑 OPS HANDOFF 4 (maintainer deploys)
Commit, STOP. Maintainer deploys `youtube-search` via MCP and checks: with Karaoke on, "Yellow" floats Sing King / KaraFun to the top; with it off, normal results and ordering. Reports, then continue.

---

## Phase 5: UX fixes (from the /ux audit)

Bugs first; these come after. Each is independently shippable. Some visual polish (icons) hands to `/impeccable`.

### Task 5.1: Persistent control "peek" (audit Sev 4)

**Problem:** the bottom ribbon is fully hidden until hover, so on a TV / no-mouse screen the core controls look like they don't exist.

**Files:** Modify `src/pages/Room.tsx`, `src/lib/ribbonVisibility.ts`.

- [ ] **Step 1:** When the ribbon is "hidden", instead of `opacity-0 translate-y-4 pointer-events-none`, render a **collapsed peek**: a slim always-visible strip showing the thumbnail, title, and a play/pause button, plus a subtle "chevron up" affordance. Full ribbon expands on hover / focus / touch (existing `ribbonVisible`). Keep `prefers-reduced-motion` handling.
- [ ] **Step 2:** Keep the existing instant-hide for the *expanded* chrome; the peek never fully disappears. Verify keyboard focus still expands it.
- [ ] **Step 3: Build.** Commit: `git commit -m "fix(ux): persistent control peek so playback controls are always discoverable"`.

### 🛑 CHECKPOINT 5a (human)
Maintainer confirms controls are discoverable at rest (especially mouse-idle) and the peek doesn't fight the immersive feel. This reverses part of the earlier "fully hide" behavior by design; confirm it's wanted.

### Task 5.2: Untangle the three lyric surfaces (audit Sev 3)

**Files:** Modify `src/pages/Room.tsx` (labels/icons) and tooltips.

- [ ] **Step 1:** Rename for distinct meaning: video overlay toggle -> "Subtitles on video" (icon `Subtitles`); Sing mode -> "Big lyrics" (keep `Mic2`); sidebar tab stays "Lyrics" but its content header reads "Lyrics & timing". Give the overlay toggle and the sidebar tab **different** icons (they currently share `Captions`).
- [ ] **Step 2:** Update `aria-label`/`title` to match. Build. Commit: `git commit -m "fix(ux): disambiguate the subtitle / sing / lyrics controls"`.

### Task 5.3: Surface "use as remote" + fix stale empty copy (audit Sev 2-3)

**Files:** Modify `src/pages/Room.tsx`.

- [ ] **Step 1:** Replace the empty-stage copy `"Open Up Next to add songs."` with context-correct guidance: desktop -> "Search for a song in the panel to start." ; narrow -> "Tap the panel button to add a song." (Use the existing `isWideDesktop` or a CSS `lg:` split.)
- [ ] **Step 2:** Add a first-class "Use my phone as a remote" affordance in the empty state (and/or header) that shows the room code prominently (QR optional, can defer). It should not be buried only in the kebab menu.
- [ ] **Step 3:** Build. Commit: `git commit -m "fix(ux): surface phone-as-remote and correct empty-state copy"`.

### 🛑 CHECKPOINT 5b (human)
Maintainer reviews the three UX changes in the running app, gives feedback.

---

## Self-review checklist (done while writing)
- Sync button + joiner: both covered by Phase 1 (shared root cause). ✓
- Duplicate users: Phase 2. ✓
- Wrong lyrics + no-hardcode + threshold "not found": Phase 3. ✓
- Karaoke toggle + providers: Phase 4. ✓
- UX audit top 3 + stale copy: Phase 5. ✓
- Edge deploys are OPS HANDOFFs (maintainer/MCP). ✓
- Two-device behavior is human CHECKPOINT (agent can't run it). ✓

## Notes for the implementer
- Do NOT reintroduce hardcoded lyric maps. If Thai matching regresses badly, raise it at OPS HANDOFF 3 rather than adding a table.
- Keep pure logic in the `.ts` modules and tested via Vitest; the edge `index.ts` stays thin.
- `RealtimePayload` in `src/types/karaoke.ts` already anticipates `sync_request`; if its shape differs from `{type:'sync_request', payload:null}`, match the existing union rather than inventing a new one.
- Caveman-ultra in all status updates (AGENTS.md).
