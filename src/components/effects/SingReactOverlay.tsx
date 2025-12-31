import React, { useState, useCallback, useEffect } from 'react';
import { LightStick, LIGHTSTICK_COLORS } from './LightStick';
import { useAudioReactive } from '@/hooks/useAudioReactive';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RealtimeChannel } from '@supabase/supabase-js';

interface WavingUser {
  userId: string;
  color: string;
  position: number; // 0-1 horizontal position
}

interface SingReactOverlayProps {
  isPlaying: boolean;
  userId: string;
  channel: RealtimeChannel | null;
  className?: string;
}

export const SingReactOverlay: React.FC<SingReactOverlayProps> = ({
  isPlaying,
  userId,
  channel,
  className,
}) => {
  const [isWaving, setIsWaving] = useState(false);
  const [otherWaving, setOtherWaving] = useState<WavingUser[]>([]);
  const [myColor] = useState(() =>
    LIGHTSTICK_COLORS[Math.floor(Math.random() * LIGHTSTICK_COLORS.length)]
  );
  
  const { intensity, isBeat, lowFreq } = useAudioReactive({
    enabled: isPlaying,
    sensitivity: 6,
    smoothing: 0.7,
  });

  // Broadcast waving state
  const broadcastWaving = useCallback((waving: boolean) => {
    if (!channel) return;
    
    channel.send({
      type: 'broadcast',
      event: 'lightstick_wave',
      payload: {
        userId,
        isWaving: waving,
        color: myColor,
        position: Math.random(), // Random horizontal position
      },
    });
  }, [channel, userId, myColor]);

  // Toggle waving
  const toggleWaving = () => {
    const newWaving = !isWaving;
    setIsWaving(newWaving);
    broadcastWaving(newWaving);
  };

  // Listen for other users waving
  useEffect(() => {
    if (!channel) return;

    const handleWave = (payload: { payload: { userId: string; isWaving: boolean; color: string; position: number } }) => {
      const { userId: oderId, isWaving: oderWaving, color, position } = payload.payload;
      
      if (oderId === userId) return; // Ignore own events
      
      setOtherWaving(prev => {
        if (oderWaving) {
          // Add or update
          const existing = prev.find(u => u.userId === oderId);
          if (existing) {
            return prev.map(u => u.userId === oderId ? { ...u, color, position } : u);
          }
          return [...prev, { userId: oderId, color, position }];
        } else {
          // Remove
          return prev.filter(u => u.userId !== oderId);
        }
      });
    };

    channel.on('broadcast', { event: 'lightstick_wave' }, handleWave);

    return () => {
      channel.unsubscribe();
    };
  }, [channel, userId]);

  // Auto-wave on beat if user is waving
  const shouldAnimate = isWaving && (isBeat || lowFreq > 0.5);

  if (!isPlaying) return null;

  return (
    <div className={cn('pointer-events-none', className)}>
      {/* Audio-reactive background pulse */}
      <div 
        className="absolute inset-0 transition-opacity duration-150"
        style={{
          background: `radial-gradient(ellipse at center bottom, hsl(var(--primary) / ${intensity * 0.15}), transparent 70%)`,
          opacity: isPlaying ? 1 : 0,
        }}
      />
      
      {/* Beat flash effect */}
      {isBeat && (
        <div 
          className="absolute inset-0 bg-primary/10 animate-pulse"
          style={{ animationDuration: '150ms' }}
        />
      )}
      
      {/* Other users' light sticks */}
      <div className="absolute bottom-0 left-0 right-0 h-32 flex justify-center items-end gap-4 px-8">
        {otherWaving.map((user) => (
          <div
            key={user.userId}
            className="relative"
            style={{
              transform: `translateX(${(user.position - 0.5) * 100}px)`,
            }}
          >
            <LightStick
              color={user.color}
              isWaving={true}
              intensity={intensity}
              size="sm"
            />
          </div>
        ))}
      </div>
      
      {/* My light stick (centered, larger) */}
      {isWaving && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <LightStick
            color={myColor}
            isWaving={shouldAnimate}
            intensity={intensity}
            size="lg"
          />
        </div>
      )}
      
      {/* Wave button */}
      <div className="absolute bottom-4 right-4 pointer-events-auto">
        <Button
          variant={isWaving ? 'default' : 'outline'}
          size="sm"
          onClick={toggleWaving}
          className={cn(
            'gap-2 transition-all',
            isWaving && 'bg-primary shadow-lg shadow-primary/50'
          )}
        >
          <Sparkles className={cn(
            'w-4 h-4',
            isWaving && 'animate-pulse'
          )} />
          {isWaving ? 'Waving!' : 'Wave'}
        </Button>
      </div>
    </div>
  );
};
