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
  isHost: boolean;
  channel: RealtimeChannel | null;
  updatePlayback: (state: Partial<PlaybackState>) => void;
  updateQueue: (queue: Song[]) => void;
  updateSpeaking: (isSpeaking: boolean, audioLevel?: number, score?: number) => void;
  updateMicStatus: (isMicEnabled: boolean) => void;
  updateMode: (mode: RoomMode, battleFormat?: BattleFormat) => void;
  updateTeams: (userTeams: Record<string, 'left' | 'right'>) => void;
  swapUserTeam: (userId: string) => void;
  broadcastMatchStart: () => void;
  broadcastMatchEnd: () => void;
  roomMode: RoomMode;
  battleFormat?: BattleFormat;
  requestSync: () => void;
  networkLatency: number;
  kickUser: (userId: string) => void;
  forceMuteUser: (userId: string) => void;
  toggleControlAccess: (userId: string) => void;
}

const DEFAULT_PLAYBACK: PlaybackState = {
  // New sync system fields
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

// RTT constants (for latency display only - not used for sync)
const RTT_PING_INTERVAL = 10000; // Measure RTT every 10 seconds
const RTT_SAMPLE_COUNT = 5; // Average over 5 samples
// NOTE: sync_heartbeat removed - useSyncV2 handles all synchronization via useServerTime

export const useRoom = (
  roomCode: string, 
  user: User | null,
  onUserJoin?: (user: User) => void,
  onHostAction?: (action: 'mute' | 'kick' | 'control_access', payload?: any) => void
): UseRoomReturn => {
  const [users, setUsers] = useState<User[]>([]);
  const [queue, setQueue] = useState<Song[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState>(DEFAULT_PLAYBACK);
  const [isConnected, setIsConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [roomMode, setRoomMode] = useState<RoomMode>('free-sing');
  const [battleFormat, setBattleFormat] = useState<BattleFormat | undefined>();
  const [networkLatency, setNetworkLatency] = useState(0);
  
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isHostRef = useRef(false);
  const hasSyncedRef = useRef(false);

  // RTT measurement state (for latency display only)
  const rttSamplesRef = useRef<number[]>([]);
  const pendingPingsRef = useRef<Map<string, number>>(new Map());
  const rttIntervalRef = useRef<number | null>(null);

  // Store latest state in refs for sync responses
  const queueRef = useRef<Song[]>([]);
  

  const playbackRef = useRef<PlaybackState>(DEFAULT_PLAYBACK);
  const roomModeRef = useRef<RoomMode>('free-sing');
  const battleFormatRef = useRef<BattleFormat | undefined>();

  // Speaking update throttle state
  const lastSpeakingBroadcastRef = useRef<number>(0);
  const lastSpeakingStateRef = useRef<{ isSpeaking: boolean; audioLevel: number }>({ 
    isSpeaking: false, 
    audioLevel: 0 
  });

  // Calculate average RTT from samples
  const getAverageRTT = useCallback(() => {
    const samples = rttSamplesRef.current;
    if (samples.length === 0) return 0;
    return samples.reduce((a, b) => a + b, 0) / samples.length;
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
          const newIsHost = sortedByJoinTime[0]?.id === user.id;
          isHostRef.current = newIsHost;
          setIsHost(newIsHost);
        } else {
          isHostRef.current = false;
          setIsHost(false);
        }
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('User joined:', newPresences);

        // Notify parent component about new user joining
        const newUsers = newPresences as unknown as User[];
        newUsers.forEach(newUser => {
          // Don't trigger for self
          if (newUser.id !== user?.id && onUserJoin) {
            onUserJoin(newUser);
          }
        });

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
                  playbackState: playbackRef.current,
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
          case 'queue_update':
            setQueue(data.payload as Song[]);
            break;
          case 'speaking_update': {
            const { userId, isSpeaking, audioLevel, score } = data.payload as { userId: string; isSpeaking: boolean; audioLevel?: number; score?: number };
            // Skip our own updates - already applied locally for instant feedback
            if (userId === user?.id) break;
            setUsers(prev => prev.map(u => 
              u.id === userId ? { ...u, isSpeaking, audioLevel, score: score ?? u.score } : u
            ));
            break;
          }
          case 'mode_update': {
            const { mode, battleFormat } = data.payload as { mode: RoomMode; battleFormat?: BattleFormat };
            setRoomMode(mode);
            setBattleFormat(battleFormat);
            // Reset scores when switching to team battle
            if (mode === 'team-battle') {
              setUsers(prev => prev.map(u => ({ ...u, score: 0 })));
            }
            break;
          }
          case 'match_start': {
            // Reset all user scores for new match
            console.log('Match started - resetting scores');
            setUsers(prev => prev.map(u => ({ ...u, score: 0 })));
            break;
          }
          case 'match_end': {
            // Just log for now - could save to DB in future
            console.log('Match ended');
            break;
          }
          case 'team_swap': {
            const { userId, newTeam } = data.payload as { userId: string; newTeam: 'left' | 'right' };
            setUsers(prev => prev.map(u => 
              u.id === userId ? { ...u, team: newTeam } : u
            ));
            break;
          }
          case 'format_selected': {
            const { format } = data.payload as { format: BattleFormat };
            setBattleFormat(format);
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
          case 'mic_status_update': {
            const { userId, isMicEnabled } = data.payload as { userId: string; isMicEnabled: boolean };
            // Skip our own updates
            if (userId === user?.id) break;
            setUsers(prev => prev.map(u => 
              u.id === userId ? { ...u, isMicEnabled } : u
            ));
            break;
          }
          // SyncV2 events (prepare_song, start_song, pause_song, resume_song, seek_song, end_song)
          // are handled by useSyncV2 — no duplicate handling here.

          case 'sync_request': {
            // If we're host, respond with full state
            if (isHostRef.current) {
              const requestData = data.payload as { requesterId?: string; latency?: number } | null;
              const targetLatency = requestData?.latency || 0;
              channel.send({
                type: 'broadcast',
                event: 'room_event',
                payload: {
                  type: 'full_sync_response',
                  payload: {
                    queue: queueRef.current,
                    playbackState: getEffectivePlaybackForSync(targetLatency),
                    roomMode: roomModeRef.current,
                    battleFormat: battleFormatRef.current,
                    serverTime: Date.now(),
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
                serverTime?: number;
              };
              console.log('Received full sync:', syncData);
              
              setQueue(syncData.queue);
              setPlaybackState(syncData.playbackState);
              // Update ref immediately 
              playbackRef.current = syncData.playbackState;
              
              setRoomMode(syncData.roomMode);
              setBattleFormat(syncData.battleFormat);
              hasSyncedRef.current = true;
            }
            break;
          }
          // RTT Ping/Pong for latency measurement
          case 'rtt_ping': {
            const pingData = data.payload as { pingId: string; senderId: string; timestamp: number };
            // Respond with pong
            channel.send({
              type: 'broadcast',
              event: 'room_event',
              payload: {
                type: 'rtt_pong',
                payload: {
                  pingId: pingData.pingId,
                  originalSenderId: pingData.senderId,
                  originalTimestamp: pingData.timestamp,
                  responderId: user?.id,
                },
              },
            });
            break;
          }
          case 'rtt_pong': {
            const pongData = data.payload as { 
              pingId: string; 
              originalSenderId: string; 
              originalTimestamp: number;
              responderId: string;
            };
            // Only process if this pong is for us and from the host
            if (pongData.originalSenderId === user?.id && isHostRef.current === false) {
              const rtt = Date.now() - pongData.originalTimestamp;
              rttSamplesRef.current.push(rtt);
              // Keep only the last N samples
              if (rttSamplesRef.current.length > RTT_SAMPLE_COUNT) {
                rttSamplesRef.current.shift();
              }
              const avgRTT = rttSamplesRef.current.reduce((a, b) => a + b, 0) / rttSamplesRef.current.length;
              setNetworkLatency(Math.round(avgRTT / 2)); // One-way latency
              pendingPingsRef.current.delete(pongData.pingId);
            }
            break;
          }
          // NOTE: sync_heartbeat handler removed - SyncV2 now handles all sync via useServerTime
          // Legacy clients sending sync_heartbeat will be ignored
          case 'kick_user': {
            const { targetUserId } = data.payload as { targetUserId: string };
            if (targetUserId === user?.id) {
               console.log('[Room] Kicked by host');
               onHostAction?.('kick');
            }
            setUsers(prev => prev.filter(u => u.id !== targetUserId));
            break;
          }
          case 'force_mute_user': {
            const { targetUserId } = data.payload as { targetUserId: string };
            if (targetUserId === user?.id) {
               console.log('[Room] Muted by host');
               onHostAction?.('mute');
            }
            setUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, isMicEnabled: false } : u));
            break;
          }
          case 'permission_update': {
            const { targetUserId, hasControlAccess } = data.payload as { targetUserId: string; hasControlAccess: boolean };
            setUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, hasControlAccess } : u));
            if (targetUserId === user?.id) {
               onHostAction?.('control_access', { hasControlAccess });
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
          // Also request if we were previously synced but need to catch up (e.g., after reconnect)
          setTimeout(() => {
            const shouldRequestSync = !hasSyncedRef.current || 
              (playbackRef.current.isPlaying && !playbackRef.current.startAtRoomTime);
            
            if (shouldRequestSync) {
              console.log('[Room] Requesting sync (first join or reconnect)');
              hasSyncedRef.current = false; // Reset to accept new sync
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
      if (rttIntervalRef.current) {
        clearInterval(rttIntervalRef.current);
        rttIntervalRef.current = null;
      }
    };
  }, [roomCode, user]);

  // NOTE: Heartbeat sync removed - useSyncV2 now handles all synchronization
  // using useServerTime for clock offset and Web Worker for drift correction

  // Non-host: Measure RTT periodically
  useEffect(() => {
    if (!isConnected || !user) return;
    
    // Clear any existing interval
    if (rttIntervalRef.current) {
      clearInterval(rttIntervalRef.current);
      rttIntervalRef.current = null;
    }

    // Only non-hosts measure RTT
    if (!isHostRef.current) {
      const sendPing = () => {
        if (channelRef.current && !isHostRef.current) {
          const pingId = `${user.id}-${Date.now()}`;
          pendingPingsRef.current.set(pingId, Date.now());
          channelRef.current.send({
            type: 'broadcast',
            event: 'room_event',
            payload: {
              type: 'rtt_ping',
              payload: {
                pingId,
                senderId: user.id,
                timestamp: Date.now(),
              },
            },
          });
        }
      };

      // Send initial ping
      setTimeout(sendPing, 1000);
      
      // Send periodic pings
      rttIntervalRef.current = window.setInterval(sendPing, RTT_PING_INTERVAL);
    }

    return () => {
      if (rttIntervalRef.current) {
        clearInterval(rttIntervalRef.current);
        rttIntervalRef.current = null;
      }
    };
  }, [isConnected, user]);

  const updatePlayback = useCallback((state: Partial<PlaybackState>) => {
    const newState = { ...playbackState, ...state, lastUpdate: Date.now() };
    setPlaybackState(newState);
    // FIX: Update ref immediately so heartbeats see it
    playbackRef.current = newState;
    
    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: { type: 'playback_update', payload: newState },
    });
  }, [playbackState]);

  const seek = useCallback((time: number) => {
    if (!user) return;
    
    // 1. Optimistic local update
    const newState = { ...playbackState, currentTime: time, lastUpdate: Date.now() };
    setPlaybackState(newState);
    // FIX: Update ref immediately
    playbackRef.current = newState;
    
    // 2. Broadcast prioritized seek event
    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: { 
        type: 'seek_event', 
        payload: { 
          time, 
          timestamp: Date.now(),
          seekerId: user.id 
        } 
      },
    });
    
    // 3. Also send standard playback update for redundancy (but seek_event handles priority)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: { type: 'playback_update', payload: newState },
    });
  }, [playbackState, user]);

  const updateQueue = useCallback((newQueue: Song[]) => {
    setQueue(newQueue);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: { type: 'queue_update', payload: newQueue },
    });
  }, []);

  const updateSpeaking = useCallback((isSpeaking: boolean, audioLevel?: number, score?: number) => {
    if (!user) return;
    
    const now = Date.now();
    const lastState = lastSpeakingStateRef.current;
    const timeSinceLastBroadcast = now - lastSpeakingBroadcastRef.current;
    
    // Always broadcast if speaking state changed, otherwise throttle to 200ms (5/sec max)
    const stateChanged = isSpeaking !== lastState.isSpeaking;
    const shouldBroadcast = stateChanged || timeSinceLastBroadcast >= 200;
    
    if (shouldBroadcast) {
      lastSpeakingBroadcastRef.current = now;
      lastSpeakingStateRef.current = { isSpeaking, audioLevel: audioLevel || 0 };
      
      // Optimistic local update - apply immediately for instant feedback
      setUsers(prev => prev.map(u => 
        u.id === user.id ? { ...u, isSpeaking, audioLevel, score: score ?? u.score } : u
      ));
      
      // Round audioLevel to 2 decimals to reduce payload size
      const roundedLevel = audioLevel !== undefined ? Math.round(audioLevel * 100) / 100 : undefined;
      
      channelRef.current?.send({
        type: 'broadcast',
        event: 'room_event',
        payload: { type: 'speaking_update', payload: { userId: user.id, isSpeaking, audioLevel: roundedLevel, score } },
      });
    }
  }, [user]);

  const requestSync = useCallback(() => {
    hasSyncedRef.current = false; // Allow re-sync
    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: { 
        type: 'sync_request', 
        payload: { 
          requesterId: user?.id, 
          latency: getAverageRTT() 
        } 
      },
    });
  }, [user?.id, getAverageRTT]);

  const updateMicStatus = useCallback((isMicEnabled: boolean) => {
    if (!user) return;
    
    // Local update
    setUsers(prev => prev.map(u => 
      u.id === user.id ? { ...u, isMicEnabled } : u
    ));
    
    // Broadcast to others
    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: { type: 'mic_status_update', payload: { userId: user.id, isMicEnabled } },
    });
  }, [user]);

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

  // Swap a single user's team (host only)
  const swapUserTeam = useCallback((userId: string) => {
    setUsers(prev => {
      const user = prev.find(u => u.id === userId);
      if (!user) return prev;
      const newTeam = user.team === 'left' ? 'right' : 'left';
      // Broadcast the swap
      channelRef.current?.send({
        type: 'broadcast',
        event: 'room_event',
        payload: { type: 'team_swap', payload: { userId, newTeam } },
      });
      return prev.map(u => u.id === userId ? { ...u, team: newTeam } : u);
    });
  }, []);

  // Broadcast match start (resets scores on all clients)
  const broadcastMatchStart = useCallback(() => {
    if (!isHostRef.current) return;
    // Local reset
    setUsers(prev => prev.map(u => ({ ...u, score: 0 })));
    // Broadcast to others
    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: { type: 'match_start', payload: {} },
    });
  }, []);

  // Broadcast match end
  const broadcastMatchEnd = useCallback(() => {
    if (!isHostRef.current) return;
    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: { type: 'match_end', payload: {} },
    });
  }, []);

  const kickUser = useCallback((userId: string) => {
    if (!isHostRef.current) return;
    setUsers(prev => prev.filter(u => u.id !== userId));
    channelRef.current?.send({
        type: 'broadcast',
        event: 'room_event',
        payload: { type: 'kick_user', payload: { targetUserId: userId } }
    });
  }, []);

  const forceMuteUser = useCallback((userId: string) => {
    if (!isHostRef.current) return;
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, isMicEnabled: false } : u));
    channelRef.current?.send({
        type: 'broadcast',
        event: 'room_event',
        payload: { type: 'force_mute_user', payload: { targetUserId: userId } }
    });
  }, []);

  const toggleControlAccess = useCallback((userId: string) => {
    if (!isHostRef.current) return;
    setUsers(prev => {
        const user = prev.find(u => u.id === userId);
        if (!user) return prev;
        const newAccess = !user.hasControlAccess;
        channelRef.current?.send({
            type: 'broadcast',
            event: 'room_event',
            payload: { type: 'permission_update', payload: { targetUserId: userId, hasControlAccess: newAccess } }
        });
        return prev.map(u => u.id === userId ? { ...u, hasControlAccess: newAccess } : u);
    });
  }, []);

  // Auto-assign teams when switching to team-battle (only host to prevent race conditions)
  useEffect(() => {
    if (roomMode === 'team-battle' && users.length > 0 && isHostRef.current) {
      const needsAssignment = users.some(u => !u.team);
      if (needsAssignment) {
        const newTeams: Record<string, 'left' | 'right'> = {};
        users.forEach((u, i) => {
          newTeams[u.id] = i % 2 === 0 ? 'left' : 'right';
        });
        updateTeams(newTeams);
      }
    }
  }, [roomMode, users.length, updateTeams]);

  // Scoring for Team Battle is handled via useMicrophone's singing detection
  // which properly detects tonal singing vs mic noise using ZCR and pitch detection.
  // Scores are broadcast through the speaking_update event with the accumulated score.

  return {
    users,
    queue,
    playbackState,
    roomMode,
    battleFormat,
    currentUser: user,
    isConnected,
    isHost,
    channel: channelRef.current,
    updatePlayback,
    updateQueue,
    updateSpeaking,
    updateMicStatus,
    updateMode,
    updateTeams,
    swapUserTeam,
    broadcastMatchStart,
    broadcastMatchEnd,
    requestSync,
    seek,
    networkLatency,
    clockOffset,
    kickUser,
    forceMuteUser,
    toggleControlAccess,
  };
};
