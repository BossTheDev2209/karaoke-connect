import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward,
  SkipBack,
  Volume2, 
  VolumeX,
  Mic,
  MicOff,
  RefreshCw,
  Zap,
  Users,
  ListMusic,
  Settings2,
  ChevronUp,
  ChevronDown,
  Swords,
  Crown,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { User, Song, RoomMode, BattleFormat } from '@/types/karaoke';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface RemoteControlProps {
  // Playback
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  isMicEnabled: boolean;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onMicToggle: () => void;
  onSync: () => void;
  
  // Host features
  isHost: boolean;
  users: User[];
  queue: Song[];
  currentSongIndex: number;
  roomMode: RoomMode;
  battleFormat?: BattleFormat;
  
  // Host actions
  onForceSync?: () => void;
  onSmartPlay?: () => void;
  onSmartPause?: () => void;
  onHostSeek?: (time: number) => void;
  onRemoveSong?: (songId: string) => void;
  onSelectSong?: (index: number) => void;
  
  // Current song info
  currentSong?: Song | null;
  
  // Network info
  networkLatency?: number;
}

export const RemoteControl: React.FC<RemoteControlProps> = ({
  isPlaying,
  isMuted,
  volume,
  currentTime,
  duration,
  isMicEnabled,
  canGoPrevious,
  canGoNext,
  onPlayPause,
  onNext,
  onPrevious,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onMicToggle,
  onSync,
  isHost,
  users,
  queue,
  currentSongIndex,
  roomMode,
  battleFormat,
  onForceSync,
  onSmartPlay,
  onSmartPause,
  onHostSeek,
  onRemoveSong,
  onSelectSong,
  currentSong,
  networkLatency = 0,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('playback');
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeekStart = () => {
    setIsSeeking(true);
    setSeekValue(currentTime);
  };

  const handleSeekChange = (value: number[]) => {
    setSeekValue(value[0]);
  };

  const handleSeekEnd = (value: number[]) => {
    setIsSeeking(false);
    if (isHost && onHostSeek) {
      onHostSeek(value[0]);
    } else {
      onSeek(value[0]);
    }
  };

  const handleSmartPlayPause = () => {
    if (isHost) {
      if (isPlaying && onSmartPause) {
        onSmartPause();
      } else if (!isPlaying && onSmartPlay) {
        onSmartPlay();
      } else {
        onPlayPause();
      }
    } else {
      onPlayPause();
    }
  };

  // Team grouping for battle mode
  const leftTeam = users.filter(u => u.team === 'left');
  const rightTeam = users.filter(u => u.team === 'right');
  const leftScore = leftTeam.reduce((sum, u) => sum + (u.score || 0), 0);
  const rightScore = rightTeam.reduce((sum, u) => sum + (u.score || 0), 0);

  return (
    <div className={cn(
      "flex flex-col h-full rounded-xl transition-all",
      isHost 
        ? "bg-gradient-to-b from-amber-950/30 via-background to-background border-2 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]" 
        : "bg-background"
    )}>
      {/* Header - Different for Host vs Member */}
      <div className={cn(
        "px-3 py-2 rounded-t-lg mb-2",
        isHost 
          ? "bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border-b border-amber-500/30" 
          : "border-b border-border"
      )}>
        {isHost ? (
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20">
              <Crown className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-400 tracking-wide">DJ CONTROL</h3>
              <p className="text-[10px] text-amber-400/60">You're running the show</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-muted">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Now Playing</h3>
              <p className="text-[10px] text-muted-foreground/60">Enjoy the music</p>
            </div>
          </div>
        )}
      </div>

      {/* Current Song Info */}
      {currentSong && (
        <div className="mb-3 px-3">
          <p className={cn(
            "font-medium truncate text-sm",
            isHost && "text-amber-100"
          )}>{currentSong.title}</p>
          <p className="text-xs text-muted-foreground truncate">{currentSong.artist}</p>
        </div>
      )}

      {/* Progress bar - Always visible */}
      <div className="space-y-1 mb-4 px-3">
        <Slider
          value={[isSeeking ? seekValue : currentTime]}
          max={duration || 100}
          step={0.1}
          onPointerDown={handleSeekStart}
          onValueChange={handleSeekChange}
          onValueCommit={handleSeekEnd}
          className={cn(
            "cursor-pointer",
            isHost && "[&_[role=slider]]:bg-amber-500 [&_.bg-primary]:bg-amber-500"
          )}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
          <span>{formatTime(isSeeking ? seekValue : currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Main playback controls - Always visible */}
      <div className="flex items-center justify-center gap-2 mb-4 px-3">
        {/* Mic toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onMicToggle}
                className={cn(
                  'rounded-full h-9 w-9 transition-all',
                  isMicEnabled && 'bg-neon-green/20 text-neon-green ring-1 ring-neon-green/50'
                )}
              >
                {isMicEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isMicEnabled ? 'Mute mic' : 'Enable mic'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Previous - Host only for full control */}
        {isHost && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrevious}
            disabled={!canGoPrevious}
            className="rounded-full h-9 w-9"
          >
            <SkipBack className="w-4 h-4" />
          </Button>
        )}

        {/* Play/Pause - Main button with host styling */}
        <Button
          onClick={handleSmartPlayPause}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all",
            isHost 
              ? "bg-gradient-to-br from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-black shadow-amber-500/30" 
              : "btn-neon"
          )}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6 ml-0.5" />
          )}
        </Button>

        {/* Next - Host only for full control */}
        {isHost && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            disabled={!canGoNext}
            className="rounded-full h-9 w-9"
          >
            <SkipForward className="w-4 h-4" />
          </Button>
        )}

        {/* Volume */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMuteToggle}
            className="rounded-full h-9 w-9"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            max={100}
            step={1}
            onValueChange={([value]) => onVolumeChange(value)}
            className="w-16"
          />
        </div>
      </div>

      {/* Expandable section - Host gets full controls, Members get minimal */}
      {isHost ? (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "w-full flex items-center justify-center gap-2 text-xs mb-2 mx-3 transition-all",
              isExpanded 
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/30" 
                : "text-amber-400/60 hover:text-amber-400 border border-transparent hover:border-amber-500/20"
            )}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            Host Controls
            <Crown className="w-3 h-3 text-amber-400" />
          </Button>

          {isExpanded && (
            <div className="flex-1 min-h-0 px-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="playback" className="text-xs gap-1">
                <Zap className="w-3 h-3" />
                Sync
              </TabsTrigger>
              {roomMode === 'team-battle' ? (
                <TabsTrigger value="battle" className="text-xs gap-1">
                  <Swords className="w-3 h-3" />
                  Battle
                </TabsTrigger>
              ) : (
                <TabsTrigger value="users" className="text-xs gap-1">
                  <Users className="w-3 h-3" />
                  Users
                </TabsTrigger>
              )}
            </TabsList>

            {/* Sync/Playback Tab */}
            <TabsContent value="playback" className="flex-1 mt-3 space-y-3">
              {/* Network latency indicator */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Network Latency</span>
                <Badge variant={networkLatency < 50 ? 'default' : networkLatency < 100 ? 'secondary' : 'destructive'} className="text-[10px]">
                  {networkLatency}ms
                </Badge>
              </div>

              {/* Sync button for everyone */}
              <Button
                variant="outline"
                size="sm"
                onClick={onSync}
                className="w-full gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Request Sync
              </Button>

              {/* Host-only force sync */}
              {isHost && onForceSync && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onForceSync}
                  className="w-full gap-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Emergency Resync
                </Button>
              )}
            </TabsContent>

            {/* Battle Tab */}
            <TabsContent value="battle" className="flex-1 mt-3">
              <div className="grid grid-cols-2 gap-2">
                {/* Left Team */}
                <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-pink-400 uppercase">Pink</span>
                    <span className="text-lg font-bold text-pink-400">{leftScore}</span>
                  </div>
                  <div className="space-y-1">
                    {leftTeam.map(user => (
                      <div key={user.id} className="flex items-center gap-1 text-[10px]">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          user.isSpeaking ? "bg-neon-green animate-pulse" : "bg-muted"
                        )} />
                        <span className="truncate">{user.nickname}</span>
                        <span className="ml-auto text-pink-300">{user.score || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Team */}
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase">Blue</span>
                    <span className="text-lg font-bold text-cyan-400">{rightScore}</span>
                  </div>
                  <div className="space-y-1">
                    {rightTeam.map(user => (
                      <div key={user.id} className="flex items-center gap-1 text-[10px]">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          user.isSpeaking ? "bg-neon-green animate-pulse" : "bg-muted"
                        )} />
                        <span className="truncate">{user.nickname}</span>
                        <span className="ml-auto text-cyan-300">{user.score || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users" className="flex-1 mt-3">
              <ScrollArea className="h-[120px]">
                <div className="space-y-1 pr-2">
                  {users.map(user => (
                    <div
                      key={user.id}
                      className="flex items-center gap-2 p-2 rounded-lg text-xs hover:bg-muted/50"
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full transition-all",
                        user.isSpeaking 
                          ? "bg-neon-green shadow-[0_0_8px_hsl(var(--neon-green))]" 
                          : user.isMicEnabled 
                            ? "bg-yellow-500" 
                            : "bg-muted"
                      )} />
                      <span className="flex-1 truncate">{user.nickname}</span>
                      {user.isMicEnabled && (
                        <Mic className="w-3 h-3 text-neon-green" />
                      )}
                      {user.audioLevel !== undefined && user.audioLevel > 0 && (
                        <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-neon-green transition-all duration-75"
                            style={{ width: `${Math.min(100, user.audioLevel * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
          )}
        </>
      ) : (
        /* Member View - Simple sync option only */
        <div className="px-3 mt-2 pt-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSync}
            className="w-full text-xs text-muted-foreground hover:text-foreground gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Request Sync
          </Button>
        </div>
      )}
    </div>
  );
};
