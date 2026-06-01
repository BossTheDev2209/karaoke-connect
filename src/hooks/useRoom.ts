import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Song, PlaybackState, RealtimePayload, RoomRole } from '@/types/karaoke';
import { RealtimeChannel } from '@supabase/supabase-js';
import { detectDefaultRole, readDeviceEnv } from '@/lib/deviceRole';
import { canBroadcastClockState, electClock } from '@/lib/playbackClock';
import { fromSnapshotRow } from '@/lib/roomSnapshot';
import { dedupePresence } from '@/lib/presence';
import type { Json } from '@/integrations/supabase/types';

interface UseRoomReturn {
  users: User[];
  queue: Song[];
  playbackState: PlaybackState;
  currentUser: User | null;
  isConnected: boolean;
  channel: RealtimeChannel | null;
  updatePlayback: (state: Partial<PlaybackState>) => void;
  updateQueue: (queue: Song[]) => void;
  requestSync: () => void;
  role: RoomRole;
  setRole: (role: RoomRole) => void;
  isClock: boolean;
}

const DEFAULT_PLAYBACK: PlaybackState = {
  isPlaying: false,
  currentTime: 0,
  currentSongIndex: 0,
  lastUpdate: Date.now(),
};

const PRESENCE_SETTLE_MS = 1000;

export const useRoom = (
  roomCode: string,
  user: User | null,
  getClockPlayback?: () => PlaybackState,
): UseRoomReturn => {
  const [users, setUsers] = useState<User[]>([]);
  const [queue, setQueue] = useState<Song[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState>(DEFAULT_PLAYBACK);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [role, setRoleState] = useState<RoomRole>(() => detectDefaultRole(readDeviceEnv()));
  const roleRef = useRef(role);
  const isClockRef = useRef(false);
  const hasAuthoritativeStateRef = useRef(false);
  const usersRef = useRef(users);
  const getClockPlaybackRef = useRef(getClockPlayback);

  useEffect(() => {
    getClockPlaybackRef.current = getClockPlayback;
  }, [getClockPlayback]);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  const markAuthoritativeState = useCallback(() => {
    if (hasAuthoritativeStateRef.current) return;
    hasAuthoritativeStateRef.current = true;
    if (channelRef.current && user) {
      void channelRef.current.track({
        ...user,
        role: roleRef.current,
        hasAuthoritativeState: true,
      });
    }
  }, [user]);

  useEffect(() => {
    if (!roomCode || !user) return;

    isClockRef.current = false;
    hasAuthoritativeStateRef.current = false;

    const channel = supabase.channel(`room:${roomCode}`, {
      config: {
        presence: { key: user.id },
        broadcast: { self: true },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<User>();
        setUsers(dedupePresence(state as Record<string, User[]>));
      })
      .on('broadcast', { event: 'room_event' }, ({ payload }) => {
        const data = payload as RealtimePayload;
        switch (data.type) {
          case 'playback_update':
            if (data.senderId !== user.id) markAuthoritativeState();
            setPlaybackState(data.payload as PlaybackState);
            break;
          case 'queue_update':
            setQueue(data.payload as Song[]);
            break;
          case 'sync_request': {
            if (
              data.senderId !== user.id
              && canBroadcastClockState({
                isClock: isClockRef.current,
                hasAuthoritativeState: hasAuthoritativeStateRef.current,
              })
            ) {
              const live = getClockPlaybackRef.current?.();
              if (live) {
                channelRef.current?.send({
                  type: 'broadcast',
                  event: 'room_event',
                  payload: {
                    type: 'playback_update',
                    payload: { ...live, lastUpdate: Date.now() },
                    senderId: user.id,
                  },
                });
              }
            }
            break;
          }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            ...user,
            role: roleRef.current,
            hasAuthoritativeState: hasAuthoritativeStateRef.current,
          });
          setIsConnected(true);
          const { data } = await supabase
            .from('room_state')
            .select('code, queue, playback')
            .eq('code', roomCode)
            .maybeSingle();
          const snap = fromSnapshotRow(data);
          if (snap) {
            setQueue(snap.queue);
            setPlaybackState(snap.playback);
          }
          channel.send({
            type: 'broadcast',
            event: 'room_event',
            payload: { type: 'sync_request', payload: null, senderId: user.id },
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [markAuthoritativeState, roomCode, user]);

  const updatePlayback = useCallback((state: Partial<PlaybackState>) => {
    markAuthoritativeState();
    const newState = { ...playbackState, ...state, lastUpdate: Date.now() };
    setPlaybackState(newState);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: { type: 'playback_update', payload: newState, senderId: user?.id },
    });
  }, [markAuthoritativeState, playbackState, user]);

  const updateQueue = useCallback((newQueue: Song[]) => {
    setQueue(newQueue);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: { type: 'queue_update', payload: newQueue },
    });
  }, []);

  const requestSync = useCallback(() => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: { type: 'sync_request', payload: null, senderId: user?.id },
    });
  }, [user]);

  const setRole = useCallback((next: RoomRole) => {
    setRoleState(next);
    if (channelRef.current && user) {
      channelRef.current.track({
        ...user,
        role: next,
        hasAuthoritativeState: hasAuthoritativeStateRef.current,
      });
    }
  }, [user]);

  const isElectedClock = !!user && electClock(users) === user.id;
  const isClock = canBroadcastClockState({
    isClock: isElectedClock,
    hasAuthoritativeState: hasAuthoritativeStateRef.current,
  });
  useEffect(() => {
    if (!user || hasAuthoritativeStateRef.current) return;
    const players = users.filter((candidate) => (candidate.role ?? 'player') === 'player');
    if (players.length !== 1 || players[0].id !== user.id) return;
    const id = window.setTimeout(() => {
      const settledPlayers = usersRef.current.filter((candidate) => (candidate.role ?? 'player') === 'player');
      if (settledPlayers.length === 1 && settledPlayers[0].id === user.id) {
        markAuthoritativeState();
      }
    }, PRESENCE_SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [markAuthoritativeState, user, users]);

  useEffect(() => {
    isClockRef.current = isElectedClock;
    if (!isElectedClock) return;
    const id = window.setInterval(() => {
      if (!canBroadcastClockState({
        isClock: isClockRef.current,
        hasAuthoritativeState: hasAuthoritativeStateRef.current,
      })) return;
      const live = getClockPlaybackRef.current?.();
      if (live) {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'room_event',
          payload: {
            type: 'playback_update',
            payload: { ...live, lastUpdate: Date.now() },
            senderId: user?.id,
          },
        });
      }
    }, 5000);
    return () => window.clearInterval(id);
  }, [isElectedClock, user]);

  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!isElectedClock || !roomCode) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      if (!canBroadcastClockState({
        isClock: isClockRef.current,
        hasAuthoritativeState: hasAuthoritativeStateRef.current,
      })) return;
      void supabase.from('room_state').upsert({
        code: roomCode,
        queue: queue as unknown as Json,
        playback: playbackState as unknown as Json,
        updated_at: new Date().toISOString(),
      }).then(({ error }) => {
        if (error) console.error('Failed to persist room snapshot:', error);
      });
    }, 1500);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [isElectedClock, roomCode, queue, playbackState]);

  return {
    users,
    queue,
    playbackState,
    currentUser: user,
    isConnected,
    channel: channelRef.current,
    updatePlayback,
    updateQueue,
    requestSync,
    role,
    setRole,
    isClock,
  };
};
