import { useState, useEffect, useRef, useCallback } from 'react';

interface YouTubePlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  loadVideoById: (videoId: string) => void;
  cueVideoById: (videoId: string) => void;
  destroy: () => void;
  getPlayerState: () => number;
  loadModule: (module: string) => void;
  setOption: (module: string, option: string, value: unknown) => void;
  getOption: (module: string, option: string) => unknown;
}

interface UseYouTubePlayerReturn {
  player: YouTubePlayer | null;
  isReady: boolean;
  isSafe: boolean;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  hasEnded: boolean;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  cueVideo: (videoId: string) => void;
  getCurrentTime: () => number;
  setVolume: (volume: number) => void;
  mute: () => void;
  unmute: () => void;
  isMuted: boolean;
  enableCaptions: () => void;
  disableCaptions: () => void;
  areCaptionsEnabled: boolean;
  hasCaptionsAvailable: boolean;
  error: YouTubeError | null;
  clearError: () => void;
}

export type YouTubeErrorCode = 2 | 5 | 100 | 101 | 150;

export interface YouTubeError {
  code: YouTubeErrorCode;
  message: string;
  isAgeRestricted: boolean;
  videoId: string;
}

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        config: {
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: () => void;
            onStateChange?: (event: { data: number }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YouTubePlayer;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

export const useYouTubePlayer = (
  containerId: string,
  videoId: string | null,
  onStateChange?: (isPlaying: boolean) => void,
  onEnded?: () => void,
  privacyMode: boolean = true
): UseYouTubePlayerReturn => {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const hostElementRef = useRef<HTMLElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSafe, setIsSafe] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [areCaptionsEnabled, setAreCaptionsEnabled] = useState(false);
  const [hasCaptionsAvailable, setHasCaptionsAvailable] = useState(false);
  const [error, setError] = useState<YouTubeError | null>(null);
  const intervalRef = useRef<number>(0);
  const currentVideoIdRef = useRef<string | null>(null);
  const isPlayerReady = useRef(false);
  const isInitializing = useRef(false);
  const endedHandledRef = useRef(false);
  const playerSafetyRef = useRef<{ safe: boolean; reason: string }>({
    safe: false,
    reason: 'uninitialized',
  });

  const onEndedRef = useRef(onEnded);
  const onStateChangeRef = useRef(onStateChange);

  const debugLog = useCallback((message: string, details?: unknown) => {
    if (!import.meta.env.DEV) return;
    if (details !== undefined) {
      console.log(`[YouTubePlayer] ${message}`, details);
    } else {
      console.log(`[YouTubePlayer] ${message}`);
    }
  }, []);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    if (window.YT) return;

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
  }, []);

  const evaluatePlayerSafety = useCallback(() => {
    const hostElement = hostElementRef.current ?? document.getElementById(containerId);
    if (hostElement && hostElementRef.current !== hostElement) {
      hostElementRef.current = hostElement;
    }

    const currentHost = document.getElementById(containerId);

    if (!playerRef.current) {
      return { safe: false, reason: 'no-player-instance', hostElement };
    }
    if (!isPlayerReady.current) {
      return { safe: false, reason: 'not-ready', hostElement };
    }
    if (!hostElement) {
      return { safe: false, reason: 'missing-host', hostElement };
    }
    if (!document.body.contains(hostElement) || !hostElement.isConnected) {
      return { safe: false, reason: 'host-detached', hostElement };
    }
    if (currentHost !== hostElement) {
      return { safe: false, reason: 'host-replaced', hostElement };
    }

    return { safe: true, reason: 'safe', hostElement };
  }, [containerId]);

  const syncPlayerSafety = useCallback((source: string) => {
    const result = evaluatePlayerSafety();
    setIsSafe(result.safe);

    if (
      result.safe !== playerSafetyRef.current.safe ||
      (!result.safe && result.reason !== playerSafetyRef.current.reason)
    ) {
      debugLog(
        result.safe
          ? `player safe (${source})`
          : `player unsafe (${source}): ${result.reason}`
      );
      playerSafetyRef.current = { safe: result.safe, reason: result.reason };
    }

    return result;
  }, [debugLog, evaluatePlayerSafety]);

  const withSafePlayer = useCallback(<T,>(callback: (player: YouTubePlayer) => T, fallback?: T) => {
    const safety = syncPlayerSafety('api-call');
    if (!safety.safe || !playerRef.current) return fallback;

    try {
      return callback(playerRef.current);
    } catch {
      return fallback;
    }
  }, [syncPlayerSafety]);

  const checkCaptionsAvailable = useCallback(() => {
    const safety = syncPlayerSafety('captions-check');
    if (!safety.safe || !playerRef.current) {
      setHasCaptionsAvailable(false);
      return;
    }

    try {
      playerRef.current.loadModule('captions');
      setTimeout(() => {
        const currentSafety = syncPlayerSafety('captions-tracklist');
        if (!currentSafety.safe || !playerRef.current) {
          setHasCaptionsAvailable(false);
          return;
        }
        try {
          const tracks = playerRef.current.getOption('captions', 'tracklist');
          setHasCaptionsAvailable(Array.isArray(tracks) && tracks.length > 0);
        } catch {
          setHasCaptionsAvailable(false);
        }
      }, 500);
    } catch {
      setHasCaptionsAvailable(false);
    }
  }, [syncPlayerSafety]);

  const destroyPlayer = useCallback(() => {
    try {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = 0;
      }

      if (playerRef.current) {
        debugLog('player destroyed');
        playerRef.current.destroy();
        playerRef.current = null;
      }

      const el = document.getElementById(containerId);
      if (el) el.innerHTML = '';

      hostElementRef.current = null;
      isPlayerReady.current = false;
      isInitializing.current = false;
      currentVideoIdRef.current = null;
      endedHandledRef.current = false;
      setIsReady(false);
      setIsSafe(false);
      playerSafetyRef.current = { safe: false, reason: 'destroyed' };
      setIsPlaying(false);
      setHasEnded(false);
      setCurrentTime(0);
      setDuration(0);
      setIsMuted(false);
      setAreCaptionsEnabled(false);
      setHasCaptionsAvailable(false);
    } catch {
      // best-effort cleanup
    }
  }, [containerId, debugLog]);

  useEffect(() => {
    if (!videoId) return;
    if (playerRef.current || isInitializing.current) return;

    const initPlayer = () => {
      if (playerRef.current || isInitializing.current) return;

      const hostElement = document.getElementById(containerId);
      if (!hostElement || !document.body.contains(hostElement)) {
        debugLog('player host missing during init');
        return;
      }

      hostElementRef.current = hostElement;
      debugLog('player host mounted');
      isInitializing.current = true;
      currentVideoIdRef.current = videoId;
      endedHandledRef.current = false;
      setIsSafe(false);

      const newPlayer = new window.YT.Player(containerId, {
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          loop: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          playsinline: 1,
          cc_load_policy: 0,
          ...(privacyMode && { origin: window.location.origin }),
          widget_referrer: window.location.origin,
        },
        events: {
          onReady: () => {
            isPlayerReady.current = true;
            isInitializing.current = false;
            setIsReady(true);
            setError(null);
            syncPlayerSafety('onReady');
            debugLog('player onReady');
            const nextDuration = withSafePlayer((player) => player.getDuration(), 0) ?? 0;
            setDuration(nextDuration);
            withSafePlayer((player) => player.playVideo());
            setTimeout(() => {
              checkCaptionsAvailable();
            }, 1500);
          },
          onStateChange: (event) => {
            const playing = event.data === window.YT.PlayerState.PLAYING;
            const ended = event.data === window.YT.PlayerState.ENDED;

            setIsPlaying(playing);
            setHasEnded(ended);

            if (!ended) {
              onStateChangeRef.current?.(playing);
            }

            if (playing) {
              const nextDuration = withSafePlayer((player) => player.getDuration(), duration) ?? duration;
              setDuration(nextDuration);
              setError(null);
            }

            if (ended && !endedHandledRef.current) {
              endedHandledRef.current = true;
              onEndedRef.current?.();
            }
          },
          onError: (event) => {
            const errorCode = event.data as YouTubeErrorCode;
            console.error(`YouTube Player Error: ${errorCode}`);

            const errorMessages: Record<number, string> = {
              2: 'Invalid video ID or parameters',
              5: 'HTML5 player error - the video cannot be played',
              100: 'Video not found - it may have been removed or set to private',
              101: 'This video is age-restricted and cannot be embedded',
              150: 'This video is age-restricted and cannot be embedded',
            };

            const isAgeRestricted = errorCode === 101 || errorCode === 150;

            setError({
              code: errorCode,
              message: errorMessages[errorCode] || `Unknown error (code: ${errorCode})`,
              isAgeRestricted,
              videoId: currentVideoIdRef.current || videoId || '',
            });
          },
        },
      });

      playerRef.current = newPlayer;
      debugLog('player initialized');
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        initPlayer();
      };
    }
  }, [checkCaptionsAvailable, containerId, debugLog, privacyMode, syncPlayerSafety, videoId, withSafePlayer, duration]);

  useEffect(() => {
    return () => {
      destroyPlayer();
    };
  }, [destroyPlayer]);

  useEffect(() => {
    const handleHostStateCheck = () => {
      requestAnimationFrame(() => {
        syncPlayerSafety('layout-change');
      });
    };

    window.addEventListener('resize', handleHostStateCheck);
    window.addEventListener('orientationchange', handleHostStateCheck);
    document.addEventListener('visibilitychange', handleHostStateCheck);

    return () => {
      window.removeEventListener('resize', handleHostStateCheck);
      window.removeEventListener('orientationchange', handleHostStateCheck);
      document.removeEventListener('visibilitychange', handleHostStateCheck);
    };
  }, [syncPlayerSafety]);

  useEffect(() => {
    if (!videoId) return;
    if (!playerRef.current || !isPlayerReady.current) return;

    if (currentVideoIdRef.current !== videoId) {
      currentVideoIdRef.current = videoId;
      endedHandledRef.current = false;
      setHasEnded(false);
      setCurrentTime(0);
      setAreCaptionsEnabled(false);
      setHasCaptionsAvailable(false);
      withSafePlayer((player) => player.loadVideoById(videoId));
      setIsPlaying(true);
      setTimeout(() => {
        checkCaptionsAvailable();
      }, 2000);
    }
  }, [videoId, checkCaptionsAvailable, withSafePlayer]);

  useEffect(() => {
    if (isPlaying && isSafe) {
      intervalRef.current = window.setInterval(() => {
        const nextTime = withSafePlayer((player) => player.getCurrentTime(), null);
        if (typeof nextTime === 'number') {
          setCurrentTime(nextTime);
        }
      }, 100);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = 0;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = 0;
      }
    };
  }, [isPlaying, isSafe, withSafePlayer]);

  const play = useCallback(() => {
    withSafePlayer((player) => player.playVideo());
  }, [withSafePlayer]);

  const pause = useCallback(() => {
    withSafePlayer((player) => player.pauseVideo());
  }, [withSafePlayer]);

  const seekTo = useCallback((seconds: number) => {
    const didSeek = withSafePlayer((player) => {
      player.seekTo(seconds, true);
      return true;
    }, false);
    if (didSeek) {
      setCurrentTime(seconds);
    }
  }, [withSafePlayer]);

  const cueVideo = useCallback((nextVideoId: string) => {
    if (currentVideoIdRef.current === nextVideoId) return;

    currentVideoIdRef.current = nextVideoId;
    endedHandledRef.current = false;
    setHasEnded(false);
    setCurrentTime(0);
    setAreCaptionsEnabled(false);
    setHasCaptionsAvailable(false);

    const cued = withSafePlayer((player) => {
      if ((player as any).cueVideoById) {
        (player as any).cueVideoById(nextVideoId);
      } else {
        player.loadVideoById(nextVideoId);
        setTimeout(() => {
          withSafePlayer((safePlayer) => safePlayer.pauseVideo());
        }, 100);
      }
      return true;
    }, false);

    if (!cued) {
      setIsPlaying(false);
    }
  }, [withSafePlayer]);

  const getCurrentTimeValue = useCallback(() => {
    return withSafePlayer((player) => player.getCurrentTime(), currentTime) ?? currentTime;
  }, [currentTime, withSafePlayer]);

  const setVolume = useCallback((volume: number) => {
    withSafePlayer((player) => player.setVolume(volume));
  }, [withSafePlayer]);

  const mute = useCallback(() => {
    const didMute = withSafePlayer((player) => {
      player.mute();
      return true;
    }, false);
    if (didMute) setIsMuted(true);
  }, [withSafePlayer]);

  const unmute = useCallback(() => {
    const didUnmute = withSafePlayer((player) => {
      player.unMute();
      return true;
    }, false);
    if (didUnmute) setIsMuted(false);
  }, [withSafePlayer]);

  const enableCaptions = useCallback(() => {
    const enabled = withSafePlayer((player) => {
      try {
        player.loadModule('captions');
        player.setOption('captions', 'track', { languageCode: 'en' });
        return true;
      } catch {
        try {
          player.loadModule('cc');
          return true;
        } catch {
          return false;
        }
      }
    }, false);

    if (enabled) {
      setAreCaptionsEnabled(true);
    }
  }, [withSafePlayer]);

  const disableCaptions = useCallback(() => {
    const disabled = withSafePlayer((player) => {
      try {
        player.setOption('captions', 'track', {});
        return true;
      } catch {
        return false;
      }
    }, false);

    if (disabled) {
      setAreCaptionsEnabled(false);
    }
  }, [withSafePlayer]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    player: playerRef.current,
    isReady,
    isSafe,
    currentTime,
    duration,
    isPlaying,
    hasEnded,
    play,
    pause,
    seekTo,
    setVolume,
    mute,
    unmute,
    isMuted,
    enableCaptions,
    disableCaptions,
    areCaptionsEnabled,
    hasCaptionsAvailable,
    error,
    clearError,
    cueVideo,
    getCurrentTime: getCurrentTimeValue,
  };
};
