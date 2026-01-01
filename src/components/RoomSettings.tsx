import React from 'react';
import { Settings, Palette, Sparkles, PartyPopper, Waves, Zap, Shapes, Music, Mic2 } from 'lucide-react';
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

interface RoomSettingsProps {
  celebrationEnabled: boolean;
  onCelebrationToggle: (enabled: boolean) => void;
  eqSettings?: number[];
  onEqChange?: (settings: number[]) => void;
}

export const RoomSettings: React.FC<RoomSettingsProps> = ({
  celebrationEnabled,
  onCelebrationToggle,
  eqSettings,
  onEqChange,
}) => {
  const { 
    preset, 
    setPreset, 
    backgroundEffect, 
    setBackgroundEffect,
    karaokeFilterEnabled,
    setKaraokeFilterEnabled
  } = useTheme();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="w-4 h-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[340px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Room Settings
          </SheetTitle>
          <SheetDescription>
            Customize your karaoke experience
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="theme" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="theme" className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Theme
            </TabsTrigger>
            <TabsTrigger value="effects" className="flex items-center gap-2">
              <PartyPopper className="w-4 h-4" />
              Effects
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center gap-2">
              <Mic2 className="w-4 h-4" />
              Audio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="theme" className="mt-4 space-y-4">
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
          </TabsContent>

          <TabsContent value="effects" className="mt-4 space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Waves className="w-4 h-4 text-primary" />
                Background Visuals
              </Label>
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
              <p className="text-xs text-muted-foreground px-1">
                Choose a visual effect that reacts to the music playback.
              </p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/20 relative">
                  <Music className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="search-filter-toggle" className="text-sm font-medium">
                    Search Filter
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Only show Instrumental/Karaoke versions
                  </p>
                </div>
              </div>
              <Switch
                id="search-filter-toggle"
                checked={karaokeFilterEnabled}
                onCheckedChange={setKaraokeFilterEnabled}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/20 relative">
                  <PartyPopper className="w-5 h-5 text-primary" />
                  {celebrationEnabled && (
                    <div className="absolute inset-0 bg-primary/30 rounded-full animate-ping" />
                  )}
                </div>
                <div>
                  <Label htmlFor="celebration-toggle" className="text-sm font-medium">
                    Event Celebrations
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Show confetti & effects during holidays
                  </p>
                </div>
              </div>
              <Switch
                id="celebration-toggle"
                checked={celebrationEnabled}
                onCheckedChange={onCelebrationToggle}
              />
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Celebrations auto-activate during special events like New Year, Christmas, and Halloween.
            </p>
          </TabsContent>


          <TabsContent value="audio" className="mt-4 space-y-6 overflow-y-auto max-h-[70vh] pb-6 px-1">
            <EQSettings 
              initialSettings={eqSettings} 
              onChange={onEqChange} 
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
