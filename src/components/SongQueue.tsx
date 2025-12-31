import React from 'react';
import { Song } from '@/types/karaoke';
import { Music, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SongQueueProps {
  queue: Song[];
  currentIndex: number;
  onRemove: (songId: string) => void;
  onSelect: (index: number) => void;
}

export const SongQueue: React.FC<SongQueueProps> = ({
  queue,
  currentIndex,
  onRemove,
  onSelect,
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
    <div className="space-y-2">
      {queue.map((song, index) => (
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
            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
            index === currentIndex 
              ? 'bg-neon-purple text-primary-foreground' 
              : 'bg-muted text-muted-foreground'
          )}>
            {index + 1}
          </span>
          
          <img
            src={song.thumbnail}
            alt={song.title}
            className="w-12 h-9 object-cover rounded"
          />
          
          <div className="flex-1 min-w-0">
            <p className={cn(
              'text-sm font-medium truncate',
              index === currentIndex && 'text-neon-pink'
            )}>
              {song.title}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {song.artist}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
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
      ))}
    </div>
  );
};
