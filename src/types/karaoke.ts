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
  hasControlAccess?: boolean; // Whether non-host user can control playback
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

// Playback status for the new sync system
export type PlaybackStatus = 'idle' | 'preparing' | 'ready' | 'playing' | 'paused' | 'buffering';

export interface PlaybackState {
  /** Current playback status */
  status: PlaybackStatus;
  /** Current video ID being played */
  videoId: string | null;
  /** Room time (ms) when the song started playing (for sync calculation) */
  startAtRoomTime: number | null;
  /** Offset in seconds for pause/resume and seek operations */
  seekOffset: number;
  /** Index in the queue */
  currentSongIndex: number;
  /** Legacy: for backward compatibility during migration */
  isPlaying?: boolean;
  currentTime?: number;
  lastUpdate?: number;
}

/** Track which users have their player ready */
export interface PlayerReadyStates {
  [userId: string]: boolean;
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
    // New sync system events
    | 'prepare_song'        // Host tells everyone to load video
    | 'player_ready'        // Client signals player is ready
    | 'all_ready'           // Host confirms all players ready
    | 'start_song'          // Host sends synchronized start time
    | 'pause_song'          // Pause with current seekOffset
    | 'resume_song'         // Resume with new startAtRoomTime
    | 'seek_song'           // Seek to specific time
    | 'end_song'            // Song ended
    | 'buffering_report'    // Client reports buffering issue
    // Legacy (kept for backward compat during migration)
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
    | 'force_mute_user'
    | 'permission_update'
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
    | 'sync_heartbeat'
    | 'reaction';
  payload: unknown;
};
