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
  const isHostRef = useRef(false);
  const hasSyncedRef = useRef(false);

  // Store latest state in refs for sync responses
  const queueRef = useRef<Song[]>([]);
  const playbackRef = useRef<PlaybackState>(DEFAULT_PLAYBACK);
  const roomModeRef = useRef<RoomMode>('free-sing');
  const battleFormatRef = useRef<BattleFormat | undefined>();

  // When sending a full sync, compute an "effective" currentTime for joiners
  // based on the last known time + elapsed since lastUpdate.
  const getEffectivePlaybackForSync = useCallback((): PlaybackState => {
    const base = playbackRef.current;
    const now = Date.now();
    const elapsed = base.isPlaying ? Math.max(0, (now - (base.lastUpdate || now)) / 1000) : 0;
    return {
      ...base,
      currentTime: (base.currentTime || 0) + elapsed,
      lastUpdate: now,
    };
  }, []);

  // Keep refs updated
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    playbackRef.current = playbackState;
  }, [playbackState]);

  useEffect(() => {
    roomModeRef.current = roomMode;
  }, [roomMode]);

  useEffect(() => {
    battleFormatRef.current = battleFormat;
  }, [battleFormat]);

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

        // Host = earliest joiner (re-evaluated on every sync to handle host leaving)
        if (presentUsers.length > 0) {
          const sortedByJoinTime = [...presentUsers].sort(
            (a, b) => (a.joinedAt || 0) - (b.joinedAt || 0)
          );
          isHostRef.current = sortedByJoinTime[0]?.id === user.id;
        } else {
          isHostRef.current = false;
        }
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('User joined:', newPresences);

        // If we're the host and someone joins, proactively push our current state.
        // (Don't gate on queue length; new users still need mode/battleFormat/empty queue.)
        if (isHostRef.current) {
          setTimeout(() => {
            channel.send({
              type: 'broadcast',
              event: 'room_event',
              payload: {
                type: 'full_sync_response',
                payload: {
                  queue: queueRef.current,
                  playbackState: getEffectivePlaybackForSync(),
                  roomMode: roomModeRef.current,
                  battleFormat: battleFormatRef.current,
                },
              },
            });
          }, 500); // Small delay to ensure new user is ready
        }
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
          case 'sync_request': {
            // If we're host, respond with full state
            if (isHostRef.current) {
              channel.send({
                type: 'broadcast',
                event: 'room_event',
                payload: {
                  type: 'full_sync_response',
                  payload: {
                    queue: queueRef.current,
                    playbackState: getEffectivePlaybackForSync(),
                    roomMode: roomModeRef.current,
                    battleFormat: battleFormatRef.current,
                  },
                },
              });
            }
            break;
          }
          case 'full_sync_response': {
            // Only accept sync if we haven't synced yet or have no data
            if (!hasSyncedRef.current || queueRef.current.length === 0) {
              const syncData = data.payload as {
                queue: Song[];
                playbackState: PlaybackState;
                roomMode: RoomMode;
                battleFormat?: BattleFormat;
              };
              console.log('Received full sync:', syncData);
              setQueue(syncData.queue);
              setPlaybackState(syncData.playbackState);
              setRoomMode(syncData.roomMode);
              setBattleFormat(syncData.battleFormat);
              hasSyncedRef.current = true;
            }
            break;
          }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ ...user, joinedAt: Date.now() });
          setIsConnected(true);
          
          // Request sync after joining with a small delay
          setTimeout(() => {
            if (!hasSyncedRef.current) {
              channel.send({
                type: 'broadcast',
                event: 'room_event',
                payload: { type: 'sync_request', payload: null },
              });
            }
          }, 300);
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      isHostRef.current = false;
      hasSyncedRef.current = false;
    };
  }, [roomCode, user, getEffectivePlaybackForSync]);

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
    hasSyncedRef.current = false; // Allow re-sync
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
