import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Song } from '@/types/karaoke';
import { useRoom } from '@/hooks/useRoom';
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';
import { useLyrics } from '@/hooks/useLyrics';
import { useMicrophone } from '@/hooks/useMicrophone';
import { useThemeFromThumbnail } from '@/hooks/useThemeFromThumbnail';
import { LyricsDisplay } from '@/components/LyricsDisplay';
import { PlayerControls } from '@/components/PlayerControls';
import { SongQueue } from '@/components/SongQueue';
import { SongSearch } from '@/components/SongSearch';
import { UserAvatarRow } from '@/components/UserAvatarRow';
import { RoomCodeDisplay } from '@/components/RoomCodeDisplay';
import { RoomThemePicker, RoomTheme, themeStyles } from '@/components/RoomThemePicker';
import { CelebrationOverlay, getCurrentCelebration } from '@/components/effects/CelebrationOverlay';
import { ReactionBar, FloatingReactions, useReactions } from '@/components/Reactions';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Room = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [volume, setVolume] = useState(80);
  const [theme, setTheme] = useState<RoomTheme>('neon');
  const [celebration] = useState(getCurrentCelebration());

  useEffect(() => {
    const stored = sessionStorage.getItem('karaoke_user');
    if (stored) {
      setUser(JSON.parse(stored));
    } else {
      navigate('/');
    }
  }, [navigate]);

  const { users, queue, playbackState, isConnected, channel, updatePlayback, updateQueue, updateSpeaking, requestSync } = useRoom(code || '', user);
  
  const currentSong = queue[playbackState.currentSongIndex];
  
  // Auto theme from thumbnail
  const autoColors = useThemeFromThumbnail(currentSong?.videoId || null, theme === 'auto');

  // Apply theme CSS variables - update ALL theme colors including computed gradients/shadows
  useEffect(() => {
    const root = document.documentElement;
    
    // All theme-related CSS variables that should be updated
    const themeVars = [
      '--neon-pink', '--neon-purple', '--neon-blue',
      '--primary', '--secondary', '--accent', '--ring',
      '--gradient-neon', '--gradient-glow', '--shadow-neon', '--shadow-glow'
    ];
    
    const applyTheme = (pink: string, purple: string, blue: string) => {
      root.style.setProperty('--neon-pink', pink);
      root.style.setProperty('--neon-purple', purple);
      root.style.setProperty('--neon-blue', blue);
      root.style.setProperty('--primary', purple);
      root.style.setProperty('--secondary', blue);
      root.style.setProperty('--accent', pink);
      root.style.setProperty('--ring', purple);
      
      // Update computed gradient/shadow values
      root.style.setProperty('--gradient-neon', `linear-gradient(135deg, hsl(${purple}), hsl(${pink}), hsl(${blue}))`);
      root.style.setProperty('--gradient-glow', `radial-gradient(ellipse at center, hsl(${purple} / 0.3), transparent 70%)`);
      root.style.setProperty('--shadow-neon', `0 0 20px hsl(${purple} / 0.5), 0 0 40px hsl(${pink} / 0.3)`);
      root.style.setProperty('--shadow-glow', `0 4px 30px hsl(${purple} / 0.4)`);
    };
    
    if (theme === 'auto' && autoColors) {
      applyTheme(autoColors.primary, autoColors.secondary, autoColors.accent);
    } else if (theme !== 'auto') {
      const styles = themeStyles[theme];
      applyTheme(styles['--neon-pink'], styles['--neon-purple'], styles['--neon-blue']);
    }

    return () => {
      // Reset all theme variables on unmount
      themeVars.forEach(v => root.style.removeProperty(v));
    };
  }, [theme, autoColors]);

  // Reactions
  const { reactions, sendReaction } = useReactions(channel, user?.id || '');

  const handleStateChange = useCallback((isPlaying: boolean) => {
    updatePlayback({ isPlaying });
  }, [updatePlayback]);

  // Auto-play next song when current ends (no looping)
  const handleVideoEnded = useCallback(() => {
    const nextIndex = playbackState.currentSongIndex + 1;
    if (nextIndex < queue.length) {
      updatePlayback({ currentSongIndex: nextIndex, currentTime: 0, isPlaying: true });
    } else {
      // End of queue - stop playing
      updatePlayback({ isPlaying: false });
    }
  }, [queue.length, playbackState.currentSongIndex, updatePlayback]);

  const { isReady, currentTime, duration, isPlaying, play, pause, seekTo, setVolume: setPlayerVolume, mute, unmute, isMuted, enableCaptions, disableCaptions, areCaptionsEnabled, hasCaptionsAvailable } = useYouTubePlayer('youtube-player', currentSong?.videoId || null, handleStateChange, handleVideoEnded);

  const remainingSeconds = duration > 0 ? Math.ceil(duration - currentTime) : null;
  const showCountdown = isPlaying && remainingSeconds !== null && remainingSeconds > 0 && remainingSeconds <= 5;

  const { lyrics, currentLineIndex, isLoading: lyricsLoading, error: lyricsError, offset: lyricsOffset, setOffset: setLyricsOffset } = useLyrics(
    currentSong?.artist || null,
    currentSong?.title || null,
    currentTime
  );

  const handleSpeakingChange = useCallback((isSpeaking: boolean) => {
    updateSpeaking(isSpeaking);
  }, [updateSpeaking]);

  const { isEnabled: isMicEnabled, toggleMic } = useMicrophone(handleSpeakingChange);

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
      updatePlayback({ isPlaying: false, currentTime });
    } else {
      play();
      updatePlayback({ isPlaying: true, currentTime });
    }
  };

  const handleSeek = (time: number) => {
    seekTo(time);
    updatePlayback({ currentTime: time });
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
    updateQueue(queue.filter(s => s.id !== songId));
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

  if (!user || !code) return null;

  return (
    <div className="min-h-screen flex flex-col p-4 gap-4">
      {/* Celebration effects */}
      <CelebrationOverlay theme={celebration} />
      
      {/* Floating reactions */}
      <FloatingReactions reactions={reactions} />

      {/* Header */}
      <header className="flex items-center justify-between">
        <RoomCodeDisplay code={code} />
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-neon-green' : 'bg-destructive'}`} />
          <span className="text-sm text-muted-foreground">{users.length} online</span>
          <RoomThemePicker currentTheme={theme} onThemeChange={setTheme} />
          <Button variant="ghost" size="icon" onClick={handleLeave}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main content - Video takes priority */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Queue panel */}
        <div className="lg:col-span-3 card-karaoke overflow-hidden flex flex-col">
          <h3 className="font-semibold mb-3 text-primary">Queue</h3>
          <div className="mb-3">
            <SongSearch onAddSong={handleAddSong} userId={user.id} />
          </div>
          <div className="flex-1 overflow-y-auto">
            <SongQueue queue={queue} currentIndex={playbackState.currentSongIndex} onRemove={handleRemoveSong} onSelect={handleSelectSong} />
          </div>
        </div>

        {/* Video & Lyrics - Main focus */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="card-karaoke aspect-video relative flex-1">
            <div id="youtube-player" className="w-full h-full rounded-lg overflow-hidden" />

            {showCountdown && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
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

            {!currentSong && (
              <div className="absolute inset-0 flex items-center justify-center bg-card/80 rounded-lg">
                <p className="text-muted-foreground">Add songs to start!</p>
              </div>
            )}
          </div>
          <div className="card-karaoke h-[100px] shrink-0">
            <LyricsDisplay 
              lyrics={lyrics} 
              currentLineIndex={currentLineIndex} 
              currentTime={currentTime} 
              isLoading={lyricsLoading} 
              error={lyricsError}
              offset={lyricsOffset}
              onOffsetChange={setLyricsOffset}
              areCaptionsEnabled={areCaptionsEnabled}
              hasCaptionsAvailable={hasCaptionsAvailable}
              onEnableCaptions={enableCaptions}
              onDisableCaptions={disableCaptions}
            />
          </div>
        </div>

        {/* Controls panel */}
        <div className="lg:col-span-3 card-karaoke flex flex-col">
          <h3 className="font-semibold mb-4 text-primary">Now Playing</h3>
          {currentSong && (
            <div className="mb-4">
              <p className="font-medium truncate">{currentSong.title}</p>
              <p className="text-sm text-muted-foreground truncate">{currentSong.artist}</p>
            </div>
          )}
          <PlayerControls
            isPlaying={isPlaying}
            isMuted={isMuted}
            volume={volume}
            currentTime={currentTime}
            duration={duration}
            isMicEnabled={isMicEnabled}
            canGoPrevious={playbackState.currentSongIndex > 0}
            canGoNext={playbackState.currentSongIndex < queue.length - 1}
            onPlayPause={handlePlayPause}
            onNext={handleNext}
            onPrevious={handlePrevious}
            onSeek={handleSeek}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={isMuted ? unmute : mute}
            onMicToggle={toggleMic}
            onSync={requestSync}
          />
          
          {/* Reactions */}
          <div className="mt-auto pt-4">
            <ReactionBar onReact={sendReaction} />
          </div>
        </div>
      </div>

      {/* User avatars */}
      <UserAvatarRow users={users} currentUserId={user.id} />
    </div>
  );
};

export default Room;
