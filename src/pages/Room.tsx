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
import { LogOut, Maximize2, Minimize2, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { expectedPosition, shouldCorrect } from '@/lib/playbackClock';

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
    <div className="min-h-screen flex flex-col p-4 gap-4">
      <FloatingReactions reactions={reactions} />
      <header className="flex items-center justify-between">
        <RoomCodeDisplay code={code} />
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-neon-green' : 'bg-destructive'}`} />
          <span className="text-sm text-muted-foreground">{users.length} online</span>
          {users.length > 0 && (
            <UserAvatars
              size={28}
              maxVisible={6}
              overlap={40}
              users={avatarUsers}
            />
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
          <Button variant="ghost" size="icon" onClick={handleLeave}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-3 card-karaoke overflow-hidden flex flex-col min-h-0">
          <h3 className="font-semibold mb-3 text-primary">Queue</h3>
          <div className="mb-3">
            <SongSearch onAddSong={handleAddSong} userId={user.id} />
          </div>
          <div className="relative flex-1 min-h-0">
            <div className="absolute inset-0 overflow-y-auto pr-1">
              <SongQueue 
                queue={queue} 
                currentIndex={playbackState.currentSongIndex} 
                onRemove={handleRemoveSong} 
                onSelect={handleSelectSong}
                getLyricStatus={getStatusForSong}
              />
            </div>
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent" />
          </div>
        </div>

        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="card-karaoke aspect-video relative flex-1">
            <div ref={videoStageRef} className="karaoke-fullscreen-stage absolute inset-6 overflow-hidden rounded-lg bg-black">
              <div className="absolute inset-0 rounded-lg overflow-hidden" id="youtube-player-wrapper">
                {playerVideoId && <div id="youtube-player" className="w-full h-full" />}
              </div>
              {/* Blocks all YouTube chrome (channel header, pause overlay, share, end cards, branding) by preventing iframe interaction */}
              <div className="absolute inset-0 rounded-lg z-10" aria-hidden="true" />

              <Button
                variant="ghost"
                size="icon"
                onClick={handleVideoFullscreen}
                className="absolute right-3 top-3 z-30 h-9 w-9 rounded-full bg-background/70 text-foreground backdrop-blur hover:bg-background/90"
                title={isVideoFullscreen ? 'Exit fullscreen' : 'Watch fullscreen'}
                aria-label={isVideoFullscreen ? 'Exit video fullscreen' : 'Watch video fullscreen'}
              >
                {isVideoFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>

              {showCountdown && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                  <div className="rounded-2xl bg-card/70 backdrop-blur border border-border shadow-lg px-6 py-4">
                    <div className="text-6xl font-black text-primary tabular-nums text-center">
                      {remainingSeconds}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.3em] text-muted-foreground text-center">
                      seconds
                    </div>
                  </div>
                </div>
              )}

              {isVideoFullscreen && fullscreenLyric && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-5 pt-20 karaoke-fullscreen-lyrics">
                  <div className="max-w-5xl text-center text-2xl font-semibold leading-relaxed text-white md:text-4xl">
                    {fullscreenLyric}
                  </div>
                </div>
              )}

              {!currentSong && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-card/80 rounded-lg">
                  <p className="text-muted-foreground">Add songs to start!</p>
                </div>
              )}
              {role === 'remote' && currentSong && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-card/85 rounded-lg text-center px-4">
                  <Smartphone className="w-8 h-8 text-primary" />
                  <p className="text-muted-foreground">Remote mode - audio plays on the room's screen. Tap the screen icon above to play here.</p>
                </div>
              )}
            </div>
          </div>
          <div className="card-karaoke h-[160px] shrink-0">
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
        </div>

        <div className="lg:col-span-3 card-karaoke flex flex-col">
          <h3 className="font-semibold mb-4 text-primary">Now Playing</h3>
          {currentSong && (
            <div className="mb-4">
              <p className="font-medium truncate">{currentSong.title}</p>
              <p className="text-sm text-muted-foreground truncate">{currentSong.artist}</p>
            </div>
          )}
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

          <div className="mt-auto pt-4 flex flex-col gap-4">
            <ReactionBar onReact={sendReaction} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Room;
