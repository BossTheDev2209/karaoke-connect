import React from 'react';
import { Song } from '@/types/karaoke';
import { Music, Trash2, Loader2, Check, AlertCircle, FileText, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LyricStatus } from '@/hooks/useLyricsPreload';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SongQueueProps {
  queue: Song[];
  currentIndex: number;
  onRemove?: (songId: string) => void;
  onSelect?: (index: number) => void;
  getLyricStatus?: (songId: string) => LyricStatus;
  isCompact?: boolean;
}

const LyricStatusIcon: React.FC<{ status: LyricStatus }> = ({ status }) => {
  switch (status) {
    case 'loading':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center">
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            Loading lyrics...
          </TooltipContent>
        </Tooltip>
      );
    case 'loaded':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center">
              <Check className="w-3.5 h-3.5 text-neon-green" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            Lyrics ready
          </TooltipContent>
        </Tooltip>
      );
    case 'not_found':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            No lyrics found
          </TooltipContent>
        </Tooltip>
      );
    case 'error':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center">
              <AlertCircle className="w-3.5 h-3.5 text-destructive" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            Failed to load lyrics
          </TooltipContent>
        </Tooltip>
      );
    case 'pending':
    default:
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center">
              <Clock className="w-3.5 h-3.5 text-muted-foreground/50" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            Waiting to load
          </TooltipContent>
        </Tooltip>
      );
  }
};

export const SongQueue: React.FC<SongQueueProps> = ({
  queue,
  currentIndex,
  onRemove,
  onSelect,
  getLyricStatus,
  isCompact = false,
}) => {
  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
        <div className="p-4 rounded-full bg-muted/30 mb-4">
          <Music className="w-10 h-10 opacity-40" />
        </div>
        <p className="text-sm font-medium">Queue is empty</p>
        <p className="text-xs mt-1 text-muted-foreground/70">Search and add songs to get started!</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-1.5">
        {queue.map((song, index) => {
          const lyricStatus = getLyricStatus?.(song.id) || 'pending';
          const isCurrent = index === currentIndex;
          const isNext = index === currentIndex + 1;
          const isInteractive = !!onSelect;
          
          return (
            <div
              key={song.id}
              className={cn(
                'group flex items-center gap-3 rounded-xl transition-all',
                // Larger touch targets on mobile
                isCompact ? 'p-2.5 min-h-[56px]' : 'p-3 min-h-[60px]',
                // Current song highlight
                isCurrent
                  ? 'bg-primary/15 border border-primary/40 shadow-[0_0_12px_hsl(var(--primary)/0.15)]' 
                  : isNext
                    ? 'bg-muted/20 border border-border/50'
                    : 'border border-transparent',
                // Interactive states
                isInteractive 
                  ? 'cursor-pointer hover:bg-muted/40 hover:border-border/70 active:scale-[0.99] active:bg-muted/50' 
                  : 'cursor-default',
              )}
              onClick={() => onSelect?.(index)}
            >
              {/* Index / Now Playing indicator */}
              <span className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
                isCurrent 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'bg-muted/50 text-muted-foreground'
              )}>
                {isCurrent ? '▶' : index + 1}
              </span>
              
              {/* Thumbnail */}
              <img
                src={song.thumbnail}
                alt={song.title}
                className={cn(
                  "object-cover rounded-lg shrink-0",
                  isCompact ? "w-14 h-10" : "w-16 h-12"
                )}
              />
              
              {/* Song info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={cn(
                    'font-medium truncate',
                    isCompact ? 'text-sm' : 'text-sm',
                    isCurrent && 'text-primary'
                  )}>
                    {song.title}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-muted-foreground truncate">
                    {song.artist}
                  </p>
                  {isCurrent && (
                    <span className="text-[9px] uppercase tracking-widest text-primary font-bold shrink-0 bg-primary/10 px-1.5 py-0.5 rounded">Now</span>
                  )}
                  {isNext && (
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">Next</span>
                  )}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <LyricStatusIcon status={lyricStatus} />
                <span className="text-[11px] text-muted-foreground font-mono hidden sm:block">
                  {song.duration}
                </span>
                {onRemove && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 rounded-lg transition-all text-muted-foreground hover:text-destructive hover:bg-destructive/10",
                      // Always visible on mobile (touch), hover-reveal on desktop
                      "sm:opacity-0 sm:group-hover:opacity-100"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(song.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
};
