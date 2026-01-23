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
    <div className="flex flex-col h-full">
      {/* Current Song Info - Always visible */}
      {currentSong && (
        <div className="mb-3">
          <p className="font-medium truncate text-sm">{currentSong.title}</p>
          <p className="text-xs text-muted-foreground truncate">{currentSong.artist}</p>
        </div>
      )}

      {/* Progress bar - Always visible */}
      <div className="space-y-1 mb-4">
        <Slider
          value={[isSeeking ? seekValue : currentTime]}
          max={duration || 100}
          step={0.1}
          onPointerDown={handleSeekStart}
          onValueChange={handleSeekChange}
          onValueCommit={handleSeekEnd}
          className="cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
          <span>{formatTime(isSeeking ? seekValue : currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Main playback controls - Always visible */}
      <div className="flex items-center justify-center gap-2 mb-4">
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

        {/* Previous */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className="rounded-full h-9 w-9"
        >
          <SkipBack className="w-4 h-4" />
        </Button>

        {/* Play/Pause - Main button */}
        <Button
          onClick={handleSmartPlayPause}
          className="btn-neon w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
        >
          {isPlaying ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6 ml-0.5" />
          )}
        </Button>

        {/* Next */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onNext}
          disabled={!canGoNext}
          className="rounded-full h-9 w-9"
        >
          <SkipForward className="w-4 h-4" />
        </Button>

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

      {/* Expandable section for host/advanced features */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground mb-2"
      >
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        {isHost ? 'Host Controls' : 'More Options'}
        {isHost && <Crown className="w-3 h-3 text-amber-400" />}
      </Button>

      {isExpanded && (
        <div className="flex-1 min-h-0">
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
    </div>
  );
};
