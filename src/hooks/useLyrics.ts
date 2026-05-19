import { useState, useEffect, useMemo } from 'react';
import { LyricLine } from '@/types/karaoke';
import { supabase } from '@/integrations/supabase/client';
import { PreloadedLyrics } from './useLyricsPreload';

interface UseLyricsReturn {
  lyrics: LyricLine[];
  currentLineIndex: number;
  isLoading: boolean;
  error: string | null;
  offset: number;
  setOffset: (offset: number) => void;
  isSynced: boolean;
  source: string | null;
}

// Detect karaoke/cover/remix/etc. variations whose timing won't match the
// original release the lyrics provider has timestamps for.
const VARIATION_PATTERNS = [
  /\bkaraoke\b/i,
  /\binstrumental\b/i,
  /\bcover(ed)?\b/i,
  /\blive\b/i,
  /\bacoustic\b/i,
  /\bunplugged\b/i,
  /\bremix\b/i,
  /\bmashup\b/i,
  /\bsped[\s-]?up\b/i,
  /\bspedup\b/i,
  /\bslowed\b/i,
  /\bnightcore\b/i,
  /\breverb\b/i,
  /\b8d\b/i,
  /\bpiano\s+(version|cover)\b/i,
  /\bguitar\s+(version|cover)\b/i,
  /\bparody\b/i,
  /\btutorial\b/i,
  /\bbackingtrack\b/i,
  /\bbacking\s+track\b/i,
  /\breaction\b/i,
];

const isLikelyVariation = (title: string | null): boolean => {
  if (!title) return false;
  return VARIATION_PATTERNS.some((rx) => rx.test(title));
};

export const useLyrics = (
  artist: string | null,
  title: string | null,
  currentTime: number,
  preloadedData?: PreloadedLyrics | null
): UseLyricsReturn => {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSynced, setIsSynced] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  // Offset in seconds: positive = lyrics delayed (for lyrics ahead of audio)
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!artist || !title) {
      setLyrics([]);
      setIsSynced(false);
      return;
    }

    // Use preloaded data if available and loaded
    if (preloadedData && preloadedData.status === 'loaded') {
      setLyrics(preloadedData.lyrics);
      setIsSynced(preloadedData.isSynced);
      setSource(preloadedData.source ?? null);
      setError(null);
      setIsLoading(false);
      setOffset(0);
      return;
    }

    // If preloaded data is not found
    if (preloadedData && preloadedData.status === 'not_found') {
      setLyrics([]);
      setIsSynced(false);
      setError('No lyrics found');
      setIsLoading(false);
      return;
    }

    // If preloaded data has error
    if (preloadedData && preloadedData.status === 'error') {
      setLyrics([]);
      setIsSynced(false);
      setError('Could not load lyrics');
      setIsLoading(false);
      return;
    }

    // If preloading is in progress, show loading state
    if (preloadedData && preloadedData.status === 'loading') {
      setIsLoading(true);
      return;
    }

    // Fallback: fetch if no preloaded data (shouldn't happen often)
    const fetchLyrics = async () => {
      setIsLoading(true);
      setError(null);
      setOffset(0);

      try {
        const { data, error: fnError } = await supabase.functions.invoke('fetch-lyrics', {
          body: { artist, title },
        });

        if (fnError) throw fnError;

        setSource(data?.source ?? null);
        if (data.syncedLyrics) {
          const parsed = parseSyncedLyrics(data.syncedLyrics);
          setLyrics(parsed);
          setIsSynced(true);
        } else if (data.plainLyrics) {
          const lines = parsePlainLyrics(data.plainLyrics);
          setLyrics(lines);
          setIsSynced(false);
        } else {
          setLyrics([]);
          setIsSynced(false);
          setError('No lyrics found');
        }
      } catch (err) {
        console.error('Error fetching lyrics:', err);
        setError('Could not load lyrics');
        setLyrics([]);
        setIsSynced(false);
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch if no preload data at all
    if (!preloadedData) {
      fetchLyrics();
    }
  }, [artist, title, preloadedData]);

  const currentLineIndex = useMemo(() => {
    if (lyrics.length === 0) return -1;
    
    // Apply offset: if lyrics are ahead, we need to delay them (subtract offset from currentTime)
    const adjustedTime = currentTime - offset;

    let low = 0;
    let high = lyrics.length - 1;
    let currentIndex = -1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (adjustedTime >= lyrics[mid].time) {
        currentIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return currentIndex;
  }, [lyrics, currentTime, offset]);

  const effectiveIsSynced = isSynced && !isLikelyVariation(title);

  return { lyrics, currentLineIndex, isLoading, error, offset, setOffset, isSynced: effectiveIsSynced, source };

};

// Parse LRC format: [mm:ss.xx] lyrics text
function parseSyncedLyrics(lrc: string): LyricLine[] {
  const lines = lrc.split('\n');
  const result: LyricLine[] = [];

  for (const line of lines) {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\](.*)/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const centiseconds = parseInt(match[3], 10);
      const text = match[4].trim();

      if (text) {
        result.push({
          time: minutes * 60 + seconds + centiseconds / 100,
          text,
        });
      }
    }
  }

  return result;
}

// Parse plain lyrics into separate lines (no fake timestamps)
function parsePlainLyrics(plainLyrics: string): LyricLine[] {
  const lines = plainLyrics
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  return lines.map((text) => ({ time: 0, text }));
}
