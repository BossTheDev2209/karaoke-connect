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
import { supabase } from '@/integrations/supabase/client';

import { LyricsDisplay } from '@/components/LyricsDisplay';
import { RemoteControl } from '@/components/RemoteControl';
import { SongQueue } from '@/components/SongQueue';
import { SongSearch } from '@/components/SongSearch';
import { UserAvatarRow } from '@/components/UserAvatarRow';
import { RoomCodeDisplay } from '@/components/RoomCodeDisplay';
import { RoomMenu } from '@/components/RoomMenu';
import { CelebrationOverlay, getCurrentCelebration } from '@/components/effects/CelebrationOverlay';
import { ReactionBar, FloatingReactions, useReactions, useWaving } from '@/components/Reactions';
import { SingReactOverlay } from '@/components/effects/SingReactOverlay';
import { DustFallEffect } from '@/components/effects/SingerEffects';
import { useAudioReactive } from '@/hooks/useAudioReactive';
import { useVoteKick, VoteKickOverlay } from '@/components/VoteKick';
import { TeamBattleOverlay } from '@/components/TeamBattleOverlay';
import { LyricsSelector } from '@/components/LyricsSelector';
import { MobileRoomLayout } from '@/components/MobileRoomLayout';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { HostControlPanel } from '@/components/HostControlPanel';

import { LogOut, Swords, Mic2, Sparkles, Play, Crown, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const [volume, setVolume] = useState(80);
  const [celebration] = useState(getCurrentCelebration());
  const [celebrationEnabled, setCelebrationEnabled] = useState(true);
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
  
  // Theme context
  // const { setVideoId, privacyMode } = useTheme(); // This line is removed as per instruction

  // useEffect(() => { // This useEffect block is removed as per instruction
  //   const stored = sessionStorage.getItem('karaoke_user');
  //   if (stored) {
  //     setUser(JSON.parse(stored));
  //   } else {
  //     navigate('/');
  //   }
  // }, [navigate]);

  // Refs for auto sync logic (to avoid circular dependency)
  const isHostRef = useRef(false);
  const playbackStateRef = useRef<{ isPlaying?: boolean }>({ isPlaying: false });
  const startSyncLockRef = useRef<(() => void) | null>(null);

  // Ref for handling host actions (mute/kick) to avoid circular dependencies with useMicrophone
  const onHostActionRef = useRef<((action: 'mute' | 'kick' | 'control_access', payload?: any) => void) | null>(null);

  const handleHostAction = useCallback((action: 'mute' | 'kick' | 'control_access', payload?: any) => {
    onHostActionRef.current?.(action, payload);
  }, []);

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
    // NOTE: clockOffset removed - useSyncV2 uses serverTimeOffset from useServerTime instead
    kickUser,
    forceMuteUser,
    toggleControlAccess,
  } = useRoom(code || '', user, handleUserJoin, handleHostAction);

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

  // Ref for syncV2 to break circular dependency with handleVideoEnded
  const syncV2Ref = useRef<{ prepareSong: (index: number) => void } | null>(null);

  // When the current video changes (often driven by remote sync), suppress transient player events
  useEffect(() => {
    if (!currentSong?.videoId) return;
    markApplyingRemote();
  }, [currentSong?.videoId, markApplyingRemote]);

  const handleStateChange = useCallback((isPlaying: boolean) => {
    if (applyingRemoteRef.current) return;
    updatePlayback({ isPlaying });
  }, [updatePlayback]);

  // Recommendations state
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);

  // Fetch recommendations when current song changes
  useEffect(() => {
    // Reset recommendations when song changes
    setRecommendations([]); 
    
    if (!currentSong || !isHost || queue.length > 1) { 
        return;
    }
    
    const fetchRecs = async () => {
      setIsLoadingRecs(true);
      try {
        const query = currentSong.artist ? `${currentSong.artist} karaoke` : `${currentSong.title} karaoke`;
        console.log('Fetching recommendations for:', query);
        
        const { data, error } = await supabase.functions.invoke('youtube-search', {
          body: { query, type: 'video' }
        });
        
        if (data?.results) {
          // Filter out current song and map to Song type
          const recs = data.results
            .filter((r: any) => r.videoId !== currentSong.videoId)
            .slice(0, 3)
            .map((r: any) => ({
              id: crypto.randomUUID(),
              videoId: r.videoId,
              title: r.title,
              artist: r.channelTitle, // Best guess
              thumbnail: r.thumbnail,
              duration: r.duration
            }));
          setRecommendations(recs);
        }
      } catch (err) {
        console.error('Failed to fetch recommendations:', err);
      } finally {
        setIsLoadingRecs(false);
      }
    };
    
    fetchRecs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.videoId, queue.length, isHost]);

  const addRecommendation = (rec: any) => {
    const newSong: Song = {
      id: crypto.randomUUID(),
      videoId: rec.videoId,
      title: rec.title,
      artist: rec.artist,
      duration: rec.duration || '3:00', // approximation
      addedBy: (user as any).name || user.nickname || 'System',
      thumbnail: rec.thumbnail
    };
    
    // Calculate the new song's index BEFORE updating queue
    const newSongIndex = queue.length;
    const newQueue = [...queue, newSong];
    
    // Update queue via useRoom hook
    updateQueue(newQueue);
    
    // Clear recommendations immediately
    setRecommendations([]);

    // Use the new sync system to prepare and start the song
    // This triggers the ready check flow for synchronized playback
    if (isHost) {
      // Small delay to allow queue update to propagate
      setTimeout(() => {
        syncV2Ref.current?.prepareSong(newSongIndex);
      }, 100);
    }
  };

  // State for Team Battle Winner Screen
  const [showWinnerScreen, setShowWinnerScreen] = useState(false);

  // Close winner screen when song changes (for non-hosts reacting to host action)
  useEffect(() => {
    setShowWinnerScreen(false);
  }, [playbackState.currentSongIndex]);

  // Auto-play next song when current ends (no looping)
  const handleVideoEnded = useCallback(() => {
    // Battle Mode Logic - Show Winner Screen first
    if (roomMode === 'team-battle') {
       setShowWinnerScreen(true);
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
        syncV2Ref.current?.prepareSong(nextIndex);
      }
    }
  }, [queue.length, playbackState.currentSongIndex, updatePlayback, isHost, roomMode]);

  const handleNextRound = useCallback(() => {
     setShowWinnerScreen(false);
     
     // Advance to next song
     const nextIndex = playbackState.currentSongIndex + 1;
     if (nextIndex < queue.length) {
       // Use the new sync system for synchronized start
       if (isHost) {
         syncV2Ref.current?.prepareSong(nextIndex);
       }
     } else {
       updatePlayback({ isPlaying: false, status: 'idle' });
     }
  }, [playbackState.currentSongIndex, queue.length, updatePlayback, isHost]);

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


  // NOTE: Legacy sync logic removed - useSyncV2 now handles ALL synchronization
  // via server time offset (useServerTime) and Web Worker for background-safe correction

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
    currentTime,
    preloadedLyrics
  );

  // State for showing lyrics selector
  const [showLyricsSelector, setShowLyricsSelector] = useState(false);
  const [hasShownSelectorForSong, setHasShownSelectorForSong] = useState<string | null>(null);

  // Show lyrics selector when song changes and there are multiple matches
  useEffect(() => {
    if (currentSong?.id && allMatches.length > 1 && hasShownSelectorForSong !== currentSong.id) {
      // Only show selector once per song and if there are alternatives
      setShowLyricsSelector(true);
      setHasShownSelectorForSong(currentSong.id);
    }
  }, [currentSong?.id, allMatches.length, hasShownSelectorForSong]);

  const handleLyricsConfirm = useCallback(() => {
    setShowLyricsSelector(false);
  }, []);

  const handleLyricsSkip = useCallback(() => {
    setShowLyricsSelector(false);
    // Enable YouTube CC as fallback
    if (hasCaptionsAvailable) {
      enableCaptions();
    }
  }, [hasCaptionsAvailable, enableCaptions]);

  // Calculate if a lyric line is currently active (for Rhythm Scoring)
  const isLyricActive = useMemo(() => {
    if (!lyrics || lyrics.length === 0 || currentLineIndex === -1) return false;
    if (currentLineIndex >= lyrics.length) return false;
    
    const currentLine = lyrics[currentLineIndex];
    
    // Determine end time
    let endTime = Infinity;
    if (currentLineIndex < lyrics.length - 1) {
      endTime = lyrics[currentLineIndex + 1].time;
    } else {
      // Last line - assume 5 seconds
      endTime = currentLine.time + 5;
    }
    
    // Check if within time window and text is valid (not instrumental marker)
    // Note: Some instrumentals might be marked in text, but usually empty/symbols
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
    // Broadcast mic status after toggle (inverted because toggleMic toggles the state)
    updateMicStatus(!isMicEnabled);
  }, [toggleMic, eqSettings, updateMicStatus, isMicEnabled]);

  const handlePlayPause = () => {
    if (canControl) {
      if (isPlaying) {
        syncV2.pause();
      } else {
        syncV2.resume();
      }
    } else {
      if (isPlaying) {
        pause();
      } else {
        play();
      }
    }
  };

  const handleSeek = (time: number) => {
    if (canControl) {
      syncV2.seek(time);
    } else {
      seekTo(time); // Instant local feedback
    }
  };

  // Force sync all users to current playback position
  const handleForceSync = useCallback(() => {
    if (!isHost) return;
    const currentPos = getPlayerTime();
    console.log('[Room] Force syncing all users to:', currentPos);
    syncV2.seek(currentPos);
  }, [isHost, getPlayerTime, syncV2]);

  const handleNext = () => {
    if (playbackState.currentSongIndex < queue.length - 1) {
      const nextIndex = playbackState.currentSongIndex + 1;
      if (canControl) {
        syncV2.prepareSong(nextIndex);
      } else {
        updatePlayback({ currentSongIndex: nextIndex, currentTime: 0, isPlaying: true });
      }
    }
  };

  const handlePrevious = () => {
    if (playbackState.currentSongIndex > 0) {
      const prevIndex = playbackState.currentSongIndex - 1;
      if (canControl) {
        syncV2.prepareSong(prevIndex);
      } else {
        updatePlayback({ currentSongIndex: prevIndex, currentTime: 0, isPlaying: true });
      }
    }
  };

  const handleAddSong = (song: Song) => {
    updateQueue([...queue, song]);
  };

  const handleRemoveSong = (songId: string) => {
    updateQueue(queue.filter(s => s.id !== songId));
  };

  const handleSelectSong = (index: number) => {
    if (canControl) {
      syncV2.prepareSong(index);
    } else {
      updatePlayback({ currentSongIndex: index, currentTime: 0, isPlaying: true });
    }
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    setPlayerVolume(v);
  };

  const handleLeave = () => {
    sessionStorage.removeItem('karaoke_user');
    navigate('/');
  };

  // Hydrate SyncV2 state with the latest playback state from legacy sync if SyncV2 is behind
  // (Fixes issue where new joiners don't sync because SyncV2 missed the start event)
  useEffect(() => {
    if (playbackState.lastUpdate && playbackState.lastUpdate > (syncV2.playbackState.lastUpdate || 0)) {
        // We received a newer state from legacy sync (e.g., initial full_sync_response)
        // Check if it has SyncV2 data (startAtRoomTime)
        if (playbackState.startAtRoomTime) {
            console.log('[Room] Hydrating SyncV2 with incoming full sync state');
            // We can't directly set SyncV2 state from here because it's internal to the hook.
            // But we can trigger a force sync-like behavior if we detect desync.
            // Actually, best approach is to have useSyncV2 listen to full_sync_response internally (which I'll do in useRoom/useSyncV2).
            // But if useSyncV2 is separate... 
            // Better fix: Update useSyncV2 to accept external state updates or listen to the event.
            // I'll leave this valid comment but handle the logic in useRoom/useSyncV2 integration below.
        }
    }
  }, [playbackState, syncV2.playbackState.lastUpdate]);
  useEffect(() => {
    onHostActionRef.current = (action, payload) => {
      if (action === 'kick') {
        toast.error('You have been kicked from the room.');
        handleLeave();
      } else if (action === 'mute') {
        if (isMicEnabled) {
             toast.warning('Your microphone was muted by the host.');
             // We need to force disable. toggleMic toggles.
             // But if isMicEnabled check is true, toggleMic() will disable.
             // We pass current settings to ensure we don't reset EQ
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

  // Check for mobile layout
  const isMobile = useMediaQuery('(max-width: 768px)');
  const youtubePlayerRef = useRef<HTMLDivElement>(null);
  
  const handleVoteKick = useCallback((userId: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (targetUser) {
      startVoteKick(targetUser);
    }
  }, [users, startVoteKick]);

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
          onVoteKick={handleVoteKick}
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
            activeVoteKick,
            hasVoted,
            onStartVoteKick: handleVoteKick,
            onVoteYes: voteYes,
            onVoteNo: voteNo,
            voteKickDisabled: !!activeVoteKick
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
        
        {/* Floating SingReactOverlay for mobile - optional/hidden but needed for logic? */}
        {/* Actually MobileRoomLayout handles video and overlays internally or hides them */}
      </>
    );
  }

  return (
    <div className="h-screen flex flex-col p-4 gap-3 overflow-hidden">
      {/* Celebration effects */}
      {celebrationEnabled && <CelebrationOverlay theme={celebration} />}
      
      {/* Host Control Panel (Modrinth-style popup) */}
      <HostControlPanel
        isOpen={showHostControlPanel}
        onClose={() => setShowHostControlPanel(false)}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        currentSong={currentSong}
        canGoPrevious={playbackState.currentSongIndex > 0}
        canGoNext={playbackState.currentSongIndex < queue.length - 1}
        onPlayPause={handlePlayPause}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onSeek={handleSeek}
        networkLatency={networkLatency}
        onSync={requestSync}
        onForceSync={handleForceSync}
        users={users}
        volume={volume}
        isMuted={isMuted}
        onVolumeChange={handleVolumeChange}
        onMuteToggle={isMuted ? unmute : mute}
        isMicEnabled={isMicEnabled}
        onMicToggle={handleMicToggle}
        onKickUser={kickUser}
        onForceMuteUser={forceMuteUser}
        onToggleControlAccess={toggleControlAccess}
        currentUserId={user.id}
        audioSettings={{
          eqSettings: eqSettings,
          onEqChange: handleEqChange,
          noiseSuppression: noiseSuppression,
          onNoiseSuppressionChange: setNoiseSuppression,
          echoCancellation: echoCancellation,
          onEchoCancellationChange: setEchoCancellation,
          autoGainControl: autoGainControl,
          onAutoGainControlChange: setAutoGainControl,
          micGain: micGain,
          onMicGainChange: setMicGain,
          compressorThreshold: compressorThreshold,
          onCompressorThresholdChange: setCompressorThreshold,
          compressorRatio: compressorRatio,
          onCompressorRatioChange: setCompressorRatio,
        }}
      />

      {/* Floating reactions */}
      
      {/* Dust fall effect when singing EXTRA loudly (Level 2) */}
      <DustFallEffect isActive={isExtraLoudSinging && isPlaying} intensity={maxUserAudioLevel} />
      {/* Header - Host gets amber accent */}
      <header className={cn(
        "flex flex-wrap gap-2 items-center justify-between rounded-xl px-4 py-2 transition-all",
        isHost 
          ? "bg-gradient-to-r from-amber-950/40 via-background to-background border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)]" 
          : "bg-background/50"
      )}>
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

          {/* Host Control Panel Button (Host only) */}
          {isHost && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHostControlPanel(true)}
              className="gap-2 border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-500/50 text-amber-400"
            >
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">Host Controls</span>
            </Button>
          )}
          {/* Unified Room Menu (replaces VotingPanel & RoomSettings) */}
          <RoomMenu
            // Voting Props
            channel={channel}
            currentUserId={user.id}
            users={users}
            currentMode={roomMode}
            isHost={isHost}
            onModeChange={updateMode}
            activeVoteKick={activeVoteKick}
            hasVoted={hasVoted}
            onStartVoteKick={handleVoteKick}
            onVoteYes={voteYes}
            onVoteNo={voteNo}
            voteKickDisabled={!!activeVoteKick}
            
            // Settings Props
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
        {/* Queue panel - Different for Host vs Member */}
        <div className={cn(
          "lg:col-span-3 card-karaoke overflow-hidden flex flex-col order-3 lg:order-1",
          isHost && "border-amber-500/20 bg-gradient-to-b from-amber-950/20 to-transparent"
        )}>
          <div className="flex items-center gap-2 mb-3">
            {isHost ? (
              <>
                <Crown className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-amber-400">Your Queue</h3>
              </>
            ) : (
              <h3 className="font-semibold text-muted-foreground">Room Queue</h3>
            )}
          </div>
          <div className={cn("mb-3", !isHost && "opacity-70")}>
            <SongSearch onAddSong={handleAddSong} userId={user.id} />
          </div>
          <div className="flex-1 overflow-y-auto">
            <SongQueue 
              queue={queue} 
              currentIndex={playbackState.currentSongIndex} 
              onRemove={isHost ? handleRemoveSong : undefined} 
              onSelect={isHost ? handleSelectSong : undefined}
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

            {/* Ready Check Overlay (SyncV2) */}
            {(syncV2.playbackState.status === 'preparing' || syncV2.playbackState.status === 'ready') && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg z-20">
                <div className="text-center space-y-4 p-6">
                  <div className="animate-pulse">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                      <Play className="w-8 h-8 text-primary" />
                    </div>
                  </div>
                  <div className="text-xl font-semibold">Waiting for players...</div>
                  <div className="flex flex-wrap justify-center gap-2 max-w-xs">
                    {users.map(u => (
                      <div 
                        key={u.id}
                        className={cn(
                          "px-3 py-1 rounded-full text-sm flex items-center gap-2",
                          syncV2.playerReadyStates[u.id] 
                            ? "bg-green-500/20 text-green-400 border border-green-500/30" 
                            : "bg-muted text-muted-foreground border border-border"
                        )}
                      >
                        {syncV2.playerReadyStates[u.id] && <span className="text-green-400">✓</span>}
                        {u.nickname}
                      </div>
                    ))}
                  </div>
                  {isHost && (
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={() => syncV2.forceStart()}
                      className="mt-2"
                    >
                      Start Now
                    </Button>
                  )}
                </div>
              </div>
            )}


            {!currentSong && (
              <div className="absolute inset-0 flex items-center justify-center bg-card/80 rounded-lg">
                <p className="text-muted-foreground">Add songs to start!</p>
              </div>
            )}

            {/* Recommendations Overlay (Up Next) */}
            {!isPlaying && !playerError && queue.length <= 1 && recommendations.length > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-lg z-20 p-6 animate-in fade-in duration-300">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-white mb-2">Up Next</h3>
                  <p className="text-white/60 text-sm">Based on your last song</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
                  {recommendations.map((rec) => (
                    <button 
                      key={rec.id}
                      type="button"
                      className="group relative aspect-video bg-black/50 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all text-left"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('[Recommendations] Adding song to queue:', rec.title, rec.videoId);
                        addRecommendation(rec);
                      }}
                    >
                      <img src={rec.thumbnail} alt={rec.title} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute inset-0 flex flex-col justify-end p-3 bg-gradient-to-t from-black/90 to-transparent">
                        <p className="text-white font-medium text-sm line-clamp-2 leading-tight">{rec.title}</p>
                        <p className="text-white/60 text-xs mt-1 truncate">{rec.artist}</p>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-primary/90 text-primary-foreground rounded-full p-3 shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                          <Play className="w-6 h-6 fill-current" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                
                <Button 
                  variant="ghost" 
                  className="mt-8 text-white/50 hover:text-white"
                  onClick={() => setRecommendations([])}
                >
                  Cancel
                </Button>
              </div>
            )}

            {/* Player Error Overlay (Age-restricted, etc.) */}
            {playerError && currentSong && (
              <div className="absolute inset-0 flex items-center justify-center bg-card/95 rounded-lg backdrop-blur-sm z-10">
                <div className="text-center p-6 max-w-md">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {playerError.isAgeRestricted ? 'Age-Restricted Video' : 'Video Unavailable'}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {playerError.message}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <a
                      href={`https://www.youtube.com/watch?v=${playerError.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                      </svg>
                      Watch on YouTube
                    </a>
                    {queue.length > 1 && (
                      <button
                        onClick={() => {
                          clearError();
                          handleVideoEnded();
                        }}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors text-sm font-medium"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                        Skip to Next
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    {playerError.isAgeRestricted 
                      ? 'Age-restricted videos can only be watched directly on YouTube'
                      : 'This video cannot be played in an embedded player'}
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* Lyrics Display - Hide if option enabled and no lyrics found */}
          {!(hideLyricsWhenNotFound && (lyricsError || lyrics.length === 0)) && (
            <div className="card-karaoke h-[140px] shrink-0">
              <LyricsDisplay 
                lyrics={lyrics} 
                currentLineIndex={currentLineIndex} 
                currentTime={currentTime} 
                isLoading={lyricsLoading} 
                error={lyricsError}
                offset={lyricsOffset}
                onOffsetChange={setLyricsOffset}
                onSeek={handleSeek}
                areCaptionsEnabled={areCaptionsEnabled}
                hasCaptionsAvailable={hasCaptionsAvailable}
                onEnableCaptions={enableCaptions}
                onDisableCaptions={disableCaptions}
                source={lyricsSource}
                hasMultipleMatches={allMatches.length > 1}
                onChangeLyrics={() => setShowLyricsSelector(true)}
              />
            </div>
          )}
        </div>

        {/* Controls panel - Host gets special styling */}
        <div className={cn(
          "lg:col-span-3 card-karaoke flex flex-col order-2 lg:order-3",
          isHost && "border-amber-500/20 !p-0 overflow-hidden"
        )}>
          <RemoteControl
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
            isHost={canControl}
            users={users}
            queue={queue}
            currentSongIndex={playbackState.currentSongIndex}
            roomMode={roomMode}
            battleFormat={battleFormat}
            onForceSync={handleForceSync}
            onSmartPlay={handlePlayPause}
            onSmartPause={handlePlayPause}
            onHostSeek={handleSeek}
            onRemoveSong={handleRemoveSong}
            onSelectSong={handleSelectSong}
            currentSong={currentSong}
            networkLatency={networkLatency}
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
      
      {roomMode === 'team-battle' && (
        <TeamBattleOverlay 
          users={users} 
          isPlaying={playbackState.isPlaying} 
          onContinue={handleNextRound}
          showWinner={showWinnerScreen}
          isHost={isHost}
          currentUserId={user.id}
        />
      )}
      
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

      {/* Lyrics Selector - Show when multiple matches available */}
      {showLyricsSelector && allMatches.length > 1 && (
        <LyricsSelector
          matches={allMatches}
          selectedIndex={selectedMatchIndex}
          onSelect={selectMatch}
          onConfirm={handleLyricsConfirm}
          onSkip={handleLyricsSkip}
          songTitle={currentSong?.title || 'Unknown Song'}
          autoConfirmSeconds={10}
        />
      )}
    </div>
  );
};

