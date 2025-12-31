import React, { useEffect, useState } from 'react';
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

// Floating orb component for background
const FloatingOrb: React.FC<{ delay: number; size: number; color: string; x: number; y: number }> = ({
  delay,
  size,
  color,
  x,
  y,
}) => {
  return (
    <div
      className="absolute rounded-full animate-pulse"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        left: `${x}%`,
        top: `${y}%`,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        filter: 'blur(20px)',
        animationDelay: `${delay}s`,
        animationDuration: '3s',
      }}
    />
  );
};

// Particle component
const BackgroundParticle: React.FC<{ index: number }> = ({ index }) => {
  const [position, setPosition] = useState({ x: Math.random() * 100, y: Math.random() * 100 });
  
  useEffect(() => {
    const interval = setInterval(() => {
      setPosition(prev => ({
        x: prev.x + (Math.random() - 0.5) * 2,
        y: prev.y - 0.5,
      }));
    }, 100);
    
    return () => clearInterval(interval);
  }, []);

  // Reset when going off screen
  useEffect(() => {
    if (position.y < -5) {
      setPosition({ x: Math.random() * 100, y: 105 });
    }
  }, [position.y]);

  return (
    <div
      className="absolute w-1 h-1 rounded-full bg-primary/40"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        boxShadow: '0 0 6px hsl(var(--primary) / 0.5)',
        transition: 'all 100ms linear',
      }}
    />
  );
};

export const RoomSettings: React.FC<RoomSettingsProps> = ({
  celebrationEnabled,
  onCelebrationToggle,
}) => {
  const { preset, setPreset } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="w-4 h-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[340px] sm:w-[400px] overflow-hidden">
        {/* Animated background effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Gradient mesh */}
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              background: `
                radial-gradient(ellipse 80% 50% at 10% 90%, hsl(var(--primary) / 0.3) 0%, transparent 50%),
                radial-gradient(ellipse 60% 40% at 90% 80%, hsl(var(--neon-purple) / 0.25) 0%, transparent 50%),
                radial-gradient(ellipse 50% 30% at 50% 20%, hsl(var(--neon-pink) / 0.2) 0%, transparent 50%)
              `,
            }}
          />

          {/* Floating orbs */}
          {isOpen && (
            <>
              <FloatingOrb delay={0} size={120} color="hsl(var(--primary) / 0.15)" x={10} y={70} />
              <FloatingOrb delay={0.5} size={80} color="hsl(var(--neon-purple) / 0.12)" x={80} y={20} />
              <FloatingOrb delay={1} size={100} color="hsl(var(--neon-pink) / 0.1)" x={60} y={60} />
              <FloatingOrb delay={1.5} size={60} color="hsl(var(--neon-blue) / 0.15)" x={20} y={30} />
            </>
          )}

          {/* Floating particles */}
          {isOpen && Array.from({ length: 12 }).map((_, i) => (
            <BackgroundParticle key={i} index={i} />
          ))}

          {/* Subtle grid pattern */}
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `
                linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
                linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
            }}
          />

          {/* Vignette */}
          <div 
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 80% 60% at 50% 50%, transparent 20%, hsl(var(--background) / 0.5) 100%)',
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10">
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
            <TabsList className="grid w-full grid-cols-2 bg-background/50 backdrop-blur-sm">
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
                      'p-3 rounded-lg border-2 transition-all hover:scale-[1.02] backdrop-blur-sm',
                      preset === theme.id
                        ? 'border-primary bg-primary/20 shadow-lg shadow-primary/20'
                        : 'border-border bg-card/50 hover:border-muted-foreground/50 hover:bg-card/80'
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
              <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 backdrop-blur-sm border border-border">
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
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};