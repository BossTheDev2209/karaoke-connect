import { useState, useEffect, useCallback } from 'react';
import { Song } from '@/types/karaoke';
import { supabase } from '@/integrations/supabase/client';

interface UseRecommendationsProps {
  currentSong: Song | undefined;
  queue: Song[];
  isHost: boolean;
  updateQueue: (queue: Song[]) => void;
  userDisplayName: string;
  syncV2Ref: React.MutableRefObject<{ prepareSong: (index: number) => void } | null>;
}

export function useRecommendations({
  currentSong,
  queue,
  isHost,
  updateQueue,
  userDisplayName,
  syncV2Ref,
}: UseRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);

  // Fetch recommendations when current song changes
  useEffect(() => {
    // Reset recommendations when song changes
    setRecommendations([]);

    // Fetch if there's a current song and queue is ending (last song or empty)
    if (!currentSong || queue.length > 1) {
      return;
    }

    const fetchRecs = async () => {
      setIsLoadingRecs(true);
      try {
        const query = currentSong.artist
          ? `${currentSong.artist} karaoke`
          : `${currentSong.title} karaoke`;
        console.log('Fetching recommendations for:', query);

        const { data, error } = await supabase.functions.invoke('youtube-search', {
          body: { query, type: 'video' },
        });

        if (data?.results) {
          // Filter out current song and map to Song type
          const recs = data.results
            .filter((r: any) => r.videoId !== currentSong.videoId)
            .slice(0, 3)
            .map((r: any) => ({
              id: crypto.randomUUID(),
              videoId: r.videoId,
              title: r.title,
              artist: r.channelTitle, // Best guess
              thumbnail: r.thumbnail,
              duration: r.duration,
            }));
          setRecommendations(recs);
        }
      } catch (err) {
        console.error('Failed to fetch recommendations:', err);
      } finally {
        setIsLoadingRecs(false);
      }
    };

    fetchRecs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.videoId, queue.length, isHost]);

  const addRecommendation = useCallback(
    (rec: any) => {
      const newSong: Song = {
        id: crypto.randomUUID(),
        videoId: rec.videoId,
        title: rec.title,
        artist: rec.artist,
        duration: rec.duration || '3:00', // approximation
        addedBy: userDisplayName || 'System',
        thumbnail: rec.thumbnail,
      };

      // Calculate the new song's index BEFORE updating queue
      const newSongIndex = queue.length;
      const newQueue = [...queue, newSong];

      // Update queue via useRoom hook
      updateQueue(newQueue);

      // Clear recommendations immediately
      setRecommendations([]);

      // Use the new sync system to prepare and start the song
      // This triggers the ready check flow for synchronized playback
      if (isHost) {
        // Small delay to allow queue update to propagate
        setTimeout(() => {
          syncV2Ref.current?.prepareSong(newSongIndex);
        }, 100);
      }
    },
    [queue, updateQueue, isHost, userDisplayName, syncV2Ref]
  );

  const dismissRecommendations = useCallback(() => {
    setRecommendations([]);
  }, []);

  return {
    recommendations,
    isLoadingRecs,
    addRecommendation,
    dismissRecommendations,
  };
}
