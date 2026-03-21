import React, { useState, useEffect, useRef } from 'react';
import { User, Song, RoomMode, PlaybackState } from '@/types/karaoke';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mic, MicOff, Play, Pause, SkipForward, SkipBack, Search, Music, Users, LogOut, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SongSearch } from '@/components/SongSearch';
import { SongQueue } from '@/components/SongQueue';
import { ReactionBar } from '@/components/Reactions';
import { RoomMenu } from '@/components/RoomMenu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LyricsDisplay } from '@/components/LyricsDisplay';
import { Badge } from '@/components/ui/badge';

interface MobileRoomLayoutProps {
  user: User;
  users: User[];
  queue: Song[];
  playbackState: PlaybackState;
  roomMode: RoomMode;
  isHost: boolean;
  isConnected: boolean;
  currentSong: Song | undefined;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (time: number) => void;
  onAddSong: (song: Song) => void;
  onRemoveSong: (id: string) => void;
  onSelectSong: (index: number) => void;
  onVoteKick: (userId: string) => void;
  onLeave: () => void;
  isMicEnabled: boolean;
  onMicToggle: () => void;
  volume: number;
  onVolumeChange: (v: number) => void;
  eqSettings: number[];
  onEqChange: (settings: number[]) => void;
  playerHost: React.ReactNode;
  lyricsProps: any;
  reactionProps: any;
  votingProps: any;
  settingsProps: any;
  currentTime: number;
  duration: number;
}

export const MobileRoomLayout: React.FC<MobileRoomLayoutProps> = ({
  user,
  users,
  queue,
  playbackState,
  roomMode,
  isHost,
  isConnected,
  currentSong,
  onPlayPause,
  onNext,
  onPrevious,
  onSeek,
  onAddSong,
  onRemoveSong,
  onSelectSong,
  onLeave,
  isMicEnabled,
  onMicToggle,
  volume,
  onVolumeChange,
  playerHost,
  lyricsProps,
  reactionProps,
  votingProps,
  settingsProps,
  currentTime,
  duration
}) => {
  const [activeTab, setActiveTab] = useState('remote');
  const [showVideo, setShowVideo] = useState(true);
  const [isLandscape, setIsLandscape] = useState(false);
  const playerShellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      requestAnimationFrame(() => {
        playerShellRef.current?.getBoundingClientRect();
      });
    };
    window.addEventListener('orientationchange', handleResize);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('orientationchange', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const videoVisible = showVideo && activeTab === 'remote';

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-[100svh] h-[100svh] flex flex-col bg-background text-foreground overflow-hidden">
      <header className={cn(
        "flex items-center justify-between border-b bg-card/50 backdrop-blur-md shrink-0",
        isLandscape ? "px-3 py-1" : "p-3"
      )}>
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full animate-pulse', isConnected ? 'bg-neon-green' : 'bg-destructive')} />
          <h1 className={cn("font-bold tracking-tight", isLandscape ? "text-sm" : "text-lg")}>
            Karaoke<span className="text-primary">Connect</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={isMicEnabled ? 'default' : 'outline'}
            size="icon"
            className={cn(
              'rounded-full transition-all',
              isLandscape ? 'w-7 h-7' : 'w-9 h-9',
              isMicEnabled && 'bg-neon-green text-black hover:bg-neon-green/90 shadow-[0_0_10px_rgba(34,197,94,0.5)]'
            )}
            onClick={onMicToggle}
          >
            {isMicEnabled ? <Mic className={cn(isLandscape ? 'w-3 h-3' : 'w-4 h-4')} /> : <MicOff className={cn(isLandscape ? 'w-3 h-3' : 'w-4 h-4')} />}
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className={cn(isLandscape ? 'w-7 h-7' : 'w-9 h-9')}>
                <Menu className={cn(isLandscape ? 'w-4 h-4' : 'w-5 h-5')} />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[80vw]">
              <div className="flex flex-col h-full gap-4 py-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-2xl">🎤</div>
                  <div>
                    <h3 className="font-bold">{user.nickname}</h3>
                    <p className="text-xs text-muted-foreground">{isHost ? 'Room Host 👑' : 'Guest'}</p>
                  </div>
                </div>

                <div className="space-y-4 flex-1">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Room Menu</h4>
                    <RoomMenu {...settingsProps} {...votingProps} defaultTab="audio" />
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Display</h4>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <span className="text-sm">Show Video</span>
                      <Button
                        variant={showVideo ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setShowVideo(!showVideo)}
                        className="h-7 text-xs"
                      >
                        {showVideo ? 'Visible' : 'Hidden'}
                      </Button>
                    </div>
                  </div>
                </div>

                <Button variant="destructive" className="w-full gap-2" onClick={onLeave}>
                  <LogOut className="w-4 h-4" /> Leave Room
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div
        ref={playerShellRef}
        className={cn(
          'transition-all duration-300 bg-black overflow-hidden shrink-0 rounded-b-2xl',
          videoVisible
            ? cn(
                'w-full relative opacity-100',
                isLandscape ? 'h-[25vh] min-h-[100px] max-h-[160px]' : 'h-[35vh] min-h-[180px] max-h-[280px]'
              )
            : 'w-full h-0 max-h-0 opacity-0 pointer-events-none'
        )}
      >
        {playerHost}
      </div>

      <div className="flex-1 overflow-hidden relative min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsContent value="remote" className="flex-1 flex flex-col m-0 p-3 data-[state=active]:flex overflow-hidden">
            <div className={cn('text-center shrink-0', isLandscape ? 'mb-1 space-y-0' : 'mb-3 space-y-1')}>
              {currentSong ? (
                <>
                  <h2 className={cn('font-bold truncate px-4 leading-tight', isLandscape ? 'text-base' : 'text-xl')}>{currentSong.title}</h2>
                  <p className={cn('text-primary truncate', isLandscape ? 'text-xs' : 'text-sm')}>{currentSong.artist}</p>
                </>
              ) : (
                <div className={cn('text-muted-foreground', isLandscape ? 'py-2' : 'py-6')}>
                  <Music className={cn('mx-auto opacity-20', isLandscape ? 'w-8 h-8 mb-1' : 'w-12 h-12 mb-2')} />
                  <p>No song playing</p>
                </div>
              )}
            </div>

            <div className={cn(
              'flex-1 min-h-0 bg-secondary/10 rounded-2xl relative overflow-hidden backdrop-blur-sm border border-white/5',
              isLandscape ? 'p-2 mb-2 min-h-[120px]' : 'p-4 mb-3 min-h-[180px]'
            )}>
              <ScrollArea className="h-full">
                <LyricsDisplay {...lyricsProps} className="text-center" />
              </ScrollArea>
            </div>

            <div className={cn('px-1 shrink-0', isLandscape ? 'mb-1' : 'mb-3')}>
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={1}
                onValueChange={(val) => onSeek(val[0])}
                className="mb-1"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono px-0.5">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className={cn('flex items-center justify-center shrink-0', isLandscape ? 'gap-4 mb-1' : 'gap-6 mb-3')}>
              <Button variant="ghost" size="icon" onClick={onPrevious} className="text-muted-foreground">
                <SkipBack className={cn(isLandscape ? 'w-5 h-5' : 'w-6 h-6')} />
              </Button>

              <Button
                size="icon"
                className={cn(
                  'rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform',
                  isLandscape ? 'w-12 h-12' : 'w-16 h-16'
                )}
                onClick={onPlayPause}
              >
                {playbackState.isPlaying ? (
                  <Pause className={cn('fill-current', isLandscape ? 'w-6 h-6' : 'w-8 h-8')} />
                ) : (
                  <Play className={cn('fill-current ml-0.5', isLandscape ? 'w-6 h-6' : 'w-8 h-8')} />
                )}
              </Button>

              <Button variant="ghost" size="icon" onClick={onNext} className="text-muted-foreground">
                <SkipForward className={cn(isLandscape ? 'w-5 h-5' : 'w-6 h-6')} />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="queue" className="flex-1 flex flex-col m-0 p-0 data-[state=active]:flex overflow-hidden">
            <div className="p-3 border-b bg-muted/20 shrink-0">
              <SongSearch onAddSong={onAddSong} userId={user.id} compact />
            </div>
            <ScrollArea className="flex-1 p-3">
              <SongQueue
                queue={queue}
                currentIndex={playbackState.currentSongIndex}
                onRemove={onRemoveSong}
                onSelect={onSelectSong}
                isCompact
              />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="social" className="flex-1 flex flex-col m-0 p-3 data-[state=active]:flex overflow-hidden">
            <ScrollArea className="flex-1 h-full">
              <div className="space-y-4 pb-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Reactions</h3>
                  <ReactionBar {...reactionProps} layout="grid" />
                </div>

                <div className="text-center py-2 px-3 rounded-lg bg-muted/20 border border-dashed border-border">
                  <p className="text-xs text-muted-foreground">
                    💡 Settings, voting & more in the <span className="font-semibold text-primary">Menu ☰</span> button above
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Users ({users.length})
                  </h3>
                  <div className="p-2 space-y-1 rounded-lg border bg-card/50">
                    {users.map((u) => (
                      <div key={u.id} className="flex items-center gap-2 p-2 rounded hover:bg-white/5">
                        <div className={cn('w-2 h-2 rounded-full', u.id === user.id ? 'bg-primary' : 'bg-muted-foreground')} />
                        <span className="font-medium text-sm flex-1">{u.nickname}</span>
                        {u.id === user.id && <Badge variant="secondary" className="text-[10px]">You</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsList className={cn(
            'grid grid-cols-3 shrink-0 rounded-none border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
            isLandscape ? 'h-10' : 'h-14'
          )}>
            <TabsTrigger
              value="remote"
              className={cn(
                'flex flex-col gap-0.5 h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:text-primary border-t-2 border-transparent data-[state=active]:border-primary transition-all',
                isLandscape && 'py-1'
              )}
            >
              <Music className={cn(isLandscape ? 'w-4 h-4' : 'w-5 h-5')} />
              <span className={cn('font-medium', isLandscape ? 'text-[8px]' : 'text-[10px]')}>Remote</span>
            </TabsTrigger>
            <TabsTrigger
              value="queue"
              className={cn(
                'flex flex-col gap-0.5 h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:text-primary border-t-2 border-transparent data-[state=active]:border-primary transition-all',
                isLandscape && 'py-1'
              )}
            >
              <Search className={cn(isLandscape ? 'w-4 h-4' : 'w-5 h-5')} />
              <span className={cn('font-medium', isLandscape ? 'text-[8px]' : 'text-[10px]')}>Queue</span>
            </TabsTrigger>
            <TabsTrigger
              value="social"
              className={cn(
                'flex flex-col gap-0.5 h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:text-primary border-t-2 border-transparent data-[state=active]:border-primary transition-all',
                isLandscape && 'py-1'
              )}
            >
              <Users className={cn(isLandscape ? 'w-4 h-4' : 'w-5 h-5')} />
              <span className={cn('font-medium', isLandscape ? 'text-[8px]' : 'text-[10px]')}>Social</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
};
