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
}

interface UseYouTubePlayerReturn {
  player: YouTubePlayer | null;
  isReady: boolean;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
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
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

export const useYouTubePlayer = (
  containerId: string,
  videoId: string | null,
  onStateChange?: (isPlaying: boolean) => void
): UseYouTubePlayerReturn => {
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const intervalRef = useRef<number>(0);

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

    const initPlayer = () => {
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
            setIsReady(true);
            setDuration(newPlayer.getDuration());
          },
          onStateChange: (event) => {
            const playing = event.data === window.YT.PlayerState.PLAYING;
            setIsPlaying(playing);
            onStateChange?.(playing);
            
            if (playing) {
              setDuration(newPlayer.getDuration());
            }
          },
        },
      });
      setPlayer(newPlayer);
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
    if (isPlaying && player) {
      intervalRef.current = window.setInterval(() => {
        setCurrentTime(player.getCurrentTime());
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
  }, [isPlaying, player]);

  // Load new video when videoId changes
  useEffect(() => {
    if (player && videoId && isReady) {
      player.loadVideoById(videoId);
    }
  }, [videoId, player, isReady]);

  const play = useCallback(() => {
    player?.playVideo();
  }, [player]);

  const pause = useCallback(() => {
    player?.pauseVideo();
  }, [player]);

  const seekTo = useCallback((seconds: number) => {
    player?.seekTo(seconds, true);
    setCurrentTime(seconds);
  }, [player]);

  const setVolume = useCallback((volume: number) => {
    player?.setVolume(volume);
  }, [player]);

  const mute = useCallback(() => {
    player?.mute();
    setIsMuted(true);
  }, [player]);

  const unmute = useCallback(() => {
    player?.unMute();
    setIsMuted(false);
  }, [player]);

  return {
    player,
    isReady,
    currentTime,
    duration,
    isPlaying,
    play,
    pause,
    seekTo,
    setVolume,
    mute,
    unmute,
    isMuted,
  };
};
