import React, { useState } from 'react';
import { Search, Plus, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { YouTubeSearchResult, Song } from '@/types/karaoke';
import { cn } from '@/lib/utils';

interface SongSearchProps {
  onAddSong: (song: Song) => void;
  userId: string;
}

export const SongSearch: React.FC<SongSearchProps> = ({ onAddSong, userId }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-search', {
        body: { query },
      });

      if (error) throw error;
      setResults(data.results || []);
      setIsOpen(true);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSong = (result: YouTubeSearchResult) => {
    const song: Song = {
      id: crypto.randomUUID(),
      videoId: result.videoId,
      title: result.title,
      artist: result.channelTitle,
      thumbnail: result.thumbnail,
      duration: result.duration,
      addedBy: userId,
    };
    onAddSong(song);
    setIsOpen(false);
    setQuery('');
    setResults([]);
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search for songs..."
            className="pl-10 bg-input border-border"
          />
        </div>
        <Button 
          onClick={handleSearch} 
          disabled={isLoading}
          className="btn-neon"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
        </Button>
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 glass rounded-xl max-h-80 overflow-y-auto">
          <div className="p-2 flex justify-between items-center border-b border-border">
            <span className="text-sm text-muted-foreground">
              {results.length} results
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-6 w-6"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="p-2 space-y-1">
            {results.map((result) => (
              <button
                key={result.videoId}
                onClick={() => handleAddSong(result)}
                className={cn(
                  'w-full flex items-center gap-3 p-2 rounded-lg transition-colors',
                  'hover:bg-muted/50 text-left group'
                )}
              >
                <img
                  src={result.thumbnail}
                  alt={result.title}
                  className="w-16 h-12 object-cover rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{result.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {result.channelTitle}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">
                    {result.duration}
                  </span>
                  <Plus className="w-5 h-5 text-neon-green opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
