import { PlaybackState } from '@/types/karaoke';

/** Single source of truth for the default/idle playback state. */
export const DEFAULT_PLAYBACK: PlaybackState = {
  status: 'idle',
  videoId: null,
  startAtRoomTime: null,
  seekOffset: 0,
  currentSongIndex: 0,
  // Legacy fields (for backward compatibility)
  isPlaying: false,
  currentTime: 0,
  lastUpdate: Date.now(),
};
