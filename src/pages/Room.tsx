import React, { useState, useEffect, useCallback } from 'react';
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
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Room = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [volume, setVolume] = useState(80);
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
  } = useRoom(code || '', user);

  const currentSong = queue[playbackState.currentSongIndex];

  useEffect(() => {
    setVideoId(currentSong?.videoId || null);
  }, [currentSong?.videoId, setVideoId]);

  const { reactions, sendReaction } = useReactions(channel, user?.id || '');
  

  const handleStateChange = useCallback((isPlaying: boolean) => {
    updatePlayback({ isPlaying });
  }, [updatePlayback]);

  const handleVideoEnded = useCallback(() => {
    const nextIndex = playbackState.currentSongIndex + 1;
    if (nextIndex < queue.length) {
      updatePlayback({ currentSongIndex: nextIndex, currentTime: 0, isPlaying: true });
    } else {
      updatePlayback({ isPlaying: false });
    }
  }, [queue.length, playbackState.currentSongIndex, updatePlayback]);

  const { currentTime, duration, isPlaying, play, pause, seekTo, setVolume: setPlayerVolume, mute, unmute, isMuted, enableCaptions, disableCaptions, areCaptionsEnabled, hasCaptionsAvailable } = useYouTubePlayer('youtube-player', currentSong?.videoId || null, handleStateChange, handleVideoEnded);

  const remainingSeconds = duration > 0 ? Math.ceil(duration - currentTime) : null;
  const showCountdown = isPlaying && remainingSeconds !== null && remainingSeconds > 0 && remainingSeconds <= 5;

  const { getStatusForSong, getLyricsForSong } = useLyricsPreload(queue, playbackState.currentSongIndex);
  const preloadedLyrics = currentSong ? getLyricsForSong(currentSong.id) : undefined;

  const { lyrics, currentLineIndex, isLoading: lyricsLoading, error: lyricsError, offset: lyricsOffset, setOffset: setLyricsOffset } = useLyrics(
    currentSong?.artist || null,
    currentSong?.title || null,
    currentTime,
    preloadedLyrics
  );

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

  if (!user || !code) return null;

  return (
    <div className="min-h-screen flex flex-col p-4 gap-4">
      <FloatingReactions reactions={reactions} />
      <header className="flex items-center justify-between">
        <RoomCodeDisplay code={code} />
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-neon-green' : 'bg-destructive'}`} />
          <span className="text-sm text-muted-foreground">{users.length} online</span>
          <RoomSettings />
          <Button variant="ghost" size="icon" onClick={handleLeave}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-3 card-karaoke overflow-hidden flex flex-col">
          <h3 className="font-semibold mb-3 text-primary">Queue</h3>
          <div className="mb-3">
            <SongSearch onAddSong={handleAddSong} userId={user.id} />
          </div>
          <div className="flex-1 overflow-y-auto">
            <SongQueue 
              queue={queue} 
              currentIndex={playbackState.currentSongIndex} 
              onRemove={handleRemoveSong} 
              onSelect={handleSelectSong}
              getLyricStatus={getStatusForSong}
            />
          </div>
        </div>

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
          <div className="card-karaoke h-[160px] shrink-0">
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
            {users.length > 0 && (
              <div className="flex justify-center pt-2">
                <UserAvatars
                  size={40}
                  maxVisible={6}
                  users={users.map((u) => ({
                    id: u.id,
                    name: u.nickname,
                    image:
                      u.customAvatarNormal ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.avatarId || u.id)}`,
                  }))}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Room;
