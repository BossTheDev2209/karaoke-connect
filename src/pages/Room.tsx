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

  // Apply theme CSS variables
  useEffect(() => {
    const root = document.documentElement;
    
    if (theme === 'auto' && autoColors) {
      root.style.setProperty('--neon-pink', autoColors.primary);
      root.style.setProperty('--neon-purple', autoColors.secondary);
      root.style.setProperty('--neon-blue', autoColors.accent);
    } else if (theme !== 'auto') {
      const styles = themeStyles[theme];
      Object.entries(styles).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
    }

    return () => {
      root.style.removeProperty('--neon-pink');
      root.style.removeProperty('--neon-purple');
      root.style.removeProperty('--neon-blue');
    };
  }, [theme, autoColors]);

  // Reactions
  const { reactions, sendReaction } = useReactions(channel, user?.id || '');

  const handleStateChange = useCallback((isPlaying: boolean) => {
    updatePlayback({ isPlaying });
  }, [updatePlayback]);

  const { isReady, currentTime, duration, isPlaying, play, pause, seekTo, setVolume: setPlayerVolume, mute, unmute, isMuted } = useYouTubePlayer('youtube-player', currentSong?.videoId || null, handleStateChange);

  const { lyrics, currentLineIndex, isLoading: lyricsLoading, error: lyricsError } = useLyrics(
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
    const nextIndex = (playbackState.currentSongIndex + 1) % queue.length;
    updatePlayback({ currentSongIndex: nextIndex, currentTime: 0, isPlaying: true });
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

      {/* Main content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Queue panel */}
        <div className="lg:col-span-1 card-karaoke overflow-hidden flex flex-col">
          <h3 className="font-semibold mb-3 text-neon-purple">Queue</h3>
          <div className="mb-3">
            <SongSearch onAddSong={handleAddSong} userId={user.id} />
          </div>
          <div className="flex-1 overflow-y-auto">
            <SongQueue queue={queue} currentIndex={playbackState.currentSongIndex} onRemove={handleRemoveSong} onSelect={handleSelectSong} />
          </div>
        </div>

        {/* Video & Lyrics */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="card-karaoke aspect-video relative">
            <div id="youtube-player" className="w-full h-full rounded-lg overflow-hidden" />
            {!currentSong && (
              <div className="absolute inset-0 flex items-center justify-center bg-card/80 rounded-lg">
                <p className="text-muted-foreground">Add songs to start!</p>
              </div>
            )}
          </div>
          <div className="card-karaoke flex-1 min-h-[200px]">
            <LyricsDisplay lyrics={lyrics} currentLineIndex={currentLineIndex} currentTime={currentTime} isLoading={lyricsLoading} error={lyricsError} />
          </div>
        </div>

        {/* Controls panel */}
        <div className="lg:col-span-1 card-karaoke flex flex-col">
          <h3 className="font-semibold mb-4 text-neon-pink">Now Playing</h3>
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
            onPlayPause={handlePlayPause}
            onNext={handleNext}
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
