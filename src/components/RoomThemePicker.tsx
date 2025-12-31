import React from 'react';
import { Palette, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type RoomTheme = 'auto' | 'neon' | 'ocean' | 'sunset' | 'forest' | 'galaxy' | 'retro' | 'midnight' | 'candy' | 'ember';

interface RoomThemePickerProps {
  currentTheme: RoomTheme;
  onThemeChange: (theme: RoomTheme) => void;
}

const themes: { id: RoomTheme; name: string; colors: string[]; isAuto?: boolean }[] = [
  { id: 'auto', name: 'Match Thumbnail', colors: [], isAuto: true },
  { id: 'neon', name: 'Neon Night', colors: ['#a855f7', '#ec4899', '#3b82f6'] },
  { id: 'ocean', name: 'Ocean Wave', colors: ['#06b6d4', '#0ea5e9', '#3b82f6'] },
  { id: 'sunset', name: 'Sunset Glow', colors: ['#f97316', '#ef4444', '#f59e0b'] },
  { id: 'forest', name: 'Forest Mist', colors: ['#22c55e', '#10b981', '#14b8a6'] },
  { id: 'galaxy', name: 'Galaxy', colors: ['#8b5cf6', '#6366f1', '#a855f7'] },
  { id: 'retro', name: 'Retro Wave', colors: ['#f472b6', '#c084fc', '#22d3ee'] },
  { id: 'midnight', name: 'Midnight Blue', colors: ['#1e3a8a', '#3730a3', '#4f46e5'] },
  { id: 'candy', name: 'Candy Pop', colors: ['#f43f5e', '#fb7185', '#fda4af'] },
  { id: 'ember', name: 'Ember Glow', colors: ['#dc2626', '#ea580c', '#f59e0b'] },
];

export const RoomThemePicker: React.FC<RoomThemePickerProps> = ({
  currentTheme,
  onThemeChange,
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {currentTheme === 'auto' ? (
            <Sparkles className="w-4 h-4 text-neon-pink" />
          ) : (
            <Palette className="w-4 h-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {themes.map((theme, index) => (
          <React.Fragment key={theme.id}>
            {index === 1 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={() => onThemeChange(theme.id)}
              className={cn(
                'flex items-center gap-3 cursor-pointer',
                currentTheme === theme.id && 'bg-accent'
              )}
            >
              {theme.isAuto ? (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-neon-pink" />
                  <span className="bg-gradient-to-r from-neon-pink via-neon-purple to-neon-blue bg-clip-text text-transparent font-medium">
                    {theme.name}
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex gap-1">
                    {theme.colors.map((color, i) => (
                      <div
                        key={i}
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <span>{theme.name}</span>
                </>
              )}
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Theme CSS variables - complete theme override
export const themeStyles: Record<Exclude<RoomTheme, 'auto'>, Record<string, string>> = {
  neon: {
    '--neon-pink': '320 100% 60%',
    '--neon-purple': '280 100% 65%',
    '--neon-blue': '200 100% 55%',
    '--primary': '280 100% 65%',
    '--secondary': '200 100% 55%',
    '--accent': '320 100% 60%',
    '--ring': '280 100% 65%',
  },
  ocean: {
    '--neon-pink': '190 95% 50%',
    '--neon-purple': '200 100% 55%',
    '--neon-blue': '210 100% 50%',
    '--primary': '200 100% 55%',
    '--secondary': '210 100% 50%',
    '--accent': '190 95% 50%',
    '--ring': '200 100% 55%',
  },
  sunset: {
    '--neon-pink': '20 100% 55%',
    '--neon-purple': '0 85% 55%',
    '--neon-blue': '35 100% 55%',
    '--primary': '0 85% 55%',
    '--secondary': '35 100% 55%',
    '--accent': '20 100% 55%',
    '--ring': '0 85% 55%',
  },
  forest: {
    '--neon-pink': '160 85% 45%',
    '--neon-purple': '150 80% 50%',
    '--neon-blue': '170 75% 45%',
    '--primary': '150 80% 50%',
    '--secondary': '170 75% 45%',
    '--accent': '160 85% 45%',
    '--ring': '150 80% 50%',
  },
  galaxy: {
    '--neon-pink': '260 85% 65%',
    '--neon-purple': '240 80% 60%',
    '--neon-blue': '270 90% 65%',
    '--primary': '240 80% 60%',
    '--secondary': '270 90% 65%',
    '--accent': '260 85% 65%',
    '--ring': '240 80% 60%',
  },
  retro: {
    '--neon-pink': '330 90% 65%',
    '--neon-purple': '280 90% 70%',
    '--neon-blue': '185 90% 55%',
    '--primary': '280 90% 70%',
    '--secondary': '185 90% 55%',
    '--accent': '330 90% 65%',
    '--ring': '280 90% 70%',
  },
  midnight: {
    '--neon-pink': '220 80% 50%',
    '--neon-purple': '250 75% 55%',
    '--neon-blue': '230 85% 60%',
    '--primary': '250 75% 55%',
    '--secondary': '230 85% 60%',
    '--accent': '220 80% 50%',
    '--ring': '250 75% 55%',
  },
  candy: {
    '--neon-pink': '350 90% 60%',
    '--neon-purple': '340 85% 65%',
    '--neon-blue': '330 80% 70%',
    '--primary': '340 85% 65%',
    '--secondary': '330 80% 70%',
    '--accent': '350 90% 60%',
    '--ring': '340 85% 65%',
  },
  ember: {
    '--neon-pink': '0 85% 50%',
    '--neon-purple': '20 90% 55%',
    '--neon-blue': '35 95% 55%',
    '--primary': '20 90% 55%',
    '--secondary': '35 95% 55%',
    '--accent': '0 85% 50%',
    '--ring': '20 90% 55%',
  },
};
