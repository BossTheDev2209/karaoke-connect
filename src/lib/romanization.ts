import { toRomaji, isJapanese, isKana, isKanji } from 'wanakana';
import { pinyin } from 'pinyin-pro';

// Check if text contains Chinese characters
export const containsChinese = (text: string): boolean => {
  return /[\u4e00-\u9fff]/.test(text) && !isJapanese(text);
};

// Check if text contains Japanese (Hiragana, Katakana, or Kanji with Japanese context)
export const containsJapanese = (text: string): boolean => {
  return isJapanese(text) || /[\u3040-\u309f\u30a0-\u30ff]/.test(text);
};

// Check if text contains Korean (Hangul)
export const containsKorean = (text: string): boolean => {
  return /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/.test(text);
};

// Check if text contains any CJK characters
export const containsCJK = (text: string): boolean => {
  return containsChinese(text) || containsJapanese(text) || containsKorean(text);
};

// Romanize Japanese text
export const romanizeJapanese = (text: string): string => {
  try {
    return toRomaji(text);
  } catch {
    return text;
  }
};

// Romanize Chinese text to Pinyin
export const romanizeChinese = (text: string): string => {
  try {
    return pinyin(text, { toneType: 'num', type: 'array' }).join(' ');
  } catch {
    return text;
  }
};

// Simple Korean romanization based on standard Revised Romanization
const koreanInitials: { [key: string]: string } = {
  'ㄱ': 'g', 'ㄲ': 'kk', 'ㄴ': 'n', 'ㄷ': 'd', 'ㄸ': 'tt',
  'ㄹ': 'r', 'ㅁ': 'm', 'ㅂ': 'b', 'ㅃ': 'pp', 'ㅅ': 's',
  'ㅆ': 'ss', 'ㅇ': '', 'ㅈ': 'j', 'ㅉ': 'jj', 'ㅊ': 'ch',
  'ㅋ': 'k', 'ㅌ': 't', 'ㅍ': 'p', 'ㅎ': 'h'
};

const koreanVowels: { [key: string]: string } = {
  'ㅏ': 'a', 'ㅐ': 'ae', 'ㅑ': 'ya', 'ㅒ': 'yae', 'ㅓ': 'eo',
  'ㅔ': 'e', 'ㅕ': 'yeo', 'ㅖ': 'ye', 'ㅗ': 'o', 'ㅘ': 'wa',
  'ㅙ': 'wae', 'ㅚ': 'oe', 'ㅛ': 'yo', 'ㅜ': 'u', 'ㅝ': 'wo',
  'ㅞ': 'we', 'ㅟ': 'wi', 'ㅠ': 'yu', 'ㅡ': 'eu', 'ㅢ': 'ui',
  'ㅣ': 'i'
};

const koreanFinals: { [key: string]: string } = {
  '': '', 'ㄱ': 'k', 'ㄲ': 'k', 'ㄳ': 'k', 'ㄴ': 'n', 'ㄵ': 'n',
  'ㄶ': 'n', 'ㄷ': 't', 'ㄹ': 'l', 'ㄺ': 'k', 'ㄻ': 'm', 'ㄼ': 'l',
  'ㄽ': 'l', 'ㄾ': 'l', 'ㄿ': 'p', 'ㅀ': 'l', 'ㅁ': 'm', 'ㅂ': 'p',
  'ㅄ': 'p', 'ㅅ': 't', 'ㅆ': 't', 'ㅇ': 'ng', 'ㅈ': 't', 'ㅊ': 't',
  'ㅋ': 'k', 'ㅌ': 't', 'ㅍ': 'p', 'ㅎ': 't'
};

const initialCodes = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const vowelCodes = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const finalCodes = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

export const romanizeKorean = (text: string): string => {
  try {
    let result = '';
    
    for (const char of text) {
      const code = char.charCodeAt(0);
      
      // Check if it's a Hangul syllable (가-힣)
      if (code >= 0xAC00 && code <= 0xD7A3) {
        const syllableIndex = code - 0xAC00;
        const initialIndex = Math.floor(syllableIndex / (21 * 28));
        const vowelIndex = Math.floor((syllableIndex % (21 * 28)) / 28);
        const finalIndex = syllableIndex % 28;
        
        const initial = initialCodes[initialIndex];
        const vowel = vowelCodes[vowelIndex];
        const final = finalCodes[finalIndex];
        
        result += (koreanInitials[initial] || '') + (koreanVowels[vowel] || '') + (koreanFinals[final] || '');
      } else {
        result += char;
      }
    }
    
    return result;
  } catch {
    return text;
  }
};

// Get romanization for any CJK text
export const romanize = (text: string): string | null => {
  if (!containsCJK(text)) {
    return null;
  }
  
  if (containsJapanese(text)) {
    return romanizeJapanese(text);
  }
  
  if (containsKorean(text)) {
    return romanizeKorean(text);
  }
  
  if (containsChinese(text)) {
    return romanizeChinese(text);
  }
  
  return null;
};

// Detect the language of text
export const detectCJKLanguage = (text: string): 'japanese' | 'korean' | 'chinese' | null => {
  if (containsJapanese(text)) return 'japanese';
  if (containsKorean(text)) return 'korean';
  if (containsChinese(text)) return 'chinese';
  return null;
};
