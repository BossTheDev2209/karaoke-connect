import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LRCLIB_API = 'https://lrclib.net/api';
const GENIUS_API = 'https://api.genius.com';

// Thai character range detection
function containsThai(text: string): boolean {
  return /[\u0E00-\u0E7F]/.test(text);
}

// Extract Thai text from mixed content
function extractThai(text: string): string {
  const matches = text.match(/[\u0E00-\u0E7F]+/g);
  return matches ? matches.join(' ') : '';
}

// Extract non-Thai (romanized/English) text
function extractNonThai(text: string): string {
  return text
    .replace(/[\u0E00-\u0E7F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Common Thai artist name mappings to romanized versions
const THAI_ARTIST_MAPPINGS: Record<string, string[]> = {
  'ป้าง นครินทร์': ['Pang Nakarin', 'Pang'],
  'บอดี้สแลม': ['Bodyslam', 'Body Slam'],
  'โปเตโต้': ['Potato'],
  'ลาบานูน': ['Labanoon'],
  'บิ๊กแอส': ['Big Ass'],
  'แสตมป์': ['Stamp', 'Stamp Apiwat'],
  'พาราด็อกซ์': ['Paradox'],
  'ซิลลี่ฟูลส์': ['Silly Fools'],
  'สล็อตแมชชีน': ['Slot Machine'],
  'คาราบาว': ['Carabao'],
  'เบิร์ด ธงไชย': ['Bird Thongchai', 'Thongchai McIntyre'],
  'ทาทา ยัง': ['Tata Young'],
  'แอม สิริอร': ['Am Siriorn'],
  'กอล์ฟ ฟักกลิ้ง': ['Golf Fuckling', 'Golf Pichaya'],
  'หนุ่ม กะลา': ['Num Kala'],
  'ด้าแน็ก': ['Da Endorphine', 'Endorphine'],
  'พัลลีย์': ['Palmy'],
  'มาลีฮวนน่า': ['Maleehuana'],
  'อัสนี วสันต์': ['Asanee Wasan'],
  'คริสติน่า อากีล่าร์': ['Christina Aguilar'],
  'ไอซ์ ศรัณยู': ['Ice Sarunyu'],
  'นิว จิ๋ว': ['New Jiew'],
  'กัน นภัทร': ['Gun Napat'],
  'โอม ค็อกเทล': ['Ohm Cocktail', 'Cocktail'],
  'ไททาเนียม': ['Titanium'],
  'แมว จิระศักดิ์': ['Mew Jirasakul'],
  'ออฟ ปองศักดิ์': ['Off Pongsak'],
  "AYLA's": ["AYLA", "Ayla"],
  "Jeff Satur": ["Jeff Satur", "Jeff"],
  'ต้น ธนษิต': ['Ton Thanasit'],
  'ว่าน ธนกฤต': ['Wan Thanakrit'],
  'แพรวา ณิชาภัทร': ['Praewa Nichapat'],
  'เอิ๊ต ภัทรวี': ['Earth Patravee', 'Earth'],
  'นนท์ ธนนท์': ['Non Thanon'],
  'ไอซ์ พาริส': ['Ice Paris'],
  'บุรินทร์': ['Burin'],
  'เป๊ก ผลิตโชค': ['Peck Palitchoke', 'Peck'],
  'โบว์': ['Bow Maylada', 'Bow'],
};

// Get romanized variations for Thai artist
function getThaiArtistVariations(artist: string): string[] {
  const variations: string[] = [];
  
  for (const [thai, romanized] of Object.entries(THAI_ARTIST_MAPPINGS)) {
    if (artist.includes(thai)) {
      variations.push(...romanized);
    }
  }
  
  return variations;
}

// Clean YouTube-specific patterns from title
function cleanTitle(title: string): string {
  return title
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
    .replace(/Official\s*(Music\s*)?Video/gi, '')
    .replace(/Official\s*MV/gi, '')
    .replace(/Music\s*Video/gi, '')
    .replace(/Lyric\s*Video/gi, '')
    .replace(/Official\s*English\s*Lyrics/gi, '')
    .replace(/English\s*Lyrics/gi, '')
    .replace(/Full\s*Lyrics/gi, '')
    .replace(/\|\s*.*$/g, '')
    .replace(/#\w+/g, '')
    .replace(/[''""]/g, "'")
    .replace(/'([^']+)'/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract the FIRST part before any dash (usually the actual song name)
function extractFirstPart(title: string): string {
  const parts = title.split(/\s*[-–—]\s*/);
  if (parts.length > 0 && parts[0].trim().length >= 2) {
    return parts[0].trim();
  }
  return title;
}

// Extract song name from title (often in quotes or after dash)
function extractSongName(title: string, artist?: string): string {
  const cleanedTitle = cleanTitle(title);
  
  // First try: extract the first part before any dash
  const firstPart = extractFirstPart(cleanedTitle);
  if (firstPart && firstPart.length >= 2 && firstPart !== cleanedTitle) {
    // Make sure it's not just the artist name
    if (!artist || similarity(firstPart, artist) < 0.7) {
      return firstPart;
    }
  }
  
  // For Thai songs: extract the Thai portion as the primary song name
  if (containsThai(cleanedTitle)) {
    const thaiPart = extractThai(cleanedTitle);
    if (thaiPart && thaiPart.length >= 3) {
      return thaiPart;
    }
  }
  
  // Try to find quoted song name
  const quotedMatch = cleanedTitle.match(/[''""]([^''""\(\)]+)[''""]/) ||
                      cleanedTitle.match(/'([^'\(\)]+)'/) ||
                      cleanedTitle.match(/"([^"\(\)]+)"/);
  if (quotedMatch) {
    return quotedMatch[1].trim();
  }
  
  // Try "Artist - Song" format
  const dashMatch = cleanedTitle.match(/[-–—]\s*(.+?)(?:\s*[\(\[\|]|$)/);
  if (dashMatch) {
    const extracted = dashMatch[1].trim();
    if (artist && similarity(extracted, artist) > 0.7) {
      const beforeDash = cleanedTitle.split(/[-–—]/)[0].trim();
      if (beforeDash && beforeDash.length > 2) {
        return beforeDash;
      }
    }
    return extracted;
  }
  
  return cleanedTitle;
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
    .replace(/\s*&\s+[^-\(\[]+$/gi, '')
    .trim();
}

// Extract primary artist from featuring format
function extractPrimaryArtist(text: string): string {
  const match = text.match(/^([^(\[]+?)(?:\s*[\(\[]?\s*(?:feat\.?|ft\.?|featuring|with|×|x)\s+)/i);
  if (match) {
    return match[1].trim();
  }
  const ampMatch = text.match(/^([^&]+?)\s*&/);
  if (ampMatch) {
    return ampMatch[1].trim();
  }
  return text;
}

// Remove Korean/Japanese/Chinese/Thai text in parentheses
function removeAsianParentheses(text: string): string {
  return text
    .replace(/\([가-힣ㄱ-ㅎㅏ-ㅣ]+\)/g, '')
    .replace(/\([一-龯ぁ-んァ-ン]+\)/g, '')
    .replace(/\([\u0E00-\u0E7F]+\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Calculate similarity score between two strings (0-1)
function similarity(s1: string, s2: string): number {
  const str1 = s1.toLowerCase();
  const str2 = s2.toLowerCase();
  
  if (str1 === str2) return 1;
  if (str1.includes(str2) || str2.includes(str1)) return 0.8;
  
  const words1 = str1.split(/\s+/);
  const words2 = str2.split(/\s+/);
  const commonWords = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));
  
  return commonWords.length / Math.max(words1.length, words2.length);
}

// Score a result based on how well it matches our query
function scoreResult(result: any, queryArtist: string, queryTitle: string): number {
  const artistScore = similarity(result.artistName || '', queryArtist);
  const titleScore = similarity(result.trackName || '', queryTitle);
  const hasSynced = result.syncedLyrics ? 0.5 : 0;
  
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

// Search Genius API for lyrics
async function searchGenius(query: string, apiKey: string): Promise<{ lyrics: string | null; artist: string | null; title: string | null }> {
  console.log(`Searching Genius: "${query}"`);
  
  try {
    const searchUrl = new URL(`${GENIUS_API}/search`);
    searchUrl.searchParams.set('q', query);

    const response = await fetch(searchUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.error('Genius search failed:', response.status);
      return { lyrics: null, artist: null, title: null };
    }

    const data = await response.json();
    const hits = data.response?.hits || [];
    
    if (hits.length === 0) {
      console.log('No Genius results found');
      return { lyrics: null, artist: null, title: null };
    }

    // Get the first result
    const firstHit = hits[0].result;
    const songPath = firstHit.path;
    const artist = firstHit.primary_artist?.name || null;
    const title = firstHit.title || null;
    
    console.log(`Genius found: "${artist}" - "${title}"`);

    // Fetch the actual lyrics page and scrape
    const lyricsUrl = `https://genius.com${songPath}`;
    const lyricsResponse = await fetch(lyricsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!lyricsResponse.ok) {
      console.error('Failed to fetch Genius lyrics page');
      return { lyrics: null, artist, title };
    }

    const html = await lyricsResponse.text();
    
    // Extract lyrics from Genius HTML
    // Look for data-lyrics-container="true" divs
    const lyricsMatch = html.match(/data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/g);
    
    if (!lyricsMatch) {
      console.log('Could not parse Genius lyrics from HTML');
      return { lyrics: null, artist, title };
    }

    // Clean up the extracted lyrics
    let lyrics = lyricsMatch
      .join('\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\[.*?\]/g, '') // Remove section headers like [Verse 1]
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    console.log(`Genius lyrics extracted: ${lyrics.length} chars`);
    return { lyrics, artist, title };
  } catch (err) {
    console.error('Genius fetch error:', err);
    return { lyrics: null, artist: null, title: null };
  }
}

// Generate Thai-specific search strategies
function generateThaiSearchStrategies(
  artist: string,
  title: string,
  cleanedArtist: string,
  cleanedTitle: string
): Array<{ track: string; artist: string | undefined }> {
  const strategies: Array<{ track: string; artist: string | undefined }> = [];
  
  const hasThai = containsThai(artist) || containsThai(title);
  
  if (!hasThai) {
    return strategies;
  }
  
  console.log('Thai content detected, adding Thai-specific strategies');
  
  const thaiTitle = extractThai(title);
  const romanizedTitle = extractNonThai(title)
    .replace(new RegExp(cleanedArtist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
    .replace(/^[-–—\s]+|[-–—\s]+$/g, '')
    .trim();
  
  const thaiArtist = extractThai(artist);
  const romanizedArtist = extractNonThai(artist);
  
  const artistVariations = getThaiArtistVariations(artist);
  
  if (thaiTitle && thaiTitle.length >= 3) {
    if (thaiArtist) {
      strategies.push({ track: thaiTitle, artist: thaiArtist });
    }
    if (romanizedArtist && romanizedArtist !== thaiArtist) {
      strategies.push({ track: thaiTitle, artist: romanizedArtist });
    }
    strategies.push({ track: thaiTitle, artist: undefined });
  }
  
  const englishInParens = title.match(/\(([A-Za-z][^)]*)\)/);
  if (englishInParens) {
    const englishTitle = englishInParens[1].trim();
    if (englishTitle.length >= 3) {
      if (romanizedArtist) {
        strategies.push({ track: englishTitle, artist: romanizedArtist });
      }
      strategies.push({ track: englishTitle, artist: undefined });
    }
  }
  
  if (romanizedTitle && romanizedTitle.length >= 3 && romanizedArtist) {
    strategies.push({ track: romanizedTitle, artist: romanizedArtist });
  }
  
  for (const romanizedVariation of artistVariations) {
    if (thaiTitle && thaiTitle.length >= 3) {
      strategies.push({ track: thaiTitle, artist: romanizedVariation });
    }
    if (romanizedTitle && romanizedTitle.length >= 3) {
      strategies.push({ track: romanizedTitle, artist: romanizedVariation });
    }
  }
  
  return strategies;
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
    const songName = extractSongName(title, cleanedArtist);
    const firstPart = extractFirstPart(cleanedTitle);
    const titleNoFeat = removeFeaturing(cleanedTitle);
    const titleNoAsian = removeAsianParentheses(cleanedTitle);

    console.log(`Cleaned artist: "${cleanedArtist}" | Primary: "${primaryArtist}"`);
    console.log(`Cleaned title: "${cleanedTitle}" | Song name: "${songName}" | First part: "${firstPart}"`);

    // IMPROVED: Search strategies - prioritize simple song name first
    const searchStrategies: Array<{ track: string; artist: string | undefined }> = [
      // Strategy 0: PRIORITY - Just the first part of the title (before any dash)
      { track: firstPart, artist: undefined },
      // Strategy 1: First part + any artist variation
      { track: firstPart, artist: cleanedArtist },
      { track: firstPart, artist: primaryArtist },
      // Strategy 2: Extracted song name + cleaned artist
      { track: songName, artist: cleanedArtist },
      // Strategy 3: Cleaned title + cleaned artist  
      { track: cleanedTitle, artist: cleanedArtist },
      // Strategy 4: Title without featuring + primary artist
      { track: titleNoFeat, artist: primaryArtist },
      // Strategy 5: Title without Asian text + artist without Asian text
      { track: titleNoAsian, artist: artistNoAsian },
      // Strategy 6: Just the song name (broader search)
      { track: songName, artist: undefined },
      // Strategy 7: Cleaned title only
      { track: cleanedTitle, artist: undefined },
    ];
    
    // Add Thai-specific strategies
    const thaiStrategies = generateThaiSearchStrategies(artist, title, cleanedArtist, cleanedTitle);
    searchStrategies.push(...thaiStrategies);

    // Remove duplicate searches
    const uniqueSearches = searchStrategies.filter((search, index, self) => 
      index === self.findIndex(s => 
        s.track === search.track && s.artist === search.artist
      )
    );

    let allResults: any[] = [];

    for (const search of uniqueSearches) {
      if (!search.track || search.track.length < 2) continue;
      
      const results = await searchLRCLIB(search.track, search.artist);
      if (results.length > 0) {
        allResults = [...allResults, ...results];
        if (results.some((r: any) => r.syncedLyrics)) {
          console.log(`Found synced lyrics on strategy: track="${search.track}" artist="${search.artist || 'any'}"`);
          break;
        }
      }
    }

    // If LRCLIB found results, use them
    if (allResults.length > 0) {
      const uniqueResults = allResults.filter((result, index, self) =>
        index === self.findIndex(r => r.id === result.id)
      );

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
          source: 'lrclib',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // FALLBACK: Try Genius API
    console.log('LRCLIB found nothing, trying Genius API...');
    const geniusApiKey = Deno.env.get('GENIUS_API_KEY');
    
    if (geniusApiKey) {
      // Try multiple Genius search queries
      const geniusQueries = [
        firstPart, // Just song name
        `${firstPart} ${primaryArtist}`, // Song + artist
        songName,
        `${songName} ${cleanedArtist}`,
      ].filter((q, i, arr) => q && q.length >= 2 && arr.indexOf(q) === i);

      for (const query of geniusQueries) {
        const geniusResult = await searchGenius(query, geniusApiKey);
        
        if (geniusResult.lyrics) {
          console.log(`Genius found lyrics for: "${geniusResult.artist}" - "${geniusResult.title}"`);
          return new Response(
            JSON.stringify({
              syncedLyrics: null,
              plainLyrics: geniusResult.lyrics,
              trackName: geniusResult.title,
              artistName: geniusResult.artist,
              source: 'genius',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      console.log('Genius also found nothing');
    } else {
      console.log('GENIUS_API_KEY not configured, skipping Genius fallback');
    }

    console.log('No lyrics found after all strategies');
    return new Response(
      JSON.stringify({ syncedLyrics: null, plainLyrics: null }),
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