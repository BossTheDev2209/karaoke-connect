import React, { useState } from 'react';
import { Check, Pencil, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DEFAULT_REACTION_FAVORITES,
  REACTION_LIBRARY,
  loadReactionFavorites,
  saveReactionFavorites,
} from '@/lib/reactionFavorites';
import { cn } from '@/lib/utils';
import type { FloatingReaction } from '@/hooks/useReactions';

interface ReactionBarProps {
  onReact: (emoji: string) => void;
  compact?: boolean;
}

function readFavorites(): string[] {
  try {
    return loadReactionFavorites(window.localStorage);
  } catch {
    return [...DEFAULT_REACTION_FAVORITES];
  }
}

function persistFavorites(favorites: string[]): void {
  try {
    saveReactionFavorites(window.localStorage, favorites);
  } catch {
    // Reactions still work when storage is unavailable.
  }
}

export const ReactionBar: React.FC<ReactionBarProps> = ({ onReact, compact = false }) => {
  const [favorites] = useState(readFavorites);

  return (
    <div className="flex items-center gap-1">
      {favorites.map((emoji) => (
        <Button
          key={emoji}
          variant="ghost"
          size="icon"
          className={cn(
            'h-11 w-11 rounded-full p-0 text-lg transition-transform duration-150 ease-out hover:scale-110 hover:bg-white/10 active:scale-125 motion-reduce:transition-none motion-reduce:hover:scale-100',
            compact && 'hover:bg-white/[0.06]'
          )}
          onClick={() => onReact(emoji)}
          aria-label={`Send ${emoji} reaction`}
        >
          {emoji}
        </Button>
      ))}
    </div>
  );
};

interface ReactionPickerProps {
  onReact: (emoji: string) => void;
}

export const ReactionPicker: React.FC<ReactionPickerProps> = ({ onReact }) => {
  const [favorites, setFavorites] = useState(readFavorites);
  const [editing, setEditing] = useState(false);

  const toggleFavorite = (emoji: string) => {
    const next = favorites.includes(emoji)
      ? favorites.filter((favorite) => favorite !== emoji)
      : [...favorites, emoji];
    if (next.length < 4 || next.length > 6) return;
    setFavorites(next);
    persistFavorites(next);
  };

  return (
    <Popover onOpenChange={(open) => !open && setEditing(false)}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full text-primary hover:bg-transparent hover:text-primary" aria-label="Open reactions">
          <Sparkles className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-72 rounded-2xl border-white/10 bg-[hsl(var(--surface))] p-3 shadow-2xl">
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="text-sm font-medium">Reactions</span>
          <Button variant="ghost" size="sm" className="rounded-full px-2.5 text-xs" onClick={() => setEditing(!editing)}>
            {editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {editing ? 'Done' : 'Edit'}
          </Button>
        </div>
        {editing ? (
          <>
            <p className="px-1 pb-2 text-xs text-muted-foreground">Pick 4–6 quick reactions.</p>
            <div className="grid grid-cols-6 gap-1">
              {REACTION_LIBRARY.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => toggleFavorite(emoji)}
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-full text-lg transition-colors',
                    favorites.includes(emoji) ? 'bg-primary/20 ring-1 ring-primary/70' : 'hover:bg-white/10'
                  )}
                  aria-pressed={favorites.includes(emoji)}
                  aria-label={`${favorites.includes(emoji) ? 'Remove' : 'Add'} ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        ) : (
          <ReactionBar onReact={onReact} compact />
        )}
      </PopoverContent>
    </Popover>
  );
};

export const FloatingReactions: React.FC<{ reactions: FloatingReaction[] }> = ({ reactions }) => (
  <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
    {reactions.map((reaction) => (
      <div
        key={reaction.id}
        className="animate-reaction-float absolute bottom-20 text-4xl"
        style={{ left: `${reaction.x}%` }}
      >
        {reaction.emoji}
      </div>
    ))}
  </div>
);
