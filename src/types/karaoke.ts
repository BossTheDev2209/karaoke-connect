export interface User {
  id: string;
  nickname: string;
  avatarId: string; // Changed to string for human avatar customization
  customAvatarNormal?: string; // Custom image URL when not speaking
  customAvatarSpeaking?: string; // Custom image URL when speaking
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
  romanization?: string; // Optional romanization for CJK lyrics
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
  channelId?: string;
  thumbnail: string;
  duration: string;
}

export interface YouTubeChannel {
  channelId: string;
  title: string;
  description: string;
  thumbnail: string;
  subscriberCount: string;
  videoCount: string;
}

export interface VoteKick {
  targetUserId: string;
  initiatorId: string;
  votes: Set<string>; // User IDs who voted
  createdAt: number;
}

export type RealtimePayload = {
  type: 'playback_update' | 'queue_update' | 'speaking_update' | 'sync_request' | 'vote_kick_start' | 'vote_kick_vote' | 'kick_user';
  payload: unknown;
};
