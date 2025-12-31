import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LRCLIB_API = 'https://lrclib.net/api';

// Clean YouTube-specific patterns from title
function cleanTitle(title: string): string {
  return title
    // Remove content in brackets/parentheses with common YouTube tags
    .replace(/\[Official\s*(Music\s*)?Video\]/gi, '')
    .replace(/\[Official\s*MV\]/gi, '')
    .replace(/\[MV\]/gi, '')
    .replace(/\[M\/V\]/gi, '')
    .replace(/\[Lyric\s*Video\]/gi, '')
    .replace(/\[Lyrics?\]/gi, '')
    .replace(/\[Audio\]/gi, '')
    .replace(/\[Visualizer\]/gi, '')
    .replace(/\[Performance\s*Video\]/gi, '')
    .replace(/\[Dance\s*Practice\]/gi, '')
    .replace(/\[Live\]/gi, '')
    .replace(/\[\d+K\]/gi, '')
    .replace(/\[HD\]/gi, '')
    .replace(/\[HQ\]/gi, '')
    .replace(/\(Official\s*(Music\s*)?Video\)/gi, '')
    .replace(/\(Official\s*MV\)/gi, '')
    .replace(/\(MV\)/gi, '')
    .replace(/\(M\/V\)/gi, '')
    .replace(/\(Lyric\s*Video\)/gi, '')
    .replace(/\(Lyrics?\)/gi, '')
    .replace(/\(Audio\)/gi, '')
    .replace(/\(Visualizer\)/gi, '')
    .replace(/\(Performance\s*Video\)/gi, '')
    .replace(/\(Dance\s*Practice\)/gi, '')
    .replace(/\(Live\)/gi, '')
    .replace(/\(\d+K\)/gi, '')
    .replace(/\(HD\)/gi, '')
    .replace(/\(HQ\)/gi, '')
    // Remove common suffixes
    .replace(/Official\s*(Music\s*)?Video/gi, '')
    .replace(/Official\s*MV/gi, '')
    .replace(/Music\s*Video/gi, '')
    .replace(/Lyric\s*Video/gi, '')
    .replace(/\|\s*.*$/g, '') // Remove everything after |
    .replace(/#\w+/g, '') // Remove hashtags
    // Remove quotes around song names
    .replace(/[''""]/g, "'")
    .replace(/'([^']+)'/g, '$1')
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract song name from title (often in quotes or after dash)
function extractSongName(title: string): string {
  // Try to find quoted song name first
  const quotedMatch = title.match(/[''""]([^''""\(\)]+)[''""]/) ||
                      title.match(/'([^'\(\)]+)'/) ||
                      title.match(/"([^"\(\)]+)"/);
  if (quotedMatch) {
    return quotedMatch[1].trim();
  }
  
  // Try "Artist - Song" format
  const dashMatch = title.match(/[-–—]\s*(.+?)(?:\s*[\(\[\|]|$)/);
  if (dashMatch) {
    return cleanTitle(dashMatch[1]);
  }
  
  return cleanTitle(title);
}

// Clean artist name from YouTube channel conventions
function cleanArtist(artist: string): string {
  return artist
    .replace(/VEVO$/i, '')
    .replace(/Official$/i, '')
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/Music$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Remove featuring artists from string
function removeFeaturing(text: string): string {
  return text
    .replace(/\s*[\(\[]?\s*(?:feat\.?|ft\.?|featuring|with|prod\.?\s*by|×|x)\s+[^\)\]]+[\)\]]?/gi, '')
    .replace(/\s*&\s+[^-\(\[]+$/gi, '') // Remove "& Artist" at end
    .trim();
}

// Extract primary artist from featuring format
function extractPrimaryArtist(text: string): string {
  const match = text.match(/^([^(\[]+?)(?:\s*[\(\[]?\s*(?:feat\.?|ft\.?|featuring|with|×|x)\s+)/i);
  if (match) {
    return match[1].trim();
  }
  // Handle "Artist1 & Artist2" - take first
  const ampMatch = text.match(/^([^&]+?)\s*&/);
  if (ampMatch) {
    return ampMatch[1].trim();
  }
  return text;
}

// Remove Korean/Japanese/Chinese text in parentheses (romanization kept)
function removeAsianParentheses(text: string): string {
  return text
    .replace(/\([가-힣ㄱ-ㅎㅏ-ㅣ]+\)/g, '') // Korean
    .replace(/\([一-龯ぁ-んァ-ン]+\)/g, '') // Japanese/Chinese
    .replace(/\s+/g, ' ')
    .trim();
}

// Calculate similarity score between two strings (0-1)
function similarity(s1: string, s2: string): number {
  const str1 = s1.toLowerCase();
  const str2 = s2.toLowerCase();
  
  if (str1 === str2) return 1;
  if (str1.includes(str2) || str2.includes(str1)) return 0.8;
  
  // Simple word overlap score
  const words1 = str1.split(/\s+/);
  const words2 = str2.split(/\s+/);
  const commonWords = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));
  
  return commonWords.length / Math.max(words1.length, words2.length);
}

// Score a result based on how well it matches our query
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scoreResult(result: any, queryArtist: string, queryTitle: string): number {
  const artistScore = similarity(result.artistName || '', queryArtist);
  const titleScore = similarity(result.trackName || '', queryTitle);
  const hasSynced = result.syncedLyrics ? 0.5 : 0; // Bonus for synced lyrics
  
  return (artistScore * 0.4) + (titleScore * 0.4) + hasSynced;
}

// Search LRCLIB with given parameters
async function searchLRCLIB(trackName: string, artistName?: string): Promise<any[]> {
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

    // Clean and extract variations
    const cleanedArtist = cleanArtist(artist);
    const primaryArtist = extractPrimaryArtist(cleanedArtist);
    const artistNoAsian = removeAsianParentheses(cleanedArtist);
    
    const cleanedTitle = cleanTitle(title);
    const songName = extractSongName(title);
    const titleNoFeat = removeFeaturing(cleanedTitle);
    const titleNoAsian = removeAsianParentheses(cleanedTitle);

    console.log(`Cleaned artist: "${cleanedArtist}" | Primary: "${primaryArtist}"`);
    console.log(`Cleaned title: "${cleanedTitle}" | Song name: "${songName}"`);

    // Try multiple search strategies
    const searchStrategies = [
      // Strategy 1: Extracted song name + cleaned artist
      { track: songName, artist: cleanedArtist },
      // Strategy 2: Cleaned title + cleaned artist  
      { track: cleanedTitle, artist: cleanedArtist },
      // Strategy 3: Title without featuring + primary artist
      { track: titleNoFeat, artist: primaryArtist },
      // Strategy 4: Title without Asian text + artist without Asian text
      { track: titleNoAsian, artist: artistNoAsian },
      // Strategy 5: Just the song name (broader search)
      { track: songName, artist: undefined },
      // Strategy 6: Cleaned title only
      { track: cleanedTitle, artist: undefined },
    ];

    // Remove duplicate searches
    const uniqueSearches = searchStrategies.filter((search, index, self) => 
      index === self.findIndex(s => 
        s.track === search.track && s.artist === search.artist
      )
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allResults: any[] = [];

    for (const search of uniqueSearches) {
      if (!search.track || search.track.length < 2) continue;
      
      const results = await searchLRCLIB(search.track, search.artist);
      if (results.length > 0) {
        allResults = [...allResults, ...results];
        // If we found results with synced lyrics, we can stop
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (results.some((r: any) => r.syncedLyrics)) {
          console.log(`Found synced lyrics on strategy: track="${search.track}" artist="${search.artist || 'any'}"`);
          break;
        }
      }
    }

    if (allResults.length === 0) {
      console.log('No lyrics found after all strategies');
      return new Response(
        JSON.stringify({ syncedLyrics: null, plainLyrics: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Remove duplicates by ID
    const uniqueResults = allResults.filter((result, index, self) =>
      index === self.findIndex(r => r.id === result.id)
    );

    // Score and sort results
    const scoredResults = uniqueResults.map(result => ({
      ...result,
      score: scoreResult(result, cleanedArtist, songName || cleanedTitle)
    })).sort((a, b) => b.score - a.score);

    const bestMatch = scoredResults[0];

    console.log(`Found ${uniqueResults.length} unique results, best match score: ${bestMatch.score.toFixed(2)}`);
    console.log(`Best match: "${bestMatch.artistName}" - "${bestMatch.trackName}"`);
    console.log(`Has synced: ${!!bestMatch.syncedLyrics}, Has plain: ${!!bestMatch.plainLyrics}`);

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
