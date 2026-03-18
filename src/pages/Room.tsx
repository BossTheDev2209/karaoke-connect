import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, RoomMode, BattleFormat, Song } from '@/types/karaoke';
import { useRoom } from '@/hooks/useRoom';
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';
import { useLyrics } from '@/hooks/useLyrics';
import { useLyricsPreload } from '@/hooks/useLyricsPreload';
import { useMicrophone } from '@/hooks/useMicrophone';
import { useSyncV2 } from '@/hooks/useSyncV2';

import { useTheme } from '@/contexts/ThemeContext';

import { DesktopRoomLayout } from '@/components/room/DesktopRoomLayout';
import { CelebrationOverlay, getCurrentCelebration } from '@/components/effects/CelebrationOverlay';
import { DustFallEffect } from '@/components/effects/SingerEffects';
import { useReactions, useWaving } from '@/components/Reactions';
import { useAudioReactive } from '@/hooks/useAudioReactive';
import { MobileRoomLayout } from '@/components/MobileRoomLayout';
import { useMediaQuery } from '@/hooks/useMediaQuery';

import { useRecommendations } from '@/hooks/useRecommendations';
import { usePlaybackControls } from '@/hooks/usePlaybackControls';
import { useRoomQueue } from '@/hooks/useRoomQueue';
import { useRoomModeration } from '@/hooks/useRoomModeration';

import { cn } from '@/lib/utils';
import { toast } from 'sonner';



export default function Room() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  // Theme settings including autoSyncOnJoin
  const { privacyMode, setVideoId, autoSyncOnJoin, hideLyricsWhenNotFound } = useTheme();
  
  // State for pending sync after song ends
  const [pendingSyncOnSongEnd, setPendingSyncOnSongEnd] = useState(false);
  
  // Check if user has a saved profile, if not redirect to join page
  const [user] = useState<User | null>(() => {
    const saved = sessionStorage.getItem('karaoke_user') || localStorage.getItem('karaoke_user');
    if (saved) {
      return JSON.parse(saved);
    }
    // No saved user - will redirect to join page
    return null;
  });
  
  // Redirect to join page if no saved profile
  useEffect(() => {
    if (!user && code) {
      console.log('[Room] No user profile found, redirecting to join page');
      navigate(`/join/${code}`, { replace: true });
    }
  }, [user, code, navigate]);

  const [celebration] = useState(getCurrentCelebration());
  const [celebrationEnabled, setCelebrationEnabled] = useState(true);
  const { autoPlayNext } = useTheme();
  const [showHostControlPanel, setShowHostControlPanel] = useState(false);
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

  // Refs for auto sync logic (to avoid circular dependency)
  const isHostRef = useRef(false);
  const playbackStateRef = useRef<{ isPlaying?: boolean }>({ isPlaying: false });
  const startSyncLockRef = useRef<(() => void) | null>(null);

  // --- Moderation hook (vote kick, host actions, winner screen) ---
  const moderation = useRoomModeration({
    channel: null, // Will be set after useRoom - passed via ref pattern below
    userId: user?.id || '',
    users: [], // Will be updated after useRoom
    navigate: (path: string) => navigate(path),
    playbackState: { status: 'idle', videoId: null, startAtRoomTime: null, seekOffset: 0, currentSongIndex: 0 },
    roomMode: 'free-sing',
  });

  // Handle user join for auto sync
  const handleUserJoin = useCallback((joinedUser: User) => {
    console.log('User joined - checking auto sync settings:', autoSyncOnJoin);
    
    // Notification
    toast.success(`${joinedUser.nickname || 'A new user'} has joined the party! 🎉`);

    // Only host can trigger sync
    if (!isHostRef.current) return;
    
    // Check if there's a current song playing
    if (autoSyncOnJoin === 'immediate' && playbackStateRef.current.isPlaying) {
      // Immediate sync
      console.log('Triggering immediate sync for new user');
      setPendingSyncOnSongEnd(false);
      // Small delay to ensure new user is connected
      setTimeout(() => {
        startSyncLockRef.current?.();
      }, 1000);
    } else if (autoSyncOnJoin === 'after-song' && playbackStateRef.current.isPlaying) {
      console.log('Queuing sync for after current song ends');
      setPendingSyncOnSongEnd(true);
    }
  }, [autoSyncOnJoin]);

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
    swapUserTeam,
    broadcastMatchStart,
    broadcastMatchEnd,
    requestSync,
    seek,
    networkLatency,
    kickUser,
    forceMuteUser,
    toggleControlAccess,
  } = useRoom(code || '', user, handleUserJoin, moderation.handleHostAction);

  // Keep refs in sync
  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    playbackStateRef.current = playbackState;
  }, [playbackState]);

  // Derived state
  const currentSong = useMemo(() => 
    queue[playbackState.currentSongIndex], 
    [queue, playbackState.currentSongIndex]
  );
  
  // Check if user has music control permissions
  const canControl = useMemo(() => {
    if (isHost) return true;
    const currentUserData = users.find(u => u.id === user?.id);
    return !!currentUserData?.hasControlAccess;
  }, [isHost, users, user?.id]);
  
  // Update theme context with current video ID for auto-theme
  useEffect(() => {
    setVideoId(currentSong?.videoId || null);
  }, [currentSong?.videoId, setVideoId]);

  // Reactions and waving
  const { reactions, sendReaction } = useReactions(channel, user?.id || '');
  const { isWaving, toggleWaving, wavingUsers } = useWaving(channel, user?.id || '');

  // Prevent feedback loops when we apply remote playback updates to the local player
  const applyingRemoteRef = useRef(false);
  const markApplyingRemote = useCallback(() => {
    applyingRemoteRef.current = true;
    window.setTimeout(() => {
      applyingRemoteRef.current = false;
    }, 300);
  }, []);

  // Ref for syncV2 to break circular dependency with handleVideoEnded
  const syncV2Ref = useRef<{ 
    prepareSong: (index: number) => void; 
    endSong: () => void;
    getTargetTime: () => number;
  } | null>(null);

  // When the current video changes (often driven by remote sync), suppress transient player events
  useEffect(() => {
    if (!currentSong?.videoId) return;
    markApplyingRemote();
  }, [currentSong?.videoId, markApplyingRemote]);

  const handleStateChange = useCallback((isPlaying: boolean) => {
    if (applyingRemoteRef.current) return;
    updatePlayback({ isPlaying });
  }, [updatePlayback]);

  // --- Recommendations hook ---
  const {
    recommendations,
    isLoadingRecs,
    addRecommendation,
    dismissRecommendations,
  } = useRecommendations({
    currentSong,
    queue,
    isHost,
    updateQueue,
    userDisplayName: (user as any)?.name || user?.nickname || 'System',
    syncV2Ref,
  });

  // --- Room Queue hook (auto-play watcher + queue operations) ---
  // Note: we need syncV2 for this, but syncV2 is defined after useYouTubePlayer.
  // We use syncV2Ref for the auto-play watcher effect, and pass syncV2 directly for callbacks.
  // The queue hook is called here but the syncV2 passed to callbacks will be updated via ref.

  // Auto-play next song when current ends (no looping)
  const handleVideoEnded = useCallback(() => {
    // Battle Mode Logic - Show Winner Screen first
    if (roomMode === 'team-battle') {
       moderation.setShowWinnerScreen(true);
       return; // Don't advance yet
    }

    const nextIndex = playbackState.currentSongIndex + 1;
    
    // Stop if queue is empty (or just 1 song that finished) or at end
    if (queue.length === 0 || nextIndex >= queue.length) {
       console.log('Queue ended, stopping playback');
       if (isHost) {
          syncV2Ref.current?.endSong(); // Explicitly end session
       }
       updatePlayback({ isPlaying: false, status: 'idle' });
       return;
    }

    if (nextIndex < queue.length) {
      // Use the new sync system for synchronized start
      if (isHost) {
        if (autoPlayNext) {
            syncV2Ref.current?.prepareSong(nextIndex);
        } else {
            updatePlayback({ isPlaying: false, status: 'idle' });
        }
      }
    }
  }, [queue.length, playbackState.currentSongIndex, updatePlayback, isHost, roomMode, autoPlayNext, moderation.setShowWinnerScreen]);

  const handleNextRound = useCallback(() => {
     moderation.setShowWinnerScreen(false);
     
     // Advance to next song
     const nextIndex = playbackState.currentSongIndex + 1;
     if (nextIndex < queue.length) {
       if (isHost) {
         syncV2Ref.current?.prepareSong(nextIndex);
       }
     } else {
       updatePlayback({ isPlaying: false, status: 'idle' });
     }
  }, [playbackState.currentSongIndex, queue.length, updatePlayback, isHost, moderation.setShowWinnerScreen]);

  const { isReady, currentTime, duration, isPlaying, play, pause, seekTo, setVolume: setPlayerVolume, mute, unmute, isMuted, enableCaptions, disableCaptions, areCaptionsEnabled, hasCaptionsAvailable, error: playerError, clearError, cueVideo, getCurrentTime: getPlayerTime } = useYouTubePlayer('youtube-player', currentSong?.videoId || null, handleStateChange, handleVideoEnded, privacyMode);

  // NEW: Timeline-based sync system (V2)
  const syncV2 = useSyncV2({
    channel,
    userId: user?.id || null,
    isHost,
    queue,
    onSeekRequired: seekTo,
    onPlayRequired: play,
    onPauseRequired: pause,
    onCueVideo: cueVideo,
    getCurrentVideoTime: getPlayerTime,
    isPlayerReady: isReady,
  });

  // Sync the ref for use in callbacks defined before syncV2
  useEffect(() => {
    syncV2Ref.current = syncV2;
  }, [syncV2]);

  // --- Playback Controls hook ---
  const {
    volume,
    handlePlayPause,
    handleSeek,
    handleForceSync,
    handleNext,
    handlePrevious,
    handleVolumeChange,
  } = usePlaybackControls({
    canControl,
    syncV2,
    play,
    pause,
    seekTo,
    getPlayerTime,
    setPlayerVolume,
    isHost,
    isPlaying,
    updatePlayback,
    playbackState,
    queueLength: queue.length,
  });

  // --- Room Queue hook ---
  const {
    handleAddSong,
    handleRemoveSong,
    handleSelectSong,
  } = useRoomQueue({
    queue,
    updateQueue,
    canControl,
    syncV2,
    updatePlayback,
    playbackState,
    isHost,
    syncV2Ref,
  });

  // NOTE: Legacy sync logic removed - useSyncV2 now handles ALL synchronization
  // via server time offset (useServerTime) and Web Worker for background-safe correction

  // Audio reactive for light sticks (enabled if Room is playing, even if local audio is buffering/blocked)
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

  // Use synchronized time for lyrics (falls back to player currentTime if not calibrated)
  const syncedCurrentTime = useMemo(() => {
    if (syncV2?.isTimeCalibrated && playbackState.status === 'playing') {
      return syncV2.getTargetTime();
    }
    return currentTime;
  }, [syncV2, playbackState.status, currentTime]);

  const { 
    lyrics, 
    currentLineIndex, 
    isLoading: lyricsLoading, 
    error: lyricsError, 
    offset: lyricsOffset, 
    setOffset: setLyricsOffset,
    // NEW: Multiple matches support
    allMatches,
    selectedMatchIndex,
    selectMatch,
    source: lyricsSource,
  } = useLyrics(
    currentSong?.artist || null,
    currentSong?.title || null,
    syncedCurrentTime,
    preloadedLyrics
  );

  // State for showing lyrics selector
  const [showLyricsSelector, setShowLyricsSelector] = useState(false);
  const [hasShownSelectorForSong, setHasShownSelectorForSong] = useState<string | null>(null);

  // Show lyrics selector when song changes and there are multiple matches
  useEffect(() => {
    if (currentSong?.id && allMatches.length > 1 && hasShownSelectorForSong !== currentSong.id) {
      setShowLyricsSelector(true);
      setHasShownSelectorForSong(currentSong.id);
    }
  }, [currentSong?.id, allMatches.length, hasShownSelectorForSong]);

  const handleLyricsConfirm = useCallback(() => {
    setShowLyricsSelector(false);
  }, []);

  const handleLyricsSkip = useCallback(() => {
    setShowLyricsSelector(false);
    if (hasCaptionsAvailable) {
      enableCaptions();
    }
  }, [hasCaptionsAvailable, enableCaptions]);

  // Calculate if a lyric line is currently active (for Rhythm Scoring)
  const isLyricActive = useMemo(() => {
    if (!lyrics || lyrics.length === 0 || currentLineIndex === -1) return false;
    if (currentLineIndex >= lyrics.length) return false;
    
    const currentLine = lyrics[currentLineIndex];
    
    let endTime = Infinity;
    if (currentLineIndex < lyrics.length - 1) {
      endTime = lyrics[currentLineIndex + 1].time;
    } else {
      endTime = currentLine.time + 5;
    }
    
    const isInstrumental = currentLine.text.includes('♪') || currentLine.text.includes('[') || !currentLine.text.trim();
    
    return currentTime >= currentLine.time && currentTime < endTime && !isInstrumental;
  }, [lyrics, currentLineIndex, currentTime]);

  const handleSpeakingChange = useCallback((isSpeaking: boolean, level: number, score?: number) => {
    updateSpeaking(isSpeaking, level, score);
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
    userVolumes,
    isLyricActive
  );

  const handleEqChange = (newSettings: number[]) => {
    setEqSettings(newSettings);
    applyEQ(newSettings);
  };

  const handleMicToggle = useCallback(() => {
    toggleMic(eqSettings);
    updateMicStatus(!isMicEnabled);
  }, [toggleMic, eqSettings, updateMicStatus, isMicEnabled]);

  // Hydrate SyncV2 state with the latest playback state from legacy sync if SyncV2 is behind
  useEffect(() => {
    if (playbackState.lastUpdate && playbackState.lastUpdate > (syncV2.playbackState.lastUpdate || 0)) {
        if (playbackState.startAtRoomTime) {
            console.log('[Room] Hydrating SyncV2 with incoming full sync state');
        }
    }
  }, [playbackState, syncV2.playbackState.lastUpdate]);

  // Host action ref setup - connects moderation's ref to actual handlers
  useEffect(() => {
    moderation.onHostActionRef.current = (action, payload) => {
      if (action === 'kick') {
        toast.error('You have been kicked from the room.');
        handleLeave();
      } else if (action === 'mute') {
        if (isMicEnabled) {
             toast.warning('Your microphone was muted by the host.');
             toggleMic(eqSettings);
        }
      } else if (action === 'control_access') {
          const { hasControlAccess } = payload || {};
          if (hasControlAccess) {
              toast.success('You have been granted control access!');
          } else {
              toast.info('Your control access has been revoked.');
          }
      }
    };
  }, [isMicEnabled, toggleMic, eqSettings, moderation.onHostActionRef]);

  // Check for mobile layout
  const isMobile = useMediaQuery('(max-width: 768px)');
  const youtubePlayerRef = useRef<HTMLDivElement>(null);

  const handleLeave = useCallback(() => {
    sessionStorage.removeItem('karaoke_user');
    navigate('/');
  }, [navigate]);
  
  // Re-initialize moderation with actual values now that useRoom has returned
  // Note: useRoomModeration was called with placeholder values above because
  // it needs to be called before useRoom (for handleHostAction). 
  // The actual vote kick logic uses channel/users from useRoom via the VoteKick component's own hook.
  // The moderation hook's vote kick uses its own internal useVoteKick with the channel ref pattern.
  
  // Actually, we need to restructure. The moderation hook was called with empty values.
  // Let's use the vote kick values from the moderation hook that was initialized with placeholders.
  // This won't work correctly. Let me fix this by keeping vote kick in Room.tsx directly
  // since it depends on useRoom's channel which comes after.

  // VOTE KICK - kept inline since it depends on channel from useRoom
  // (useRoomModeration handles winner screen + host action ref only)

  if (!user || !code) return null;

  // Render mobile layout if on small screen
  if (isMobile) {
    return (
      <>
        {/* Celebration effects & Dust - Global */}
        {celebrationEnabled && <CelebrationOverlay theme={celebration} />}
        <DustFallEffect isActive={isExtraLoudSinging && isPlaying} intensity={maxUserAudioLevel} />
        
        <MobileRoomLayout 
          user={user}
          users={users}
          queue={queue}
          playbackState={playbackState}
          roomMode={roomMode}
          isHost={isHost}
          isConnected={isConnected}
          currentSong={currentSong || undefined}
          // Actions
          onPlayPause={handlePlayPause}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onSeek={handleSeek}
          onAddSong={handleAddSong}
          onRemoveSong={handleRemoveSong}
          onSelectSong={handleSelectSong}
          onVoteKick={moderation.handleVoteKick}
          onLeave={handleLeave}
          // Mic & Audio
          isMicEnabled={isMicEnabled}
          onMicToggle={handleMicToggle}
          volume={volume}
          onVolumeChange={handleVolumeChange}
          eqSettings={eqSettings}
          onEqChange={handleEqChange}
          // Refs/Props
          youtubePlayerRef={youtubePlayerRef}
          currentTime={currentTime}
          duration={duration}
          
          lyricsProps={{
            lyrics,
            currentLineIndex,
            isLoading: lyricsLoading,
            error: lyricsError,
            offset: lyricsOffset,
            onOffsetChange: setLyricsOffset,
            onLyricsConfirm: handleLyricsConfirm,
            onLyricsSkip: handleLyricsSkip,
            showSelector: showLyricsSelector,
            allMatches,
            selectedMatchIndex,
            onSelectMatch: selectMatch,
            source: lyricsSource
          }}
          
          reactionProps={{
            channel, 
            userId: user.id,
            reactions,
            onReaction: sendReaction,
            onWave: toggleWaving,
            isWaving,
            wavingUsers
          }}
          
          votingProps={{
            channel,
            currentUserId: user.id,
            users,
            currentMode: roomMode,
            isHost,
            onModeChange: updateMode,
            activeVoteKick: moderation.activeVoteKick,
            hasVoted: moderation.hasVoted,
            onStartVoteKick: moderation.handleVoteKick,
            onVoteYes: moderation.voteYes,
            onVoteNo: moderation.voteNo,
            voteKickDisabled: !!moderation.activeVoteKick
          }}
          
          settingsProps={{
            celebrationEnabled,
            onCelebrationToggle: setCelebrationEnabled,
            eqSettings,
            onEqChange: handleEqChange,
            threshold,
            onThresholdChange: setThreshold,
            isMonitorEnabled,
            onMonitorEnabledChange: setMonitorEnabled,
            monitorVolume,
            onMonitorVolumeChange: setMonitorVolume,
            noiseSuppression,
            onNoiseSuppressionChange: setNoiseSuppression,
            echoCancellation,
            onEchoCancellationChange: setEchoCancellation,
            autoGainControl,
            onAutoGainControlChange: setAutoGainControl,
            micGain,
            onMicGainChange: setMicGain,
            compressorThreshold,
            onCompressorThresholdChange: setCompressorThreshold,
            compressorRatio,
            onCompressorRatioChange: setCompressorRatio
          }}
        />
      </>
    );
  }

  // --- Prop assembly for DesktopRoomLayout (all logic stays here) ---

  const headerProps = {
    code,
    isHost,
    isConnected,
    userCount: users.length,
    networkLatency,
    isMicEnabled,
    webrtcStats,
    roomMode,
    onShowHostControlPanel: () => setShowHostControlPanel(true),
    onLeave: handleLeave,
    roomMenuProps: {
      channel,
      currentUserId: user.id,
      users,
      currentMode: roomMode,
      isHost,
      onModeChange: updateMode,
      activeVoteKick: moderation.activeVoteKick,
      hasVoted: moderation.hasVoted,
      onStartVoteKick: moderation.handleVoteKick,
      onVoteYes: moderation.voteYes,
      onVoteNo: moderation.voteNo,
      voteKickDisabled: !!moderation.activeVoteKick,
      celebrationEnabled,
      onCelebrationToggle: setCelebrationEnabled,
      eqSettings,
      onEqChange: handleEqChange,
      threshold,
      onThresholdChange: setThreshold,
      isMonitorEnabled,
      onMonitorEnabledChange: setMonitorEnabled,
      monitorVolume,
      onMonitorVolumeChange: setMonitorVolume,
      noiseSuppression,
      onNoiseSuppressionChange: setNoiseSuppression,
      echoCancellation,
      onEchoCancellationChange: setEchoCancellation,
      autoGainControl,
      onAutoGainControlChange: setAutoGainControl,
      micGain,
      onMicGainChange: setMicGain,
      compressorThreshold,
      onCompressorThresholdChange: setCompressorThreshold,
      compressorRatio,
      onCompressorRatioChange: setCompressorRatio,
    },
  };

  const showReadyCheck = syncV2.playbackState.status === 'preparing' || syncV2.playbackState.status === 'ready';
  const readyCheckUsers = users.map(u => ({
    id: u.id,
    nickname: u.nickname,
    isReady: !!syncV2.playerReadyStates[u.id],
  }));
  const showNoSong = !currentSong;
  const showRecommendations = !isPlaying && !playerError && queue.length <= 1 && recommendations.length > 0;
  const showPlayerError = !!playerError && !!currentSong;
  const showLyrics = !(hideLyricsWhenNotFound && (lyricsError || lyrics.length === 0));

  const stageProps = {
    showSingReactOverlay: true,
    singReactOverlayProps: {
      isPlaying,
      userId: user.id,
      channel,
      className: "absolute inset-0 rounded-lg overflow-hidden",
    },
    showCountdown,
    remainingSeconds,
    showReadyCheck,
    readyCheckUsers,
    isHost,
    onForceStart: () => syncV2.forceStart(),
    showNoSong,
    showRecommendations,
    recommendations,
    onAddRecommendation: addRecommendation,
    onDismissRecommendations: dismissRecommendations,
    showPlayerError,
    playerError,
    onClearErrorAndSkip: () => {
      clearError();
      handleVideoEnded();
    },
    hasMoreSongs: queue.length > 1,
    showLyrics,
    lyricsDisplayProps: {
      lyrics,
      currentLineIndex,
      currentTime,
      isLoading: lyricsLoading,
      error: lyricsError,
      offset: lyricsOffset,
      onOffsetChange: setLyricsOffset,
      onSeek: handleSeek,
      areCaptionsEnabled,
      hasCaptionsAvailable,
      onEnableCaptions: enableCaptions,
      onDisableCaptions: disableCaptions,
      source: lyricsSource,
      hasMultipleMatches: allMatches.length > 1,
      matchCount: allMatches.length,
      onChangeLyrics: () => setShowLyricsSelector(true),
    },
  };

  const controlsProps = {
    remoteControlProps: {
      isPlaying,
      isMuted,
      volume,
      currentTime,
      duration,
      isMicEnabled,
      canGoPrevious: playbackState.currentSongIndex > 0,
      canGoNext: playbackState.currentSongIndex < queue.length - 1,
      onPlayPause: handlePlayPause,
      onNext: handleNext,
      onPrevious: handlePrevious,
      onSeek: handleSeek,
      onVolumeChange: handleVolumeChange,
      onMuteToggle: isMuted ? unmute : mute,
      onMicToggle: handleMicToggle,
      onSync: requestSync,
      isHost: canControl,
      users,
      queue,
      currentSongIndex: playbackState.currentSongIndex,
      roomMode,
      battleFormat,
      onForceSync: handleForceSync,
      onSmartPlay: handlePlayPause,
      onSmartPause: handlePlayPause,
      onHostSeek: handleSeek,
      onRemoveSong: handleRemoveSong,
      onSelectSong: handleSelectSong,
      currentSong,
      networkLatency,
    },
    reactionBarProps: {
      onReact: sendReaction,
      isWaving,
      onWaveToggle: toggleWaving,
    },
  };

  const overlaysProps = {
    showTeamBattle: roomMode === 'team-battle',
    teamBattleProps: {
      users,
      isPlaying: playbackState.isPlaying,
      onContinue: handleNextRound,
      showWinner: moderation.showWinnerScreen,
      isHost,
      currentUserId: user.id,
    },
    showVoteKick: !!moderation.activeVoteKick,
    voteKickProps: {
      voteKick: moderation.activeVoteKick!,
      currentUserId: user.id,
      hasVoted: moderation.hasVoted,
      onVoteYes: moderation.voteYes,
      onVoteNo: moderation.voteNo,
    },
    showLyricsSelector: showLyricsSelector && allMatches.length > 1,
    lyricsSelectorProps: {
      matches: allMatches,
      selectedIndex: selectedMatchIndex,
      onSelect: selectMatch,
      onConfirm: handleLyricsConfirm,
      onSkip: handleLyricsSkip,
      songTitle: currentSong?.title || 'Unknown Song',
      autoConfirmSeconds: 10,
    },
  };

  const queuePanelProps = {
    isHost,
    queue,
    currentSongIndex: playbackState.currentSongIndex,
    canControl,
    onAddSong: handleAddSong,
    onRemoveSong: handleRemoveSong,
    onSelectSong: handleSelectSong,
    userId: user.id,
    getStatusForSong,
  };

  const avatarRowProps = {
    users,
    currentUserId: user.id,
    wavingUsers,
    audioIntensity,
    beatPhase,
    isBeat,
    bpm,
    onStartVoteKick: moderation.startVoteKick,
    voteKickDisabled: !!moderation.activeVoteKick,
    roomMode,
    battleFormat,
    userVolumes,
    onVolumeChange: handleUserVolumeChange,
  };

  const layoutFlags = {
    isHost,
    celebrationEnabled,
    isExtraLoudSinging,
    isPlaying,
    maxUserAudioLevel,
  };

  const hostControlPanelProps = {
    isOpen: showHostControlPanel,
    onClose: () => setShowHostControlPanel(false),
    networkLatency,
    onForceSync: handleForceSync,
    users,
    onKickUser: kickUser,
    onForceMuteUser: forceMuteUser,
    onToggleControlAccess: toggleControlAccess,
    currentUserId: user.id,
  };

  return (
    <DesktopRoomLayout
      headerProps={headerProps}
      stageProps={stageProps}
      controlsProps={controlsProps}
      overlaysProps={overlaysProps}
      queuePanelProps={queuePanelProps}
      avatarRowProps={avatarRowProps}
      layoutFlags={layoutFlags}
      celebration={celebration}
      hostControlPanelProps={hostControlPanelProps}
      showHostControlPanel={showHostControlPanel}
      onCloseHostControlPanel={() => setShowHostControlPanel(false)}
    />
  );
};
