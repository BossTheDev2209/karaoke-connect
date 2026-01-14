import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LRCLIB_API = 'https://lrclib.net/api';
const GENIUS_API = 'https://api.genius.com';
const MUSIXMATCH_API = 'https://api.musixmatch.com/ws/1.1';

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

// Common Thai artist name mappings to romanized versions (Top 150+ Thai artists)
const THAI_ARTIST_MAPPINGS: Record<string, string[]> = {
  // Top chart artists from Viberate
  'YOUNGOHM': ['Youngohm', 'Young Ohm'],
  'ยังโอม': ['Youngohm', 'Young Ohm'],
  'เจฟ ซาเตอร์': ['Jeff Satur', 'Jeff'],
  'Jeff Satur': ['Jeff Satur', 'Jeff'],
  'เบิ้ล ปทุมราช': ['Ble Patumrach', 'Ble'],
  'Ble Patumrach': ['Ble Patumrach', 'Ble'],
  'ป๋าบอล': ['Pao Ball', 'Pa Ball'],
  'ก้อง ห้วยไร่': ['Kong Huayrai', 'Kong'],
  'Kong Huayrai': ['Kong Huayrai', 'Kong'],
  'บอดี้สแลม': ['Bodyslam', 'Body Slam'],
  'Bodyslam': ['Bodyslam', 'Body Slam'],
  'พงษ์สิทธิ์ คำภีร์': ['Pongsit Kamphee', 'Pongsit'],
  'Pongsit Kamphee': ['Pongsit Kamphee', 'Pongsit'],
  'กระต่าย พรรณนิภา': ['Kratai Pannipa', 'Kratai'],
  'Kratai Pannipa': ['Kratai Pannipa', 'Kratai'],
  'บิ๊กแอส': ['Big Ass'],
  'Big Ass': ['Big Ass'],
  'TATTOO COLOUR': ['Tattoo Colour', 'Tattoo Color'],
  'แทตทู คัลเลอร์': ['Tattoo Colour', 'Tattoo Color'],
  'คาราบาว': ['Carabao'],
  'Carabao': ['Carabao'],
  'นิว ชวรินทร์': ['Nunew', 'New Chawarin'],
  'Nunew': ['Nunew', 'New Chawarin'],
  'จินตหรา พูนลาภ': ['Jintara Poonlarp', 'Jintara'],
  'Jintara Poonlarp': ['Jintara Poonlarp', 'Jintara'],
  'ต่าย อรทัย': ['Tai Orathai', 'Tai'],
  'Tai Orathai': ['Tai Orathai', 'Tai'],
  'เก่ง ธชย': ['Tachaya', 'Keng Tachaya'],
  'TACHAYA': ['Tachaya', 'Keng Tachaya'],
  'น้ำแข็ง ทิพวรรณ': ['Namkhaeng Thipawan', 'Namkhaeng'],
  'ดิด คิตตี้': ['Did Kitty', 'Did'],
  'วุฒิ ป่าบอน': ['Wut Pabon', 'Wut'],
  'Wut Pabon': ['Wut Pabon', 'Wut'],
  'มาริโอ้ โจ๊ก': ['Mario Jok', 'Mario'],
  'Mario Jok': ['Mario Jok', 'Mario'],
  'พาย คอนเฟลก': ['Pie Cornflakes', 'Pie'],
  'สล็อตแมชชีน': ['Slot Machine'],
  'Slot Machine': ['Slot Machine'],
  "AYLA's": ["AYLA", "Ayla"],
  'นนท์ ธนนท์': ['Nont Tanont', 'Non Thanon'],
  'NONT TANONT': ['Nont Tanont', 'Non Thanon'],
  'นะนุ่น': ['Na-nun', 'Nanun'],
  'JOEY PHUWASIT': ['Joey Phuwasit', 'Joey'],
  'โจอี้ ภูวศิษฐ์': ['Joey Phuwasit', 'Joey'],
  'เวียง นฤมล': ['Vieng Naruemon', 'Vieng'],
  'Vieng Naruemon': ['Vieng Naruemon', 'Vieng'],
  'วิน เมธวิน': ['Win Metawin', 'Win'],
  'Win Metawin': ['Win Metawin', 'Win'],
  'ลำเพลิน วงศกร': ['Lumplearn Wongsakorn', 'Lumplearn'],
  'Lumplearn Wongsakorn': ['Lumplearn Wongsakorn', 'Lumplearn'],
  'ทิดแอม': ['Thid Am', 'Tid Am'],
  'เรนิษรา': ['Reinizra'],
  'reinizra': ['Reinizra'],
  'โปเตโต้': ['Potato'],
  'POTATO': ['Potato'],
  'เต้ย ณัฐพงษ์': ['Rapper Tery', 'Tery'],
  'Rapper Tery': ['Rapper Tery', 'Tery'],
  'คณะขวัญใจ': ['Khana Kwanjai'],
  
  // More top artists
  'MILLI': ['Milli'],
  'มิลลิ': ['Milli'],
  'UrboyTJ': ['UrboyTJ', 'Urboy TJ'],
  'ยูเรย์บอย': ['UrboyTJ', 'Urboy TJ'],
  '4EVE': ['4EVE', 'Four Eve'],
  'โฟร์อีฟ': ['4EVE', 'Four Eve'],
  'PP Krit': ['PP Krit', 'PP'],
  'พีพี กฤษฏ์': ['PP Krit', 'PP'],
  'Billkin': ['Billkin'],
  'บิวกิ้น': ['Billkin'],
  'Bright Vachirawit': ['Bright', 'Bright Vachirawit'],
  'ไบร์ท วชิรวิชญ์': ['Bright', 'Bright Vachirawit'],
  'Gulf Kanawut': ['Gulf', 'Gulf Kanawut'],
  'กลัฟ คณาวุฒิ': ['Gulf', 'Gulf Kanawut'],
  'Mew Suppasit': ['Mew Suppasit', 'Mew'],
  'มิว ศุภศิษฏ์': ['Mew Suppasit', 'Mew'],
  'PROXIE': ['Proxie'],
  'พร็อกซี่': ['Proxie'],
  'ZEAL': ['Zeal'],
  'ซีล': ['Zeal'],
  'GETSUNOVA': ['Getsunova'],
  'เก็ตสุโนวา': ['Getsunova'],
  'SCRUBB': ['Scrubb'],
  'สครับบ์': ['Scrubb'],
  'SERIOUS BACON': ['Serious Bacon'],
  'ซีเรียส เบคอน': ['Serious Bacon'],
  'MEAN': ['Mean'],
  'มีน': ['Mean'],
  'THREE MAN DOWN': ['Three Man Down'],
  'ทรี แมน ดาวน์': ['Three Man Down'],
  'INDIGO': ['Indigo'],
  'อินดิโก้': ['Indigo'],
  'PALAPHOL': ['Palaphol'],
  'ภาลาพล': ['Palaphol'],
  'TILLY BIRDS': ['Tilly Birds'],
  'ทิลลี่ เบิร์ดส์': ['Tilly Birds'],
  'VIOLETTE WAUTIER': ['Violette Wautier', 'Violette'],
  'วิโอเลต โวเทียร์': ['Violette Wautier', 'Violette'],
  
  // Classic and legendary artists
  'ป้าง นครินทร์': ['Pang Nakarin', 'Pang'],
  'ลาบานูน': ['Labanoon'],
  'Labanoon': ['Labanoon'],
  'แสตมป์': ['Stamp', 'Stamp Apiwat'],
  'Stamp': ['Stamp', 'Stamp Apiwat'],
  'พาราด็อกซ์': ['Paradox'],
  'Paradox': ['Paradox'],
  'ซิลลี่ฟูลส์': ['Silly Fools'],
  'Silly Fools': ['Silly Fools'],
  'เบิร์ด ธงไชย': ['Bird Thongchai', 'Thongchai McIntyre'],
  'Bird Thongchai': ['Bird Thongchai', 'Thongchai McIntyre'],
  'ทาทา ยัง': ['Tata Young'],
  'Tata Young': ['Tata Young'],
  'แอม สิริอร': ['Am Siriorn'],
  'กอล์ฟ พิชญะ': ['Golf Pichaya', 'Golf'],
  'Golf Pichaya': ['Golf Pichaya', 'Golf'],
  'หนุ่ม กะลา': ['Num Kala', 'Num'],
  'Num Kala': ['Num Kala', 'Num'],
  'ดา เอ็นโดฟิน': ['Da Endorphine', 'Endorphine'],
  'Endorphine': ['Da Endorphine', 'Endorphine'],
  'พัลลีย์': ['Palmy'],
  'Palmy': ['Palmy'],
  'มาลีฮวนน่า': ['Maleehuana'],
  'อัสนี วสันต์': ['Asanee Wasan'],
  'Asanee Wasan': ['Asanee Wasan'],
  'คริสติน่า อากีล่าร์': ['Christina Aguilar'],
  'Christina Aguilar': ['Christina Aguilar'],
  'ไอซ์ ศรัณยู': ['Ice Sarunyu'],
  'Ice Sarunyu': ['Ice Sarunyu'],
  'นิว จิ๋ว': ['New Jiew'],
  'กัน นภัทร': ['Gun Napat', 'Gun'],
  'Gun Napat': ['Gun Napat', 'Gun'],
  'โอม ค็อกเทล': ['Ohm Cocktail', 'Cocktail'],
  'Cocktail': ['Ohm Cocktail', 'Cocktail'],
  'ไททาเนียม': ['Titanium'],
  'Titanium': ['Titanium'],
  'แมว จิระศักดิ์': ['Mew Jirasakul'],
  'ออฟ ปองศักดิ์': ['Off Pongsak', 'Off'],
  'Off Pongsak': ['Off Pongsak', 'Off'],
  'ต้น ธนษิต': ['Ton Thanasit', 'Ton'],
  'ว่าน ธนกฤต': ['Wan Thanakrit', 'Wan'],
  'แพรวา ณิชาภัทร': ['Praewa Nichapat', 'Praewa'],
  'เอิ๊ต ภัทรวี': ['Earth Patravee', 'Earth'],
  'Earth Patravee': ['Earth Patravee', 'Earth'],
  'ไอซ์ พาริส': ['Ice Paris'],
  'Ice Paris': ['Ice Paris'],
  'บุรินทร์': ['Burin'],
  'Burin': ['Burin'],
  'เป๊ก ผลิตโชค': ['Peck Palitchoke', 'Peck'],
  'Peck Palitchoke': ['Peck Palitchoke', 'Peck'],
  'โบว์ เมลดา': ['Bow Maylada', 'Bow'],
  'Bow Maylada': ['Bow Maylada', 'Bow'],
  
  // Hip-hop and Rap artists
  'DABOYWAY': ['Daboyway'],
  'ดาบอยเวย์': ['Daboyway'],
  'F.HERO': ['F.Hero', 'F Hero'],
  'เอฟ ฮีโร่': ['F.Hero', 'F Hero'],
  'TWOPEE': ['Twopee', 'Two P'],
  'ทูพี': ['Twopee', 'Two P'],
  'THAITANIUM': ['Thaitanium'],
  'ไทเทเนียม': ['Thaitanium'],
  'KHAN': ['Khan'],
  'ข่าน': ['Khan'],
  'MAIYARAP': ['Maiyarap'],
  'ไมยราพ': ['Maiyarap'],
  'OG-ANIC': ['OG-Anic', 'Og Anic'],
  'โอจี อนิค': ['OG-Anic', 'Og Anic'],
  'YENTED': ['Yented'],
  'เยนเต็ด': ['Yented'],
  'GAVIN D': ['Gavin D'],
  'แกวินดี': ['Gavin D'],
  'TXRBO': ['Txrbo', 'Turbo'],
  'เทอร์โบ': ['Txrbo', 'Turbo'],
  'P-HOT': ['P-Hot'],
  'พีฮอท': ['P-Hot'],
  'SARAN': ['Saran'],
  'ซาร่าน': ['Saran'],
  
  // Mor Lam and Luk Thung artists
  'ไผ่ พงศธร': ['Phai Phongsathorn', 'Phai'],
  'Phai Phongsathorn': ['Phai Phongsathorn', 'Phai'],
  'มนต์แคน แก่นคูน': ['Monkan Kankoon', 'Monkan'],
  'Monkan Kankoon': ['Monkan Kankoon', 'Monkan'],
  'ลำไย ไหทองคำ': ['Lamyai Haithongkham', 'Lamyai'],
  'Lamyai Haithongkham': ['Lamyai Haithongkham', 'Lamyai'],
  'ตั๊กแตน ชลดา': ['Takatan Cholada', 'Takatan'],
  'Takatan Cholada': ['Takatan Cholada', 'Takatan'],
  'ต้าร์ ตจว': ['Tar Tachauea', 'Tar'],
  'ไหมไทย หัวใจศิลป์': ['Mai Thai Huajai Sin', 'Mai Thai'],
  'ศิริพร อำไพพงษ์': ['Siriporn Ampaipong', 'Siriporn'],
  'Siriporn Ampaipong': ['Siriporn Ampaipong', 'Siriporn'],
  'พี่สา วงเยอะ': ['Pee Sa Wong Yoe'],
  'หญิงลี ศรีจุมพล': ['Ying Lee Srijumpon', 'Ying Lee'],
  'Ying Lee Srijumpon': ['Ying Lee Srijumpon', 'Ying Lee'],
  
  // More contemporary artists
  'INK WARUNTORN': ['Ink Waruntorn', 'Ink'],
  'อิ้งค์ วรันธร': ['Ink Waruntorn', 'Ink'],
  'BOWKYLION': ['Bowkylion'],
  'โบกี้ไลอ้อน': ['Bowkylion'],
  'SAFEPLANET': ['Safeplanet'],
  'เซฟแพลนเน็ต': ['Safeplanet'],
  'WHAL & DOLPH': ['Whal & Dolph', 'Whal and Dolph'],
  'วาฬ แอนด์ ดอลฟ์': ['Whal & Dolph', 'Whal and Dolph'],
  'POLYCAT': ['Polycat'],
  'โพลีแคท': ['Polycat'],
  'LOMOSONIC': ['Lomosonic'],
  'โลโมโซนิค': ['Lomosonic'],
  'SEASON FIVE': ['Season Five'],
  'ซีซั่น ไฟว์': ['Season Five'],
  'LIPTA': ['Lipta'],
  'ลิปตา': ['Lipta'],
  'DA JAM': ['Da Jam'],
  'ดาแจม': ['Da Jam'],
  'PAUSE': ['Pause'],
  'พอส': ['Pause'],
  'ABNormal': ['ABNormal', 'AB Normal'],
  'อบอุ่น': ['ABNormal', 'AB Normal'],
  'NENE': ['Nene'],
  'เนเน่': ['Nene'],
  'NANA': ['Nana'],
  'นานา': ['Nana'],
  'BUS': ['Bus'],
  'บัส': ['Bus'],
  'SINGTO NUMCHOK': ['Singto Numchok', 'Singto'],
  'สิงโต นำโชค': ['Singto Numchok', 'Singto'],
  'ZOM MARIE': ['Zom Marie', 'Zom'],
  'ส้ม มารี': ['Zom Marie', 'Zom'],
  'KLEAR': ['Klear'],
  'เคลียร์': ['Klear'],
};

// Common Thai song title patterns - for better extraction
const THAI_TITLE_PATTERNS = [
  // Pattern: "Thai Title (English Title)"
  /^([\u0E00-\u0E7F][\u0E00-\u0E7F\s]+)\s*\([^)]+\)/,
  // Pattern: "Thai Title - Artist"
  /^([\u0E00-\u0E7F][\u0E00-\u0E7F\s]+)\s*[-–—]/,
  // Pattern: Just Thai text at start
  /^([\u0E00-\u0E7F][\u0E00-\u0E7F\s]+)/,
];

// Get romanized variations for Thai artist
function getThaiArtistVariations(artist: string): string[] {
  const variations: string[] = [];
  
  for (const [thai, romanized] of Object.entries(THAI_ARTIST_MAPPINGS)) {
    if (artist.toLowerCase().includes(thai.toLowerCase())) {
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
    .replace(/[''""\u201C\u201D]/g, "'")
    .replace(/'([^']+)'/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// IMPROVED: Extract Thai song title more accurately
function extractThaiSongTitle(title: string): string | null {
  // Try each pattern
  for (const pattern of THAI_TITLE_PATTERNS) {
    const match = title.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      // Ensure it's meaningful (at least 2 Thai characters)
      if (extracted.length >= 2) {
        return extracted;
      }
    }
  }
  return null;
}

// Extract the FIRST part before any dash (usually the actual song name)
function extractFirstPart(title: string): string {
  const parts = title.split(/\s*[-–—]\s*/);
  if (parts.length > 0 && parts[0].trim().length >= 2) {
    return parts[0].trim();
  }
  return title;
}

// IMPROVED: Better song name extraction
function extractSongName(title: string, artist?: string): string {
  const cleanedTitle = cleanTitle(title);
  
  // PRIORITY 1: For Thai songs, extract Thai title first
  if (containsThai(cleanedTitle)) {
    const thaiTitle = extractThaiSongTitle(cleanedTitle);
    if (thaiTitle && thaiTitle.length >= 2) {
      // Make sure it's not just the artist name
      if (!artist || !containsThai(artist) || similarity(thaiTitle, extractThai(artist)) < 0.6) {
        return thaiTitle;
      }
    }
  }
  
  // PRIORITY 2: Extract the first part before any dash
  const firstPart = extractFirstPart(cleanedTitle);
  if (firstPart && firstPart.length >= 2 && firstPart !== cleanedTitle) {
    // Make sure it's not just the artist name
    if (!artist || similarity(firstPart, artist) < 0.7) {
      return firstPart;
    }
  }
  
  // PRIORITY 3: Try to find quoted song name
  const quotedMatch = cleanedTitle.match(/[''"""]([^''""\(\)]+)[''"""]/) ||
                      cleanedTitle.match(/'([^'\(\)]+)'/) ||
                      cleanedTitle.match(/"([^"\(\)]+)"/);
  if (quotedMatch) {
    return quotedMatch[1].trim();
  }
  
  // PRIORITY 4: Try "Artist - Song" format (after the dash)
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

// IMPROVED: Calculate similarity score between two strings (0-1)
function similarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();
  
  if (str1 === str2) return 1;
  
  // For Thai text, use character-level comparison
  if (containsThai(str1) && containsThai(str2)) {
    const thai1 = extractThai(str1);
    const thai2 = extractThai(str2);
    if (thai1 === thai2) return 0.95;
    if (thai1.includes(thai2) || thai2.includes(thai1)) {
      const ratio = Math.min(thai1.length, thai2.length) / Math.max(thai1.length, thai2.length);
      return 0.8 * ratio;
    }
  }
  
  if (str1.includes(str2) || str2.includes(str1)) {
    // Penalize very short matches being found in long strings
    const ratio = Math.min(str1.length, str2.length) / Math.max(str1.length, str2.length);
    return 0.75 * ratio + 0.1;
  }
  
  const words1 = str1.split(/[\s-]+/).filter(w => w.length > 1);
  const words2 = str2.split(/[\s-]+/).filter(w => w.length > 1);
  const commonWords = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  return commonWords.length / Math.max(words1.length, words2.length);
}

// IMPROVED: More aggressive scoring with better validation
function scoreResult(result: any, queryArtist: string, queryTitle: string, originalTitle: string): number {
  const resultArtist = (result.artistName || '').toLowerCase();
  const resultTrack = (result.trackName || '').toLowerCase();
  const queryArtistLower = queryArtist.toLowerCase();
  const queryTitleLower = queryTitle.toLowerCase();
  const originalTitleLower = originalTitle.toLowerCase();
  
  // Calculate base scores
  let artistScore = similarity(resultArtist, queryArtistLower);
  let titleScore = similarity(resultTrack, queryTitleLower);

  // Improve artist matching by checking Romanized variations (critical for Thai artists)
  if (artistScore < 0.85 && containsThai(queryArtist)) {
    const variations = getThaiArtistVariations(queryArtist);
    for (const v of variations) {
      const vScore = similarity(resultArtist, v.toLowerCase());
      if (vScore > artistScore) artistScore = vScore;
    }
  }
  
  // Also try matching against original title (sometimes has more context)
  const originalTitleScore = similarity(resultTrack, originalTitleLower);
  if (originalTitleScore > titleScore) {
    titleScore = originalTitleScore * 0.9; // Slight penalty for using original
  }
  
  // STRICT VALIDATION: Penalize mismatched content heavily
  
  // If neither title nor artist match at all, reject
  if (artistScore < 0.2 && titleScore < 0.2) {
    console.log(`  Rejecting: "${resultArtist}" - "${resultTrack}" (no match)`);
    return 0;
  }
  
  // If artist is completely different and title only partial match, reduce score significantly
  if (artistScore < 0.3 && titleScore < 0.5) {
    console.log(`  Low score: "${resultArtist}" - "${resultTrack}" (weak match)`);
    return (titleScore * 0.3) + (artistScore * 0.1);
  }

  // Bonus for Thai characters matching if query had Thai
  let thaiBonus = 0;
  if (containsThai(queryArtist) && containsThai(resultArtist)) {
    thaiBonus += 0.15;
  }
  if (containsThai(queryTitle) && containsThai(resultTrack)) {
    thaiBonus += 0.15;
  }

  // Reduced synced bonus
  const hasSynced = result.syncedLyrics ? 0.1 : 0;
  
  // Weighted score: Title is most important, then Artist
  const baseScore = (titleScore * 0.50) + (artistScore * 0.35) + hasSynced + thaiBonus;
  
  return Math.min(1, baseScore);
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

// NEW: Search Musixmatch API (better Thai coverage)
async function searchMusixmatch(trackName: string, artistName?: string, apiKey?: string): Promise<any> {
  if (!apiKey) return null;
  
  console.log(`Searching Musixmatch: track="${trackName}" artist="${artistName || 'any'}"`);

  try {
    // Step 1: Search for track
    const searchUrl = new URL(`${MUSIXMATCH_API}/track.search`);
    searchUrl.searchParams.set('q_track', trackName);
    if (artistName) {
      searchUrl.searchParams.set('q_artist', artistName);
    }
    searchUrl.searchParams.set('page_size', '5');
    searchUrl.searchParams.set('s_track_rating', 'desc');
    searchUrl.searchParams.set('apikey', apiKey);

    const searchResponse = await fetch(searchUrl.toString());
    if (!searchResponse.ok) {
      console.error('Musixmatch search failed:', searchResponse.status);
      return null;
    }

    const searchData = await searchResponse.json();
    const tracks = searchData.message?.body?.track_list || [];
    
    if (tracks.length === 0) {
      console.log('No Musixmatch results found');
      return null;
    }

    // Get the first matching track
    const track = tracks[0].track;
    const trackId = track.track_id;
    
    console.log(`Musixmatch found: "${track.artist_name}" - "${track.track_name}"`);

    // Step 2: Get lyrics for this track
    const lyricsUrl = new URL(`${MUSIXMATCH_API}/track.lyrics.get`);
    lyricsUrl.searchParams.set('track_id', trackId);
    lyricsUrl.searchParams.set('apikey', apiKey);

    const lyricsResponse = await fetch(lyricsUrl.toString());
    if (!lyricsResponse.ok) {
      console.error('Musixmatch lyrics fetch failed:', lyricsResponse.status);
      return null;
    }

    const lyricsData = await lyricsResponse.json();
    const lyricsBody = lyricsData.message?.body?.lyrics;
    
    if (!lyricsBody || !lyricsBody.lyrics_body) {
      console.log('Musixmatch: No lyrics body found');
      return null;
    }

    // Clean up Musixmatch lyrics (they add a disclaimer at the end)
    let lyrics = lyricsBody.lyrics_body
      .replace(/\*+\s*This Lyrics is NOT for Commercial use\s*\*+/gi, '')
      .replace(/\(\d+\)$/g, '')
      .trim();

    return {
      plainLyrics: lyrics,
      trackName: track.track_name,
      artistName: track.artist_name,
      source: 'musixmatch'
    };
  } catch (err) {
    console.error('Musixmatch fetch error:', err);
    return null;
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
    
    // Extract lyrics from Genius HTML - try multiple patterns
    let lyricsMatch = html.match(/data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/g);
    
    if (!lyricsMatch) {
      // Try alternate pattern
      lyricsMatch = html.match(/<div class="[^"]*Lyrics__Container[^"]*"[^>]*>([\s\S]*?)<\/div>/g);
    }
    
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
  
  // Extract Thai song title using improved patterns
  const thaiTitle = extractThaiSongTitle(title) || extractThai(title);
  const romanizedTitle = extractNonThai(title)
    .replace(new RegExp(cleanedArtist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
    .replace(/^[-–—\s]+|[-–—\s]+$/g, '')
    .trim();
  
  const thaiArtist = extractThai(artist);
  const romanizedArtist = extractNonThai(artist);
  
  const artistVariations = getThaiArtistVariations(artist);
  
  // Strategy: Thai title + Thai artist
  if (thaiTitle && thaiTitle.length >= 2) {
    if (thaiArtist && thaiArtist.length >= 2) {
      strategies.push({ track: thaiTitle, artist: thaiArtist });
    }
    // Thai title + romanized artist
    if (romanizedArtist && romanizedArtist.length >= 2 && romanizedArtist !== thaiArtist) {
      strategies.push({ track: thaiTitle, artist: romanizedArtist });
    }
    // Thai title only
    strategies.push({ track: thaiTitle, artist: undefined });
  }
  
  // Look for English title in parentheses
  const englishInParens = title.match(/\(([A-Za-z][^)]*)\)/);
  if (englishInParens) {
    const englishTitle = englishInParens[1].trim();
    if (englishTitle.length >= 3) {
      if (romanizedArtist && romanizedArtist.length >= 2) {
        strategies.push({ track: englishTitle, artist: romanizedArtist });
      }
      strategies.push({ track: englishTitle, artist: undefined });
    }
  }
  
  // Romanized title + romanized artist
  if (romanizedTitle && romanizedTitle.length >= 3 && romanizedArtist && romanizedArtist.length >= 2) {
    strategies.push({ track: romanizedTitle, artist: romanizedArtist });
  }
  
  // Try with artist mapping variations
  for (const romanizedVariation of artistVariations) {
    if (thaiTitle && thaiTitle.length >= 2) {
      strategies.push({ track: thaiTitle, artist: romanizedVariation });
    }
    if (romanizedTitle && romanizedTitle.length >= 3) {
      strategies.push({ track: romanizedTitle, artist: romanizedVariation });
    }
  }
  
  return strategies;
}

// IMPROVED: Validate that lyrics look reasonable for the query
function validateLyrics(lyrics: string, queryTitle: string, queryArtist: string): boolean {
  if (!lyrics || lyrics.length < 50) {
    console.log('Validation: Lyrics too short');
    return false;
  }
  
  // Check if lyrics contain at least some content
  const lines = lyrics.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 4) {
    console.log('Validation: Too few lines');
    return false;
  }
  
  // For Thai songs, check if lyrics contain Thai characters
  if (containsThai(queryTitle) || containsThai(queryArtist)) {
    // It's okay if lyrics are romanized (transliterated) - don't require Thai chars
    console.log('Validation: Thai query - allowing any lyrics');
  }
  
  return true;
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

    // API Keys
    const geniusApiKey = Deno.env.get('GENIUS_API_KEY');
    const musixmatchApiKey = Deno.env.get('MUSIXMATCH_API_KEY');

    // IMPROVED: Search strategies - prioritize exact matches first
    const searchStrategies: Array<{ track: string; artist: string | undefined }> = [
      // Strategy 0: Extracted song name (most accurate) + cleaned artist
      { track: songName, artist: cleanedArtist },
      // Strategy 1: First part of title + artist variations
      { track: firstPart, artist: cleanedArtist },
      { track: firstPart, artist: primaryArtist },
      // Strategy 2: Cleaned title + cleaned artist  
      { track: cleanedTitle, artist: cleanedArtist },
      // Strategy 3: Title without featuring + primary artist
      { track: titleNoFeat, artist: primaryArtist },
      // Strategy 4: Title without Asian text + artist without Asian text
      { track: titleNoAsian, artist: artistNoAsian },
      // Strategy 5: Broader searches (artist-agnostic)
      { track: songName, artist: undefined },
      { track: firstPart, artist: undefined },
    ];
    
    // Add Thai-specific strategies
    const thaiStrategies = generateThaiSearchStrategies(artist, title, cleanedArtist, cleanedTitle);
    // Insert Thai strategies after the first few to prioritize them for Thai content
    if (thaiStrategies.length > 0) {
      searchStrategies.splice(2, 0, ...thaiStrategies);
    }

    // Remove duplicate searches
    const uniqueSearches = searchStrategies.filter((search, index, self) => 
      index === self.findIndex(s => 
        s.track === search.track && s.artist === search.artist
      )
    );

    let allResults: any[] = [];
    let foundSynced = false;

    // LRCLIB Search
    for (const search of uniqueSearches) {
      if (!search.track || search.track.length < 2) continue;
      
      const results = await searchLRCLIB(search.track, search.artist);
      if (results.length > 0) {
        allResults = [...allResults, ...results];
        if (results.some((r: any) => r.syncedLyrics)) {
          console.log(`Found synced lyrics on strategy: track="${search.track}" artist="${search.artist || 'any'}"`);
          foundSynced = true;
          break;
        }
      }
      
      // Early exit if we have enough results
      if (allResults.length >= 10) break;
    }

    // If LRCLIB found results, use them
    if (allResults.length > 0) {
      const uniqueResults = allResults.filter((result, index, self) =>
        index === self.findIndex(r => r.id === result.id)
      );

      const scoredResults = uniqueResults.map(result => ({
        ...result,
        score: scoreResult(result, cleanedArtist, songName || cleanedTitle, title)
      }))
        .filter(r => r.score > 0.15) // Filter out very low scores
        .sort((a, b) => b.score - a.score);

      if (scoredResults.length > 0) {
        const bestMatch = scoredResults[0];

        console.log(`Found ${scoredResults.length} valid results, best match score: ${bestMatch.score.toFixed(2)}`);
        console.log(`Best match: "${bestMatch.artistName}" - "${bestMatch.trackName}"`);
        console.log(`Has synced: ${!!bestMatch.syncedLyrics}, Has plain: ${!!bestMatch.plainLyrics}`);

        // Validate lyrics quality
        const lyrics = bestMatch.syncedLyrics || bestMatch.plainLyrics || '';
        if (validateLyrics(lyrics, title, artist)) {
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
        } else {
          console.log('LRCLIB result failed validation, trying fallbacks...');
        }
      }
    }

    // FALLBACK 1: Try Musixmatch API (good for Asian music)
    if (musixmatchApiKey) {
      console.log('Trying Musixmatch API...');
      
      const musixmatchQueries = [
        { track: songName, artist: cleanedArtist },
        { track: firstPart, artist: primaryArtist },
        { track: songName, artist: undefined },
      ];
      
      for (const query of musixmatchQueries) {
        if (!query.track || query.track.length < 2) continue;
        
        const result = await searchMusixmatch(query.track, query.artist, musixmatchApiKey);
        if (result && result.plainLyrics && validateLyrics(result.plainLyrics, title, artist)) {
          console.log(`Musixmatch found valid lyrics: "${result.artistName}" - "${result.trackName}"`);
          return new Response(
            JSON.stringify({
              syncedLyrics: null,
              plainLyrics: result.plainLyrics,
              trackName: result.trackName,
              artistName: result.artistName,
              source: 'musixmatch',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // FALLBACK 2: Try Genius API
    if (geniusApiKey) {
      console.log('Trying Genius API...');
      
      const geniusQueries = [
        `${songName} ${primaryArtist}`,
        `${firstPart} ${primaryArtist}`,
        songName,
        firstPart,
      ].filter((q, i, arr) => q && q.length >= 3 && arr.indexOf(q) === i);

      for (const query of geniusQueries) {
        const geniusResult = await searchGenius(query, geniusApiKey);
        
        if (geniusResult.lyrics && validateLyrics(geniusResult.lyrics, title, artist)) {
          console.log(`Genius found valid lyrics for: "${geniusResult.artist}" - "${geniusResult.title}"`);
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
      console.log('Genius also found nothing valid');
    } else {
      console.log('GENIUS_API_KEY not configured');
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