import { useCallback, useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
  userId: string;
}

export const useReactions = (channel: RealtimeChannel | null, userId: string) => {
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);

  const showReaction = useCallback((reaction: FloatingReaction) => {
    setReactions((prev) => [...prev, reaction]);
    setTimeout(() => setReactions((prev) => prev.filter((item) => item.id !== reaction.id)), 3000);
  }, []);

  const sendReaction = useCallback((emoji: string) => {
    if (!channel) return;

    const reaction: FloatingReaction = {
      id: `${Date.now()}-${Math.random()}`,
      emoji,
      x: 30 + Math.random() * 40,
      userId,
    };

    void channel.send({ type: 'broadcast', event: 'reaction', payload: reaction });
    showReaction(reaction);
  }, [channel, showReaction, userId]);

  useEffect(() => {
    if (!channel) return;

    const handleReaction = ({ payload }: { payload: FloatingReaction }) => {
      if (payload.userId !== userId) showReaction(payload);
    };

    channel.on('broadcast', { event: 'reaction' }, handleReaction);
  }, [channel, showReaction, userId]);

  return { reactions, sendReaction };
};
