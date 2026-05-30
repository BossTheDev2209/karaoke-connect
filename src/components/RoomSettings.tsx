import React from 'react';
import { Search, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/contexts/ThemeContext';

export const RoomSettings: React.FC = () => {
  const { karaokeFilterEnabled, setKaraokeFilterEnabled } = useTheme();

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
            Tune shared-room controls
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card/60 p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Search className="w-4 h-4 text-primary" />
                Karaoke search filter
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Add karaoke terms when searching songs.
              </p>
            </div>
            <Switch
              checked={karaokeFilterEnabled}
              onCheckedChange={setKaraokeFilterEnabled}
              aria-label="Toggle karaoke search filter"
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
