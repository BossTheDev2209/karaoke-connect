import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LRCLIB_API = 'https://lrclib.net/api';

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

    console.log(`Fetching lyrics for: ${artist} - ${title}`);

    // Clean up the title (remove "karaoke", "lyrics", etc.)
    const cleanTitle = title
      .replace(/\(.*?\)/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/karaoke|lyrics|official|video|audio|hd|4k/gi, '')
      .trim();

    const cleanArtist = artist
      .replace(/VEVO|Official|Topic/gi, '')
      .trim();

    console.log(`Cleaned: ${cleanArtist} - ${cleanTitle}`);

    // Try to get synced lyrics first
    const searchUrl = new URL(`${LRCLIB_API}/search`);
    searchUrl.searchParams.set('track_name', cleanTitle);
    searchUrl.searchParams.set('artist_name', cleanArtist);

    const searchResponse = await fetch(searchUrl.toString(), {
      headers: { 'User-Agent': 'KaraokeApp/1.0' },
    });

    if (!searchResponse.ok) {
      console.error('LRCLIB search failed:', searchResponse.status);
      return new Response(
        JSON.stringify({ error: 'Lyrics service unavailable', syncedLyrics: null, plainLyrics: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = await searchResponse.json();
    
    if (!results || results.length === 0) {
      console.log('No lyrics found');
      return new Response(
        JSON.stringify({ syncedLyrics: null, plainLyrics: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the best match (prefer synced lyrics)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const withSynced = results.find((r: any) => r.syncedLyrics);
    const bestMatch = withSynced || results[0];

    console.log(`Found lyrics: synced=${!!bestMatch.syncedLyrics}, plain=${!!bestMatch.plainLyrics}`);

    return new Response(
      JSON.stringify({
        syncedLyrics: bestMatch.syncedLyrics || null,
        plainLyrics: bestMatch.plainLyrics || null,
        trackName: bestMatch.trackName,
        artistName: bestMatch.artistName,
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
