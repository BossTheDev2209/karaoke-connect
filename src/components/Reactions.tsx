import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
  userId: string;
}

const REACTION_EMOJIS = ['🔥', '❤️', '👏', '🎉', '😍', '🎤', '✨', '💯'];

interface ReactionBarProps {
  onReact: (emoji: string) => void;
  isWaving: boolean;
  onWaveToggle: () => void;
  layout?: 'inline' | 'grid';
}

export const ReactionBar: React.FC<ReactionBarProps> = ({ onReact, isWaving, onWaveToggle, layout = 'inline' }) => {
  return (
    <div className={cn(
      layout === 'grid' ? 'flex flex-col gap-3' : 'flex items-center gap-2'
    )}>
      <div className={cn(
        "glass border border-border/50 rounded-2xl",
        layout === 'grid' 
          ? 'grid grid-cols-4 gap-1 p-2' 
          : 'flex gap-1 p-2 rounded-full'
      )}>
        {REACTION_EMOJIS.map((emoji) => (
          <Button
            key={emoji}
            variant="ghost"
            size="sm"
            className={cn(
              "text-lg hover:scale-125 active:scale-95 transition-transform rounded-xl",
              // Larger touch targets on mobile
              layout === 'grid' ? "w-full h-12 p-0" : "w-9 h-9 p-0"
            )}
            onClick={() => onReact(emoji)}
          >
            {emoji}
          </Button>
        ))}
      </div>
      
      <Button
        variant={isWaving ? 'default' : 'outline'}
        size="sm"
        onClick={onWaveToggle}
        className={cn(
          'gap-1.5 transition-all rounded-xl',
          layout === 'grid' ? 'w-full h-11' : '',
          isWaving && 'bg-primary shadow-lg shadow-primary/50'
        )}
      >
        <Sparkles className={cn(
          'w-4 h-4',
          isWaving && 'animate-pulse'
        )} />
        {isWaving ? '🎵' : 'Wave'}
      </Button>
    </div>
  );
};

export const FloatingReactions: React.FC<{ reactions: FloatingReaction[] }> = ({ reactions }) => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-30">
      {reactions.map((reaction) => (
        <div
          key={reaction.id}
          className="absolute bottom-20 animate-reaction-float text-4xl"
          style={{ left: `${reaction.x}%` }}
        >
          {reaction.emoji}
        </div>
      ))}
    </div>
  );
};

// Hook exports
export { useReactions, useWaving } from '@/hooks/useReactionsHook';
