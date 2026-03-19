import { useState, useCallback } from 'react';

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
  currentSongIndex: number;
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
  currentSongIndex,
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
      // Non-control users: local-only playback toggle
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
    if (canControl && currentSongIndex < queueLength - 1) {
      syncV2.prepareSong(currentSongIndex + 1);
    }
  }, [currentSongIndex, queueLength, canControl, syncV2]);

  const handlePrevious = useCallback(() => {
    if (canControl && currentSongIndex > 0) {
      syncV2.prepareSong(currentSongIndex - 1);
    }
  }, [currentSongIndex, canControl, syncV2]);

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
