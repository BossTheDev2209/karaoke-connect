import React, { useState, useEffect, useCallback } from 'react';
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

// Hook to manage reactions with Supabase realtime
export const useReactions = (
  channel: any | null,
  userId: string
) => {
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [activeReactions, setActiveReactions] = useState<Map<string, string>>(new Map());

  const sendReaction = useCallback((emoji: string) => {
    if (!channel) return;
    channel.send({
      type: 'broadcast',
      event: 'reaction',
      payload: { id: `${Date.now()}-${Math.random()}`, emoji, userId },
    });
    handleNewReaction(userId, emoji);
  }, [channel, userId]);

  const handleNewReaction = (reactorId: string, emoji: string) => {
    const newParticle: FloatingReaction = {
      id: `${Date.now()}-${Math.random()}`,
      emoji,
      x: 30 + Math.random() * 40,
      userId: reactorId,
    };
    setReactions((prev) => [...prev, newParticle]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== newParticle.id));
    }, 3000);
    setActiveReactions((prev) => {
      const next = new Map(prev);
      next.set(reactorId, emoji);
      return next;
    });
    setTimeout(() => {
      setActiveReactions((prev) => {
        const next = new Map(prev);
        if (next.get(reactorId) === emoji) next.delete(reactorId);
        return next;
      });
    }, 5000);
  };

  useEffect(() => {
    if (!channel) return;
    const handleReaction = (payload: { payload: { id: string; emoji: string; userId: string } }) => {
      const { userId: reactorId, emoji } = payload.payload;
      if (reactorId === userId) return;
      handleNewReaction(reactorId, emoji);
    };
    channel.on('broadcast', { event: 'reaction' }, handleReaction);
  }, [channel, userId]);

  return { reactions, activeReactions, sendReaction };
};

// Hook to manage light stick waving
export const useWaving = (
  channel: any | null,
  userId: string
) => {
  const [isWaving, setIsWaving] = useState(false);
  const [wavingUsers, setWavingUsers] = useState<Set<string>>(new Set());

  const toggleWaving = useCallback(() => {
    const newWaving = !isWaving;
    setIsWaving(newWaving);
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'lightstick_wave',
        payload: { userId, isWaving: newWaving },
      });
    }
  }, [channel, userId, isWaving]);

  useEffect(() => {
    if (!channel) return;
    const handleWave = (payload: { payload: { userId: string; isWaving: boolean } }) => {
      const { userId: oderId, isWaving: oderWaving } = payload.payload;
      if (oderId === userId) return;
      setWavingUsers(prev => {
        const next = new Set(prev);
        if (oderWaving) next.add(oderId);
        else next.delete(oderId);
        return next;
      });
    };
    channel.on('broadcast', { event: 'lightstick_wave' }, handleWave);
  }, [channel, userId]);

  const allWavingUsers = new Set(wavingUsers);
  if (isWaving) allWavingUsers.add(userId);

  return { isWaving, toggleWaving, wavingUsers: allWavingUsers };
};
