export interface User {
  id: string;
  nickname: string;
  avatarId: string; // Changed to string for human avatar customization
  isSpeaking: boolean;
}

// Human avatar customization
export interface AvatarConfig {
  bodyColor: string;
  hairStyle: 'short' | 'long' | 'spiky' | 'curly' | 'bald' | 'ponytail';
  hairColor: string;
  accessory: 'none' | 'glasses' | 'headphones' | 'hat' | 'bow' | 'crown';
}

export interface Song {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: string;
  addedBy: string;
}

export interface LyricLine {
  time: number;
  text: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  currentSongIndex: number;
  lastUpdate: number;
}

export interface Room {
  code: string;
  users: User[];
  queue: Song[];
  playbackState: PlaybackState;
}

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration: string;
}

export type RealtimePayload = {
  type: 'playback_update' | 'queue_update' | 'speaking_update' | 'sync_request';
  payload: unknown;
};
