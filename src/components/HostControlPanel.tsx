import React, { useState } from 'react';
import { 
  X, Crown, Sliders, Users, Music, Zap, RefreshCw, 
  AlertTriangle, SkipForward, SkipBack, Play, Pause,
  Volume2, Mic, Settings2, Palette
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { EQSettings } from './EQSettings';

interface User {
  id: string;
  nickname: string;
  isSpeaking?: boolean;
  isMicEnabled?: boolean;
  audioLevel?: number;
  team?: 'left' | 'right';
  score?: number;
}

interface Song {
  id: string;
  title: string;
  artist: string;
  videoId: string;
  addedBy?: string;
}

interface HostControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // Playback
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  currentSong: Song | null;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (time: number) => void;
  // Sync
  networkLatency: number;
  onSync: () => void;
  onForceSync: () => void;
  // Users
  users: User[];
  // Volume
  volume: number;
  isMuted: boolean;
  onVolumeChange: (value: number) => void;
  onMuteToggle: () => void;
  // Mic
  isMicEnabled: boolean;
  onMicToggle: () => void;
  // Audio settings props
  audioSettings?: {
    eqSettings: number[];
    onEqChange: (settings: number[]) => void;
    noiseSuppression: boolean;
    onNoiseSuppressionChange: (value: boolean) => void;
    echoCancellation: boolean;
    onEchoCancellationChange: (value: boolean) => void;
    autoGainControl: boolean;
    onAutoGainControlChange: (value: boolean) => void;
    micGain: number;
    onMicGainChange: (value: number) => void;
    compressorThreshold: number;
    onCompressorThresholdChange: (value: number) => void;
    compressorRatio: number;
    onCompressorRatioChange: (value: number) => void;
  };
}

type SectionType = 'playback' | 'sync' | 'users' | 'audio' | 'appearance';

const navItems: { id: SectionType; label: string; icon: React.ElementType }[] = [
  { id: 'playback', label: 'Playback', icon: Play },
  { id: 'sync', label: 'Sync', icon: Zap },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'audio', label: 'Audio', icon: Sliders },
  { id: 'appearance', label: 'Appearance', icon: Palette },
];

export const HostControlPanel: React.FC<HostControlPanelProps> = ({
  isOpen,
  onClose,
  isPlaying,
  currentTime,
  duration,
  currentSong,
  canGoPrevious,
  canGoNext,
  onPlayPause,
  onNext,
  onPrevious,
  onSeek,
  networkLatency,
  onSync,
  onForceSync,
  users,
  volume,
  isMuted,
  onVolumeChange,
  onMuteToggle,
  isMicEnabled,
  onMicToggle,
  audioSettings,
}) => {
  const [activeSection, setActiveSection] = useState<SectionType>('playback');
  const { preset, setPreset, backgroundEffect, setBackgroundEffect, partyMode, setPartyMode } = useTheme();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const renderPlaybackSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Now Playing</h3>
        <p className="text-sm text-muted-foreground">Control the current song playback</p>
      </div>

      {currentSong && (
        <div className="p-4 rounded-xl bg-muted/30 border border-border">
          <p className="font-medium truncate">{currentSong.title}</p>
          <p className="text-sm text-muted-foreground truncate">{currentSong.artist}</p>
        </div>
      )}

      {/* Progress */}
      <div className="space-y-2">
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={([v]) => onSeek(v)}
          className="cursor-pointer"
        />
        <div className="flex justify-between text-xs text-muted-foreground font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Main Controls */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className="h-12 w-12 rounded-full"
        >
          <SkipBack className="w-5 h-5" />
        </Button>

        <Button
          onClick={onPlayPause}
          className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90"
        >
          {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onNext}
          disabled={!canGoNext}
          className="h-12 w-12 rounded-full"
        >
          <SkipForward className="w-5 h-5" />
        </Button>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20">
        <Button variant="ghost" size="icon" onClick={onMuteToggle} className="shrink-0">
          <Volume2 className={cn("w-5 h-5", isMuted && "text-muted-foreground")} />
        </Button>
        <Slider
          value={[isMuted ? 0 : volume]}
          max={100}
          step={1}
          onValueChange={([v]) => onVolumeChange(v)}
          className="flex-1"
        />
        <span className="text-sm text-muted-foreground w-8">{volume}%</span>
      </div>

      {/* Mic Toggle */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
        <div className="flex items-center gap-3">
          <Mic className={cn("w-5 h-5", isMicEnabled ? "text-primary" : "text-muted-foreground")} />
          <span>Microphone</span>
        </div>
        <Switch checked={isMicEnabled} onCheckedChange={onMicToggle} />
      </div>
    </div>
  );

  const renderSyncSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Synchronization</h3>
        <p className="text-sm text-muted-foreground">Keep everyone in sync</p>
      </div>

      {/* Latency Display */}
      <div className="p-4 rounded-xl bg-muted/30 border border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Network Latency</span>
          <Badge variant={networkLatency < 50 ? 'default' : networkLatency < 100 ? 'secondary' : 'destructive'}>
            {networkLatency}ms
          </Badge>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full transition-all",
              networkLatency < 50 ? "bg-green-500" : networkLatency < 100 ? "bg-yellow-500" : "bg-red-500"
            )}
            style={{ width: `${Math.min(100, (networkLatency / 200) * 100)}%` }}
          />
        </div>
      </div>

      {/* Sync Actions */}
      <div className="space-y-3">
        <Button variant="outline" className="w-full gap-2 h-12" onClick={onSync}>
          <RefreshCw className="w-4 h-4" />
          Request Sync
        </Button>

        <Button variant="destructive" className="w-full gap-2 h-12" onClick={onForceSync}>
          <AlertTriangle className="w-4 h-4" />
          Emergency Resync
          <span className="text-xs opacity-70">(Forces all users)</span>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Use Emergency Resync if users are experiencing significant playback drift.
      </p>
    </div>
  );

  const renderUsersSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Connected Users</h3>
        <p className="text-sm text-muted-foreground">{users.length} user{users.length !== 1 ? 's' : ''} online</p>
      </div>

      <ScrollArea className="h-[300px]">
        <div className="space-y-2 pr-4">
          {users.map(user => (
            <div
              key={user.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
            >
              <div className={cn(
                "w-3 h-3 rounded-full shrink-0 transition-all",
                user.isSpeaking 
                  ? "bg-primary shadow-[0_0_10px_hsl(var(--primary))] animate-pulse" 
                  : user.isMicEnabled 
                    ? "bg-yellow-500" 
                    : "bg-muted"
              )} />
              <span className="flex-1 truncate">{user.nickname}</span>
              {user.isMicEnabled && <Mic className="w-4 h-4 text-primary shrink-0" />}
              {user.audioLevel !== undefined && user.audioLevel > 0 && (
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
                  <div 
                    className="h-full bg-primary transition-all duration-75"
                    style={{ width: `${Math.min(100, user.audioLevel * 100)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  const renderAudioSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Audio Settings</h3>
        <p className="text-sm text-muted-foreground">Adjust microphone and audio processing</p>
      </div>

      {audioSettings ? (
        <ScrollArea className="h-[350px] pr-4">
          <EQSettings
            initialSettings={audioSettings.eqSettings}
            onChange={audioSettings.onEqChange}
            noiseSuppression={audioSettings.noiseSuppression}
            onNoiseSuppressionChange={audioSettings.onNoiseSuppressionChange}
            echoCancellation={audioSettings.echoCancellation}
            onEchoCancellationChange={audioSettings.onEchoCancellationChange}
            autoGainControl={audioSettings.autoGainControl}
            onAutoGainControlChange={audioSettings.onAutoGainControlChange}
            micGain={audioSettings.micGain}
            onMicGainChange={audioSettings.onMicGainChange}
            compressorThreshold={audioSettings.compressorThreshold}
            onCompressorThresholdChange={audioSettings.onCompressorThresholdChange}
            compressorRatio={audioSettings.compressorRatio}
            onCompressorRatioChange={audioSettings.onCompressorRatioChange}
          />
        </ScrollArea>
      ) : (
        <p className="text-sm text-muted-foreground">Audio settings not available</p>
      )}
    </div>
  );

  const renderAppearanceSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Appearance</h3>
        <p className="text-sm text-muted-foreground">Customize the room's look and feel</p>
      </div>

      {/* Color Theme */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Color Theme</h4>
        <div className="grid grid-cols-3 gap-3">
          {(['neon', 'sunset', 'ocean', 'forest', 'galaxy', 'candy'] as const).map((theme) => (
            <button
              key={theme}
              onClick={() => setPreset(theme)}
              className={cn(
                "p-3 rounded-xl border-2 transition-all text-center capitalize text-sm",
                preset === theme 
                  ? "border-primary bg-primary/10" 
                  : "border-border hover:border-primary/50"
              )}
            >
              {theme}
            </button>
          ))}
        </div>
      </div>

      {/* Background Style */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Background</h4>
        <div className="grid grid-cols-2 gap-3">
          {(['none', 'beat-sync', 'particles', 'neon-grid'] as const).map((effect) => (
            <button
              key={effect}
              onClick={() => setBackgroundEffect(effect)}
              className={cn(
                "p-3 rounded-xl border-2 transition-all text-center capitalize text-sm",
                backgroundEffect === effect 
                  ? "border-primary bg-primary/10" 
                  : "border-border hover:border-primary/50"
              )}
            >
              {effect === 'none' ? 'Default' : effect.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Party Mode */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border">
        <div>
          <h4 className="font-medium">Party Mode</h4>
          <p className="text-xs text-muted-foreground">Enable fun animations</p>
        </div>
        <Switch checked={partyMode} onCheckedChange={setPartyMode} />
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'playback': return renderPlaybackSection();
      case 'sync': return renderSyncSection();
      case 'users': return renderUsersSection();
      case 'audio': return renderAudioSection();
      case 'appearance': return renderAppearanceSection();
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-3xl mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Crown className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Host Controls</h2>
              <p className="text-xs text-muted-foreground">Manage your karaoke session</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex min-h-[450px]">
          {/* Sidebar Navigation */}
          <nav className="w-48 shrink-0 border-r border-border p-3 space-y-1 bg-muted/20">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  activeSection === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </nav>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};
