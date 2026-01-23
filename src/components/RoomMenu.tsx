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
  Volume2,
  Monitor,
  Sun,
  Moon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import { ScrollArea } from '@/components/ui/scroll-area';

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

type NavItem = 'appearance' | 'audio' | 'room' | 'moderation';

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

  // Map defaultTab to nav item
  const getInitialNav = (): NavItem => {
    if (defaultTab === 'audio') return 'audio';
    if (defaultTab === 'look') return 'appearance';
    return 'room';
  };

  const [activeNav, setActiveNav] = useState<NavItem>(getInitialNav());
  const [selectedUserToKick, setSelectedUserToKick] = useState<string>('');
  const otherUsers = users.filter(u => u.id !== currentUserId);
  const isTarget = activeVoteKick?.targetUserId === currentUserId;

  const handleKickUser = () => {
    if (selectedUserToKick) {
      onStartVoteKick(selectedUserToKick);
      setSelectedUserToKick('');
    }
  };

  // Navigation items
  const navItems: { id: NavItem; label: string; icon: React.ReactNode; badge?: boolean }[] = [
    { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
    { id: 'audio', label: 'Audio', icon: <Volume2 className="w-4 h-4" /> },
    { id: 'room', label: 'Room Mode', icon: <Swords className="w-4 h-4" /> },
    { id: 'moderation', label: 'Moderation', icon: <UserX className="w-4 h-4" />, badge: !!activeVoteKick },
  ];

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
      <SheetContent className="w-[95vw] sm:w-[680px] sm:max-w-[680px] p-0 bg-[#1a1a1a] border-[#2a2a2a]">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-[#2a2a2a]">
          <Settings className="w-5 h-5 text-zinc-400" />
          <h2 className="text-lg font-semibold text-zinc-100">Settings</h2>
        </div>

        <div className="flex h-[calc(100vh-65px)]">
          {/* Left Sidebar Navigation */}
          <nav className="w-[180px] p-3 border-r border-[#2a2a2a] flex flex-col gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left w-full",
                  activeNav === item.id
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                )}
              >
                {item.icon}
                {item.label}
                {item.badge && (
                  <span className="ml-auto flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </button>
            ))}
          </nav>

          {/* Right Content Area */}
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              
              {/* ===== APPEARANCE ===== */}
              {activeNav === 'appearance' && (
                <>
                  {/* Color Theme Section */}
                  <section className="space-y-4">
                    <div>
                      <h3 className="text-base font-semibold text-zinc-100">Color theme</h3>
                      <p className="text-sm text-zinc-500">Select your preferred color theme.</p>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      {THEME_PRESETS.slice(0, 6).map((theme) => (
                        <button
                          key={theme.id}
                          onClick={() => setPreset(theme.id)}
                          className={cn(
                            "group relative rounded-xl overflow-hidden border-2 transition-all",
                            preset === theme.id
                              ? "border-emerald-500 ring-2 ring-emerald-500/20"
                              : "border-[#2a2a2a] hover:border-zinc-600"
                          )}
                        >
                          {/* Preview Card */}
                          <div 
                            className="aspect-[4/3] p-3 flex flex-col items-center justify-center gap-2"
                            style={{ 
                              background: theme.id === 'auto' 
                                ? 'linear-gradient(135deg, #1a1a1a 50%, #f5f5f5 50%)' 
                                : theme.id.includes('light') 
                                  ? '#f5f5f5' 
                                  : '#1a1a1a' 
                            }}
                          >
                            {theme.id === 'auto' ? (
                              <div className="w-10 h-6 rounded-md bg-gradient-to-r from-zinc-700 to-zinc-300 flex items-center justify-center">
                                <div className="w-6 h-1.5 rounded-full bg-white/80" />
                              </div>
                            ) : (
                              <div 
                                className="w-10 h-6 rounded-md flex items-center justify-center"
                                style={{ 
                                  backgroundColor: theme.colors?.[0] || (theme.id.includes('light') ? '#e5e5e5' : '#2a2a2a')
                                }}
                              >
                                <div 
                                  className="w-6 h-1.5 rounded-full"
                                  style={{ 
                                    backgroundColor: theme.colors?.[1] || (theme.id.includes('light') ? '#333' : '#fff'),
                                    opacity: 0.8
                                  }}
                                />
                              </div>
                            )}
                          </div>
                          
                          {/* Label with Radio */}
                          <div className="flex items-center gap-2 p-2.5 bg-[#252525] border-t border-[#2a2a2a]">
                            <div className={cn(
                              "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                              preset === theme.id
                                ? "border-emerald-500"
                                : "border-zinc-600"
                            )}>
                              {preset === theme.id && (
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                              )}
                            </div>
                            <span className="text-xs font-medium text-zinc-300 flex items-center gap-1">
                              {theme.name}
                              {theme.id === 'auto' && <Monitor className="w-3 h-3" />}
                              {theme.id.includes('light') && <Sun className="w-3 h-3" />}
                              {theme.id.includes('dark') && !theme.id.includes('oled') && <Moon className="w-3 h-3" />}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Background Effect Section */}
                  <section className="space-y-4">
                    <div>
                      <h3 className="text-base font-semibold text-zinc-100">Background effect</h3>
                      <p className="text-sm text-zinc-500">Choose animated background style.</p>
                    </div>

                    <Select 
                      value={backgroundEffect} 
                      onValueChange={(value: any) => setBackgroundEffect(value)}
                    >
                      <SelectTrigger className="w-full bg-[#252525] border-[#2a2a2a] text-zinc-200">
                        <SelectValue placeholder="Select effect" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#252525] border-[#2a2a2a]">
                        <SelectItem value="none" className="text-zinc-200 focus:bg-zinc-700">
                          <div className="flex items-center gap-2">
                            <Shapes className="w-4 h-4" />
                            <span>None</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="beat-sync" className="text-zinc-200 focus:bg-zinc-700">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4" />
                            <span>Beat Sync</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="particles" className="text-zinc-200 focus:bg-zinc-700">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            <span>Floating Particles</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="neon-grid" className="text-zinc-200 focus:bg-zinc-700">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border border-emerald-500/50 bg-emerald-500/20" />
                            <span>Retro Neon Grid</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="wave-form" className="text-zinc-200 focus:bg-zinc-700">
                          <div className="flex items-center gap-2">
                            <Waves className="w-4 h-4" />
                            <span>Audio Waveform</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </section>

                  {/* Visual Effects Toggles */}
                  <section className="space-y-4">
                    <div>
                      <h3 className="text-base font-semibold text-zinc-100">Visual effects</h3>
                      <p className="text-sm text-zinc-500">Control animations and visual feedback.</p>
                    </div>

                    <div className="space-y-3">
                      {/* Party Mode */}
                      <div className="flex items-center justify-between p-4 rounded-xl bg-[#252525] border border-[#2a2a2a]">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                            Party Mode
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">FUN</span>
                          </Label>
                          <p className="text-xs text-zinc-500">Light sticks, music notes & bouncing avatars.</p>
                        </div>
                        <Switch
                          checked={partyMode}
                          onCheckedChange={setPartyMode}
                          className="data-[state=checked]:bg-emerald-500"
                        />
                      </div>

                      {/* Celebrations */}
                      <div className="flex items-center justify-between p-4 rounded-xl bg-[#252525] border border-[#2a2a2a]">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium text-zinc-200">Celebrations</Label>
                          <p className="text-xs text-zinc-500">Show confetti on special events.</p>
                        </div>
                        <Switch
                          checked={celebrationEnabled}
                          onCheckedChange={onCelebrationToggle}
                          className="data-[state=checked]:bg-emerald-500"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Preferences */}
                  <section className="space-y-4">
                    <div>
                      <h3 className="text-base font-semibold text-zinc-100">Preferences</h3>
                      <p className="text-sm text-zinc-500">Customize your experience.</p>
                    </div>

                    <div className="space-y-3">
                      {/* Karaoke Filter */}
                      <div className="flex items-center justify-between p-4 rounded-xl bg-[#252525] border border-[#2a2a2a]">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium text-zinc-200">Karaoke Filter</Label>
                          <p className="text-xs text-zinc-500">Prioritize karaoke versions in search.</p>
                        </div>
                        <Switch
                          checked={karaokeFilterEnabled}
                          onCheckedChange={setKaraokeFilterEnabled}
                          className="data-[state=checked]:bg-emerald-500"
                        />
                      </div>

                      {/* Privacy Mode */}
                      <div className="flex items-center justify-between p-4 rounded-xl bg-[#252525] border border-[#2a2a2a]">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium text-zinc-200">Privacy Mode</Label>
                          <p className="text-xs text-zinc-500">Incognito playback, hide activity.</p>
                        </div>
                        <Switch
                          checked={privacyMode}
                          onCheckedChange={setPrivacyMode}
                          className="data-[state=checked]:bg-emerald-500"
                        />
                      </div>

                      {/* Hide Empty Lyrics */}
                      <div className="flex items-center justify-between p-4 rounded-xl bg-[#252525] border border-[#2a2a2a]">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium text-zinc-200">Hide Empty Lyrics</Label>
                          <p className="text-xs text-zinc-500">Expand video when no lyrics found.</p>
                        </div>
                        <Switch
                          checked={hideLyricsWhenNotFound}
                          onCheckedChange={setHideLyricsWhenNotFound}
                          className="data-[state=checked]:bg-emerald-500"
                        />
                      </div>
                    </div>
                  </section>
                </>
              )}

              {/* ===== AUDIO ===== */}
              {activeNav === 'audio' && (
                <section>
                  <div className="mb-6">
                    <h3 className="text-base font-semibold text-zinc-100">Audio settings</h3>
                    <p className="text-sm text-zinc-500">Configure microphone and audio processing.</p>
                  </div>
                  
                  <div className="[&_*]:!border-[#2a2a2a] [&_.bg-card]:!bg-[#252525] [&_.bg-muted\\/30]:!bg-[#252525] [&_.border-border]:!border-[#2a2a2a]">
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
                  </div>
                </section>
              )}

              {/* ===== ROOM MODE ===== */}
              {activeNav === 'room' && (
                <section className="space-y-6">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-100">Room mode</h3>
                    <p className="text-sm text-zinc-500">Switch between Free Sing and Team Battle modes.</p>
                  </div>

                  <div className="rounded-xl bg-[#252525] border border-[#2a2a2a] p-4">
                    <ModeVoting
                      channel={channel}
                      currentUserId={currentUserId}
                      usersCount={users.length}
                      currentMode={currentMode}
                      isHost={isHost}
                      onModeChange={onModeChange}
                    />
                  </div>

                  <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                    <div className="p-2 rounded-lg bg-emerald-500/20">
                      {currentMode === 'team-battle' ? (
                        <Swords className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Mic2 className="w-5 h-5 text-emerald-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">
                        Currently: {currentMode === 'team-battle' ? 'Team Battle' : 'Free Sing'}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {currentMode === 'team-battle' 
                          ? 'Compete in teams for points!' 
                          : 'Take turns singing together.'}
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {/* ===== MODERATION ===== */}
              {activeNav === 'moderation' && (
                <section className="space-y-6">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-100">Moderation</h3>
                    <p className="text-sm text-zinc-500">Manage users and vote kicks.</p>
                  </div>

                  {/* Active Vote Kick Banner */}
                  {activeVoteKick && (
                    <div className="rounded-xl border-2 border-red-500/30 bg-red-500/10 p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-500/20">
                          <UserX className="w-5 h-5 text-red-400 animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-200">
                            {isTarget ? 'Vote to kick you!' : `Vote to kick ${activeVoteKick.targetNickname}`}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {activeVoteKick.votes.length}/{activeVoteKick.requiredVotes} votes needed
                          </p>
                        </div>
                      </div>
                      
                      {!isTarget && !hasVoted && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={onVoteYes}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                          >
                            <Check className="w-4 h-4 mr-1.5" />
                            Yes, Kick
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={onVoteNo}
                            className="flex-1 border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                          >
                            <X className="w-4 h-4 mr-1.5" />
                            No
                          </Button>
                        </div>
                      )}
                      
                      {(hasVoted || isTarget) && (
                        <p className="text-center text-xs uppercase tracking-wider text-zinc-500 bg-zinc-800/50 py-2 rounded-lg">
                          {isTarget ? 'Waiting for results...' : 'Vote Registered'}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Start Vote Kick */}
                  <div className="rounded-xl bg-[#252525] border border-[#2a2a2a] p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-zinc-700/50">
                        <Vote className="w-4 h-4 text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-200">Start a vote kick</p>
                        <p className="text-xs text-zinc-500">Majority vote required to remove user.</p>
                      </div>
                    </div>

                    {otherUsers.length === 0 ? (
                      <p className="text-sm text-zinc-500 text-center py-4 italic">
                        No other users in the room
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <Select 
                          value={selectedUserToKick} 
                          onValueChange={setSelectedUserToKick}
                          disabled={voteKickDisabled}
                        >
                          <SelectTrigger className="w-full bg-[#1a1a1a] border-[#2a2a2a] text-zinc-200">
                            <SelectValue placeholder="Select user..." />
                          </SelectTrigger>
                          <SelectContent className="bg-[#252525] border-[#2a2a2a]">
                            {otherUsers.map(user => (
                              <SelectItem key={user.id} value={user.id} className="text-zinc-200 focus:bg-zinc-700">
                                <div className="flex items-center gap-2">
                                  <div className={cn("w-2 h-2 rounded-full", user.isSpeaking ? "bg-emerald-500" : "bg-zinc-600")} />
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
                          className="w-full bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                        >
                          <UserX className="w-4 h-4 mr-2" />
                          Start Vote Kick
                        </Button>
                      </div>
                    )}
                    
                    {voteKickDisabled && activeVoteKick && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                        <span className="text-yellow-500">⚠️</span>
                        <p className="text-xs text-yellow-400">A vote is already in progress</p>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
};
