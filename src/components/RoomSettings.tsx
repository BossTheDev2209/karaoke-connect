import React from 'react';
import { Settings, Palette, Sparkles, PartyPopper } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { useTheme, THEME_PRESETS } from '@/contexts/ThemeContext';

interface RoomSettingsProps {
  celebrationEnabled: boolean;
  onCelebrationToggle: (enabled: boolean) => void;
}

export const RoomSettings: React.FC<RoomSettingsProps> = ({
  celebrationEnabled,
  onCelebrationToggle,
}) => {
  const { preset, setPreset } = useTheme();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="w-4 h-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[340px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>Room Settings</SheetTitle>
          <SheetDescription>
            Customize your karaoke experience
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="theme" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="theme" className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Theme
            </TabsTrigger>
            <TabsTrigger value="effects" className="flex items-center gap-2">
              <PartyPopper className="w-4 h-4" />
              Effects
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
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:border-muted-foreground/50'
                  )}
                >
                  {theme.id === 'auto' ? (
                    <div className="flex flex-col items-center gap-2">
                      <Sparkles className="w-6 h-6 text-accent" />
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
                            className="w-5 h-5 rounded-full border border-border/50"
                            style={{ backgroundColor: color }}
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
            <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <PartyPopper className="w-5 h-5 text-primary" />
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
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};