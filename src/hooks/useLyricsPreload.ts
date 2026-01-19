import { useState, useEffect, useCallback, useRef } from 'react';
import { Song, LyricLine } from '@/types/karaoke';
import { supabase } from '@/integrations/supabase/client';
import { LyricsMatch } from './useLyrics';

export type LyricStatus = 'pending' | 'loading' | 'loaded' | 'error' | 'not_found';

export interface PreloadedLyrics {
  songId: string;
  status: LyricStatus;
  lyrics: LyricLine[];
  isSynced: boolean;
  // NEW: Support for multiple matches
  allMatches?: LyricsMatch[];
  source?: string;
}

interface UseLyricsPreloadReturn {
  preloadedLyrics: Map<string, PreloadedLyrics>;
  getLyricsForSong: (songId: string) => PreloadedLyrics | undefined;
  getStatusForSong: (songId: string) => LyricStatus;
}

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
  const lines = plainLyrics
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  return lines.map((text, index) => ({
    time: index * 0.001,
    text,
  }));
}

export const useLyricsPreload = (
  queue: Song[],
  currentIndex: number
): UseLyricsPreloadReturn => {
  const [preloadedLyrics, setPreloadedLyrics] = useState<Map<string, PreloadedLyrics>>(new Map());
  const loadingRef = useRef<Set<string>>(new Set());

  const fetchLyricsForSong = useCallback(async (song: Song) => {
    // Skip if already loading or loaded
    if (loadingRef.current.has(song.id)) return;
    
    const existing = preloadedLyrics.get(song.id);
    if (existing && existing.status !== 'pending') return;

    loadingRef.current.add(song.id);

    // Update status to loading
    setPreloadedLyrics(prev => {
      const next = new Map(prev);
      next.set(song.id, {
        songId: song.id,
        status: 'loading',
        lyrics: [],
        isSynced: false,
      });
      return next;
    });

    try {
      const { data, error } = await supabase.functions.invoke('fetch-lyrics', {
        body: { artist: song.artist, title: song.title },
      });

      if (error) throw error;

      let lyrics: LyricLine[] = [];
      let isSynced = false;
      let status: LyricStatus = 'not_found';

      if (data.syncedLyrics) {
        lyrics = parseSyncedLyrics(data.syncedLyrics);
        isSynced = true;
        status = 'loaded';
      } else if (data.plainLyrics) {
        lyrics = parsePlainLyrics(data.plainLyrics);
        isSynced = false;
        status = 'loaded';
      }

      setPreloadedLyrics(prev => {
        const next = new Map(prev);
        next.set(song.id, {
          songId: song.id,
          status,
          lyrics,
          isSynced,
          // NEW: Store all matches and source
          allMatches: data.allMatches || [],
          source: data.source || undefined,
        });
        return next;
      });
    } catch (err) {
      console.error('Error preloading lyrics for:', song.title, err);
      setPreloadedLyrics(prev => {
        const next = new Map(prev);
        next.set(song.id, {
          songId: song.id,
          status: 'error',
          lyrics: [],
          isSynced: false,
        });
        return next;
      });
    } finally {
      loadingRef.current.delete(song.id);
    }
  }, [preloadedLyrics]);

  // Preload lyrics for songs in queue
  useEffect(() => {
    if (queue.length === 0) return;

    // Prioritize: current song, next song, then rest
    const songsToPreload: Song[] = [];
    
    // Current song first
    if (queue[currentIndex]) {
      songsToPreload.push(queue[currentIndex]);
    }
    
    // Next song
    if (queue[currentIndex + 1]) {
      songsToPreload.push(queue[currentIndex + 1]);
    }
    
    // Then preload rest (up to 5 songs ahead)
    for (let i = currentIndex + 2; i < Math.min(queue.length, currentIndex + 6); i++) {
      if (queue[i]) {
        songsToPreload.push(queue[i]);
      }
    }

    // Start preloading
    songsToPreload.forEach(song => {
      const existing = preloadedLyrics.get(song.id);
      if (!existing || existing.status === 'pending') {
        fetchLyricsForSong(song);
      }
    });
  }, [queue, currentIndex, fetchLyricsForSong, preloadedLyrics]);

  // Mark new songs as pending
  useEffect(() => {
    queue.forEach(song => {
      if (!preloadedLyrics.has(song.id)) {
        setPreloadedLyrics(prev => {
          const next = new Map(prev);
          next.set(song.id, {
            songId: song.id,
            status: 'pending',
            lyrics: [],
            isSynced: false,
          });
          return next;
        });
      }
    });
  }, [queue, preloadedLyrics]);

  const getLyricsForSong = useCallback((songId: string) => {
    return preloadedLyrics.get(songId);
  }, [preloadedLyrics]);

  const getStatusForSong = useCallback((songId: string): LyricStatus => {
    return preloadedLyrics.get(songId)?.status || 'pending';
  }, [preloadedLyrics]);

  return {
    preloadedLyrics,
    getLyricsForSong,
    getStatusForSong,
  };
};
