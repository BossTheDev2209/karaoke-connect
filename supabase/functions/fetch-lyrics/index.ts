import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LRCLIB_API = 'https://lrclib.net/api';

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
  // Additional popular Thai artists
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
  
  // Check direct mappings
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
function extractSongName(title: string, artist?: string): string {
  const cleanedTitle = cleanTitle(title);
  
  // For Thai songs: extract the Thai portion as the primary song name
  if (containsThai(cleanedTitle)) {
    const thaiPart = extractThai(cleanedTitle);
    if (thaiPart && thaiPart.length >= 3) {
      return thaiPart;
    }
  }
  
  // Try to find quoted song name first
  const quotedMatch = cleanedTitle.match(/[''""]([^''""\(\)]+)[''""]/) ||
                      cleanedTitle.match(/'([^'\(\)]+)'/) ||
                      cleanedTitle.match(/"([^"\(\)]+)"/);
  if (quotedMatch) {
    return quotedMatch[1].trim();
  }
  
  // Try "Artist - Song" format, but make sure we don't extract artist name as song
  const dashMatch = cleanedTitle.match(/[-–—]\s*(.+?)(?:\s*[\(\[\|]|$)/);
  if (dashMatch) {
    const extracted = dashMatch[1].trim();
    // If extracted looks like artist name (same as channel), skip it
    if (artist && similarity(extracted, artist) > 0.7) {
      // Try the part before the dash instead
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

// Remove Korean/Japanese/Chinese/Thai text in parentheses (romanization kept)
function removeAsianParentheses(text: string): string {
  return text
    .replace(/\([가-힣ㄱ-ㅎㅏ-ㅣ]+\)/g, '') // Korean
    .replace(/\([一-龯ぁ-んァ-ン]+\)/g, '') // Japanese/Chinese
    .replace(/\([\u0E00-\u0E7F]+\)/g, '') // Thai
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
  
  // Extract Thai and non-Thai parts from title
  const thaiTitle = extractThai(title);
  const romanizedTitle = extractNonThai(title)
    // Remove artist name from romanized title if present
    .replace(new RegExp(cleanedArtist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
    .replace(/^[-–—\s]+|[-–—\s]+$/g, '')
    .trim();
  
  const thaiArtist = extractThai(artist);
  const romanizedArtist = extractNonThai(artist);
  
  // Get known romanizations for Thai artists
  const artistVariations = getThaiArtistVariations(artist);
  
  // PRIORITY: Thai title with Thai/romanized artist - most accurate for Thai songs
  if (thaiTitle && thaiTitle.length >= 3) {
    // First try with specific artist
    if (thaiArtist) {
      strategies.push({ track: thaiTitle, artist: thaiArtist });
    }
    if (romanizedArtist && romanizedArtist !== thaiArtist) {
      strategies.push({ track: thaiTitle, artist: romanizedArtist });
    }
    // Then try without artist (broader but might find Thai databases)
    strategies.push({ track: thaiTitle, artist: undefined });
  }
  
  // Try romanized version of title (English in parentheses)
  // Extract English from parentheses like "(Vanishing)" or "(Can I ask?)"
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
  
  // Strategy: Romanized title + romanized artist
  if (romanizedTitle && romanizedTitle.length >= 3 && romanizedArtist) {
    strategies.push({ track: romanizedTitle, artist: romanizedArtist });
  }
  
  // Strategy: Use known artist romanizations
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
    const titleNoFeat = removeFeaturing(cleanedTitle);
    const titleNoAsian = removeAsianParentheses(cleanedTitle);

    console.log(`Cleaned artist: "${cleanedArtist}" | Primary: "${primaryArtist}"`);
    console.log(`Cleaned title: "${cleanedTitle}" | Song name: "${songName}"`);

    // Base search strategies
    const searchStrategies: Array<{ track: string; artist: string | undefined }> = [
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
    
    // Add Thai-specific strategies
    const thaiStrategies = generateThaiSearchStrategies(artist, title, cleanedArtist, cleanedTitle);
    searchStrategies.push(...thaiStrategies);

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
