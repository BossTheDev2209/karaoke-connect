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
import { useTheme, THEME_PRESETS, ThemePreset } from '@/contexts/ThemeContext';

export const RoomThemePicker: React.FC = () => {
  const { preset, setPreset } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {preset === 'auto' ? (
            <Sparkles className="w-4 h-4 text-accent" />
          ) : (
            <Palette className="w-4 h-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {THEME_PRESETS.map((theme, index) => (
          <React.Fragment key={theme.id}>
            {index === 1 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={() => setPreset(theme.id)}
              className={cn(
                'flex items-center gap-3 cursor-pointer',
                preset === theme.id && 'bg-accent/20'
              )}
            >
              {theme.id === 'auto' ? (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <span className="bg-gradient-to-r from-accent via-primary to-secondary bg-clip-text text-transparent font-medium">
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

// Re-export types for backwards compatibility
export type { ThemePreset as RoomTheme } from '@/contexts/ThemeContext';