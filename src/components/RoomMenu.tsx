import React, { useState } from 'react';
import { 
  Settings, 
  Palette, 
  Sparkles, 
  PartyPopper, 
  Waves, 
  Zap, 
  Shapes, 
  Music, 
  Mic2, 
  EyeOff, 
  AlignVerticalJustifyCenter,
  Swords,
  UserX,
  Vote,
  Check,
  X,
  Menu,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { useTheme, THEME_PRESETS } from '@/contexts/ThemeContext';
import { EQSettings } from './EQSettings';
import { User, RoomMode, BattleFormat } from '@/types/karaoke';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ModeVoting } from './ModeVoting';

// Type from VotingPanel
interface VoteKickState {
  targetUserId: string;
  targetNickname: string;
  initiatorId: string;
  votes: string[];
  requiredVotes: number;
}

interface RoomMenuProps {
  // --- Voting Props ---
  channel: RealtimeChannel | null;
  currentUserId: string;
  users: User[];
  currentMode: RoomMode;
  isHost: boolean;
  onModeChange: (mode: RoomMode, format?: BattleFormat) => void;
  activeVoteKick: VoteKickState | null;
  hasVoted: boolean;
  onStartVoteKick: (userId: string) => void;
  onVoteYes: () => void;
  onVoteNo: () => void;
  voteKickDisabled: boolean;

  // --- Settings Props ---
  celebrationEnabled: boolean;
  onCelebrationToggle: (enabled: boolean) => void;
  eqSettings?: number[];
  onEqChange?: (settings: number[]) => void;
  // Microphone settings
  threshold?: number;
  onThresholdChange?: (value: number) => void;
  isMonitorEnabled?: boolean;
  onMonitorEnabledChange?: (enabled: boolean) => void;
  monitorVolume?: number;
  onMonitorVolumeChange?: (value: number) => void;
  // Advanced Audio
  noiseSuppression?: boolean;
  onNoiseSuppressionChange?: (val: boolean) => void;
  echoCancellation?: boolean;
  onEchoCancellationChange?: (val: boolean) => void;
  autoGainControl?: boolean;
  onAutoGainControlChange?: (val: boolean) => void;
  micGain?: number;
  onMicGainChange?: (val: number) => void;
  compressorThreshold?: number;
  onCompressorThresholdChange?: (val: number) => void;
  compressorRatio?: number;
  onCompressorRatioChange?: (val: number) => void;
  defaultTab?: 'actions' | 'audio' | 'look';
}

export const RoomMenu: React.FC<RoomMenuProps> = ({
  channel,
  currentUserId,
  users,
  currentMode,
  isHost,
  onModeChange,
  activeVoteKick,
  hasVoted,
  onStartVoteKick,
  onVoteYes,
  onVoteNo,
  voteKickDisabled,
  celebrationEnabled,
  onCelebrationToggle,
  eqSettings,
  onEqChange,
  threshold,
  onThresholdChange,
  isMonitorEnabled,
  onMonitorEnabledChange,
  monitorVolume,
  onMonitorVolumeChange,
  noiseSuppression,
  onNoiseSuppressionChange,
  echoCancellation,
  onEchoCancellationChange,
  autoGainControl,
  onAutoGainControlChange,
  micGain,
  onMicGainChange,
  compressorThreshold,
  onCompressorThresholdChange,
  compressorRatio,
  onCompressorRatioChange,
  defaultTab = 'actions',
}) => {
  const { 
    preset, 
    setPreset, 
    backgroundEffect, 
    setBackgroundEffect,
    karaokeFilterEnabled,
    setKaraokeFilterEnabled,
    privacyMode,
    setPrivacyMode,
    autoSyncOnJoin,
    setAutoSyncOnJoin,
    hideLyricsWhenNotFound,
    setHideLyricsWhenNotFound,
    partyMode,
    setPartyMode
  } = useTheme();

  const [selectedUserToKick, setSelectedUserToKick] = useState<string>('');
  const otherUsers = users.filter(u => u.id !== currentUserId);
  const isTarget = activeVoteKick?.targetUserId === currentUserId;

  const handleKickUser = () => {
    // Note: onStartVoteKick in Room.tsx now expects userId string (via our wrapper)
    // or User object if originally defined.
    // Based on previous step, we wrapper it to accept string.
    if (selectedUserToKick) {
      onStartVoteKick(selectedUserToKick);
      setSelectedUserToKick('');
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2 bg-background/50 backdrop-blur-sm border-primary/20 hover:bg-primary/10 hover:border-primary/50 transition-all shadow-sm">
          <Menu className="w-4 h-4" />
          <span className="hidden sm:inline">Menu</span>
          {activeVoteKick && (
            <span className="flex h-2 w-2 rounded-full bg-destructive animate-ping" />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[340px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Menu className="w-5 h-5 text-primary" />
            Room Menu
          </SheetTitle>
          <SheetDescription>
            Manage room settings and actions
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue={defaultTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="actions" className="flex items-center gap-2 relative">
              <Vote className="w-4 h-4" />
              Actions
              {activeVoteKick && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive animate-ping" />
              )}
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center gap-2">
              <Mic2 className="w-4 h-4" />
              Audio
            </TabsTrigger>
            <TabsTrigger value="look" className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Look
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: ACTIONS (VOTING) */}
          <TabsContent value="actions" className="mt-4 space-y-6">
            
            {/* Active Vote Kick Banner */}
            {activeVoteKick && (
              <div className="rounded-lg border-2 border-destructive/30 bg-destructive/5 p-3 space-y-3 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                  <UserX className="w-4 h-4 text-destructive animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {isTarget ? 'Vote to kick you!' : `Kick ${activeVoteKick.targetNickname}?`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activeVoteKick.votes.length}/{activeVoteKick.requiredVotes} votes needed
                    </p>
                  </div>
                </div>
                
                {!isTarget && !hasVoted && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={onVoteYes}
                      className="flex-1 h-8"
                    >
                      <Check className="w-4 h-4 mr-1.5" />
                      Yes
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onVoteNo}
                      className="flex-1 h-8"
                    >
                      <X className="w-4 h-4 mr-1.5" />
                      No
                    </Button>
                  </div>
                )}
                
                {(hasVoted || isTarget) && (
                  <p className="text-center text-[10px] uppercase tracking-wider text-muted-foreground bg-background/50 py-1 rounded">
                    {isTarget ? 'Waiting for results...' : 'Vote Registered'}
                  </p>
                )}
              </div>
            )}

            {/* Room Mode Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {currentMode === 'team-battle' ? (
                  <Swords className="w-4 h-4 text-primary" />
                ) : (
                  <Mic2 className="w-4 h-4 text-primary" />
                )}
                Room Mode
              </div>
              <div className="bg-muted/30 p-4 rounded-lg border border-border">
                <ModeVoting
                  channel={channel}
                  currentUserId={currentUserId}
                  usersCount={users.length}
                  currentMode={currentMode}
                  isHost={isHost}
                  onModeChange={onModeChange}
                />
              </div>
            </div>

            <Separator />

            {/* Vote Kick Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <UserX className="w-4 h-4 text-primary" />
                Vote Kick User
              </div>
              
              <div className="bg-muted/30 p-4 rounded-lg border border-border">
                {otherUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2 italic">
                    No other users in the room
                  </p>
                ) : (
                  <div className="space-y-3">
                    <Select 
                      value={selectedUserToKick} 
                      onValueChange={setSelectedUserToKick}
                      disabled={voteKickDisabled}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select user to kick..." />
                      </SelectTrigger>
                      <SelectContent>
                        {otherUsers.map(user => (
                          <SelectItem key={user.id} value={user.id}>
                            <div className="flex items-center gap-2">
                              <div className={cn("w-2 h-2 rounded-full", user.isSpeaking ? "bg-green-500" : "bg-muted-foreground")} />
                              {user.nickname}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Button
                      variant="destructive"
                      onClick={handleKickUser}
                      disabled={!selectedUserToKick || voteKickDisabled}
                      className="w-full gap-2"
                    >
                      <UserX className="w-4 h-4" />
                      Start Vote Kick
                    </Button>
                  </div>
                )}
                
                {voteKickDisabled && activeVoteKick && (
                  <p className="text-xs text-muted-foreground text-center mt-2 bg-yellow-500/10 text-yellow-500 p-2 rounded">
                    ⚠️ A vote is already in progress
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: AUDIO */}
          <TabsContent value="audio" className="mt-4 space-y-6 overflow-y-auto max-h-[70vh] pb-6 px-1">
             <EQSettings 
              initialSettings={eqSettings} 
              onChange={onEqChange}
              threshold={threshold}
              onThresholdChange={onThresholdChange}
              isMonitorEnabled={isMonitorEnabled}
              onMonitorEnabledChange={onMonitorEnabledChange}
              monitorVolume={monitorVolume}
              onMonitorVolumeChange={onMonitorVolumeChange}
              // Advanced
              noiseSuppression={noiseSuppression}
              onNoiseSuppressionChange={onNoiseSuppressionChange}
              echoCancellation={echoCancellation}
              onEchoCancellationChange={onEchoCancellationChange}
              autoGainControl={autoGainControl}
              onAutoGainControlChange={onAutoGainControlChange}
              micGain={micGain}
              onMicGainChange={onMicGainChange}
              compressorThreshold={compressorThreshold}
              onCompressorThresholdChange={onCompressorThresholdChange}
              compressorRatio={compressorRatio}
              onCompressorRatioChange={onCompressorRatioChange}
            />
          </TabsContent>

          {/* TAB 3: LOOK (THEME) */}
          <TabsContent value="look" className="mt-4 space-y-4 overflow-y-auto max-h-[70vh] pb-6">
            
            {/* Theme Presets */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                 <Palette className="w-4 h-4 text-primary" />
                 Color Theme
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {THEME_PRESETS.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setPreset(theme.id)}
                    className={cn(
                      'p-3 rounded-lg border-2 transition-all hover:scale-[1.02]',
                      preset === theme.id
                        ? 'border-primary bg-primary/20 shadow-lg shadow-primary/20'
                        : 'border-border bg-card hover:border-muted-foreground/50'
                    )}
                  >
                    {theme.id === 'auto' ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="relative">
                          <Sparkles className="w-6 h-6 text-accent animate-pulse" />
                          <div className="absolute inset-0 w-6 h-6 bg-accent/30 rounded-full blur-md" />
                        </div>
                        <span className="text-sm font-medium bg-gradient-to-r from-accent via-primary to-secondary bg-clip-text text-transparent">
                          {theme.name}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex gap-1">
                          {theme.colors.map((color, i) => (
                            <div
                              key={i}
                              className="w-5 h-5 rounded-full border border-border/50 shadow-sm"
                              style={{ 
                                backgroundColor: color,
                                boxShadow: preset === theme.id ? `0 0 10px ${color}` : 'none',
                              }}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-medium">{theme.name}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Visual Effects */}
            <div className="space-y-4">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Waves className="w-4 h-4 text-primary" />
                Visual Effects
              </Label>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Background Style</Label>
                  <Select 
                    value={backgroundEffect} 
                    onValueChange={(value: any) => setBackgroundEffect(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select effect" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <div className="flex items-center gap-2">
                          <Shapes className="w-4 h-4" />
                          <span>None</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="beat-sync">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4" />
                          <span>Beat Sync (Classic)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="particles">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          <span>Floating Particles</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="neon-grid">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border border-primary/50 bg-primary/20" />
                          <span>Retro Neon Grid</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="wave-form">
                        <div className="flex items-center gap-2">
                          <Waves className="w-4 h-4" />
                          <span>Audio Waveform</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-cyan-500/10 border border-primary/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-gradient-to-br from-pink-500/30 to-purple-500/30 relative">
                      <Sparkles className="w-4 h-4 text-pink-400" />
                    </div>
                    <div>
                      <Label htmlFor="party-mode-toggle" className="text-sm font-medium flex items-center gap-1">
                        Party Mode
                        <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">FUN</span>
                      </Label>
                      <p className="text-xs text-muted-foreground">Light sticks, music notes & bouncing</p>
                    </div>
                  </div>
                  <Switch
                    id="party-mode-toggle"
                    checked={partyMode}
                    onCheckedChange={setPartyMode}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/20 relative">
                      <PartyPopper className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <Label htmlFor="celebration-toggle" className="text-sm font-medium">Celebrations</Label>
                      <p className="text-xs text-muted-foreground">Confetti on events</p>
                    </div>
                  </div>
                  <Switch
                    id="celebration-toggle"
                    checked={celebrationEnabled}
                    onCheckedChange={onCelebrationToggle}
                  />
                </div>
              </div>
            </div>
            
            <Separator />

            {/* Other Settings */}
             <div className="space-y-4">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                Preferences
              </Label>
              
               <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/20 relative">
                      <Music className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <Label htmlFor="search-filter-toggle" className="text-sm font-medium">Karaoke Filter</Label>
                      <p className="text-xs text-muted-foreground">Find karaoke versions</p>
                    </div>
                  </div>
                  <Switch
                    id="search-filter-toggle"
                    checked={karaokeFilterEnabled}
                    onCheckedChange={setKaraokeFilterEnabled}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-green-500/20 relative">
                      <EyeOff className="w-4 h-4 text-green-500" />
                    </div>
                    <div>
                      <Label htmlFor="privacy-mode-toggle" className="text-sm font-medium">Privacy Mode</Label>
                      <p className="text-xs text-muted-foreground">Incognito playback</p>
                    </div>
                  </div>
                  <Switch
                    id="privacy-mode-toggle"
                    checked={privacyMode}
                    onCheckedChange={setPrivacyMode}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/20 relative">
                      <AlignVerticalJustifyCenter className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <Label htmlFor="hide-lyrics-toggle" className="text-sm font-medium">Hide Empty Lyrics</Label>
                      <p className="text-xs text-muted-foreground">Expand video instead</p>
                    </div>
                  </div>
                  <Switch
                    id="hide-lyrics-toggle"
                    checked={hideLyricsWhenNotFound}
                    onCheckedChange={setHideLyricsWhenNotFound}
                  />
                </div>
             </div>

          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
