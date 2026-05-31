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
  onRemove: (songId: string) => void;
  onSelect: (index: number) => void;
  getLyricStatus?: (songId: string) => LyricStatus;
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
              <Check className="w-3.5 h-3.5 text-[hsl(var(--success))]" />
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
}) => {
  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
        <Music className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-sm">Queue is empty</p>
        <p className="text-xs mt-1">Search and add songs to get started!</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="divide-y divide-white/10">
        {queue.map((song, index) => {
          const lyricStatus = getLyricStatus?.(song.id) || 'pending';
          
          return (
            <div
              key={song.id}
              className={cn(
                'group flex cursor-pointer items-center gap-3 px-1 py-3 transition-colors',
                index === currentIndex
                  ? 'text-foreground'
                  : 'hover:bg-white/[0.04]'
              )}
              onClick={() => onSelect(index)}
            >
              <span className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center font-mono text-xs',
                index === currentIndex
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}>
                {index + 1}
              </span>
              
              <img
                src={song.thumbnail}
                alt={song.title}
                className="h-10 w-14 shrink-0 rounded-md object-cover"
              />
              
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-sm font-medium truncate',
                  index === currentIndex && 'text-primary'
                )}>
                  {song.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {song.artist}
                </p>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                <LyricStatusIcon status={lyricStatus} />
                <span className="text-xs text-muted-foreground font-mono">
                  {song.duration}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 text-destructive/70 transition-opacity hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  aria-label={`Remove ${song.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(song.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
};
