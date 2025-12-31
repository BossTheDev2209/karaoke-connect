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
}

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
      console.log('Using preloaded lyrics for:', title);
      setLyrics(preloadedData.lyrics);
      setIsSynced(preloadedData.isSynced);
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
    
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (adjustedTime >= lyrics[i].time) {
        return i;
      }
    }
    return -1;
  }, [lyrics, currentTime, offset]);

  return { lyrics, currentLineIndex, isLoading, error, offset, setOffset, isSynced };
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

// Parse plain lyrics into separate lines
function parsePlainLyrics(plainLyrics: string): LyricLine[] {
  // Split by newlines and filter empty lines
  const lines = plainLyrics
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  // For plain lyrics without timestamps, assign sequential "fake" times
  // so users can at least scroll through manually
  return lines.map((text, index) => ({
    time: index * 0.001, // Minimal time differences so they appear in order
    text,
  }));
}
