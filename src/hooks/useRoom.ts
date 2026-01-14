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
  roomMode: RoomMode;
  battleFormat?: BattleFormat;
  requestSync: () => void;
  seek: (time: number) => void;
  networkLatency: number;
  clockOffset: number;
}

const DEFAULT_PLAYBACK: PlaybackState = {
  isPlaying: false,
  currentTime: 0,
  currentSongIndex: 0,
  lastUpdate: Date.now(),
};

// Sync constants
const SYNC_HEARTBEAT_INTERVAL = 5000; // Host sends sync every 5 seconds
const RTT_PING_INTERVAL = 10000; // Measure RTT every 10 seconds
const RTT_SAMPLE_COUNT = 5; // Average over 5 samples

export const useRoom = (
  roomCode: string, 
  user: User | null,
  onUserJoin?: (user: User) => void
): UseRoomReturn => {
  const [users, setUsers] = useState<User[]>([]);
  const [queue, setQueue] = useState<Song[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState>(DEFAULT_PLAYBACK);
  const [isConnected, setIsConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [roomMode, setRoomMode] = useState<RoomMode>('free-sing');
  const [battleFormat, setBattleFormat] = useState<BattleFormat | undefined>();
  const [networkLatency, setNetworkLatency] = useState(0);
  const [clockOffset, setClockOffset] = useState(0);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isHostRef = useRef(false);
  const hasSyncedRef = useRef(false);

  // RTT measurement state
  const rttSamplesRef = useRef<number[]>([]);
  const pendingPingsRef = useRef<Map<string, number>>(new Map());
  const heartbeatIntervalRef = useRef<number | null>(null);
  const rttIntervalRef = useRef<number | null>(null);

  // Store latest state in refs for sync responses
  const queueRef = useRef<Song[]>([]);
  const clockOffsetRef = useRef(0);

  // Keep clockOffset ref in sync
  useEffect(() => {
    clockOffsetRef.current = clockOffset;
  }, [clockOffset]);
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

  // When sending a full sync, compute an "effective" currentTime for joiners
  // based on the last known time + elapsed since lastUpdate, plus estimated latency compensation.
  const getEffectivePlaybackForSync = useCallback((targetLatency: number = 0): PlaybackState => {
    const base = playbackRef.current;
    const now = Date.now();
    const elapsed = base.isPlaying ? Math.max(0, (now - (base.lastUpdate || now)) / 1000) : 0;
    // Add half the target's latency to compensate for network delay
    const latencyCompensation = targetLatency / 2000; // Convert ms to seconds, use half for one-way
    return {
      ...base,
      currentTime: (base.currentTime || 0) + elapsed + latencyCompensation,
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
          case 'playback_update': {
            const newState = data.payload as PlaybackState;
            // Only accept updates that are newer than our current state
            setPlaybackState(prev => {
              if (newState.lastUpdate < prev.lastUpdate) return prev;
              return newState;
            });
            break;
          }
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
          case 'seek_event': {
            const { time, timestamp, seekerId } = data.payload as { time: number; timestamp: number; seekerId: string };
            // Ignore own seeks
            if (seekerId === user?.id) break;
            
            setPlaybackState(prev => {
              // Create new state with adjusted timestamp
              const newState = {
                ...prev,
                currentTime: time,
                lastUpdate: Date.now() + clockOffsetRef.current // Convert to Server/Host time reference
              };
              // Only apply if newer (though seeks are usually intentional overrides)
              if (newState.lastUpdate < prev.lastUpdate) return prev;
              return newState;
            });
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
          case 'mic_status_update': {
            const { userId, isMicEnabled } = data.payload as { userId: string; isMicEnabled: boolean };
            // Skip our own updates
            if (userId === user?.id) break;
            setUsers(prev => prev.map(u => 
              u.id === userId ? { ...u, isMicEnabled } : u
            ));
            break;
          }
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
              
              // Calculate clock offset if server time is provided
              if (syncData.serverTime) {
                const localTime = Date.now();
                const offset = syncData.serverTime - localTime;
                setClockOffset(offset);
              }
              
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
          // Sync heartbeat from host
          case 'sync_heartbeat': {
            if (!isHostRef.current) {
              const heartbeatData = data.payload as {
                playbackState: PlaybackState;
                serverTime: number;
              };
              // Update clock offset
              const localTime = Date.now();
              const offset = heartbeatData.serverTime - localTime;
              setClockOffset(prev => (prev + offset) / 2); // Smooth the offset
              
              // Update playback state for continuous sync - but prevent race conditions
              setPlaybackState(prev => {
                // If the heartbeat state is older than our last update (unlikely from host, but possible via clock skew/reordering)
                // Actually, just trust host, but monotonic time is safer
                if (heartbeatData.playbackState.lastUpdate < prev.lastUpdate) return prev;
                return heartbeatData.playbackState;
              });
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
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (rttIntervalRef.current) {
        clearInterval(rttIntervalRef.current);
        rttIntervalRef.current = null;
      }
    };
  }, [roomCode, user, getEffectivePlaybackForSync]);

  // Host: Send sync heartbeats periodically
  useEffect(() => {
    if (!isConnected) return;
    
    // Clear any existing interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    // Only host sends heartbeats
    if (isHostRef.current) {
      heartbeatIntervalRef.current = window.setInterval(() => {
        if (channelRef.current && isHostRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'room_event',
            payload: {
              type: 'sync_heartbeat',
              payload: {
                playbackState: getEffectivePlaybackForSync(0),
                serverTime: Date.now(),
              },
            },
          });
        }
      }, SYNC_HEARTBEAT_INTERVAL);
    }

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [isConnected, getEffectivePlaybackForSync]);

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
    isHost,
    channel: channelRef.current,
    updatePlayback,
    updateQueue,
    updateSpeaking,
    updateMicStatus,
    updateMode,
    updateTeams,
    requestSync,
    seek,
    networkLatency,
    clockOffset,
  };
};
