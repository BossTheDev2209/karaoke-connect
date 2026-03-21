import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, RoomMode, BattleFormat, Song, PlaybackState } from '@/types/karaoke';
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
import { useVoteKick } from '@/components/VoteKick';
import { MobileRoomLayout } from '@/components/MobileRoomLayout';
import { useMediaQuery } from '@/hooks/useMediaQuery';

import { useRecommendations } from '@/hooks/useRecommendations';
import { usePlaybackControls } from '@/hooks/usePlaybackControls';
import { useRoomQueue } from '@/hooks/useRoomQueue';

import { cn } from '@/lib/utils';
import { toast } from 'sonner';



export default function Room() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { privacyMode, setVideoId, autoSyncOnJoin, hideLyricsWhenNotFound } = useTheme();
  
  const [pendingSyncOnSongEnd, setPendingSyncOnSongEnd] = useState(false);
  
  const [user] = useState<User | null>(() => {
    const saved = sessionStorage.getItem('karaoke_user') || localStorage.getItem('karaoke_user');
    if (saved) {
      return JSON.parse(saved);
    }
    return null;
  });
  
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

  // Refs for auto sync logic
  const isHostRef = useRef(false);
  const startSyncLockRef = useRef<(() => void) | null>(null);

  // Host action ref (for moderation - mute/kick/control_access from host)
  const onHostActionRef = useRef<((action: 'mute' | 'kick' | 'control_access', payload?: any) => void) | null>(null);

  const handleHostAction = useCallback((action: 'mute' | 'kick' | 'control_access', payload?: any) => {
    onHostActionRef.current?.(action, payload);
  }, []);

  // Ref for syncV2 — used by callbacks defined before syncV2 hook call
  const syncV2Ref = useRef<{ 
    prepareSong: (index: number) => void; 
    endSong: () => void;
    getTargetTime: () => number;
    playbackState: PlaybackState;
  } | null>(null);

  // Provide playback state to useRoom for host auto-push to joiners
  const getPlaybackState = useCallback(() => {
    return syncV2Ref.current?.playbackState ?? {
      status: 'idle' as const,
      videoId: null,
      startAtRoomTime: null,
      seekOffset: 0,
      currentSongIndex: 0,
      isPlaying: false,
      currentTime: 0,
      lastUpdate: Date.now(),
    };
  }, []);

  // Handle user join for auto sync
  const handleUserJoin = useCallback((joinedUser: User) => {
    console.log('User joined - checking auto sync settings:', autoSyncOnJoin);
    toast.success(`${joinedUser.nickname || 'A new user'} has joined the party! 🎉`);

    if (!isHostRef.current) return;
    
    const currentPlayback = syncV2Ref.current?.playbackState;
    if (autoSyncOnJoin === 'immediate' && currentPlayback?.isPlaying) {
      console.log('Triggering immediate sync for new user');
      setPendingSyncOnSongEnd(false);
      setTimeout(() => {
        startSyncLockRef.current?.();
      }, 1000);
    } else if (autoSyncOnJoin === 'after-song' && currentPlayback?.isPlaying) {
      console.log('Queuing sync for after current song ends');
      setPendingSyncOnSongEnd(true);
    }
  }, [autoSyncOnJoin]);

  // Ref for syncV2's applyFullSyncPlayback — wired after syncV2 is created
  const applyFullSyncPlaybackRef = useRef<((state: PlaybackState) => void) | null>(null);
  const handleSyncPlaybackState = useCallback((playbackState: PlaybackState) => {
    applyFullSyncPlaybackRef.current?.(playbackState);
  }, []);

  const { 
    users, queue, roomMode, battleFormat,
    isConnected, isHost, channel, syncStatus,
    updateQueue, updateSpeaking, updateMicStatus,
    updateMode, updateTeams, swapUserTeam,
    broadcastMatchStart, broadcastMatchEnd,
    requestSync, networkLatency,
    kickUser, forceMuteUser, toggleControlAccess,
  } = useRoom(code || '', user, handleUserJoin, handleHostAction, getPlaybackState, handleSyncPlaybackState);

  // Keep refs in sync
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);

  const canControl = useMemo(() => {
    if (isHost) return true;
    const currentUserData = users.find(u => u.id === user?.id);
    return !!currentUserData?.hasControlAccess;
  }, [isHost, users, user?.id]);

  // Prevent feedback loops
  const applyingRemoteRef = useRef(false);
  const markApplyingRemote = useCallback(() => {
    applyingRemoteRef.current = true;
    window.setTimeout(() => { applyingRemoteRef.current = false; }, 300);
  }, []);

  // handleStateChange: only for direct YouTube player interactions (not SyncV2 controlled)
  const handleStateChange = useCallback((isPlaying: boolean) => {
    if (applyingRemoteRef.current) return;
    // No-op for now — SyncV2 controls all playback state
  }, []);

  // --- Recommendations hook ---
  // currentSong derived from syncV2Ref for pre-syncV2 code
  const getCurrentSong = useCallback(() => {
    const idx = syncV2Ref.current?.playbackState.currentSongIndex ?? 0;
    return queue[idx];
  }, [queue]);

  const {
    recommendations, isLoadingRecs, addRecommendation, dismissRecommendations,
  } = useRecommendations({
    currentSong: getCurrentSong(), queue, isHost, updateQueue,
    userDisplayName: (user as any)?.name || user?.nickname || 'System',
    syncV2Ref,
  });

  // Transition lock to prevent double-advance
  const transitionLockRef = useRef(false);

  // Auto-play next song when current ends
  const handleVideoEnded = useCallback(() => {
    // Prevent double-advance from overlapping onEnded + skip
    if (transitionLockRef.current) return;
    transitionLockRef.current = true;
    setTimeout(() => { transitionLockRef.current = false; }, 1000);

    if (roomMode === 'team-battle') {
       setShowWinnerScreen(true);
       return;
    }

    const currentIndex = syncV2Ref.current?.playbackState.currentSongIndex ?? 0;
    const nextIndex = currentIndex + 1;
    
    if (queue.length === 0 || nextIndex >= queue.length) {
       console.log('Queue ended, stopping playback');
       if (isHost) syncV2Ref.current?.endSong();
       return;
    }

    if (nextIndex < queue.length) {
      if (isHost) {
        if (autoPlayNext) {
            syncV2Ref.current?.prepareSong(nextIndex);
        } else {
            syncV2Ref.current?.endSong();
        }
      }
    }
  }, [queue.length, isHost, roomMode, autoPlayNext]);

  const handleNextRound = useCallback(() => {
     setShowWinnerScreen(false);
     const currentIndex = syncV2Ref.current?.playbackState.currentSongIndex ?? 0;
     const nextIndex = currentIndex + 1;
     if (nextIndex < queue.length) {
       if (isHost) syncV2Ref.current?.prepareSong(nextIndex);
     } else {
       syncV2Ref.current?.endSong();
     }
  }, [queue.length, isHost]);

  // initialVideoId: used by useYouTubePlayer for first render. SyncV2 handles actual cuing.
  const initialVideoId = queue[0]?.videoId || null;

  const { isReady, currentTime, duration, isPlaying, play, pause, seekTo, setVolume: setPlayerVolume, mute, unmute, isMuted, enableCaptions, disableCaptions, areCaptionsEnabled, hasCaptionsAvailable, error: playerError, clearError, cueVideo, getCurrentTime: getPlayerTime } = useYouTubePlayer('youtube-player', initialVideoId, handleStateChange, handleVideoEnded, privacyMode);

  const syncV2 = useSyncV2({
    channel, userId: user?.id || null, isHost, queue,
    onSeekRequired: seekTo, onPlayRequired: play, onPauseRequired: pause,
    onCueVideo: cueVideo, getCurrentVideoTime: getPlayerTime, isPlayerReady: isReady,
  });

  // Keep syncV2Ref and applyFullSyncPlaybackRef updated
  useEffect(() => {
    syncV2Ref.current = syncV2;
    applyFullSyncPlaybackRef.current = syncV2.applyFullSyncPlayback;
  }, [syncV2]);

  // === SyncV2 is now the single source of truth for playback state ===
  const playbackState = syncV2.playbackState;
  const currentSongIndex = playbackState.currentSongIndex;
  const currentSong = useMemo(() => queue[currentSongIndex], [queue, currentSongIndex]);

  useEffect(() => {
    setVideoId(currentSong?.videoId || null);
  }, [currentSong?.videoId, setVideoId]);

  useEffect(() => {
    if (!currentSong?.videoId) return;
    markApplyingRemote();
  }, [currentSong?.videoId, markApplyingRemote]);

  // --- Playback Controls hook ---
  const {
    volume, handlePlayPause, handleSeek, handleForceSync,
    handleNext, handlePrevious, handleVolumeChange,
  } = usePlaybackControls({
    canControl, syncV2, play, pause, seekTo, getPlayerTime,
    setPlayerVolume, isHost, isPlaying,
    currentSongIndex, queueLength: queue.length,
  });

  // --- Room Queue hook ---
  const {
    handleAddSong, handleRemoveSong, handleSelectSong,
  } = useRoomQueue({
    queue, updateQueue, canControl, syncV2,
    playbackStatus: playbackState.status,
    currentSongIndex,
    currentVideoId: playbackState.videoId,
    isHost, syncV2Ref,
  });

  // Audio reactive
  const { intensity: audioIntensity, beatPhase, isBeat, bpm } = useAudioReactive({ 
    enabled: isPlaying, sensitivity: 6, targetBpm: 120 
  });

  const maxUserAudioLevel = useMemo(() => {
    return Math.max(0, ...users.map(u => u.audioLevel || 0));
  }, [users]);
  
  const isExtraLoudSinging = maxUserAudioLevel > 0.65;

  const remainingSeconds = duration > 0 ? Math.ceil(duration - currentTime) : null;
  const showCountdown = isPlaying && remainingSeconds !== null && remainingSeconds > 0 && remainingSeconds <= 5;

  const { getStatusForSong, getLyricsForSong } = useLyricsPreload(queue, currentSongIndex);
  const preloadedLyrics = currentSong ? getLyricsForSong(currentSong.id) : undefined;

  const syncedCurrentTime = useMemo(() => {
    if (syncV2?.isTimeCalibrated && playbackState.status === 'playing') {
      return syncV2.getTargetTime();
    }
    return currentTime;
  }, [syncV2, playbackState.status, currentTime]);

  const { 
    lyrics, currentLineIndex, isLoading: lyricsLoading, error: lyricsError, 
    offset: lyricsOffset, setOffset: setLyricsOffset,
    allMatches, selectedMatchIndex, selectMatch, source: lyricsSource,
  } = useLyrics(currentSong?.artist || null, currentSong?.title || null, syncedCurrentTime, preloadedLyrics);

  const [showLyricsSelector, setShowLyricsSelector] = useState(false);
  const [hasShownSelectorForSong, setHasShownSelectorForSong] = useState<string | null>(null);

  useEffect(() => {
    if (currentSong?.id && allMatches.length > 1 && hasShownSelectorForSong !== currentSong.id) {
      setShowLyricsSelector(true);
      setHasShownSelectorForSong(currentSong.id);
    }
  }, [currentSong?.id, allMatches.length, hasShownSelectorForSong]);

  const handleLyricsConfirm = useCallback(() => { setShowLyricsSelector(false); }, []);
  const handleLyricsSkip = useCallback(() => {
    setShowLyricsSelector(false);
    if (hasCaptionsAvailable) enableCaptions();
  }, [hasCaptionsAvailable, enableCaptions]);

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

  // Reactions and waving
  const { reactions, sendReaction } = useReactions(channel, user?.id || '');
  const { isWaving, toggleWaving, wavingUsers } = useWaving(channel, user?.id || '');
  
  // Vote kick (kept inline - depends on channel/users from useRoom)
  const handleUserKicked = useCallback(() => {
    sessionStorage.removeItem('karaoke_user');
    navigate('/');
  }, [navigate]);
  
  const { activeVoteKick, startVoteKick, voteYes, voteNo, hasVoted } = useVoteKick(
    channel, user?.id || '', users, handleUserKicked
  );

  const handleVoteKick = useCallback((userId: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (targetUser) startVoteKick(targetUser);
  }, [users, startVoteKick]);

  // Winner screen state
  const [showWinnerScreen, setShowWinnerScreen] = useState(false);
  useEffect(() => { setShowWinnerScreen(false); }, [currentSongIndex]);

  const { 
    isEnabled: isMicEnabled, toggleMic, applyEQ, remoteAudioLevels, webrtcStats,
    threshold, setThreshold, isMonitorEnabled, setMonitorEnabled,
    monitorVolume, setMonitorVolume,
    noiseSuppression, setNoiseSuppression, echoCancellation, setEchoCancellation,
    autoGainControl, setAutoGainControl, micGain, setMicGain,
    compressorThreshold, setCompressorThreshold, compressorRatio, setCompressorRatio,
  } = useMicrophone(handleSpeakingChange, channel, user?.id, users, userVolumes, isLyricActive);

  const handleEqChange = (newSettings: number[]) => {
    setEqSettings(newSettings);
    applyEQ(newSettings);
  };

  const handleMicToggle = useCallback(() => {
    toggleMic(eqSettings);
    updateMicStatus(!isMicEnabled);
  }, [toggleMic, eqSettings, updateMicStatus, isMicEnabled]);

  const handleLeave = useCallback(() => {
    sessionStorage.removeItem('karaoke_user');
    navigate('/');
  }, [navigate]);

  // Host action ref setup
  useEffect(() => {
    onHostActionRef.current = (action, payload) => {
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
  }, [handleLeave, isMicEnabled, toggleMic, eqSettings]);

  const isMobile = useMediaQuery('(max-width: 1024px) and (pointer: coarse)');
  const youtubePlayerRef = useRef<HTMLDivElement>(null);

  if (!user || !code) return null;

  if (isMobile) {
    return (
      <>
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
          onPlayPause={handlePlayPause}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onSeek={handleSeek}
          onAddSong={handleAddSong}
          onRemoveSong={handleRemoveSong}
          onSelectSong={handleSelectSong}
          onVoteKick={handleVoteKick}
          onLeave={handleLeave}
          isMicEnabled={isMicEnabled}
          onMicToggle={handleMicToggle}
          volume={volume}
          onVolumeChange={handleVolumeChange}
          eqSettings={eqSettings}
          onEqChange={handleEqChange}
          youtubePlayerRef={youtubePlayerRef}
          currentTime={currentTime}
          duration={duration}
          
          lyricsProps={{
            lyrics, currentLineIndex, isLoading: lyricsLoading, error: lyricsError,
            offset: lyricsOffset, onOffsetChange: setLyricsOffset,
            onLyricsConfirm: handleLyricsConfirm, onLyricsSkip: handleLyricsSkip,
            showSelector: showLyricsSelector, allMatches, selectedMatchIndex,
            onSelectMatch: selectMatch, source: lyricsSource
          }}
          
          reactionProps={{
            channel, userId: user.id, reactions, onReaction: sendReaction,
            onWave: toggleWaving, isWaving, wavingUsers
          }}
          
          votingProps={{
            channel, currentUserId: user.id, users, currentMode: roomMode, isHost,
            onModeChange: updateMode, activeVoteKick, hasVoted,
            onStartVoteKick: handleVoteKick, onVoteYes: voteYes, onVoteNo: voteNo,
            voteKickDisabled: !!activeVoteKick
          }}
          
          settingsProps={{
            celebrationEnabled, onCelebrationToggle: setCelebrationEnabled,
            eqSettings, onEqChange: handleEqChange,
            threshold, onThresholdChange: setThreshold,
            isMonitorEnabled, onMonitorEnabledChange: setMonitorEnabled,
            monitorVolume, onMonitorVolumeChange: setMonitorVolume,
            noiseSuppression, onNoiseSuppressionChange: setNoiseSuppression,
            echoCancellation, onEchoCancellationChange: setEchoCancellation,
            autoGainControl, onAutoGainControlChange: setAutoGainControl,
            micGain, onMicGainChange: setMicGain,
            compressorThreshold, onCompressorThresholdChange: setCompressorThreshold,
            compressorRatio, onCompressorRatioChange: setCompressorRatio
          }}
        />
      </>
    );
  }

  // --- Prop assembly for DesktopRoomLayout ---

  const headerProps = {
    code, isHost, isConnected, userCount: users.length, networkLatency,
    isMicEnabled, webrtcStats, roomMode, syncStatus,
    onShowHostControlPanel: () => setShowHostControlPanel(true),
    onLeave: handleLeave,
    roomMenuProps: {
      channel, currentUserId: user.id, users, currentMode: roomMode, isHost,
      onModeChange: updateMode, activeVoteKick, hasVoted,
      onStartVoteKick: handleVoteKick, onVoteYes: voteYes, onVoteNo: voteNo,
      voteKickDisabled: !!activeVoteKick,
      celebrationEnabled, onCelebrationToggle: setCelebrationEnabled,
      eqSettings, onEqChange: handleEqChange,
      threshold, onThresholdChange: setThreshold,
      isMonitorEnabled, onMonitorEnabledChange: setMonitorEnabled,
      monitorVolume, onMonitorVolumeChange: setMonitorVolume,
      noiseSuppression, onNoiseSuppressionChange: setNoiseSuppression,
      echoCancellation, onEchoCancellationChange: setEchoCancellation,
      autoGainControl, onAutoGainControlChange: setAutoGainControl,
      micGain, onMicGainChange: setMicGain,
      compressorThreshold, onCompressorThresholdChange: setCompressorThreshold,
      compressorRatio, onCompressorRatioChange: setCompressorRatio,
    },
  };

  const showReadyCheck = playbackState.status === 'preparing' || playbackState.status === 'ready';
  const readyCheckUsers = users.map(u => ({
    id: u.id, nickname: u.nickname, isReady: !!syncV2.playerReadyStates[u.id],
  }));
  const showNoSong = !currentSong;
  const showRecommendations = !isPlaying && !playerError && queue.length <= 1 && recommendations.length > 0;
  const showPlayerError = !!playerError && !!currentSong;
  const showLyrics = !(hideLyricsWhenNotFound && (lyricsError || lyrics.length === 0));

  const stageProps = {
    showSingReactOverlay: true,
    singReactOverlayProps: {
      isPlaying, userId: user.id, channel,
      className: "absolute inset-0 rounded-lg overflow-hidden",
    },
    showCountdown, remainingSeconds, showReadyCheck, readyCheckUsers, isHost,
    onForceStart: () => syncV2.forceStart(),
    showNoSong, showRecommendations, recommendations,
    onAddRecommendation: addRecommendation,
    onDismissRecommendations: dismissRecommendations,
    showPlayerError, playerError,
    onClearErrorAndSkip: () => { clearError(); handleVideoEnded(); },
    hasMoreSongs: queue.length > 1,
    isPlaying,
    isPaused: !isPlaying && playbackState.status === 'paused',
    showLyrics,
    lyricsDisplayProps: {
      lyrics, currentLineIndex, currentTime, isLoading: lyricsLoading,
      error: lyricsError, offset: lyricsOffset, onOffsetChange: setLyricsOffset,
      onSeek: handleSeek, areCaptionsEnabled, hasCaptionsAvailable,
      onEnableCaptions: enableCaptions, onDisableCaptions: disableCaptions,
      source: lyricsSource, hasMultipleMatches: allMatches.length > 1,
      matchCount: allMatches.length, onChangeLyrics: () => setShowLyricsSelector(true),
    },
  };

  const controlsProps = {
    remoteControlProps: {
      isPlaying, isMuted, volume, currentTime, duration, isMicEnabled,
      canGoPrevious: currentSongIndex > 0,
      canGoNext: currentSongIndex < queue.length - 1,
      onPlayPause: handlePlayPause, onNext: handleNext, onPrevious: handlePrevious,
      onSeek: handleSeek, onVolumeChange: handleVolumeChange,
      onMuteToggle: isMuted ? unmute : mute, onMicToggle: handleMicToggle,
      onSync: requestSync, isHost: canControl, users, queue,
      currentSongIndex, roomMode, battleFormat,
      onForceSync: handleForceSync, onSmartPlay: handlePlayPause,
      onSmartPause: handlePlayPause, onHostSeek: handleSeek,
      onRemoveSong: handleRemoveSong, onSelectSong: handleSelectSong,
      currentSong, networkLatency,
    },
    reactionBarProps: {
      onReact: sendReaction, isWaving, onWaveToggle: toggleWaving,
    },
  };

  const overlaysProps = {
    showTeamBattle: roomMode === 'team-battle',
    teamBattleProps: {
      users, isPlaying: playbackState.isPlaying, onContinue: handleNextRound,
      showWinner: showWinnerScreen, isHost, currentUserId: user.id,
    },
    showVoteKick: !!activeVoteKick,
    voteKickProps: {
      voteKick: activeVoteKick!, currentUserId: user.id, hasVoted,
      onVoteYes: voteYes, onVoteNo: voteNo,
    },
    showLyricsSelector: showLyricsSelector && allMatches.length > 1,
    lyricsSelectorProps: {
      matches: allMatches, selectedIndex: selectedMatchIndex, onSelect: selectMatch,
      onConfirm: handleLyricsConfirm, onSkip: handleLyricsSkip,
      songTitle: currentSong?.title || 'Unknown Song', autoConfirmSeconds: 10,
    },
  };

  const queuePanelProps = {
    isHost, queue, currentSongIndex, canControl,
    onAddSong: handleAddSong, onRemoveSong: handleRemoveSong,
    onSelectSong: handleSelectSong, userId: user.id, getStatusForSong,
  };

  const avatarRowProps = {
    users, currentUserId: user.id, wavingUsers, audioIntensity, beatPhase,
    isBeat, bpm, onStartVoteKick: startVoteKick,
    voteKickDisabled: !!activeVoteKick, roomMode, battleFormat,
    userVolumes, onVolumeChange: handleUserVolumeChange,
  };

  const layoutFlags = {
    isHost, celebrationEnabled, isExtraLoudSinging, isPlaying, maxUserAudioLevel,
  };

  const hostControlPanelProps = {
    isOpen: showHostControlPanel,
    onClose: () => setShowHostControlPanel(false),
    networkLatency, onForceSync: handleForceSync, users,
    onKickUser: kickUser, onForceMuteUser: forceMuteUser,
    onToggleControlAccess: toggleControlAccess, currentUserId: user.id,
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
    />
  );
};
