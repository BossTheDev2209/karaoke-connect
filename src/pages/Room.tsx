import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, RoomMode, BattleFormat, Song } from '@/types/karaoke';
import { useRoom } from '@/hooks/useRoom';
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';
import { useLyrics } from '@/hooks/useLyrics';
import { useLyricsPreload } from '@/hooks/useLyricsPreload';
import { useMicrophone } from '@/hooks/useMicrophone';

import { useTheme } from '@/contexts/ThemeContext';
import { LyricsDisplay } from '@/components/LyricsDisplay';
import { PlayerControls } from '@/components/PlayerControls';
import { SongQueue } from '@/components/SongQueue';
import { SongSearch } from '@/components/SongSearch';
import { UserAvatarRow } from '@/components/UserAvatarRow';
import { RoomCodeDisplay } from '@/components/RoomCodeDisplay';
import { RoomSettings } from '@/components/RoomSettings';
import { CelebrationOverlay, getCurrentCelebration } from '@/components/effects/CelebrationOverlay';
import { ReactionBar, FloatingReactions, useReactions, useWaving } from '@/components/Reactions';
import { SingReactOverlay } from '@/components/effects/SingReactOverlay';
import { DustFallEffect } from '@/components/effects/SingerEffects';
import { useAudioReactive } from '@/hooks/useAudioReactive';
import { useVoteKick, VoteKickOverlay } from '@/components/VoteKick';
import { VotingPanel } from '@/components/VotingPanel';
import { SyncLockOverlay, useSyncLock } from '@/components/SyncLockOverlay';

import { LogOut, Swords, Mic2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const Room = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [volume, setVolume] = useState(80);
  const [celebration] = useState(getCurrentCelebration());
  const [celebrationEnabled, setCelebrationEnabled] = useState(true);
  const [userVolumes, setUserVolumes] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('karaoke_user_volumes');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('karaoke_user_volumes', JSON.stringify(userVolumes));
  }, [userVolumes]);

  const handleUserVolumeChange = (userId: string, volume: number) => {
    setUserVolumes(prev => ({ ...prev, [userId]: volume }));
  };

  const [eqSettings, setEqSettings] = useState<number[]>(() => {
    const saved = localStorage.getItem('karaoke_eq_custom');
    return saved ? JSON.parse(saved) : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  });
  
  // Theme context
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
    roomMode,
    battleFormat,
    isConnected,
    isHost,
    channel, 
    updatePlayback, 
    updateQueue, 
    updateSpeaking,
    updateMicStatus,
    updateMode,
    updateTeams,
    requestSync,
    seek, // Destructure new seek function
    networkLatency,
    clockOffset
  } = useRoom(code || '', user);

  const currentSong = queue[playbackState.currentSongIndex];
  
  // Update theme context with current video ID for auto-theme
  useEffect(() => {
    setVideoId(currentSong?.videoId || null);
  }, [currentSong?.videoId, setVideoId]);

  // Reactions and waving
  const { reactions, sendReaction } = useReactions(channel, user?.id || '');
  const { isWaving, toggleWaving, wavingUsers } = useWaving(channel, user?.id || '');
  
  // Vote kick
  const handleUserKicked = useCallback(() => {
    sessionStorage.removeItem('karaoke_user');
    navigate('/');
  }, [navigate]);
  
  const { activeVoteKick, startVoteKick, voteYes, voteNo, hasVoted } = useVoteKick(
    channel,
    user?.id || '',
    users,
    handleUserKicked
  );

  // Prevent feedback loops when we apply remote playback updates to the local player
  const applyingRemoteRef = useRef(false);
  const markApplyingRemote = useCallback(() => {
    applyingRemoteRef.current = true;
    window.setTimeout(() => {
      applyingRemoteRef.current = false;
    }, 300);
  }, []);

  // When the current video changes (often driven by remote sync), suppress transient player events
  useEffect(() => {
    if (!currentSong?.videoId) return;
    markApplyingRemote();
  }, [currentSong?.videoId, markApplyingRemote]);

  const handleStateChange = useCallback((isPlaying: boolean) => {
    if (applyingRemoteRef.current) return;
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

  // Sync lock for synchronized playback start
  const handleSyncLockComplete = useCallback(() => {
    // Reset playback to start of current song and play
    seekTo(0);
    play();
    updatePlayback({ isPlaying: true, currentTime: 0 });
  }, [seekTo, play, updatePlayback]);

  const { isSyncLockActive, startSyncLock } = useSyncLock(
    channel,
    isHost,
    user?.id || ''
  );



  const lastSeekTimeRef = useRef<number>(0);

  // Simplified Sync Logic
  useEffect(() => {
    if (!isReady || !currentSong) return;

    const now = Date.now();
    const baseTime = playbackState.currentTime || 0;
    const lastUpdate = playbackState.lastUpdate || now;
    
    // Sanity check: lastUpdate should be reasonable
    const elapsedSinceUpdate = now - lastUpdate;
    if (elapsedSinceUpdate < 0 || elapsedSinceUpdate > 3600000) return;
    
    const elapsed = playbackState.isPlaying ? elapsedSinceUpdate / 1000 : 0;
    
    // Apply clock offset compensation
    // Cap the offset to reasonable bounds (max 5 seconds)
    const clampedOffset = Math.max(-5000, Math.min(5000, clockOffset));
    const offsetCompensation = clampedOffset / 1000;
    
    const targetTime = baseTime + elapsed + offsetCompensation;

    // Sanity check: targetTime should be within video duration bounds
    if (!Number.isFinite(targetTime) || targetTime < 0 || (duration > 0 && targetTime > duration + 5)) {
      return;
    }

    // 1. Playback State Sync
    if (playbackState.isPlaying && !isPlaying) {
      markApplyingRemote();
      play();
    } else if (!playbackState.isPlaying && isPlaying) {
      markApplyingRemote();
      pause();
    }

    // 2. Time Sync
    const drift = Math.abs(targetTime - currentTime);
    const SEEK_COOLDOWN = 2000;
    const timeSinceLastSeek = now - lastSeekTimeRef.current;

    // Only seek if drift is significant (> 1.5s) to avoid stuttering
    // And respect cooldown
    if (drift > 1.5 && timeSinceLastSeek > SEEK_COOLDOWN) {
      console.log(`[Sync] Correcting drift: ${drift.toFixed(2)}s`);
      markApplyingRemote();
      seekTo(targetTime);
      lastSeekTimeRef.current = now;
    }
  }, [
    isReady,
    currentSong?.videoId,
    playbackState.isPlaying,
    playbackState.currentTime,
    playbackState.lastUpdate,
    currentTime,
    duration,
    isPlaying,
    play,
    pause,
    seekTo,
    markApplyingRemote,
    clockOffset,
  ]);

  // Audio reactive for light sticks (enabled if Room is playing, even if local audio is buffering/blocked)
  // This ensures visuals are active immediately after refresh
  const { intensity: audioIntensity, beatPhase, isBeat, bpm } = useAudioReactive({ 
    enabled: playbackState.isPlaying, 
    sensitivity: 6, 
    targetBpm: 120 
  });

  // Calculate max audio level from all users for screen effects
  const maxUserAudioLevel = useMemo(() => {
    return Math.max(0, ...users.map(u => u.audioLevel || 0));
  }, [users]);
  
  // Check if anyone is singing EXTRA loud (Level 2 - for dust/shake effects)
  const isExtraLoudSinging = maxUserAudioLevel > 0.65;

  const remainingSeconds = duration > 0 ? Math.ceil(duration - currentTime) : null;
  const showCountdown = isPlaying && remainingSeconds !== null && remainingSeconds > 0 && remainingSeconds <= 5;
  // Preload lyrics for queued songs
  const { getStatusForSong, getLyricsForSong } = useLyricsPreload(queue, playbackState.currentSongIndex);

  // Get preloaded lyrics for current song
  const preloadedLyrics = currentSong ? getLyricsForSong(currentSong.id) : undefined;

  const { lyrics, currentLineIndex, isLoading: lyricsLoading, error: lyricsError, offset: lyricsOffset, setOffset: setLyricsOffset } = useLyrics(
    currentSong?.artist || null,
    currentSong?.title || null,
    currentTime,
    preloadedLyrics
  );

  const handleSpeakingChange = useCallback((isSpeaking: boolean, level: number) => {
    updateSpeaking(isSpeaking, level);
  }, [updateSpeaking]);

  const { 
    isEnabled: isMicEnabled, 
    toggleMic, 
    applyEQ, 
    remoteAudioLevels, 
    webrtcStats,
    threshold,
    setThreshold,
    isMonitorEnabled,
    setMonitorEnabled,
    monitorVolume,
    setMonitorVolume,
    // Advanced Processing
    noiseSuppression,
    setNoiseSuppression,
    echoCancellation,
    setEchoCancellation,
    autoGainControl,
    setAutoGainControl,
    micGain,
    setMicGain,
    compressorThreshold,
    setCompressorThreshold,
    compressorRatio,
    setCompressorRatio,
  } = useMicrophone(
    handleSpeakingChange,
    channel,
    user?.id,
    users,
    userVolumes
  );

  const handleEqChange = (newSettings: number[]) => {
    setEqSettings(newSettings);
    applyEQ(newSettings);
  };

  const handleMicToggle = useCallback(() => {
    toggleMic(eqSettings);
    // Broadcast mic status after toggle (inverted because toggleMic toggles the state)
    updateMicStatus(!isMicEnabled);
  }, [toggleMic, eqSettings, updateMicStatus, isMicEnabled]);

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
    seekTo(time); // Instant local feedback
    seek(time);   // Robust broadcast
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
    <div className="h-screen flex flex-col p-4 gap-3 overflow-hidden">
      {/* Celebration effects */}
      {celebrationEnabled && <CelebrationOverlay theme={celebration} />}
      
      {/* Sync Lock Overlay */}
      <SyncLockOverlay
        channel={channel}
        isHost={isHost}
        currentUserId={user.id}
        onSyncStart={() => {}}
        onCountdownComplete={handleSyncLockComplete}
      />
      
      {/* Floating reactions */}
      
      {/* Dust fall effect when singing EXTRA loudly (Level 2) */}
      <DustFallEffect isActive={isExtraLoudSinging && isPlaying} intensity={maxUserAudioLevel} />
      {/* Header */}
      <header className="flex flex-wrap gap-2 items-center justify-between">
        <RoomCodeDisplay code={code} />
        <div className="flex items-center gap-2">
          {/* Connection indicator */}
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-neon-green' : 'bg-destructive'}`} />
          <span className="text-sm text-muted-foreground">
            {users.length} online
            {networkLatency > 0 && ` · ${networkLatency}ms`}
            {isMicEnabled && webrtcStats.connectedPeers > 0 && (
              <span className={cn(
                "ml-1",
                webrtcStats.connectionQuality === 'excellent' && "text-green-400",
                webrtcStats.connectionQuality === 'good' && "text-green-500",
                webrtcStats.connectionQuality === 'fair' && "text-yellow-500",
                webrtcStats.connectionQuality === 'poor' && "text-red-500",
              )}>
                · 🎤{webrtcStats.avgLatency > 0 ? `${webrtcStats.avgLatency}ms` : '⚡'}
              </span>
            )}
          </span>
          
          {/* Host Badge */}
          {isHost && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 border border-amber-500/50 text-amber-400">
              👑 Host
            </div>
          )}
          
          {/* Mode Badge */}
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all",
            roomMode === 'team-battle' 
              ? "bg-primary/20 border-primary text-primary animate-pulse" 
              : "bg-muted/50 border-border text-muted-foreground"
          )}>
            {roomMode === 'team-battle' ? <Swords className="w-3 h-3" /> : <Mic2 className="w-3 h-3" />}
            {roomMode === 'team-battle' ? 'Team Battle' : 'Free Sing'}
          </div>


          {/* Sync Lock Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={startSyncLock}
            disabled={isSyncLockActive || !currentSong}
            className={cn(
              "gap-1.5",
              isSyncLockActive && "animate-pulse"
            )}
            title="Start synchronized playback with 3-2-1 countdown"
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sync Lock</span>
          </Button>

          {/* Unified Voting Panel */}
          <VotingPanel
            channel={channel}
            currentUserId={user.id}
            users={users}
            currentMode={roomMode}
            onModeChange={updateMode}
            activeVoteKick={activeVoteKick}
            hasVoted={hasVoted}
            onStartVoteKick={startVoteKick}
            onVoteYes={voteYes}
            onVoteNo={voteNo}
            voteKickDisabled={!!activeVoteKick}
          />

          <RoomSettings 
            celebrationEnabled={celebrationEnabled} 
            onCelebrationToggle={setCelebrationEnabled}
            eqSettings={eqSettings}
            onEqChange={handleEqChange}
            threshold={threshold}
            onThresholdChange={setThreshold}
            isMonitorEnabled={isMonitorEnabled}
            onMonitorEnabledChange={setMonitorEnabled}
            monitorVolume={monitorVolume}
            onMonitorVolumeChange={setMonitorVolume}
            // Advanced Audio
            noiseSuppression={noiseSuppression}
            onNoiseSuppressionChange={setNoiseSuppression}
            echoCancellation={echoCancellation}
            onEchoCancellationChange={setEchoCancellation}
            autoGainControl={autoGainControl}
            onAutoGainControlChange={setAutoGainControl}
            micGain={micGain}
            onMicGainChange={setMicGain}
            compressorThreshold={compressorThreshold}
            onCompressorThresholdChange={setCompressorThreshold}
            compressorRatio={compressorRatio}
            onCompressorRatioChange={setCompressorRatio}
          />
          <Button variant="ghost" size="icon" onClick={handleLeave}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main content - Video takes priority */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Queue panel */}
        <div className="lg:col-span-3 card-karaoke overflow-hidden flex flex-col order-3 lg:order-1">
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

        {/* Video & Lyrics - Main focus */}
        <div className="lg:col-span-6 flex flex-col gap-3 min-h-0 order-1 lg:order-2">
          <div className="card-karaoke relative flex-1 min-h-0">
            <div id="youtube-player" className="w-full h-full rounded-lg overflow-hidden" />

            {/* Sing React overlay with light sticks */}
            <SingReactOverlay
              isPlaying={isPlaying}
              userId={user.id}
              channel={channel}
              className="absolute inset-0 rounded-lg overflow-hidden"
            />

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
          <div className="card-karaoke h-[140px] shrink-0">
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
        <div className="lg:col-span-3 card-karaoke flex flex-col order-2 lg:order-3">
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
            onMicToggle={handleMicToggle}
            onSync={requestSync}
          />

          
          {/* Reactions */}
          <div className="mt-auto pt-4">
            <ReactionBar onReact={sendReaction} isWaving={isWaving} onWaveToggle={toggleWaving} />
          </div>
        </div>
      </div>

      {/* User avatars */}
      <div className="shrink-0 overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0">
        <UserAvatarRow 
          users={users} 
          currentUserId={user.id} 
          wavingUsers={wavingUsers} 
          audioIntensity={audioIntensity} 
          beatPhase={beatPhase} 
          isBeat={isBeat} 
          bpm={bpm}
          onStartVoteKick={startVoteKick}
          voteKickDisabled={!!activeVoteKick}
          roomMode={roomMode}
          battleFormat={battleFormat}
          userVolumes={userVolumes}
          onVolumeChange={handleUserVolumeChange}
        />
      </div>
      
      {/* Vote Kick Overlay - Animated center popup */}
      {activeVoteKick && (
        <VoteKickOverlay
          voteKick={activeVoteKick}
          currentUserId={user.id}
          hasVoted={hasVoted}
          onVoteYes={voteYes}
          onVoteNo={voteNo}
        />
      )}
    </div>
  );
};

export default Room;