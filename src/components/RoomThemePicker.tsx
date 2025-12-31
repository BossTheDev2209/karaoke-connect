import React from 'react';
import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type RoomTheme = 'neon' | 'ocean' | 'sunset' | 'forest' | 'galaxy' | 'retro';

interface RoomThemePickerProps {
  currentTheme: RoomTheme;
  onThemeChange: (theme: RoomTheme) => void;
}

const themes: { id: RoomTheme; name: string; colors: string[] }[] = [
  { id: 'neon', name: 'Neon Night', colors: ['#a855f7', '#ec4899', '#3b82f6'] },
  { id: 'ocean', name: 'Ocean Wave', colors: ['#06b6d4', '#0ea5e9', '#3b82f6'] },
  { id: 'sunset', name: 'Sunset Glow', colors: ['#f97316', '#ef4444', '#f59e0b'] },
  { id: 'forest', name: 'Forest Mist', colors: ['#22c55e', '#10b981', '#14b8a6'] },
  { id: 'galaxy', name: 'Galaxy', colors: ['#8b5cf6', '#6366f1', '#a855f7'] },
  { id: 'retro', name: 'Retro Wave', colors: ['#f472b6', '#c084fc', '#22d3ee'] },
];

export const RoomThemePicker: React.FC<RoomThemePickerProps> = ({
  currentTheme,
  onThemeChange,
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Palette className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {themes.map((theme) => (
          <DropdownMenuItem
            key={theme.id}
            onClick={() => onThemeChange(theme.id)}
            className={cn(
              'flex items-center gap-3 cursor-pointer',
              currentTheme === theme.id && 'bg-accent'
            )}
          >
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
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Theme CSS variables
export const themeStyles: Record<RoomTheme, Record<string, string>> = {
  neon: {
    '--neon-pink': '320 100% 60%',
    '--neon-purple': '280 100% 65%',
    '--neon-blue': '200 100% 55%',
  },
  ocean: {
    '--neon-pink': '190 95% 50%',
    '--neon-purple': '200 100% 55%',
    '--neon-blue': '210 100% 50%',
  },
  sunset: {
    '--neon-pink': '20 100% 55%',
    '--neon-purple': '0 85% 55%',
    '--neon-blue': '35 100% 55%',
  },
  forest: {
    '--neon-pink': '160 85% 45%',
    '--neon-purple': '150 80% 50%',
    '--neon-blue': '170 75% 45%',
  },
  galaxy: {
    '--neon-pink': '260 85% 65%',
    '--neon-purple': '240 80% 60%',
    '--neon-blue': '270 90% 65%',
  },
  retro: {
    '--neon-pink': '330 90% 65%',
    '--neon-purple': '280 90% 70%',
    '--neon-blue': '185 90% 55%',
  },
};
