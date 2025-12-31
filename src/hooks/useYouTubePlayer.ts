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
  const onEndedRef = useRef(onEnded);

  // Keep onEnded ref updated
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT) return;

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
  }, []);

  // Initialize player
  useEffect(() => {
    if (!videoId) return;
    
    // If player already exists and is ready, just load new video
    if (playerRef.current && isPlayerReady.current) {
      if (currentVideoIdRef.current !== videoId) {
        currentVideoIdRef.current = videoId;
        setHasEnded(false);
        setCurrentTime(0);
        // loadVideoById auto-plays the video
        playerRef.current.loadVideoById(videoId);
        setIsPlaying(true);
      }
      return;
    }

    // Don't create a new player if one is already being initialized
    if (playerRef.current) return;

    const initPlayer = () => {
      currentVideoIdRef.current = videoId;
      const newPlayer = new window.YT.Player(containerId, {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            isPlayerReady.current = true;
            setIsReady(true);
            setDuration(newPlayer.getDuration());
          },
          onStateChange: (event) => {
            const playing = event.data === window.YT.PlayerState.PLAYING;
            const ended = event.data === window.YT.PlayerState.ENDED;
            
            setIsPlaying(playing);
            setHasEnded(ended);

            // Avoid emitting a conflicting "isPlaying: false" update on ENDED.
            // Room-level logic decides whether to advance the queue or stop.
            if (!ended) {
              onStateChange?.(playing);
            }
            
            if (playing) {
              setDuration(newPlayer.getDuration());
            }
            
            // Trigger onEnded callback when video ends
            if (ended) {
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
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [containerId, videoId, onStateChange]);

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
