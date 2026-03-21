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
  
  // Keep callback refs updated
  useEffect(() => {
    getCurrentVideoTimeRef.current = getCurrentVideoTime;
    onSeekRequiredRef.current = onSeekRequired;
  }, [getCurrentVideoTime, onSeekRequired]);

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
        // Worker tick - perform drift correction
        // Use refs to avoid stale closure issues
        const state = playbackRef.current;
        if (state.status !== 'playing') return;
        
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
    
    if (playbackState.status === 'playing') {
      workerRef.current.postMessage({ 
        type: 'start', 
        intervalMs: SYNC_CORRECTION_INTERVAL_MS 
      });
    } else {
      workerRef.current.postMessage({ type: 'stop' });
    }
  }, [playbackState.status, isCalibrated]);

  /**
   * Calculate the target video time based on room clock.
   * Internal version that doesn't depend on getRoomTime callback
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
   * This triggers the ready check flow.
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
    
    // Broadcast prepare command
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
    
    const roomTime = getRoomTime();
    const startAtRoomTime = roomTime + delayMs; // Start in delayMs milliseconds
    
    console.log(`[SyncV2] Starting song in ${delayMs}ms (roomTime=${roomTime}, startAt=${startAtRoomTime})`);
    
    const newState: PlaybackState = {
      ...state,
      status: 'playing',
      startAtRoomTime,
      seekOffset: 0,
      isPlaying: true, // Legacy compat
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
    
    // Host also schedules own playback
    setTimeout(() => {
      onSeekRequired(0);
      onPlayRequired();
    }, delayMs);
  }, [channel, getRoomTime, onSeekRequired, onPlayRequired]);

  /**
   * Force start (skip ready check).
   */
  const forceStart = useCallback(() => {
    startSongInternal(1000); // 1 second countdown
  }, [startSongInternal]);

  /**
   * Pause playback.
   */
  const pause = useCallback(() => {
    if (!channel) return;
    
    const currentTime = getCurrentVideoTime();
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
  }, [channel, getCurrentVideoTime]);

  /**
   * Resume playback from paused state.
   */
  const resume = useCallback(() => {
    if (!channel) return;
    
    const state = playbackRef.current;
    const roomTime = getRoomTime();
    const delayMs = 1000; // 1 second to sync
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
    
    // Host also schedules own playback
    setTimeout(() => {
      onSeekRequired(state.seekOffset);
      onPlayRequired();
    }, delayMs);
  }, [channel, getRoomTime, onSeekRequired, onPlayRequired]);

  /**
   * Seek to specific time.
   */
  const seek = useCallback((time: number) => {
    if (!channel) return;
    
    const state = playbackRef.current;
    const roomTime = getRoomTime();
    
    console.log(`[SyncV2] Seeking to ${time}s`);
    
    // Calculate new startAtRoomTime so that getTargetTime() returns `time`
    const newState: PlaybackState = {
      ...state,
      seekOffset: time,
      startAtRoomTime: state.status === 'playing' ? roomTime : null,
      currentTime: time,
      lastUpdate: Date.now(),
    };
    
    setPlaybackState(newState);
    playbackRef.current = newState;
    
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
    
    // Apply locally immediately
    onSeekRequired(time);
  }, [channel, getRoomTime, onSeekRequired]);

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
          timestamp: getRoomTime(),
        },
      },
    });
  }, [channel, userId, getRoomTime]);

  /**
   * Apply full sync playback state from useRoom after validation.
   * This is the ONLY path for full_sync_response playback hydration.
   * useRoom validates requestId/dedup before calling this.
   */
  const applyFullSyncPlayback = useCallback((incomingState: PlaybackState) => {
    console.log('[SyncV2] applyFullSyncPlayback', { status: incomingState.status, isPlaying: incomingState.isPlaying, videoId: incomingState.videoId, startAtRoomTime: incomingState.startAtRoomTime, seekOffset: incomingState.seekOffset });
    
    // Handle preparing/ready phases (ready-check hydration for late joiners)
    if (incomingState.status === 'preparing' || incomingState.status === 'ready') {
      const newState: PlaybackState = { ...incomingState };
      setPlaybackState(newState);
      playbackRef.current = newState;
      
      if (incomingState.videoId) {
        console.log(`[SyncV2] Hydrating preparing/ready phase, cueing video: ${incomingState.videoId}`);
        onCueVideo(incomingState.videoId);
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
      
      if (incomingState.isPlaying && incomingState.startAtRoomTime) {
        const roomTime = getRoomTime();
        const elapsed = (roomTime - incomingState.startAtRoomTime) / 1000;
        const targetTime = Math.max(0, elapsed + (incomingState.seekOffset || 0));
        
        console.log(`[SyncV2] New joiner syncing to ${targetTime.toFixed(2)}s (elapsed=${elapsed.toFixed(2)}s)`);
        
        if (incomingState.videoId) {
          onCueVideo(incomingState.videoId);
        }
        
        setTimeout(() => {
          onSeekRequired(targetTime);
          onPlayRequired();
        }, 500);
      }
    }
  }, [getRoomTime, onCueVideo, onSeekRequired, onPlayRequired]);

  // Handle incoming sync events (all EXCEPT full_sync_response, which goes through applyFullSyncPlayback)
  useEffect(() => {
    if (!channel) return;
    
    const handleSyncEvent = ({ payload }: { payload: any }) => {
      const data = payload;
      
      switch (data.type) {
        // full_sync_response is NOT handled here — it goes through useRoom validation
        // then useRoom calls applyFullSyncPlayback after gating.
        
        case 'prepare_song': {
          const { videoId, songIndex } = data.payload;
          console.log('[SyncV2] Received prepare_song:', videoId);
          
          setPlaybackState(prev => ({
            ...prev,
            status: 'preparing',
            videoId,
            currentSongIndex: songIndex,
          }));
          
          onCueVideo(videoId);
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
          
          const roomTime = getRoomTime();
          const delayMs = startAtRoomTime - roomTime;
          
          if (delayMs > 50) {
            console.log(`[SyncV2] Scheduling playback in ${delayMs}ms`);
            setTimeout(() => {
              const targetTime = (Date.now() + serverTimeOffset - startAtRoomTime) / 1000 + (seekOffset || 0);
              onSeekRequired(Math.max(0, targetTime));
              onPlayRequired();
            }, delayMs);
          } else {
            const elapsed = (roomTime - startAtRoomTime) / 1000;
            const targetTime = Math.max(0, elapsed + (seekOffset || 0));
            console.log(`[SyncV2] Starting immediately at ${targetTime.toFixed(2)}s`);
            onSeekRequired(targetTime);
            onPlayRequired();
          }
          break;
        }
        
        case 'pause_song': {
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
          
          onPauseRequired();
          break;
        }
        
        case 'resume_song': {
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
          
          const roomTime = getRoomTime();
          const delayMs = startAtRoomTime - roomTime;
          
          if (delayMs > 50) {
            console.log(`[SyncV2] Scheduling resume in ${delayMs}ms`);
            setTimeout(() => {
              onSeekRequired(seekOffset);
              onPlayRequired();
            }, delayMs);
          } else {
            const elapsed = (roomTime - startAtRoomTime) / 1000;
            const targetTime = Math.max(0, elapsed + seekOffset);
            console.log(`[SyncV2] Resuming immediately at ${targetTime.toFixed(2)}s`);
            onSeekRequired(targetTime);
            onPlayRequired();
          }
          break;
        }
        
        case 'seek_song': {
          const { seekOffset, startAtRoomTime } = data.payload;
          console.log('[SyncV2] Received seek_song:', seekOffset);
          
          setPlaybackState(prev => ({
            ...prev,
            seekOffset,
            startAtRoomTime,
            currentTime: seekOffset,
            lastUpdate: Date.now(),
          }));
          
          onSeekRequired(seekOffset);
          break;
        }
        
        case 'end_song': {
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
          onSeekRequired(currentTime);
          break;
        }
      }
    };
    
    channel.on('broadcast', { event: 'room_event' }, handleSyncEvent);
    
    return () => {
      channel.off('broadcast', { event: 'room_event' }, handleSyncEvent);
    };
  }, [channel, onCueVideo, onPauseRequired, onSeekRequired, onPlayRequired, getRoomTime, serverTimeOffset]);

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

  // NOTE: Playback scheduling is now handled directly in event handlers (start_song, resume_song)
  // This ensures playback starts immediately when events are received, without relying on state changes

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
