import React, { useState } from 'react';
import { User, Song, RoomMode, PlaybackState, BattleFormat } from '@/types/karaoke';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mic, MicOff, Play, Pause, SkipForward, SkipBack, Search, Music, Users, ThumbsUp, Sparkles, LogOut, Menu, X, Volume2, Globe } from 'lucide-react';
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
  // Actions
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (time: number) => void;
  onAddSong: (song: Song) => void;
  onRemoveSong: (id: string) => void;
  onSelectSong: (index: number) => void;
  onVoteKick: (userId: string) => void;
  onLeave: () => void;
  // Mic & Audio
  isMicEnabled: boolean;
  onMicToggle: () => void;
  volume: number;
  onVolumeChange: (v: number) => void;
  eqSettings: number[];
  onEqChange: (settings: number[]) => void;
  // Components refs/props
  youtubePlayerRef: React.RefObject<HTMLDivElement>;
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
  youtubePlayerRef,
  lyricsProps,
  reactionProps,
  votingProps,
  settingsProps,
  currentTime,
  duration
}) => {
  const [activeTab, setActiveTab] = useState('remote');
  const [showVideo, setShowVideo] = useState(true);

  // Format time helper
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* 1. Mobile Header */}
      <header className="flex items-center justify-between p-3 border-b bg-card/50 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-neon-green' : 'bg-red-500'} animate-pulse`} />
          <h1 className="font-bold text-lg tracking-tight">Karaoke<span className="text-primary">Connect</span></h1>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Mic Toggle (Always accessible) */}
          <Button
            variant={isMicEnabled ? "default" : "outline"}
            size="icon"
            className={cn(
              "rounded-full w-9 h-9 transition-all",
              isMicEnabled && "bg-neon-green text-black hover:bg-neon-green/90 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
            )}
            onClick={onMicToggle}
          >
            {isMicEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </Button>

          {/* Menu Sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="w-9 h-9">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[80vw]">
              <div className="flex flex-col h-full gap-4 py-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-2xl">
                    🎤
                  </div>
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
                        variant={showVideo ? "default" : "outline"} 
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

      {/* 2. Persistent Video Player Area (Moved out of Tabs for persistence) */}
      <div 
        ref={youtubePlayerRef}
        id="youtube-player"
        className={cn(
          "transition-all duration-300 bg-black overflow-hidden shadow-lg shrink-0",
          (showVideo && activeTab === 'remote') 
            ? "w-full h-[35vh] min-h-[180px] max-h-[280px] relative opacity-100" 
            : "absolute top-0 left-0 w-px h-px opacity-0 pointer-events-none"
        )}
      />

      {/* 3. Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          
          {/* TAB: REMOTE (Main Player) */}
          <TabsContent value="remote" className="flex-1 flex flex-col m-0 p-4 data-[state=active]:flex overflow-hidden">
            
            {/* Current Song Info */}
            <div className="text-center mb-4 space-y-1 shrink-0">
              {currentSong ? (
                <>
                  <h2 className="text-xl font-bold truncate px-4 leading-tight">{currentSong.title}</h2>
                  <p className="text-sm text-primary truncate">{currentSong.artist}</p>
                </>
              ) : (
                <div className="py-6 text-muted-foreground">
                  <Music className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p>No song playing</p>
                </div>
              )}
            </div>

            {/* Lyrics Area (Scrollable) */}
            <div className="flex-1 min-h-0 bg-secondary/10 rounded-2xl p-4 mb-4 relative overflow-hidden backdrop-blur-sm border border-white/5">
              <ScrollArea className="h-full">
                <LyricsDisplay {...lyricsProps} className="text-center" />
              </ScrollArea>
            </div>

            {/* Progress Bar */}
            <div className="mb-4 px-1 shrink-0">
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={1}
                onValueChange={(val) => onSeek(val[0])}
                className="mb-1.5"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono px-0.5">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-6 mb-4 shrink-0">
              <Button variant="ghost" size="icon" onClick={onPrevious} className="text-muted-foreground">
                <SkipBack className="w-6 h-6" />
              </Button>
              
              <Button 
                size="icon" 
                className="w-16 h-16 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform"
                onClick={onPlayPause}
              >
                {playbackState.isPlaying ? (
                  <Pause className="w-8 h-8 fill-current" />
                ) : (
                  <Play className="w-8 h-8 fill-current ml-1" />
                )}
              </Button>
              
              <Button variant="ghost" size="icon" onClick={onNext} className="text-muted-foreground">
                <SkipForward className="w-6 h-6" />
              </Button>
            </div>
          </TabsContent>


          {/* TAB: QUEUE (Search & List) */}
          <TabsContent value="queue" className="flex-1 flex flex-col m-0 p-0 data-[state=active]:flex overflow-hidden">
            <div className="p-4 border-b bg-muted/20 shrink-0">
              <SongSearch onAddSong={onAddSong} userId={user.id} compact />
            </div>
            <ScrollArea className="flex-1 p-4">
              <SongQueue 
                queue={queue}
                currentIndex={playbackState.currentSongIndex}
                onRemove={onRemoveSong}
                onSelect={onSelectSong}
                isCompact
              />
            </ScrollArea>
          </TabsContent>


          {/* TAB: SOCIAL (Reactions & Users) */}
          <TabsContent value="social" className="flex-1 flex flex-col m-0 p-4 data-[state=active]:flex overflow-hidden">
            <ScrollArea className="flex-1 h-full"> 
             <div className="space-y-6 pb-4">
              {/* Reactions Grid */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Reactions</h3>
                <ReactionBar {...reactionProps} layout="grid" />
              </div>

              {/* Quick tip - Menu is in header */}
              <div className="text-center py-3 px-4 rounded-lg bg-muted/20 border border-dashed border-border">
                <p className="text-xs text-muted-foreground">
                  💡 Settings, voting & more in the <span className="font-semibold text-primary">Menu ☰</span> button above
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Users ({users.length})
                </h3>
                <div className="p-2 space-y-1 rounded-lg border bg-card/50">
                     {users.map(u => (
                       <div key={u.id} className="flex items-center gap-2 p-2 rounded hover:bg-white/5">
                         <div className={cn(
                           "w-2 h-2 rounded-full",
                           u.id === user.id ? "bg-primary" : "bg-muted-foreground"
                         )} />
                         <span className="font-medium text-sm flex-1">{u.nickname}</span>
                         {u.id === user.id && <Badge variant="secondary" className="text-[10px]">You</Badge>}
                       </div>
                     ))}
                   </div>
              </div>
             </div>
            </ScrollArea>
          </TabsContent>


          {/* 4. Bottom Navigation Bar */}
          <TabsList className="grid grid-cols-3 h-16 shrink-0 rounded-none border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <TabsTrigger 
              value="remote" 
              className="flex flex-col gap-1 h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:text-primary border-t-2 border-transparent data-[state=active]:border-primary transition-all"
            >
              <Music className="w-5 h-5" />
              <span className="text-[10px] font-medium">Remote</span>
            </TabsTrigger>
            <TabsTrigger 
              value="queue" 
              className="flex flex-col gap-1 h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:text-primary border-t-2 border-transparent data-[state=active]:border-primary transition-all"
            >
              <Search className="w-5 h-5" />
              <span className="text-[10px] font-medium">Queue</span>
            </TabsTrigger>
            <TabsTrigger 
              value="social" 
              className="flex flex-col gap-1 h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:text-primary border-t-2 border-transparent data-[state=active]:border-primary transition-all"
            >
              <Users className="w-5 h-5" />
              <span className="text-[10px] font-medium">Social</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
};
