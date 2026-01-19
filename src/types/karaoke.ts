export type RoomMode = 'free-sing' | 'team-battle';
export type BattleFormat = '1v1' | '2v2' | '3v3' | '4v4' | '5v5';

export interface User {
  id: string;
  nickname: string;
  avatarId: string;
  customAvatarNormal?: string;
  customAvatarSpeaking?: string;
  isSpeaking: boolean;
  isMicEnabled?: boolean;
  audioLevel?: number;
  team?: 'left' | 'right';
  score?: number;
  joinedAt?: number;
  discordId?: string;
  discordUsername?: string;
  discordAvatar?: string;
  eqSettings?: number[]; // dB values for 10 bands
}

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
  romanization?: string;
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
  mode: RoomMode;
  battleFormat?: BattleFormat;
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
  votes: Set<string>;
  createdAt: number;
}

export type RealtimePayload = {
  type: 
    | 'playback_update' 
    | 'queue_update' 
    | 'speaking_update' 
    | 'mic_status_update'
    | 'sync_request' 
    | 'full_sync_response'
    | 'seek_event'
    | 'vote_kick_start' 
    | 'vote_kick_vote' 
    | 'kick_user'
    | 'mode_vote_start'
    | 'mode_vote_cast'
    | 'mode_update'
    | 'team_update'
    | 'team_swap'
    | 'match_start'
    | 'match_end'
    | 'format_selected'
    | 'rtt_ping'
    | 'rtt_pong'
    | 'sync_heartbeat';
  payload: unknown;
};
