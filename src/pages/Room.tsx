import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { User, Song, PlaybackState } from '@/types/karaoke';
import { useRoom } from '@/hooks/useRoom';
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';
import { useLyrics } from '@/hooks/useLyrics';
import { useLyricsPreload } from '@/hooks/useLyricsPreload';
import { useTheme } from '@/contexts/ThemeContext';
import { LyricsDisplay } from '@/components/LyricsDisplay';
import { SingLyrics } from '@/components/SingLyrics';
import { PlayerControls } from '@/components/PlayerControls';
import { SongQueue } from '@/components/SongQueue';
import { SongSearch } from '@/components/SongSearch';
import { UserAvatars } from '@/components/ui/user-avatars';
import { RoomCodeDisplay } from '@/components/RoomCodeDisplay';
import { RoomSettings } from '@/components/RoomSettings';
import { FloatingReactions, ReactionBar, ReactionPicker } from '@/components/Reactions';
import { useReactions } from '@/hooks/useReactions';
import { toast } from '@/hooks/use-toast';
import { Captions, ChevronUp, Ellipsis, ListMusic, Loader2, LogOut, Maximize2, Mic2, Minimize2, Monitor, PanelRight, Pause, Play, Plus, Settings, SkipBack, SkipForward, Smartphone, Subtitles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { expectedPosition, shouldCorrect } from '@/lib/playbackClock';
import { INITIAL_RIBBON_VISIBILITY, RIBBON_HIDE_DELAY_MS, peekPointerEnterPatch, ribbonTransitionDuration, shouldShowRibbon } from '@/lib/ribbonVisibility';
import { removeSongFromQueue } from '@/lib/queuePlayback';
import { StageBackground } from '@/components/StageBackground';
import { connectionStatus } from '@/lib/connectionStatus';
import { remoteJoinUrl, roleFromSearch } from '@/lib/remoteJoin';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ToastAction } from '@/components/ui/toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type StageMode = 'video' | 'sing';

const Room = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [volume, setVolume] = useState(80);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const videoStageRef = useRef<HTMLDivElement>(null);
  const livePlaybackRef = useRef<() => PlaybackState>(() => ({
    isPlaying: false,
    currentTime: 0,
    currentSongIndex: 0,
    lastUpdate: Date.now(),
  }));
  const getClockPlayback = useCallback(() => livePlaybackRef.current(), []);
  const initialRole = useMemo(() => roleFromSearch(location.search), [location.search]);
  const remoteUrl = useMemo(() => remoteJoinUrl(window.location.origin, code || ''), [code]);
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
  } = useRoom(code || '', user, getClockPlayback, initialRole);

  const currentSong = queue[playbackState.currentSongIndex];
  const status = connectionStatus(isConnected);
  const removeSong = useCallback((songId: string) => {
    const next = removeSongFromQueue(queue, playbackState.currentSongIndex, songId);
    if (!next) return;
    const removed = queue.find((song) => song.id === songId);
    const prevQueue = queue;
    const prevPlayback = playbackState;
    updateQueue(next.queue);
    updatePlayback(next.playback);
    toast({
      title: 'Removed from queue',
      description: removed?.title ?? 'Song removed',
      action: (
        <ToastAction
          altText="Undo remove"
          onClick={() => {
            updateQueue(prevQueue);
            updatePlayback(prevPlayback);
          }}
        >
          Undo
        </ToastAction>
      ),
    });
  }, [queue, playbackState, updatePlayback, updateQueue]);

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

  // YouTube refused to play this embed (101/150 owner-blocked, 100 missing, 2 bad id).
  // Skip past it so the party never stalls on a dead video.
  const handleUnplayable = useCallback((code: number) => {
    if (![2, 100, 101, 150].includes(code)) return;
    if (!isClock) return;
    toast({
      title: "Can't play that one here",
      description: `${currentSong?.title ?? 'That video'} blocks embedding. Skipping.`,
      variant: 'destructive',
    });
    if (currentSong) removeSong(currentSong.id);
  }, [currentSong, isClock, removeSong]);

  const playerVideoId = role === 'remote' ? null : (currentSong?.videoId || null);
  const { player, isReady, currentTime, duration, isPlaying, play, pause, seekTo, setVolume: setPlayerVolume, mute, unmute, isMuted, enableCaptions, disableCaptions, areCaptionsEnabled, hasCaptionsAvailable } = useYouTubePlayer('youtube-player', playerVideoId, handleStateChange, handleVideoEnded, handleUnplayable);
  const currentTimeRef = useRef(currentTime);
  livePlaybackRef.current = () => ({
    ...playbackState,
    currentTime: currentTimeRef.current,
    lastUpdate: Date.now(),
  });

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

  const [stageMode, setStageMode] = useState<StageMode>('video');
  const [utilitySheetOpen, setUtilitySheetOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'queue' | 'lyrics'>('queue');
  const [showStageLyrics, setShowStageLyrics] = useState(true);
  const [remoteSearchOpen, setRemoteSearchOpen] = useState(false);
  const [remoteLyricsOpen, setRemoteLyricsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isWideDesktop, setIsWideDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [ribbonIntent, setRibbonIntent] = useState(INITIAL_RIBBON_VISIBILITY);
  const [ribbonVisible, setRibbonVisible] = useState(false);
  const ribbonTimerRef = useRef<number | null>(null);
  const ribbonRef = useRef<HTMLElement>(null);
  const touchHandleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updateMotionPreference();
    mediaQuery.addEventListener('change', updateMotionPreference);
    return () => mediaQuery.removeEventListener('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const updateLayout = () => setIsWideDesktop(mediaQuery.matches);
    mediaQuery.addEventListener('change', updateLayout);
    updateLayout();
    return () => mediaQuery.removeEventListener('change', updateLayout);
  }, []);

  const ribbonRequested = shouldShowRibbon(ribbonIntent);
  useEffect(() => {
    if (ribbonTimerRef.current !== null) {
      window.clearTimeout(ribbonTimerRef.current);
      ribbonTimerRef.current = null;
    }

    if (ribbonRequested) {
      setRibbonVisible(true);
      return;
    }

    ribbonTimerRef.current = window.setTimeout(() => setRibbonVisible(false), RIBBON_HIDE_DELAY_MS);
    return () => {
      if (ribbonTimerRef.current !== null) {
        window.clearTimeout(ribbonTimerRef.current);
      }
    };
  }, [ribbonRequested]);

  useEffect(() => {
    if (!ribbonIntent.touchOpen) return;

    const handleOutsideTap = (event: PointerEvent) => {
      const target = event.target as Node;
      if (ribbonRef.current?.contains(target) || touchHandleRef.current?.contains(target)) return;
      setRibbonIntent((current) => ({ ...current, touchOpen: false }));
    };

    document.addEventListener('pointerdown', handleOutsideTap);
    return () => document.removeEventListener('pointerdown', handleOutsideTap);
  }, [ribbonIntent.touchOpen]);

  const setRibbonFlag = (key: keyof typeof ribbonIntent, value: boolean) => {
    setRibbonIntent((current) => ({ ...current, [key]: value }));
  };

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

  const handleSelectSong = (index: number) => {
    updatePlayback({ currentSongIndex: index, currentTime: 0, isPlaying: true });
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    setPlayerVolume(v);
  };

  const handleResync = useCallback(() => {
    requestSync();
    toast({ title: 'Syncing to the room…', description: 'Catching up to the current position.' });
  }, [requestSync]);

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

  const renderUtilityContent = () => (
    <div className="flex h-full flex-col bg-[hsl(var(--surface))]">
      {/* Search is always pinned to the top of the panel */}
      <div className="border-b border-white/10 p-4">
        <SongSearch onAddSong={handleAddSong} userId={user.id} resultsPlacement="inline" />
      </div>

      {/* Queue / Lyrics tabs */}
      <div className="flex items-center gap-1 px-3 pt-3">
        <Button
          variant="ghost"
          size="sm"
          className={cn('flex-1 rounded-full', sidebarTab === 'queue' ? 'bg-white/10 text-foreground' : 'text-muted-foreground')}
          onClick={() => setSidebarTab('queue')}
        >
          <ListMusic className="h-3.5 w-3.5" />
          Up Next
          <span className="ml-1 font-mono text-[11px] opacity-70">{queue.length}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn('flex-1 rounded-full', sidebarTab === 'lyrics' ? 'bg-white/10 text-foreground' : 'text-muted-foreground')}
          onClick={() => setSidebarTab('lyrics')}
        >
          <Captions className="h-3.5 w-3.5" />
          Lyrics
        </Button>
      </div>

      {sidebarTab === 'lyrics' ? (
        <div className="min-h-0 flex-1 p-4">
          <LyricsDisplay
            lyrics={lyrics}
            currentLineIndex={currentLineIndex}
            currentTime={effectiveTime}
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
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-karaoke">
          <SongQueue
            queue={queue}
            currentIndex={playbackState.currentSongIndex}
            onRemove={removeSong}
            onSelect={handleSelectSong}
            getLyricStatus={getStatusForSong}
          />
        </div>
      )}
    </div>
  );

  if (role === 'remote') {
    return (
      <div className="relative isolate min-h-screen overflow-y-auto bg-background">
        <StageBackground />
        {!isConnected && (
          <div
            role="status"
            className="fixed inset-x-0 top-16 z-50 flex items-center justify-center gap-2 bg-destructive/90 py-1.5 text-xs font-medium text-destructive-foreground"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />
            Reconnecting to the room…
          </div>
        )}
        <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-4">
          <header className="flex items-center justify-between border-b border-white/10 pb-3">
            <RoomCodeDisplay code={code} />
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn('h-1.5 w-1.5 rounded-full', status.tone === 'ok' ? 'bg-[hsl(var(--success))]' : 'bg-destructive')} aria-hidden="true" />
                {status.label} · {users.length}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full" aria-label="Open room menu">
                    <Ellipsis className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-xl border-white/10 bg-[hsl(var(--surface))]">
                  <DropdownMenuItem onSelect={() => setRole('player')} className="rounded-lg">
                    <Monitor className="mr-2 h-4 w-4" />
                    Play audio here
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setSettingsOpen(true)} className="rounded-lg">
                    <Settings className="mr-2 h-4 w-4" />
                    Room settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleLeave} className="rounded-lg text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Leave room
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <section className="flex items-center gap-3 border-b border-white/10 py-4">
            {currentSong ? (
              <>
                <img src={currentSong.thumbnail} alt="" className="h-14 w-20 rounded-md object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{currentSong.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{currentSong.artist}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Audio on stage screen</p>
                </div>
              </>
            ) : (
              <div className="py-2">
                <p className="text-sm font-medium text-foreground">Queue waiting.</p>
                <p className="mt-1 text-xs text-muted-foreground">Add first song below.</p>
              </div>
            )}
          </section>

          <section className="border-b border-white/10 py-4">
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
              onSync={handleResync}
              showVolume={false}
            />
          </section>

          <section className="flex items-center gap-2 border-b border-white/10 py-3">
            <Button variant="outline" className="h-11 flex-1 rounded-full" onClick={() => setRemoteSearchOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Song
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setRemoteLyricsOpen(true)} aria-label="Open lyrics">
              <Captions className="h-4 w-4" />
            </Button>
          </section>

          <section className="border-b border-white/10 py-3">
            <p className="mb-1 px-1 text-xs font-medium text-muted-foreground">Quick reactions</p>
            <ReactionBar onReact={sendReaction} />
          </section>

          <section className="min-h-0 flex-1 py-4">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-sm font-semibold">Up Next</p>
              <span className="font-mono text-xs text-muted-foreground">{queue.length}</span>
            </div>
            <SongQueue
              queue={queue}
              currentIndex={playbackState.currentSongIndex}
              onRemove={removeSong}
              onSelect={handleSelectSong}
              getLyricStatus={getStatusForSong}
            />
          </section>
        </div>

        <Sheet open={remoteSearchOpen} onOpenChange={setRemoteSearchOpen}>
          <SheetContent side="bottom" className="max-h-[84vh] border-white/10 bg-[hsl(var(--surface))] p-0 shadow-2xl">
            <SheetHeader className="px-4 pt-4 text-left">
              <SheetTitle>Add Song</SheetTitle>
              <SheetDescription>Search shared queue.</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 scrollbar-karaoke">
              <SongSearch onAddSong={handleAddSong} userId={user.id} resultsPlacement="inline" />
            </div>
          </SheetContent>
        </Sheet>

        <Sheet open={remoteLyricsOpen} onOpenChange={setRemoteLyricsOpen}>
          <SheetContent side="bottom" className="h-[78vh] border-white/10 bg-[hsl(var(--surface))] p-4 shadow-2xl">
            <SheetHeader className="mb-3 text-left">
              <SheetTitle>Lyrics</SheetTitle>
              <SheetDescription>Timed lyric tools.</SheetDescription>
            </SheetHeader>
            <LyricsDisplay
              lyrics={lyrics}
              currentLineIndex={currentLineIndex}
              currentTime={effectiveTime}
              isLoading={lyricsLoading}
              error={lyricsError}
              isSynced={lyricsSynced}
              source={lyricsSource}
              offset={lyricsOffset}
              onOffsetChange={setLyricsOffset}
              onSeek={handleSeek}
            />
          </SheetContent>
        </Sheet>

        <RoomSettings open={settingsOpen} onOpenChange={setSettingsOpen} showTrigger={false} />
        <FloatingReactions reactions={reactions} />
      </div>
    );
  }

  return (
    <div className="relative isolate h-screen overflow-hidden bg-background">
      <StageBackground />
      {!isConnected && (
        <div
          role="status"
          className="fixed inset-x-0 top-16 z-50 flex items-center justify-center gap-2 bg-destructive/90 py-1.5 text-xs font-medium text-destructive-foreground"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />
          Reconnecting to the room…
        </div>
      )}
      <FloatingReactions reactions={reactions} />

      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-background/95 px-3 sm:px-5">
        <RoomCodeDisplay code={code} />
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={cn('h-1.5 w-1.5 rounded-full', status.tone === 'ok' ? 'bg-[hsl(var(--success))]' : 'bg-destructive')}
              aria-hidden="true"
            />
            {status.label} · {users.length}
          </span>
          {users.length > 0 && (
            <div className="hidden sm:block">
              <UserAvatars size={26} maxVisible={5} overlap={36} users={avatarUsers} />
            </div>
          )}
          <Button variant="ghost" size="icon" className="rounded-full" onClick={handleVideoFullscreen} aria-label={isVideoFullscreen ? 'Exit fullscreen' : 'Watch fullscreen'}>
            {isVideoFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Open room menu">
                <Ellipsis className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl border-white/10 bg-[hsl(var(--surface))]">
              <DropdownMenuItem onSelect={() => setRole('remote')} className="rounded-lg">
                <Smartphone className="mr-2 h-4 w-4" />
                Use as remote
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSettingsOpen(true)} className="rounded-lg">
                <Settings className="mr-2 h-4 w-4" />
                Room settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleLeave} className="rounded-lg text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Leave room
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex h-full pt-16">
        <main className="flex min-w-0 flex-1 items-center justify-center px-3 pb-20 pt-3 sm:px-6 sm:pb-24">
          <div
            ref={videoStageRef}
            className="karaoke-fullscreen-stage relative aspect-video w-full max-w-[min(100vw,calc((100vh-7rem)*16/9))] overflow-hidden rounded-lg bg-black"
          >
            <div className="absolute inset-0 overflow-hidden rounded-lg" id="youtube-player-wrapper">
            </div>

            {currentSong && !isReady && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground motion-reduce:animate-none" />
              </div>
            )}

            {showCountdown && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                <div className="rounded-2xl bg-black/70 px-6 py-4">
                  <div
                    key={remainingSeconds}
                    className="animate-in zoom-in-50 fade-in text-center text-6xl font-semibold tabular-nums text-primary duration-300 ease-out motion-reduce:animate-none"
                  >
                    {remainingSeconds}
                  </div>
                </div>
              </div>
            )}

            {stageMode === 'video' && showStageLyrics && currentSong && lyricsLoading && !fullscreenLyric && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center bg-black/50 px-4 pb-6 pt-5">
                <span className="text-sm text-white/70">Finding lyrics…</span>
              </div>
            )}

            {stageMode === 'video' && showStageLyrics && fullscreenLyric && (
              <div className="karaoke-fullscreen-lyrics pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center bg-black/65 px-4 pb-7 pt-6">
                <div className="max-w-5xl text-center text-[clamp(1.5rem,3.5vw,2.75rem)] font-semibold leading-relaxed text-white">
                  {fullscreenLyric}
                </div>
              </div>
            )}

            {stageMode === 'sing' && currentSong && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75">
                <SingLyrics lyrics={lyricsSynced ? lyrics : []} currentLineIndex={currentLineIndex} currentTime={effectiveTime} />
              </div>
            )}

            {!currentSong && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-black px-6 text-center">
                <div className="flex items-center gap-5">
                  <div>
                    <p className="text-sm uppercase tracking-wide text-muted-foreground">Room code</p>
                    <p className="mt-1 font-mono text-5xl font-bold tracking-[0.3em] text-foreground">{code}</p>
                    <p className="mt-3 max-w-sm text-sm text-muted-foreground">
                      Friends scan QR or enter code, then add songs from their phone.
                    </p>
                  </div>
                  <div className="hidden rounded-xl bg-white p-2 sm:block">
                    <QRCodeSVG value={remoteUrl} size={116} title="Scan to join as remote" />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {isWideDesktop ? 'Or search for a song in the panel to start.' : 'Or tap the panel button to add a song.'}
                  </p>
                  <p className="mt-1 hidden text-xs text-muted-foreground sm:block">Scan QR to join as remote.</p>
                </div>
                <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={() => setRole('remote')}>
                  <Smartphone className="h-4 w-4" />
                  Use this phone as a remote
                </Button>
              </div>
            )}
          </div>
        </main>

        <aside className="hidden h-full w-96 shrink-0 border-l border-white/10 lg:block">
          {renderUtilityContent()}
        </aside>
      </div>

      <Sheet open={utilitySheetOpen} onOpenChange={setUtilitySheetOpen}>
        <SheetContent className="flex w-[min(92vw,30rem)] flex-col border-white/10 bg-[hsl(var(--surface))] p-0 shadow-2xl sm:max-w-md">
          <SheetTitle className="sr-only">Search, queue and lyrics</SheetTitle>
          <SheetDescription className="sr-only">Room queue, search, and lyric tools.</SheetDescription>
          {renderUtilityContent()}
        </SheetContent>
      </Sheet>

      {/* Persistent control peek: always-visible at rest so the controls are
          discoverable on a mouse-idle / TV screen; hovering or focusing it
          expands the full ribbon below. Fades out once the ribbon is showing. */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 hidden h-24 md:block lg:right-[24rem]"
        onPointerEnter={() => setRibbonIntent((current) => ({ ...current, ...peekPointerEnterPatch() }))}
      >
        <div
          className={cn(
            'absolute inset-x-2 bottom-3 mx-auto flex max-w-7xl items-center gap-3 rounded-2xl border border-white/10 bg-[hsl(var(--surface)/0.9)] px-3 py-2 shadow-xl transition-opacity ease-out sm:inset-x-4 lg:left-4 lg:right-4 lg:mx-0 lg:max-w-none',
            ribbonVisible ? 'pointer-events-none opacity-0' : 'opacity-100'
          )}
          style={{ transitionDuration: ribbonTransitionDuration(prefersReducedMotion) }}
        >
          {currentSong ? (
            <>
              <img src={currentSong.thumbnail} alt="" className="h-8 w-12 shrink-0 rounded object-cover" />
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{currentSong.title}</p>
            </>
          ) : (
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">Queue waiting.</p>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            onClick={handlePrevious}
            disabled={playbackState.currentSongIndex <= 0}
            aria-label="Previous song"
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            onClick={handlePlayPause}
            disabled={!currentSong}
            aria-label={effectiveIsPlaying ? 'Pause' : 'Play'}
          >
            {effectiveIsPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            onClick={handleNext}
            disabled={playbackState.currentSongIndex >= queue.length - 1}
            aria-label="Next song"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full text-muted-foreground"
            onClick={() => setRibbonFlag('touchOpen', true)}
            aria-label="Show full playback controls"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <button
        ref={touchHandleRef}
        type="button"
        onClick={() => setRibbonFlag('touchOpen', !ribbonIntent.touchOpen)}
        className="fixed bottom-2 left-1/2 z-50 h-1.5 w-12 -translate-x-1/2 rounded-full bg-white/40 md:hidden"
        aria-label={ribbonIntent.touchOpen ? 'Hide playback controls' : 'Show playback controls'}
      />

      <section
        ref={ribbonRef}
        onPointerEnter={() => setRibbonFlag('ribbonHovered', true)}
        onPointerLeave={() => setRibbonFlag('ribbonHovered', false)}
        onFocusCapture={() => setRibbonFlag('focusWithin', true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setRibbonFlag('focusWithin', false);
        }}
        className={cn(
          'fixed inset-x-2 bottom-3 z-40 mx-auto flex max-w-7xl flex-col gap-3 rounded-2xl border border-white/10 bg-[hsl(var(--surface)/0.97)] p-3 shadow-2xl transition-[opacity,transform] ease-out sm:inset-x-4 lg:left-4 lg:right-[25rem] lg:mx-0 lg:max-w-none lg:flex-row lg:items-center lg:p-4',
          ribbonVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
        )}
        style={{ transitionDuration: ribbonTransitionDuration(prefersReducedMotion) }}
      >
        <div className="min-w-0 lg:w-64">
          {currentSong ? (
            <div className="flex items-center gap-3">
              <img src={currentSong.thumbnail} alt="" className="h-11 w-16 rounded-md object-cover" />
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{currentSong.title}</p>
                <p className="truncate text-xs text-muted-foreground">{currentSong.artist}</p>
              </div>
            </div>
            ) : (
              <p className="text-sm text-muted-foreground">Queue waiting.</p>
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
            onSync={handleResync}
          />
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={cn('rounded-full hover:bg-transparent', stageMode === 'sing' ? 'text-primary hover:text-primary' : 'text-foreground hover:text-foreground')}
            onClick={() => setStageMode(stageMode === 'video' ? 'sing' : 'video')}
            aria-label={stageMode === 'video' ? 'Big lyrics (full-screen sing mode)' : 'Back to video'}
            aria-pressed={stageMode === 'sing'}
            title={stageMode === 'video' ? 'Big lyrics (full-screen sing mode)' : 'Back to video'}
          >
            <Mic2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('rounded-full hover:bg-transparent', showStageLyrics ? 'text-primary hover:text-primary' : 'text-muted-foreground hover:text-muted-foreground')}
            onClick={() => setShowStageLyrics((v) => !v)}
            aria-label={showStageLyrics ? 'Hide subtitles on video' : 'Show subtitles on video'}
            aria-pressed={showStageLyrics}
            title={showStageLyrics ? 'Subtitles on video (on)' : 'Subtitles on video (off)'}
          >
            <Subtitles className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full text-foreground hover:bg-transparent hover:text-foreground lg:hidden" onClick={() => setUtilitySheetOpen(true)} aria-label="Open search, queue and lyrics">
            <PanelRight className="h-4 w-4" />
          </Button>
          <ReactionPicker onReact={sendReaction} />
        </div>
      </section>

      <RoomSettings open={settingsOpen} onOpenChange={setSettingsOpen} showTrigger={false} />
    </div>
  );
};

export default Room;
