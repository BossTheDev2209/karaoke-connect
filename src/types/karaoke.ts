export interface User {
  id: string;
  nickname: string;
  avatarId: number;
  isSpeaking: boolean;
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
