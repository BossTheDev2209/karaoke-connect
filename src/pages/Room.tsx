import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Song } from '@/types/karaoke';
import { useRoom } from '@/hooks/useRoom';
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';
import { useLyrics } from '@/hooks/useLyrics';
import { useLyricsPreload } from '@/hooks/useLyricsPreload';
import { useTheme } from '@/contexts/ThemeContext';
import { LyricsDisplay } from '@/components/LyricsDisplay';
import { PlayerControls } from '@/components/PlayerControls';
import { SongQueue } from '@/components/SongQueue';
import { SongSearch } from '@/components/SongSearch';
import { UserAvatars } from '@/components/ui/user-avatars';
import { RoomCodeDisplay } from '@/components/RoomCodeDisplay';
import { RoomSettings } from '@/components/RoomSettings';
import { ReactionBar, FloatingReactions, useReactions } from '@/components/Reactions';
import { Captions, ListMusic, LogOut, Maximize2, Minimize2, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { expectedPosition, shouldCorrect } from '@/lib/playbackClock';
import { StageBackground } from '@/components/StageBackground';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const Room = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [volume, setVolume] = useState(80);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const videoStageRef = useRef<HTMLDivElement>(null);
  const { setVideoId } = useTheme();

  useEffect(() => {
    const stored = sessionStorage.getItem('karaoke_user');
    if (stored) {
      setUser(JSON.parse(stored));
    } else {
      navigate('/');
    }
  }, [navigate]);

  const {
    users,
    queue,
    playbackState,
    isConnected,
    channel,
    updatePlayback,
    updateQueue,
    requestSync,
    role,
    setRole,
    isClock,
  } = useRoom(code || '', user);

  const currentSong = queue[playbackState.currentSongIndex];

  useEffect(() => {
    setVideoId(currentSong?.videoId || null);
  }, [currentSong?.videoId, setVideoId]);

  const { reactions, sendReaction } = useReactions(channel, user?.id || '');
  const avatarUsers = useMemo(
    () =>
      users.map((u) => ({
        id: u.id,
        name: u.nickname,
        image:
          u.customAvatarNormal ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.avatarId || u.id)}`,
      })),
    [users]
  );
  

  const handleStateChange = useCallback((playing: boolean) => {
    if (isClock) updatePlayback({ isPlaying: playing });
  }, [isClock, updatePlayback]);

  const handleVideoEnded = useCallback(() => {
    if (!isClock) return;
    const nextIndex = playbackState.currentSongIndex + 1;
    if (nextIndex < queue.length) {
      updatePlayback({ currentSongIndex: nextIndex, currentTime: 0, isPlaying: true });
    } else {
      updatePlayback({ isPlaying: false });
    }
  }, [isClock, queue.length, playbackState.currentSongIndex, updatePlayback]);

  const playerVideoId = role === 'remote' ? null : (currentSong?.videoId || null);
  const { player, isReady, currentTime, duration, isPlaying, play, pause, seekTo, setVolume: setPlayerVolume, mute, unmute, isMuted, enableCaptions, disableCaptions, areCaptionsEnabled, hasCaptionsAvailable } = useYouTubePlayer('youtube-player', playerVideoId, handleStateChange, handleVideoEnded);
  const currentTimeRef = useRef(currentTime);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // Remotes have no player; tick a local clock so lyrics + the scrubber advance.
  const [, setRemoteTick] = useState(0);
  useEffect(() => {
    if (role !== 'remote') return;
    const id = window.setInterval(() => setRemoteTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [role]);

  const effectiveTime = role === 'remote'
    ? expectedPosition(playbackState, Date.now())
    : currentTime;
  const effectiveIsPlaying = role === 'remote' ? playbackState.isPlaying : isPlaying;

  // Players follow shared play/pause, including clock commands sent by remotes.
  useEffect(() => {
    if (role === 'remote' || !isReady) return;
    if (playbackState.isPlaying && !isPlaying) play();
    if (!playbackState.isPlaying && isPlaying) pause();
  }, [role, isReady, playbackState.isPlaying, isPlaying, play, pause]);

  // Followers: seek back onto the shared timeline when drift is audible.
  useEffect(() => {
    if (isClock || role === 'remote' || !isReady || !playbackState.isPlaying) return;
    const id = window.setInterval(() => {
      const expected = expectedPosition(playbackState, Date.now());
      const local = player?.getCurrentTime?.() ?? currentTimeRef.current;
      const buffering = player?.getPlayerState?.() === window.YT?.PlayerState?.BUFFERING;
      if (!buffering && shouldCorrect(local, expected)) {
        seekTo(expected);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isClock, role, isReady, playbackState, player, seekTo]);

  // Clock: broadcast true position every 3s so followers re-anchor.
  useEffect(() => {
    if (!isClock || !isReady || !isPlaying) return;
    const id = window.setInterval(() => {
      updatePlayback({ currentTime: player?.getCurrentTime?.() ?? currentTimeRef.current, isPlaying: true });
    }, 3000);
    return () => clearInterval(id);
  }, [isClock, isReady, isPlaying, player, updatePlayback]);

  const remainingSeconds = duration > 0 ? Math.ceil(duration - currentTime) : null;
  const showCountdown = isPlaying && remainingSeconds !== null && remainingSeconds > 0 && remainingSeconds <= 5;

  const { getStatusForSong, getLyricsForSong } = useLyricsPreload(queue, playbackState.currentSongIndex);
  const preloadedLyrics = currentSong ? getLyricsForSong(currentSong.id) : undefined;

  const { lyrics, currentLineIndex, isLoading: lyricsLoading, error: lyricsError, offset: lyricsOffset, setOffset: setLyricsOffset, isSynced: lyricsSynced, source: lyricsSource } = useLyrics(
    currentSong?.artist || null,
    currentSong?.title || null,
    effectiveTime,
    preloadedLyrics
  );
  const fullscreenLyric = lyricsSynced && currentLineIndex >= 0
    ? lyrics[currentLineIndex]?.text
    : null;

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsVideoFullscreen(document.fullscreenElement === videoStageRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const [chromeVisible, setChromeVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const chromeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updateMotionPreference();
    mediaQuery.addEventListener('change', updateMotionPreference);
    return () => mediaQuery.removeEventListener('change', updateMotionPreference);
  }, []);

  const revealChrome = useCallback(() => {
    setChromeVisible(true);
    if (chromeTimerRef.current !== null) {
      window.clearTimeout(chromeTimerRef.current);
      chromeTimerRef.current = null;
    }
    if (!prefersReducedMotion) {
      chromeTimerRef.current = window.setTimeout(() => setChromeVisible(false), 3000);
    }
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) {
      setChromeVisible(true);
      return;
    }

    revealChrome();
    window.addEventListener('pointermove', revealChrome);
    window.addEventListener('pointerdown', revealChrome);
    return () => {
      window.removeEventListener('pointermove', revealChrome);
      window.removeEventListener('pointerdown', revealChrome);
      if (chromeTimerRef.current !== null) {
        window.clearTimeout(chromeTimerRef.current);
      }
    };
  }, [prefersReducedMotion, revealChrome]);

  const handlePlayPause = () => {
    if (effectiveIsPlaying) {
      pause();
      updatePlayback({ isPlaying: false, currentTime: effectiveTime });
    } else {
      play();
      updatePlayback({ isPlaying: true, currentTime: effectiveTime });
    }
  };

  const handleSeek = (time: number) => {
    seekTo(time);
    if (isClock || role === 'remote') {
      updatePlayback({ currentTime: time });
    }
  };

  const handleNext = () => {
    if (playbackState.currentSongIndex < queue.length - 1) {
      const nextIndex = playbackState.currentSongIndex + 1;
      updatePlayback({ currentSongIndex: nextIndex, currentTime: 0, isPlaying: true });
    }
  };

  const handlePrevious = () => {
    if (playbackState.currentSongIndex > 0) {
      const prevIndex = playbackState.currentSongIndex - 1;
      updatePlayback({ currentSongIndex: prevIndex, currentTime: 0, isPlaying: true });
    }
  };

  const handleAddSong = (song: Song) => {
    updateQueue([...queue, song]);
  };

  const handleRemoveSong = (songId: string) => {
    const removedIndex = queue.findIndex(s => s.id === songId);
    if (removedIndex === -1) return;
    const newQueue = queue.filter(s => s.id !== songId);
    updateQueue(newQueue);

    const currentIndex = playbackState.currentSongIndex;

    if (newQueue.length === 0) {
      // Nothing left — stop and reset
      updatePlayback({ currentSongIndex: 0, currentTime: 0, isPlaying: false });
      return;
    }

    if (removedIndex < currentIndex) {
      // Shift index down so we keep playing the same song
      updatePlayback({ currentSongIndex: currentIndex - 1 });
    } else if (removedIndex === currentIndex) {
      // Removed the currently playing song — advance to the song now at this index
      const nextIndex = Math.min(currentIndex, newQueue.length - 1);
      updatePlayback({ currentSongIndex: nextIndex, currentTime: 0, isPlaying: true });
    }
  };

  const handleSelectSong = (index: number) => {
    updatePlayback({ currentSongIndex: index, currentTime: 0, isPlaying: true });
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    setPlayerVolume(v);
  };

  const handleLeave = () => {
    sessionStorage.removeItem('karaoke_user');
    navigate('/');
  };

  const handleVideoFullscreen = async () => {
    const stage = videoStageRef.current;
    if (!stage) return;

    if (document.fullscreenElement === stage) {
      await document.exitFullscreen();
      return;
    }

    await stage.requestFullscreen();
  };

  if (!user || !code) return null;

  return (
    <div className="relative isolate h-screen overflow-hidden" onPointerMove={revealChrome}>
      <StageBackground />
      <FloatingReactions reactions={reactions} />

      <header
        className={cn(
          'fixed inset-x-3 top-3 z-40 flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[hsl(var(--border)/0.6)] bg-[hsl(var(--surface)/0.4)] px-3 py-2 backdrop-blur-xl transition-[opacity,transform] duration-200 ease-out sm:inset-x-4',
          chromeVisible ? 'translate-y-0 opacity-100' : '-translate-y-3 pointer-events-none opacity-0'
        )}
      >
        <RoomCodeDisplay code={code} />
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            <span
              className={cn('h-2 w-2 rounded-full', isConnected ? 'bg-[hsl(var(--success))]' : 'bg-destructive')}
              aria-hidden="true"
            />
            <span className="text-sm text-muted-foreground">{users.length} online</span>
          </div>
          {users.length > 0 && (
            <div className="hidden sm:block">
              <UserAvatars
                size={28}
                maxVisible={6}
                overlap={40}
                users={avatarUsers}
              />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setRole(role === 'remote' ? 'player' : 'remote')}
            title={role === 'remote' ? 'Remote (control only) - tap to play audio here' : 'Player (audio on) - tap to use as remote'}
            aria-label="Toggle device role"
          >
            {role === 'remote' ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
          </Button>
          <RoomSettings />
          <Button variant="ghost" size="icon" onClick={handleLeave} aria-label="Leave room">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="secondary"
            size="icon"
            className="fixed left-0 top-1/2 z-40 -translate-y-1/2 rounded-l-none rounded-r-xl border-l-0 bg-[hsl(var(--surface)/0.75)] backdrop-blur-xl"
            aria-label="Open queue and search"
            title="Open queue and search"
          >
            <ListMusic className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="flex w-[min(92vw,30rem)] flex-col border-[hsl(var(--border)/0.7)] bg-[hsl(var(--surface)/0.82)] p-0 shadow-none backdrop-blur-2xl sm:max-w-md"
        >
          <SheetHeader className="border-b border-border/60 px-6 py-5 text-left">
            <SheetTitle className="font-display text-2xl">Queue</SheetTitle>
            <SheetDescription>Search songs and shape next set.</SheetDescription>
          </SheetHeader>
          <div className="border-b border-border/60 p-4">
            <SongSearch onAddSong={handleAddSong} userId={user.id} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-karaoke">
            <SongQueue
              queue={queue}
              currentIndex={playbackState.currentSongIndex}
              onRemove={handleRemoveSong}
              onSelect={handleSelectSong}
              getLyricStatus={getStatusForSong}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="secondary"
            size="icon"
            className="fixed right-0 top-1/2 z-40 -translate-y-1/2 rounded-l-xl rounded-r-none border-r-0 bg-[hsl(var(--surface)/0.75)] backdrop-blur-xl"
            aria-label="Open lyric tools"
            title="Open lyric tools"
          >
            <Captions className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          className="flex w-[min(92vw,30rem)] flex-col border-[hsl(var(--border)/0.7)] bg-[hsl(var(--surface)/0.82)] p-0 shadow-none backdrop-blur-2xl sm:max-w-md"
        >
          <SheetHeader className="border-b border-border/60 px-6 py-5 text-left">
            <SheetTitle className="font-display text-2xl">Lyrics</SheetTitle>
            <SheetDescription>Read, seek, offset, and tune captions.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 p-4">
            <LyricsDisplay 
              lyrics={lyrics} 
              currentLineIndex={currentLineIndex} 
              currentTime={currentTime} 
              isLoading={lyricsLoading} 
              error={lyricsError}
              isSynced={lyricsSynced}
              source={lyricsSource}
              offset={lyricsOffset}
              onOffsetChange={setLyricsOffset}
              onSeek={handleSeek}
              areCaptionsEnabled={areCaptionsEnabled}
              hasCaptionsAvailable={hasCaptionsAvailable}
              onEnableCaptions={enableCaptions}
              onDisableCaptions={disableCaptions}
            />
          </div>
        </SheetContent>
      </Sheet>

      <main className="flex h-full items-center justify-center px-3 py-20 sm:px-8 sm:py-24">
        <div
          ref={videoStageRef}
          className="karaoke-fullscreen-stage relative aspect-video w-full max-w-[min(100vw,calc((100vh-8rem)*16/9))] overflow-hidden rounded-[var(--radius)] border border-border/60 bg-black"
        >
          <div className="absolute inset-0 overflow-hidden rounded-[var(--radius)]" id="youtube-player-wrapper">
            {playerVideoId && <div id="youtube-player" className="w-full h-full" />}
          </div>
          {/* Blocks all YouTube chrome (channel header, pause overlay, share, end cards, branding) by preventing iframe interaction */}
          <div className="absolute inset-0 z-10 rounded-[var(--radius)]" aria-hidden="true" />

          <Button
            variant="ghost"
            size="icon"
            onClick={handleVideoFullscreen}
            className="absolute right-3 top-3 z-30 rounded-full bg-background/70 text-foreground backdrop-blur hover:bg-background/90"
            title={isVideoFullscreen ? 'Exit fullscreen' : 'Watch fullscreen'}
            aria-label={isVideoFullscreen ? 'Exit video fullscreen' : 'Watch video fullscreen'}
          >
            {isVideoFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

          {showCountdown && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <div className="rounded-[var(--radius)] border border-border/70 bg-[hsl(var(--surface)/0.75)] px-6 py-4 backdrop-blur-xl">
                <div className="text-center font-display text-6xl font-bold tabular-nums text-primary">
                  {remainingSeconds}
                </div>
                <div className="mt-1 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  seconds
                </div>
              </div>
            </div>
          )}

          {fullscreenLyric && (
            <div className="karaoke-fullscreen-lyrics pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-black/90 via-black/45 to-transparent px-4 pb-8 pt-28">
              <div className="max-w-5xl text-center font-sans text-[clamp(1.5rem,3.5vw,2.75rem)] font-semibold leading-relaxed text-white">
                {fullscreenLyric}
              </div>
            </div>
          )}

          {!currentSong && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[var(--radius)] bg-card/80">
              <p className="text-muted-foreground">Open queue to add songs.</p>
            </div>
          )}
          {role === 'remote' && currentSong && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-[var(--radius)] bg-card/85 px-4 text-center">
              <Smartphone className="w-8 h-8 text-primary" />
              <p className="max-w-md text-muted-foreground">Remote mode - audio plays on the room's screen. Tap the screen icon above to play here.</p>
            </div>
          )}
        </div>
      </main>

      <section
        className={cn(
          'fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-7xl flex-col gap-3 rounded-[var(--radius)] border border-[hsl(var(--border)/0.6)] bg-[hsl(var(--surface)/0.62)] p-3 backdrop-blur-xl transition-[opacity,transform] duration-200 ease-out sm:inset-x-4 lg:flex-row lg:items-center lg:p-4',
          chromeVisible ? 'translate-y-0 opacity-100' : 'translate-y-3 pointer-events-none opacity-0'
        )}
      >
        <div className="min-w-0 lg:w-64">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Now playing</p>
          {currentSong ? (
            <div className="mt-1 min-w-0">
              <p className="truncate font-medium text-foreground">{currentSong.title}</p>
              <p className="truncate text-sm text-muted-foreground">{currentSong.artist}</p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Queue waiting.</p>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <PlayerControls
            isPlaying={effectiveIsPlaying}
            isMuted={isMuted}
            volume={volume}
            currentTime={effectiveTime}
            duration={duration}
            canGoPrevious={playbackState.currentSongIndex > 0}
            canGoNext={playbackState.currentSongIndex < queue.length - 1}
            onPlayPause={handlePlayPause}
            onNext={handleNext}
            onPrevious={handlePrevious}
            onSeek={handleSeek}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={isMuted ? unmute : mute}
            onSync={requestSync}
          />
        </div>
        <div className="shrink-0 overflow-x-auto">
          <ReactionBar onReact={sendReaction} />
        </div>
      </section>
    </div>
  );
};

export default Room;
