import { useState, useCallback } from 'react';
import { PlaybackState } from '@/types/karaoke';

interface UsePlaybackControlsProps {
  canControl: boolean;
  syncV2: {
    pause: () => void;
    resume: () => void;
    seek: (time: number) => void;
    prepareSong: (index: number) => void;
  };
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  getPlayerTime: () => number;
  setPlayerVolume: (v: number) => void;
  isHost: boolean;
  isPlaying: boolean;
  updatePlayback: (state: Partial<PlaybackState>) => void;
  playbackState: PlaybackState;
  queueLength: number;
}

export function usePlaybackControls({
  canControl,
  syncV2,
  play,
  pause,
  seekTo,
  getPlayerTime,
  setPlayerVolume,
  isHost,
  isPlaying,
  updatePlayback,
  playbackState,
  queueLength,
}: UsePlaybackControlsProps) {
  const [volume, setVolume] = useState(80);

  const handlePlayPause = useCallback(() => {
    if (canControl) {
      if (isPlaying) {
        syncV2.pause();
      } else {
        syncV2.resume();
      }
    } else {
      if (isPlaying) {
        pause();
      } else {
        play();
      }
    }
  }, [canControl, isPlaying, syncV2, play, pause]);

  const handleSeek = useCallback(
    (time: number) => {
      if (canControl) {
        syncV2.seek(time);
      } else {
        seekTo(time); // Instant local feedback
      }
    },
    [canControl, syncV2, seekTo]
  );

  // Force sync all users to current playback position
  const handleForceSync = useCallback(() => {
    if (!isHost) return;
    const currentPos = getPlayerTime();
    console.log('[Room] Force syncing all users to:', currentPos);
    syncV2.seek(currentPos);
  }, [isHost, getPlayerTime, syncV2]);

  const handleNext = useCallback(() => {
    if (playbackState.currentSongIndex < queueLength - 1) {
      const nextIndex = playbackState.currentSongIndex + 1;
      if (canControl) {
        syncV2.prepareSong(nextIndex);
      } else {
        updatePlayback({ currentSongIndex: nextIndex, currentTime: 0, isPlaying: true });
      }
    }
  }, [playbackState.currentSongIndex, queueLength, canControl, syncV2, updatePlayback]);

  const handlePrevious = useCallback(() => {
    if (playbackState.currentSongIndex > 0) {
      const prevIndex = playbackState.currentSongIndex - 1;
      if (canControl) {
        syncV2.prepareSong(prevIndex);
      } else {
        updatePlayback({ currentSongIndex: prevIndex, currentTime: 0, isPlaying: true });
      }
    }
  }, [playbackState.currentSongIndex, canControl, syncV2, updatePlayback]);

  const handleVolumeChange = useCallback(
    (v: number) => {
      setVolume(v);
      setPlayerVolume(v);
    },
    [setPlayerVolume]
  );

  return {
    volume,
    handlePlayPause,
    handleSeek,
    handleForceSync,
    handleNext,
    handlePrevious,
    handleVolumeChange,
  };
}
