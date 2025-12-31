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
  destroy: () => void;
  getPlayerState: () => number;
}

interface UseYouTubePlayerReturn {
  player: YouTubePlayer | null;
  isReady: boolean;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  hasEnded: boolean;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unmute: () => void;
  isMuted: boolean;
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
  onEnded?: () => void
): UseYouTubePlayerReturn => {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);

  const intervalRef = useRef<number>(0);
  const currentVideoIdRef = useRef<string | null>(null);
  const isPlayerReady = useRef(false);
  const isInitializing = useRef(false);
  const endedHandledRef = useRef(false);

  const onEndedRef = useRef(onEnded);
  const onStateChangeRef = useRef(onStateChange);

  // Keep refs updated
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT) return;

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
  }, []);

  const destroyPlayer = useCallback(() => {
    try {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = 0;
      }

      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }

      // Ensure no orphaned iframes keep playing
      const el = document.getElementById(containerId);
      if (el) el.innerHTML = '';

      isPlayerReady.current = false;
      isInitializing.current = false;
      currentVideoIdRef.current = null;
      endedHandledRef.current = false;
      setIsReady(false);
      setIsPlaying(false);
      setHasEnded(false);
      setCurrentTime(0);
      setDuration(0);
      setIsMuted(false);
    } catch {
      // best-effort cleanup
    }
  }, [containerId]);

  // Initialize player once per container
  useEffect(() => {
    if (!videoId) return; // need an initial videoId for construction
    if (playerRef.current || isInitializing.current) return;

    const initPlayer = () => {
      if (playerRef.current || isInitializing.current) return;
      isInitializing.current = true;

      currentVideoIdRef.current = videoId;
      endedHandledRef.current = false;

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
        },
        events: {
          onReady: (event: { target: YouTubePlayer }) => {
            isPlayerReady.current = true;
            isInitializing.current = false;
            setIsReady(true);
            setDuration(newPlayer.getDuration());
            event.target.playVideo();
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
              setDuration(newPlayer.getDuration());
            }

            if (ended && !endedHandledRef.current) {
              endedHandledRef.current = true;
              onEndedRef.current?.();
            }
          },
        },
      });

      playerRef.current = newPlayer;
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
  }, [containerId, destroyPlayer, videoId]);

  // Cleanup on unmount only (avoid destroying the player on every videoId change)
  useEffect(() => {
    return () => {
      destroyPlayer();
    };
  }, [destroyPlayer]);

  // Load/crossfade to new video IDs without recreating the player
  useEffect(() => {
    if (!videoId) return;
    if (!playerRef.current || !isPlayerReady.current) return;

    if (currentVideoIdRef.current !== videoId) {
      currentVideoIdRef.current = videoId;
      endedHandledRef.current = false;
      setHasEnded(false);
      setCurrentTime(0);
      playerRef.current.loadVideoById(videoId);
      setIsPlaying(true);
    }
  }, [videoId]);

  // Update current time periodically
  useEffect(() => {
    if (isPlaying && playerRef.current) {
      intervalRef.current = window.setInterval(() => {
        if (playerRef.current && isPlayerReady.current) {
          setCurrentTime(playerRef.current.getCurrentTime());
        }
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying]);

  const play = useCallback(() => {
    if (playerRef.current && isPlayerReady.current) {
      playerRef.current.playVideo();
    }
  }, []);

  const pause = useCallback(() => {
    if (playerRef.current && isPlayerReady.current) {
      playerRef.current.pauseVideo();
    }
  }, []);

  const seekTo = useCallback((seconds: number) => {
    if (playerRef.current && isPlayerReady.current) {
      playerRef.current.seekTo(seconds, true);
      setCurrentTime(seconds);
    }
  }, []);

  const setVolume = useCallback((volume: number) => {
    if (playerRef.current && isPlayerReady.current) {
      playerRef.current.setVolume(volume);
    }
  }, []);

  const mute = useCallback(() => {
    if (playerRef.current && isPlayerReady.current) {
      playerRef.current.mute();
      setIsMuted(true);
    }
  }, []);

  const unmute = useCallback(() => {
    if (playerRef.current && isPlayerReady.current) {
      playerRef.current.unMute();
      setIsMuted(false);
    }
  }, []);

  return {
    player: playerRef.current,
    isReady,
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
  };
};
