import { useEffect, useCallback } from 'react';
import { Song, PlaybackState } from '@/types/karaoke';

interface UseRoomQueueProps {
  queue: Song[];
  updateQueue: (queue: Song[]) => void;
  canControl: boolean;
  syncV2: { prepareSong: (index: number) => void };
  updatePlayback: (state: Partial<PlaybackState>) => void;
  playbackState: PlaybackState;
  isHost: boolean;
  syncV2Ref: React.MutableRefObject<{ prepareSong: (index: number) => void } | null>;
}

export function useRoomQueue({
  queue,
  updateQueue,
  canControl,
  syncV2,
  updatePlayback,
  playbackState,
  isHost,
  syncV2Ref,
}: UseRoomQueueProps) {
  // Host Watcher: Auto-start playback if queue grows while idle
  useEffect(() => {
    if (!isHost) return;

    const isStopped = playbackState.status === 'idle';

    if (isStopped && queue.length > 0) {
      // Scenario 1: Pending songs exist after current index
      const nextIndex = playbackState.currentSongIndex + 1;
      if (nextIndex < queue.length) {
        console.log('[Room] Auto-advancing to new song added by member');
        syncV2Ref.current?.prepareSong(nextIndex);
      }
      // Scenario 2: First song added to empty queue (fresh room)
      else if (queue.length === 1 && !playbackState.videoId) {
        console.log('[Room] Auto-starting first song added by member');
        syncV2Ref.current?.prepareSong(0);
      }
    }
  }, [queue.length, isHost, playbackState.status, playbackState.videoId, playbackState.currentSongIndex, syncV2Ref]);

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
      } else {
        updatePlayback({ currentSongIndex: index, currentTime: 0, isPlaying: true });
      }
    },
    [canControl, syncV2, updatePlayback]
  );

  return {
    handleAddSong,
    handleRemoveSong,
    handleSelectSong,
  };
}
