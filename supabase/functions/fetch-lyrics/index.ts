import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { parseArtistTitle, pickBest, cleanText, type Candidate } from "./lyricMatch.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LRCLIB_API = 'https://lrclib.net/api';

interface LrclibResult {
  id: number;
  trackName: string;
  artistName: string;
  syncedLyrics: string | null;
  plainLyrics: string | null;
}

// Search LRCLIB with given parameters.
async function searchLRCLIB(trackName: string, artistName?: string): Promise<LrclibResult[]> {
  const searchUrl = new URL(`${LRCLIB_API}/search`);
  searchUrl.searchParams.set('track_name', trackName);
  if (artistName) {
    searchUrl.searchParams.set('artist_name', artistName);
  }

  console.log(`Searching LRCLIB: track="${trackName}" artist="${artistName || 'any'}"`);

  try {
    const response = await fetch(searchUrl.toString(), {
      headers: { 'User-Agent': 'KaraokeApp/1.0' },
    });

    if (!response.ok) {
      console.error('LRCLIB search failed:', response.status);
      return [];
    }

    return await response.json();
  } catch (err) {
    console.error('LRCLIB fetch error:', err);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { artist, title } = await req.json();

    if (!artist || !title) {
      return new Response(
        JSON.stringify({ error: 'Artist and title are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`\n=== Fetching lyrics ===`);
    console.log(`Original: "${artist}" - "${title}"`);

    // Build (artist, title) guesses algorithmically (both dash orderings +
    // channel-as-artist). No hardcoded language tables.
    const guesses = parseArtistTitle(title, artist);
    console.log('Guesses:', guesses.map((g) => `${g.artist} | ${g.title}`).join('  ·  '));

    // Gather candidates from every guess WITHOUT early-breaking, so a wrong
    // synced hit can't short-circuit a better unsynced match.
    const seen = new Set<string | number>();
    const all: Candidate[] = [];
    for (const g of guesses) {
      if (!g.title || g.title.length < 2) continue;
      for (const withArtist of [true, false]) {
        const results = await searchLRCLIB(g.title, withArtist ? g.artist : undefined);
        for (const r of results) {
          if (r.id != null && seen.has(r.id)) continue;
          if (r.id != null) seen.add(r.id);
          all.push(r as Candidate);
        }
      }
    }

    // Score every candidate against the cleaned (artist, title); require a real
    // resemblance or return nothing rather than a confident wrong guess.
    const primary = { artist: cleanText(artist), title: cleanText(title) };
    const best = pickBest(all, primary);

    if (!best) {
      console.log(`No confident lyric match across ${all.length} candidates; returning empty.`);
      return new Response(
        JSON.stringify({ syncedLyrics: null, plainLyrics: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Best match: "${best.artistName}" - "${best.trackName}" (synced: ${!!best.syncedLyrics})`);

    return new Response(
      JSON.stringify({
        syncedLyrics: best.syncedLyrics || null,
        plainLyrics: best.plainLyrics || null,
        trackName: best.trackName,
        artistName: best.artistName,
        source: 'lrclib',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error in fetch-lyrics function:', error);
    return new Response(
      JSON.stringify({ error: error.message, syncedLyrics: null, plainLyrics: null }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
