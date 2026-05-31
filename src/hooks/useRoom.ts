import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Song, PlaybackState, RealtimePayload, RoomRole } from '@/types/karaoke';
import { RealtimeChannel } from '@supabase/supabase-js';
import { detectDefaultRole, readDeviceEnv } from '@/lib/deviceRole';
import { electClock } from '@/lib/playbackClock';
import { fromSnapshotRow } from '@/lib/roomSnapshot';

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

export const useRoom = (roomCode: string, user: User | null): UseRoomReturn => {
  const [users, setUsers] = useState<User[]>([]);
  const [queue, setQueue] = useState<Song[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState>(DEFAULT_PLAYBACK);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [role, setRoleState] = useState<RoomRole>(() => detectDefaultRole(readDeviceEnv()));

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
      .on('broadcast', { event: 'room_event' }, ({ payload }) => {
        const data = payload as RealtimePayload;
        switch (data.type) {
          case 'playback_update':
            setPlaybackState(data.payload as PlaybackState);
            break;
          case 'queue_update':
            setQueue(data.payload as Song[]);
            break;
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ ...user, role });
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
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [roomCode, user, role]);

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

  const requestSync = useCallback(() => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: { type: 'sync_request', payload: null },
    });
  }, []);

  const setRole = useCallback((next: RoomRole) => {
    setRoleState(next);
    if (channelRef.current && user) {
      channelRef.current.track({ ...user, role: next });
    }
  }, [user]);

  const isClock = !!user && electClock(users) === user.id;
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!isClock || !roomCode) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void supabase.from('room_state').upsert({
        code: roomCode,
        queue,
        playback: playbackState,
        updated_at: new Date().toISOString(),
      }).then(({ error }) => {
        if (error) console.error('Failed to persist room snapshot:', error);
      });
    }, 1500);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [isClock, roomCode, queue, playbackState]);

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
