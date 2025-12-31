import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
  userId: string;
}

interface ReactionsProps {
  onReact: (emoji: string) => void;
  incomingReactions: FloatingReaction[];
}

const REACTION_EMOJIS = ['🔥', '❤️', '👏', '🎉', '😍', '🎤', '✨', '💯'];

export const ReactionBar: React.FC<{ onReact: (emoji: string) => void }> = ({ onReact }) => {
  return (
    <div className="flex gap-1 p-2 rounded-full glass border border-border/50">
      {REACTION_EMOJIS.map((emoji) => (
        <Button
          key={emoji}
          variant="ghost"
          size="sm"
          className="w-8 h-8 p-0 text-lg hover:scale-125 transition-transform"
          onClick={() => onReact(emoji)}
        >
          {emoji}
        </Button>
      ))}
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

  const sendReaction = useCallback((emoji: string) => {
    if (!channel) return;

    const reaction: FloatingReaction = {
      id: `${Date.now()}-${Math.random()}`,
      emoji,
      x: 30 + Math.random() * 40,
      userId,
    };

    // Broadcast to others
    channel.send({
      type: 'broadcast',
      event: 'reaction',
      payload: reaction,
    });

    // Show locally
    setReactions((prev) => [...prev, reaction]);

    // Remove after animation
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
    }, 3000);
  }, [channel, userId]);

  useEffect(() => {
    if (!channel) return;

    const handleReaction = (payload: { payload: FloatingReaction }) => {
      const reaction = payload.payload;
      if (reaction.userId === userId) return; // Skip own reactions

      setReactions((prev) => [...prev, reaction]);

      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      }, 3000);
    };

    channel.on('broadcast', { event: 'reaction' }, handleReaction);

    // No cleanup needed - channel cleanup is handled by useRoom
  }, [channel, userId]);

  return { reactions, sendReaction };
};
