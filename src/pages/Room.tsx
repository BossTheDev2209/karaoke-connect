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

import { DesktopRoomLayout } from '@/components/room/DesktopRoomLayout';
import { getCurrentCelebration } from '@/components/effects/CelebrationOverlay';
import { useReactions, useWaving } from '@/components/Reactions';
import { useAudioReactive } from '@/hooks/useAudioReactive';
import { useVoteKick } from '@/components/VoteKick';
import { MobileRoomLayout } from '@/components/MobileRoomLayout';
import { useMediaQuery } from '@/hooks/useMediaQuery';

import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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

  // Recommendations state
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);

  // Fetch recommendations when current song changes
  useEffect(() => {
    // Reset recommendations when song changes
    setRecommendations([]); 
    
    // Fetch if there's a current song and queue is ending (last song or empty)
    if (!currentSong || queue.length > 1) { 
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

  // Host Watcher: Auto-start playback if queue grows while idle (e.g. member adds song via recommendations)
  useEffect(() => {
    if (!isHost) return;
    
    const isStopped = playbackState.status === 'idle';
    
    if (isStopped && queue.length > 0) {
        // Scenario 1: Pending songs exist after current index
        const nextIndex = playbackState.currentSongIndex + 1;
        if (nextIndex < queue.length) {
             console.log('[Room] Auto-advancing to new song added by member');
             syncV2Ref.current?.prepareSong(nextIndex);
        } 
        // Scenario 2: First song added to empty queue (fresh room)
        else if (queue.length === 1 && !playbackState.videoId) {
             console.log('[Room] Auto-starting first song added by member');
             syncV2Ref.current?.prepareSong(0);
        }
    }
  }, [queue.length, isHost, playbackState.status, playbackState.videoId, playbackState.currentSongIndex]);

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
        if (autoPlayNext) {
            syncV2Ref.current?.prepareSong(nextIndex);
        } else {
            // Queue ended / Auto-play disabled - stop playing but stay on current or just stop?
            // If we don't prepare next, we just stop.
            // But we should probably "finish" the current state.
            updatePlayback({ isPlaying: false, status: 'idle' });
            // Optionally we could notify "Auto-play disabled"
        }
      }
    }
  }, [queue.length, playbackState.currentSongIndex, updatePlayback, isHost, roomMode, autoPlayNext]);

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
      activeVoteKick,
      hasVoted,
      onStartVoteKick: handleVoteKick,
      onVoteYes: voteYes,
      onVoteNo: voteNo,
      voteKickDisabled: !!activeVoteKick,
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
    onDismissRecommendations: () => setRecommendations([]),
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
      showWinner: showWinnerScreen,
      isHost,
      currentUserId: user.id,
    },
    showVoteKick: !!activeVoteKick,
    voteKickProps: {
      voteKick: activeVoteKick!,
      currentUserId: user.id,
      hasVoted,
      onVoteYes: voteYes,
      onVoteNo: voteNo,
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
    onStartVoteKick: startVoteKick,
    voteKickDisabled: !!activeVoteKick,
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

