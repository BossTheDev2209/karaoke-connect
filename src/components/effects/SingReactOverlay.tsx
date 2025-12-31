import React from 'react';
import { useAudioReactive } from '@/hooks/useAudioReactive';
import { cn } from '@/lib/utils';

interface SingReactOverlayProps {
  isPlaying: boolean;
  userId: string;
  channel: any | null;
  className?: string;
}

export const SingReactOverlay: React.FC<SingReactOverlayProps> = ({
  isPlaying,
  className,
}) => {
  const { intensity, isBeat } = useAudioReactive({
    enabled: isPlaying,
    sensitivity: 6,
    smoothing: 0.7,
  });

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
    </div>
  );
};