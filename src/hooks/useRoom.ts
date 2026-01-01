import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Song, PlaybackState, RealtimePayload, RoomMode, BattleFormat } from '@/types/karaoke';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseRoomReturn {
  users: User[];
  queue: Song[];
  playbackState: PlaybackState;
  currentUser: User | null;
  isConnected: boolean;
  channel: RealtimeChannel | null;
  updatePlayback: (state: Partial<PlaybackState>) => void;
  updateQueue: (queue: Song[]) => void;
  updateSpeaking: (isSpeaking: boolean, audioLevel?: number) => void;
  updateMode: (mode: RoomMode, battleFormat?: BattleFormat) => void;
  updateTeams: (userTeams: Record<string, 'left' | 'right'>) => void;
  roomMode: RoomMode;
  battleFormat?: BattleFormat;
  requestSync: () => void;
}

const DEFAULT_PLAYBACK: PlaybackState = {
  isPlaying: false,
  currentTime: 0,
  currentSongIndex: 0,
  lastUpdate: Date.now(),
};

export const useRoom = (roomCode: string, user: User | null): UseRoomReturn => {
  const [users, setUsers] = useState<User[]>([]);
  const [queue, setQueue] = useState<Song[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState>(DEFAULT_PLAYBACK);
  const [isConnected, setIsConnected] = useState(false);
  const [roomMode, setRoomMode] = useState<RoomMode>('free-sing');
  const [battleFormat, setBattleFormat] = useState<BattleFormat | undefined>();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!roomCode || !user) return;

    const channel = supabase.channel(`room:${roomCode}`, {
      config: {
        presence: { key: user.id },
        broadcast: { self: true },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<User>();
        const presentUsers = Object.values(state).flat() as User[];
        setUsers(presentUsers);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('User left:', leftPresences);
      })
      .on('broadcast', { event: 'room_event' }, ({ payload }) => {
        const data = payload as RealtimePayload;
        
        switch (data.type) {
          case 'playback_update':
            setPlaybackState(data.payload as PlaybackState);
            break;
          case 'queue_update':
            setQueue(data.payload as Song[]);
            break;
          case 'speaking_update': {
            const { userId, isSpeaking, audioLevel } = data.payload as { userId: string; isSpeaking: boolean; audioLevel?: number };
            setUsers(prev => prev.map(u => 
              u.id === userId ? { ...u, isSpeaking, audioLevel } : u
            ));
            break;
          }
          case 'mode_update': {
            const { mode, battleFormat } = data.payload as { mode: RoomMode; battleFormat?: BattleFormat };
            setRoomMode(mode);
            setBattleFormat(battleFormat);
            break;
          }
          case 'team_update': {
            const { userTeams } = data.payload as { userTeams: Record<string, 'left' | 'right'> };
            setUsers(prev => prev.map(u => ({
              ...u,
              team: userTeams[u.id] || u.team
            })));
            break;
          }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(user);
          setIsConnected(true);
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [roomCode, user]);

  const updatePlayback = useCallback((state: Partial<PlaybackState>) => {
    const newState = { ...playbackState, ...state, lastUpdate: Date.now() };
    setPlaybackState(newState);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: { type: 'playback_update', payload: newState },
    });
  }, [playbackState]);

  const updateQueue = useCallback((newQueue: Song[]) => {
    setQueue(newQueue);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: { type: 'queue_update', payload: newQueue },
    });
  }, []);

  const updateSpeaking = useCallback((isSpeaking: boolean, audioLevel?: number) => {
    if (!user) return;
    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: { type: 'speaking_update', payload: { userId: user.id, isSpeaking, audioLevel } },
    });
  }, [user]);

  const requestSync = useCallback(() => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: { type: 'sync_request', payload: null },
    });
  }, []);

  const updateMode = useCallback((mode: RoomMode, format?: BattleFormat) => {
    setRoomMode(mode);
    setBattleFormat(format);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: { type: 'mode_update', payload: { mode, battleFormat: format } },
    });
  }, []);

  const updateTeams = useCallback((userTeams: Record<string, 'left' | 'right'>) => {
    setUsers(prev => prev.map(u => ({
      ...u,
      team: userTeams[u.id] || u.team
    })));
    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: { type: 'team_update', payload: { userTeams } },
    });
  }, []);

  // Auto-assign teams when switching to team-battle
  useEffect(() => {
    if (roomMode === 'team-battle' && users.length > 0) {
      const needsAssignment = users.some(u => !u.team);
      if (needsAssignment) {
        const newTeams: Record<string, 'left' | 'right'> = {};
        users.forEach((u, i) => {
          newTeams[u.id] = i % 2 === 0 ? 'left' : 'right';
        });
        updateTeams(newTeams);
      }
    }
  }, [roomMode, users.length]);

  // Scoring logic for Team Battle
  useEffect(() => {
    if (roomMode !== 'team-battle') return;

    const interval = setInterval(() => {
      setUsers(prev => prev.map(u => {
        if (u.isSpeaking && (u.audioLevel || 0) > 0.05) {
          const points = Math.floor((u.audioLevel || 0) * 10);
          return { ...u, score: (u.score || 0) + points };
        }
        return u;
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [roomMode]);

  return {
    users,
    queue,
    playbackState,
    roomMode,
    battleFormat,
    currentUser: user,
    isConnected,
    channel: channelRef.current,
    updatePlayback,
    updateQueue,
    updateSpeaking,
    updateMode,
    updateTeams,
    requestSync,
  };
};
