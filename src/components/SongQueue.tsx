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
        <Music className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-sm">Queue is empty</p>
        <p className="text-xs mt-1">Search and add songs to get started!</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-2">
        {queue.map((song, index) => {
          const lyricStatus = getLyricStatus?.(song.id) || 'pending';
          
          return (
            <div
              key={song.id}
              className={cn(
                'flex items-center gap-3 p-2 rounded-lg transition-all cursor-pointer group',
                index === currentIndex 
                  ? 'bg-primary/20 neon-border' 
                  : 'hover:bg-muted/50'
              )}
              onClick={() => onSelect(index)}
            >
              <span className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                index === currentIndex 
                  ? 'bg-neon-purple text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
              )}>
                {index === currentIndex ? '▶' : index + 1}
              </span>
              
              <img
                src={song.thumbnail}
                alt={song.title}
                className="w-12 h-9 object-cover rounded shrink-0"
              />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={cn(
                    'text-sm font-medium truncate',
                    index === currentIndex && 'text-neon-pink'
                  )}>
                    {song.title}
                  </p>
                  {index === currentIndex && (
                    <span className="text-[9px] uppercase tracking-wider text-neon-pink font-bold shrink-0">Now</span>
                  )}
                  {index === currentIndex + 1 && (
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">Next</span>
                  )}
                </div>
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
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
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
