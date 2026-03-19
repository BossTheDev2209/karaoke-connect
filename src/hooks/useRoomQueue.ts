import { useEffect, useCallback } from 'react';
import { Song, PlaybackStatus } from '@/types/karaoke';

interface UseRoomQueueProps {
  queue: Song[];
  updateQueue: (queue: Song[]) => void;
  canControl: boolean;
  syncV2: { prepareSong: (index: number) => void };
  playbackStatus: PlaybackStatus;
  currentSongIndex: number;
  currentVideoId: string | null;
  isHost: boolean;
  syncV2Ref: React.MutableRefObject<{ prepareSong: (index: number) => void } | null>;
}

export function useRoomQueue({
  queue,
  updateQueue,
  canControl,
  syncV2,
  playbackStatus,
  currentSongIndex,
  currentVideoId,
  isHost,
  syncV2Ref,
}: UseRoomQueueProps) {
  // Host Watcher: Auto-start playback if queue grows while idle
  useEffect(() => {
    if (!isHost) return;

    const isStopped = playbackStatus === 'idle';

    if (isStopped && queue.length > 0) {
      // Scenario 1: Pending songs exist after current index
      const nextIndex = currentSongIndex + 1;
      if (nextIndex < queue.length) {
        console.log('[Room] Auto-advancing to new song added by member');
        syncV2Ref.current?.prepareSong(nextIndex);
      }
      // Scenario 2: First song added to empty queue (fresh room)
      else if (queue.length === 1 && !currentVideoId) {
        console.log('[Room] Auto-starting first song added by member');
        syncV2Ref.current?.prepareSong(0);
      }
    }
  }, [queue.length, isHost, playbackStatus, currentVideoId, currentSongIndex, syncV2Ref]);

  const handleAddSong = useCallback(
    (song: Song) => {
      updateQueue([...queue, song]);
    },
    [queue, updateQueue]
  );

  const handleRemoveSong = useCallback(
    (songId: string) => {
      updateQueue(queue.filter((s) => s.id !== songId));
    },
    [queue, updateQueue]
  );

  const handleSelectSong = useCallback(
    (index: number) => {
      if (canControl) {
        syncV2.prepareSong(index);
      }
      // Non-control users cannot change the song for everyone
    },
    [canControl, syncV2]
  );

  return {
    handleAddSong,
    handleRemoveSong,
    handleSelectSong,
  };
}
