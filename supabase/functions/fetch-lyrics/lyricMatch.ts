// Pure, dependency-free lyric matching logic shared by the fetch-lyrics edge
// function and the Vitest suite. No hardcoded artist/title tables: matching is
// purely algorithmic so it generalizes to any language.

export interface Query {
  artist: string;
  title: string;
}

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
  const wx = x.split(/\s+/);
  const wy = y.split(/\s+/);
  const common = wx.filter((w) => wy.some((v) => v.includes(w) || w.includes(v)));
  return common.length / Math.max(wx.length, wy.length);
}

const NOISE =
  /\[[^\]]*\]|\((?:official|lyric|audio|mv|m\/v|hd|hq|4k|visualizer|live|performance|dance practice)[^)]*\)|official\s*(?:music\s*)?video|official\s*mv|music\s*video|lyric\s*video|\bMV\b/gi;

export function cleanText(s: string): string {
  return (s || '')
    .replace(NOISE, '')
    .replace(/\|\s*.*$/g, '')
    .replace(/#\w+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Strip YouTube channel suffixes so "Artist - Topic" / "ArtistVEVO" become "Artist".
function cleanChannel(channelTitle?: string): string {
  return cleanText(
    (channelTitle || '')
      .replace(/\s*-\s*Topic$/i, '')
      .replace(/VEVO$/i, '')
      .replace(/Official$/i, ''),
  );
}

// Offer (artist,title) guesses for both "A - B" orderings + channel as artist.
export function parseArtistTitle(rawTitle: string, channelTitle?: string): Query[] {
  const t = cleanText(rawTitle);
  const ch = cleanChannel(channelTitle);
  const out: Query[] = [];
  const parts = t
    .split(/\s*[-–—]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    out.push({ artist: parts[0], title: parts.slice(1).join(' ') }); // Artist - Song
    out.push({ artist: parts.slice(1).join(' '), title: parts[0] }); // Song - Artist
  } else {
    out.push({ artist: ch, title: t });
  }
  if (ch) {
    out.push({ artist: ch, title: parts.length >= 2 ? parts.slice(1).join(' ') : t });
  }

  // de-dupe
  const seen = new Set<string>();
  return out.filter((g) => {
    const k = `${g.artist}|${g.title}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
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
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  // Require BOTH a decent overall score and a non-trivial title match, so an
  // artist-only coincidence can't carry a wrong song.
  if (!best || bestScore < floor) return null;
  if (similarity(best.trackName || '', q.title) < 0.34) return null;
  return best;
}
