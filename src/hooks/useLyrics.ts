import { useState, useEffect, useMemo } from 'react';
import { LyricLine } from '@/types/karaoke';
import { supabase } from '@/integrations/supabase/client';

interface UseLyricsReturn {
  lyrics: LyricLine[];
  currentLineIndex: number;
  isLoading: boolean;
  error: string | null;
  offset: number;
  setOffset: (offset: number) => void;
}

export const useLyrics = (
  artist: string | null,
  title: string | null,
  currentTime: number
): UseLyricsReturn => {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Offset in seconds: positive = lyrics delayed (for lyrics ahead of audio)
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!artist || !title) {
      setLyrics([]);
      return;
    }

    const fetchLyrics = async () => {
      setIsLoading(true);
      setError(null);
      setOffset(0); // Reset offset when loading new lyrics

      try {
        const { data, error: fnError } = await supabase.functions.invoke('fetch-lyrics', {
          body: { artist, title },
        });

        if (fnError) throw fnError;

        if (data.syncedLyrics) {
          const parsed = parseSyncedLyrics(data.syncedLyrics);
          setLyrics(parsed);
        } else if (data.plainLyrics) {
          // Fallback: show plain lyrics without sync
          setLyrics([{ time: 0, text: data.plainLyrics }]);
        } else {
          setLyrics([]);
          setError('No lyrics found');
        }
      } catch (err) {
        console.error('Error fetching lyrics:', err);
        setError('Could not load lyrics');
        setLyrics([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLyrics();
  }, [artist, title]);

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

  return { lyrics, currentLineIndex, isLoading, error, offset, setOffset };
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
