import { useState, useEffect, useCallback, useRef } from 'react';
import { Song, LyricLine } from '@/types/karaoke';
import { supabase } from '@/integrations/supabase/client';
import { parsePlainLyrics, parseSyncedLyrics } from '@/lib/lrc';

export type LyricStatus = 'pending' | 'loading' | 'loaded' | 'error' | 'not_found';

export interface PreloadedLyrics {
  songId: string;
  status: LyricStatus;
  lyrics: LyricLine[];
  isSynced: boolean;
  source: string | null;
}

interface UseLyricsPreloadReturn {
  preloadedLyrics: Map<string, PreloadedLyrics>;
  getLyricsForSong: (songId: string) => PreloadedLyrics | undefined;
  getStatusForSong: (songId: string) => LyricStatus;
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
        source: null,
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
      const source: string | null = data?.source || null;

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
          source,
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
          source: null,
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
            source: null,
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
