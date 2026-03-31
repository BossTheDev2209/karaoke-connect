import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { PlaybackState, PlaybackStatus, PlayerReadyStates, Song } from '@/types/karaoke';
import { DEFAULT_PLAYBACK } from '@/lib/playbackDefaults';
import { useServerTime } from './useServerTime';

/**
 * New Sync System (V2) - Timeline-based synchronization
 * 
 * Key features:
 * 1. Uses server time offset (via useServerTime) for consistent room clock
 * 2. Ready Check: Song won't start until all players report ready
 * 3. startAtRoomTime: Stores WHEN song started, not current position
 * 4. Web Worker for background-safe drift correction (not throttled in background tabs)
 * 5. Single source of truth - no legacy sync conflicts
 * 6. Host actions are LOCAL-FIRST then broadcast (no self-echo dependency)
 */

// How long to wait for all players to be ready before force-starting
const READY_CHECK_TIMEOUT_MS = 10000;

// Sync correction thresholds (seconds)
const SYNC_DRIFT_THRESHOLD = 0.5; // Seek if drift > 0.5s
const SYNC_CORRECTION_INTERVAL_MS = 500; // Check every 500ms

interface UseSyncV2Options {
  channel: RealtimeChannel | null;
  userId: string | null;
  isHost: boolean;
  queue: Song[];
  onSeekRequired: (time: number) => void;
  onPlayRequired: () => void;
  onPauseRequired: () => void;
  onCueVideo: (videoId: string) => void;
  getCurrentVideoTime: () => number;
  isPlayerReady: boolean;
}

interface UseSyncV2Return {
  playbackState: PlaybackState;
  playerReadyStates: PlayerReadyStates;
  /** Calculate current target time based on room clock */
  getTargetTime: () => number;
  /** Host: Prepare a song (triggers ready check) */
  prepareSong: (songIndex: number) => void;
  /** Host: Force start even if not all ready */
  forceStart: () => void;
  /** Host/Any: Pause playback */
  pause: () => void;
  /** Host/Any: Resume playback */
  resume: () => void;
  /** Host/Any: Seek to time */
  seek: (time: number) => void;
  /** Host: End current song */
  endSong: () => void;
  /** Report buffering status */
  reportBuffering: (isBuffering: boolean) => void;
  /** Server time offset for external use */
  serverTimeOffset: number;
  /** Whether server time is calibrated */
  isTimeCalibrated: boolean;
  /** Apply full sync playback state from useRoom (called after validation) */
  applyFullSyncPlayback: (incomingState: PlaybackState) => void;
}

export function useSyncV2({
  channel,
  userId,
  isHost,
  queue,
  onSeekRequired,
  onPlayRequired,
  onPauseRequired,
  onCueVideo,
  getCurrentVideoTime,
  isPlayerReady,
}: UseSyncV2Options): UseSyncV2Return {
  // Server time for synchronization - SINGLE SOURCE OF TRUTH
  const { getRoomTime, isCalibrated, offset: serverTimeOffset } = useServerTime();
  
  // Core state
  const [playbackState, setPlaybackState] = useState<PlaybackState>(DEFAULT_PLAYBACK);
  const [playerReadyStates, setPlayerReadyStates] = useState<PlayerReadyStates>({});
  
  // Refs for latest values in callbacks
  const playbackRef = useRef<PlaybackState>(DEFAULT_PLAYBACK);
  const isHostRef = useRef(isHost);
  const readyCheckTimeoutRef = useRef<number | null>(null);
  const workerRef = useRef<Worker | null>(null);
  
  // Sync refs
  playbackRef.current = playbackState;
  isHostRef.current = isHost;
  
  // Refs for worker callbacks to avoid stale closures
  const getTargetTimeRef = useRef<() => number>(() => 0);
  const getCurrentVideoTimeRef = useRef(getCurrentVideoTime);
  const onSeekRequiredRef = useRef(onSeekRequired);
  const onPlayRequiredRef = useRef(onPlayRequired);
  const onPauseRequiredRef = useRef(onPauseRequired);
  const onCueVideoRef = useRef(onCueVideo);
  const getRoomTimeRef = useRef(getRoomTime);
  const serverTimeOffsetRef = useRef(serverTimeOffset);
  const playerSafeRef = useRef(isPlayerReady);
  const unsafeSyncLoggedRef = useRef(false);
  
  // Track which channel instance we've registered on to prevent duplicate handlers
  const registeredChannelRef = useRef<RealtimeChannel | null>(null);
  
  // Keep callback refs updated
  useEffect(() => {
    getCurrentVideoTimeRef.current = getCurrentVideoTime;
    onSeekRequiredRef.current = onSeekRequired;
    onPlayRequiredRef.current = onPlayRequired;
    onPauseRequiredRef.current = onPauseRequired;
    onCueVideoRef.current = onCueVideo;
    getRoomTimeRef.current = getRoomTime;
    serverTimeOffsetRef.current = serverTimeOffset;
    playerSafeRef.current = isPlayerReady;
  }, [getCurrentVideoTime, onSeekRequired, onPlayRequired, onPauseRequired, onCueVideo, getRoomTime, serverTimeOffset, isPlayerReady]);

  /**
   * Initialize Web Worker for background-safe timing
   */
  useEffect(() => {
    // Create worker from the syncTimer.worker.ts file
    workerRef.current = new Worker(
      new URL('../workers/syncTimer.worker.ts', import.meta.url),
      { type: 'module' }
    );
    
    workerRef.current.onmessage = (event) => {
      const { type } = event.data;
      
      if (type === 'tick') {
        const state = playbackRef.current;
        if (state.status !== 'playing') return;
        if (!playerSafeRef.current) {
          if (!unsafeSyncLoggedRef.current && import.meta.env.DEV) {
            console.log('[SyncV2] Drift correction paused: player unsafe');
            unsafeSyncLoggedRef.current = true;
          }
          return;
        }

        if (unsafeSyncLoggedRef.current && import.meta.env.DEV) {
          console.log('[SyncV2] Drift correction resumed: player safe');
          unsafeSyncLoggedRef.current = false;
        }

        const targetTime = getTargetTimeRef.current();
        const currentTime = getCurrentVideoTimeRef.current();
        const drift = Math.abs(targetTime - currentTime);
        
        if (drift > SYNC_DRIFT_THRESHOLD) {
          console.log(`[SyncV2] Drift correction: ${drift.toFixed(2)}s (target=${targetTime.toFixed(2)}, current=${currentTime.toFixed(2)})`);
          onSeekRequiredRef.current(targetTime);
        }
      } else if (type === 'ready') {
        console.log('[SyncV2] Worker ready');
      }
    };
    
    workerRef.current.onerror = (error) => {
      console.error('[SyncV2] Worker error:', error);
    };
    
    return () => {
      workerRef.current?.postMessage({ type: 'stop' });
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []); // Empty deps - worker created once, uses refs for latest values

  /**
   * Start/stop worker based on playback state
   */
  useEffect(() => {
    if (!workerRef.current || !isCalibrated) return;
    
    if (playbackState.status === 'playing' && isPlayerReady) {
      workerRef.current.postMessage({ 
        type: 'start', 
        intervalMs: SYNC_CORRECTION_INTERVAL_MS 
      });
    } else {
      workerRef.current.postMessage({ type: 'stop' });
    }
  }, [playbackState.status, isCalibrated, isPlayerReady]);

  /**
   * Calculate the target video time based on room clock.
   */
  const getTargetTimeInternal = useCallback(() => {
    const state = playbackRef.current;
    if (state.status !== 'playing' || !state.startAtRoomTime) {
      return state.seekOffset || 0;
    }
    const roomTime = getRoomTime();
    const elapsedMs = roomTime - state.startAtRoomTime;
    return Math.max(0, elapsedMs / 1000 + state.seekOffset);
  }, [getRoomTime]);
  
  // Keep getTargetTimeRef updated for worker callbacks
  useEffect(() => {
    getTargetTimeRef.current = getTargetTimeInternal;
  }, [getTargetTimeInternal]);

  /**
   * Public version of getTargetTime
   */
  const getTargetTime = useCallback(() => {
    return getTargetTimeInternal();
  }, [getTargetTimeInternal]);

  /**
   * Host: Prepare a song for synchronized playback.
   * LOCAL-FIRST: Cues the video locally, then broadcasts to peers.
   */
  const prepareSong = useCallback((songIndex: number) => {
    if (!channel || !isHostRef.current) return;
    
    const song = queue[songIndex];
    if (!song) return;
    
    console.log('[SyncV2] Preparing song:', song.title);
    
    // Update local state
    const newState: PlaybackState = {
      ...DEFAULT_PLAYBACK,
      status: 'preparing',
      videoId: song.videoId,
      currentSongIndex: songIndex,
    };
    setPlaybackState(newState);
    playbackRef.current = newState;
    
    // Clear ready states
    setPlayerReadyStates({});
    
    // LOCAL-FIRST: Cue video locally for the host immediately
    onCueVideoRef.current(song.videoId);
    
    // Broadcast prepare command to peers
    channel.send({
      type: 'broadcast',
      event: 'room_event',
      payload: {
        type: 'prepare_song',
        payload: {
          videoId: song.videoId,
          songIndex,
          hostId: userId,
        },
      },
    });
    
    // Set timeout for ready check
    if (readyCheckTimeoutRef.current) {
      clearTimeout(readyCheckTimeoutRef.current);
    }
    readyCheckTimeoutRef.current = window.setTimeout(() => {
      console.log('[SyncV2] Ready check timeout - force starting');
      forceStart();
    }, READY_CHECK_TIMEOUT_MS);

    // Solo user: skip ready check entirely
    setTimeout(() => {
      if (playbackRef.current.status === 'preparing') {
        console.log('[SyncV2] Solo user detected, auto-starting');
        forceStart();
      }
    }, 500);
  }, [channel, userId, queue]);

  /**
   * Host: Start the song with synchronized timing.
   * Calculates startAtRoomTime based on current room clock.
   */
  const startSongInternal = useCallback((delayMs: number = 2000) => {
    if (!channel || !isHostRef.current) return;
    
    const state = playbackRef.current;
    if (!state.videoId) return;
    
    // Clear ready check timeout
    if (readyCheckTimeoutRef.current) {
      clearTimeout(readyCheckTimeoutRef.current);
      readyCheckTimeoutRef.current = null;
    }
    
    const roomTime = getRoomTimeRef.current();
    const startAtRoomTime = roomTime + delayMs;
    
    console.log(`[SyncV2] Starting song in ${delayMs}ms (roomTime=${roomTime}, startAt=${startAtRoomTime})`);
    
    const newState: PlaybackState = {
      ...state,
      status: 'playing',
      startAtRoomTime,
      seekOffset: 0,
      isPlaying: true,
      currentTime: 0,
      lastUpdate: Date.now(),
    };
    
    setPlaybackState(newState);
    playbackRef.current = newState;
    
    // Broadcast start command
    channel.send({
      type: 'broadcast',
      event: 'room_event',
      payload: {
        type: 'start_song',
        payload: {
          videoId: state.videoId,
          startAtRoomTime,
          seekOffset: 0,
        },
      },
    });
    
    // Host schedules own playback locally
    setTimeout(() => {
      onSeekRequiredRef.current(0);
      onPlayRequiredRef.current();
    }, delayMs);
  }, [channel]);

  /**
   * Force start (skip ready check).
   */
  const forceStart = useCallback(() => {
    startSongInternal(1000); // 1 second countdown
  }, [startSongInternal]);

  /**
   * Pause playback.
   * LOCAL-FIRST: Pauses locally then broadcasts.
   */
  const pause = useCallback(() => {
    if (!channel) return;
    
    const currentTime = getCurrentVideoTimeRef.current();
    console.log(`[SyncV2] Pausing at ${currentTime}s`);
    
    const newState: PlaybackState = {
      ...playbackRef.current,
      status: 'paused',
      seekOffset: currentTime,
      startAtRoomTime: null,
      isPlaying: false,
      currentTime,
      lastUpdate: Date.now(),
    };
    
    setPlaybackState(newState);
    playbackRef.current = newState;
    
    // LOCAL-FIRST: Pause the player immediately
    onPauseRequiredRef.current();
    
    // Then broadcast to peers
    channel.send({
      type: 'broadcast',
      event: 'room_event',
      payload: {
        type: 'pause_song',
        payload: {
          seekOffset: currentTime,
        },
      },
    });
  }, [channel]);

  /**
   * Resume playback from paused state.
   * LOCAL-FIRST: Schedules local playback then broadcasts.
   */
  const resume = useCallback(() => {
    if (!channel) return;
    
    const state = playbackRef.current;
    const roomTime = getRoomTimeRef.current();
    const delayMs = 1000;
    const startAtRoomTime = roomTime + delayMs;
    
    console.log(`[SyncV2] Resuming from ${state.seekOffset}s in ${delayMs}ms`);
    
    const newState: PlaybackState = {
      ...state,
      status: 'playing',
      startAtRoomTime,
      isPlaying: true,
      lastUpdate: Date.now(),
    };
    
    setPlaybackState(newState);
    playbackRef.current = newState;
    
    // Broadcast to peers
    channel.send({
      type: 'broadcast',
      event: 'room_event',
      payload: {
        type: 'resume_song',
        payload: {
          startAtRoomTime,
          seekOffset: state.seekOffset,
        },
      },
    });
    
    // Host schedules own playback locally
    setTimeout(() => {
      onSeekRequiredRef.current(state.seekOffset);
      onPlayRequiredRef.current();
    }, delayMs);
  }, [channel]);

  /**
   * Seek to specific time.
   * LOCAL-FIRST: Seeks locally then broadcasts.
   */
  const seek = useCallback((time: number) => {
    if (!channel) return;
    
    const state = playbackRef.current;
    const roomTime = getRoomTimeRef.current();
    
    console.log(`[SyncV2] Seeking to ${time}s`);
    
    const newState: PlaybackState = {
      ...state,
      seekOffset: time,
      startAtRoomTime: state.status === 'playing' ? roomTime : null,
      currentTime: time,
      lastUpdate: Date.now(),
    };
    
    setPlaybackState(newState);
    playbackRef.current = newState;
    
    // LOCAL-FIRST: Seek immediately
    onSeekRequiredRef.current(time);
    
    // Broadcast to peers
    channel.send({
      type: 'broadcast',
      event: 'room_event',
      payload: {
        type: 'seek_song',
        payload: {
          seekOffset: time,
          startAtRoomTime: newState.startAtRoomTime,
          roomTime,
        },
      },
    });
  }, [channel]);

  /**
   * End current song.
   */
  const endSong = useCallback(() => {
    if (!channel) return;
    
    console.log('[SyncV2] Ending song');
    
    const newState: PlaybackState = {
      ...DEFAULT_PLAYBACK,
      currentSongIndex: playbackRef.current.currentSongIndex,
    };
    
    setPlaybackState(newState);
    playbackRef.current = newState;
    
    // LOCAL-FIRST: Stop playback
    onPauseRequiredRef.current();
    
    channel.send({
      type: 'broadcast',
      event: 'room_event',
      payload: {
        type: 'end_song',
        payload: {},
      },
    });
  }, [channel]);

  /**
   * Report buffering status.
   */
  const reportBuffering = useCallback((isBuffering: boolean) => {
    if (!channel || !userId) return;
    
    channel.send({
      type: 'broadcast',
      event: 'room_event',
      payload: {
        type: 'buffering_report',
        payload: {
          userId,
          isBuffering,
          timestamp: getRoomTimeRef.current(),
        },
      },
    });
  }, [channel, userId]);

  /**
   * Apply full sync playback state from useRoom after validation.
   */
  const applyFullSyncPlayback = useCallback((incomingState: PlaybackState) => {
    console.log('[SyncV2] applyFullSyncPlayback', { status: incomingState.status, isPlaying: incomingState.isPlaying, videoId: incomingState.videoId, startAtRoomTime: incomingState.startAtRoomTime, seekOffset: incomingState.seekOffset });
    
    if (incomingState.status === 'preparing' || incomingState.status === 'ready') {
      const newState: PlaybackState = { ...incomingState };
      setPlaybackState(newState);
      playbackRef.current = newState;
      
      if (incomingState.videoId && playerSafeRef.current) {
        console.log(`[SyncV2] Hydrating preparing/ready phase, cueing video: ${incomingState.videoId}`);
        onCueVideoRef.current(incomingState.videoId);
      }
      return;
    }
    
    if (incomingState.status === 'playing' || incomingState.startAtRoomTime) {
      const newState: PlaybackState = {
        ...incomingState,
        status: incomingState.isPlaying ? 'playing' : (incomingState.status || 'idle'),
      };
      setPlaybackState(newState);
      playbackRef.current = newState;
      
      if (incomingState.isPlaying && incomingState.startAtRoomTime && playerSafeRef.current) {
        const roomTime = getRoomTimeRef.current();
        const elapsed = (roomTime - incomingState.startAtRoomTime) / 1000;
        const targetTime = Math.max(0, elapsed + (incomingState.seekOffset || 0));
        
        console.log(`[SyncV2] New joiner syncing to ${targetTime.toFixed(2)}s (elapsed=${elapsed.toFixed(2)}s)`);
        
        if (incomingState.videoId) {
          onCueVideoRef.current(incomingState.videoId);
        }
        
        setTimeout(() => {
          if (!playerSafeRef.current) return;
          onSeekRequiredRef.current(targetTime);
          onPlayRequiredRef.current();
        }, 500);
      }
    }
  }, []);

  /**
   * Handle incoming sync events from peers.
   * CRITICAL: Only register ONCE per channel instance to prevent duplicate handlers.
   * All callback access is via refs to avoid stale closures.
   */
  useEffect(() => {
    if (!channel) return;
    
    // Prevent duplicate registration on the same channel instance
    if (registeredChannelRef.current === channel) return;
    registeredChannelRef.current = channel;
    
    const handleSyncEvent = ({ payload }: { payload: any }) => {
      const data = payload;
      
      switch (data.type) {
        case 'prepare_song': {
          // Host already handled this locally in prepareSong()
          if (isHostRef.current) break;
          
          const { videoId, songIndex } = data.payload;
          console.log('[SyncV2] Received prepare_song:', videoId);
          
          setPlaybackState(prev => ({
            ...prev,
            status: 'preparing',
            videoId,
            currentSongIndex: songIndex,
          }));
          
          onCueVideoRef.current(videoId);
          break;
        }
        
        case 'player_ready': {
          const { readyUserId } = data.payload;
          console.log('[SyncV2] Player ready:', readyUserId);
          
          setPlayerReadyStates(prev => ({
            ...prev,
            [readyUserId]: true,
          }));
          break;
        }
        
        case 'start_song': {
          // Host already scheduled local playback in startSongInternal()
          if (isHostRef.current) break;
          
          const { videoId, startAtRoomTime, seekOffset } = data.payload;
          console.log('[SyncV2] Received start_song:', { videoId, startAtRoomTime, seekOffset });
          
          const newState: PlaybackState = {
            status: 'playing',
            videoId,
            startAtRoomTime,
            seekOffset: seekOffset || 0,
            currentSongIndex: playbackRef.current.currentSongIndex,
            isPlaying: true,
            currentTime: seekOffset || 0,
            lastUpdate: Date.now(),
          };
          setPlaybackState(newState);
          playbackRef.current = newState;
          
          const roomTime = getRoomTimeRef.current();
          const delayMs = startAtRoomTime - roomTime;
          
          if (delayMs > 50) {
            console.log(`[SyncV2] Scheduling playback in ${delayMs}ms`);
            setTimeout(() => {
              if (!playerSafeRef.current) return;
              const targetTime = (Date.now() + serverTimeOffsetRef.current - startAtRoomTime) / 1000 + (seekOffset || 0);
              onSeekRequiredRef.current(Math.max(0, targetTime));
              onPlayRequiredRef.current();
            }, delayMs);
          } else if (playerSafeRef.current) {
            const elapsed = (roomTime - startAtRoomTime) / 1000;
            const targetTime = Math.max(0, elapsed + (seekOffset || 0));
            console.log(`[SyncV2] Starting immediately at ${targetTime.toFixed(2)}s`);
            onSeekRequiredRef.current(targetTime);
            onPlayRequiredRef.current();
          }
          break;
        }
        
        case 'pause_song': {
          // Host already paused locally in pause()
          if (isHostRef.current) break;
          
          const { seekOffset } = data.payload;
          console.log('[SyncV2] Received pause_song at:', seekOffset);
          
          setPlaybackState(prev => ({
            ...prev,
            status: 'paused',
            seekOffset,
            startAtRoomTime: null,
            isPlaying: false,
            currentTime: seekOffset,
            lastUpdate: Date.now(),
          }));
          
          if (playerSafeRef.current) {
            onPauseRequiredRef.current();
          }
          break;
        }
        
        case 'resume_song': {
          // Host already scheduled local playback in resume()
          if (isHostRef.current) break;
          
          const { startAtRoomTime, seekOffset } = data.payload;
          console.log('[SyncV2] Received resume_song:', { startAtRoomTime, seekOffset });
          
          const newState: PlaybackState = {
            ...playbackRef.current,
            status: 'playing',
            startAtRoomTime,
            seekOffset,
            isPlaying: true,
            lastUpdate: Date.now(),
          };
          setPlaybackState(newState);
          playbackRef.current = newState;
          
          const roomTime = getRoomTimeRef.current();
          const delayMs = startAtRoomTime - roomTime;
          
          if (delayMs > 50) {
            console.log(`[SyncV2] Scheduling resume in ${delayMs}ms`);
            setTimeout(() => {
              if (!playerSafeRef.current) return;
              onSeekRequiredRef.current(seekOffset);
              onPlayRequiredRef.current();
            }, delayMs);
          } else if (playerSafeRef.current) {
            const elapsed = (roomTime - startAtRoomTime) / 1000;
            const targetTime = Math.max(0, elapsed + seekOffset);
            console.log(`[SyncV2] Resuming immediately at ${targetTime.toFixed(2)}s`);
            onSeekRequiredRef.current(targetTime);
            onPlayRequiredRef.current();
          }
          break;
        }
        
        case 'seek_song': {
          // Host already seeked locally in seek()
          if (isHostRef.current) break;
          
          const { seekOffset, startAtRoomTime } = data.payload;
          console.log('[SyncV2] Received seek_song:', seekOffset);
          
          setPlaybackState(prev => ({
            ...prev,
            seekOffset,
            startAtRoomTime,
            currentTime: seekOffset,
            lastUpdate: Date.now(),
          }));
          
          if (playerSafeRef.current) {
            onSeekRequiredRef.current(seekOffset);
          }
          break;
        }
        
        case 'end_song': {
          // Host already handled locally in endSong()
          if (isHostRef.current) break;
          
          console.log('[SyncV2] Received end_song');
          setPlaybackState(prev => ({
            ...DEFAULT_PLAYBACK,
            currentSongIndex: prev.currentSongIndex,
          }));
          break;
        }
        
        case 'force_sync': {
          const { currentTime, timestamp, roomTime } = data.payload;
          console.log('[SyncV2] Force sync received:', { currentTime, roomTime });
          
          if (roomTime && playbackRef.current.status === 'playing') {
            setPlaybackState(prev => ({
              ...prev,
              startAtRoomTime: roomTime,
              seekOffset: currentTime,
              currentTime,
              lastUpdate: Date.now(),
            }));
          }
          if (playerSafeRef.current) {
            onSeekRequiredRef.current(currentTime);
          }
          break;
        }
      }
    };
    
    channel.on('broadcast', { event: 'room_event' }, handleSyncEvent);
    
    // No cleanup that would allow re-registration — we track by channel identity
    return () => {
      // Only clear the ref if the channel is being replaced
      if (registeredChannelRef.current === channel) {
        registeredChannelRef.current = null;
      }
    };
  }, [channel]); // ONLY depend on channel — everything else is via refs

  // When player becomes ready, broadcast it
  useEffect(() => {
    if (!channel || !userId || !isPlayerReady) return;
    
    const state = playbackRef.current;
    if (state.status !== 'preparing') return;
    
    console.log('[SyncV2] Broadcasting player_ready');
    
    channel.send({
      type: 'broadcast',
      event: 'room_event',
      payload: {
        type: 'player_ready',
        payload: {
          readyUserId: userId,
        },
      },
    });
    
    // Update own state
    setPlaybackState(prev => ({
      ...prev,
      status: 'ready',
    }));
  }, [channel, userId, isPlayerReady]);

  return {
    playbackState,
    playerReadyStates,
    getTargetTime,
    prepareSong,
    forceStart,
    pause,
    resume,
    seek,
    endSong,
    reportBuffering,
    serverTimeOffset,
    isTimeCalibrated: isCalibrated,
    applyFullSyncPlayback,
  };
}
