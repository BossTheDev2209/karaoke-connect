import type { PlaybackState, Song } from '@/types/karaoke';

interface QueueRemoval {
  queue: Song[];
  playback: Partial<PlaybackState>;
}

export function removeSongFromQueue(
  queue: Song[],
  currentIndex: number,
  songId: string,
): QueueRemoval | null {
  const removedIndex = queue.findIndex((song) => song.id === songId);
  if (removedIndex === -1) return null;

  const nextQueue = queue.filter((song) => song.id !== songId);
  if (nextQueue.length === 0) {
    return {
      queue: nextQueue,
      playback: { currentSongIndex: 0, currentTime: 0, isPlaying: false },
    };
  }

  if (removedIndex < currentIndex) {
    return {
      queue: nextQueue,
      playback: { currentSongIndex: currentIndex - 1 },
    };
  }

  if (removedIndex === currentIndex) {
    return {
      queue: nextQueue,
      playback: {
        currentSongIndex: Math.min(currentIndex, nextQueue.length - 1),
        currentTime: 0,
        isPlaying: true,
      },
    };
  }

  return { queue: nextQueue, playback: {} };
}
