import React from 'react';
import { useAudioReactive } from '@/hooks/useAudioReactive';
import { BeatSyncBackground } from './BeatSyncBackground';
import { cn } from '@/lib/utils';

interface SingReactOverlayProps {
  isPlaying: boolean;
  userId: string;
  channel: any | null;
  targetBpm?: number;
  className?: string;
}

export const SingReactOverlay: React.FC<SingReactOverlayProps> = ({
  isPlaying,
  targetBpm = 120,
  className,
}) => {
  const { intensity, isBeat, beatPhase, lowFreq, midFreq, highFreq, bpm } = useAudioReactive({
    enabled: isPlaying,
    sensitivity: 7,
    smoothing: 0.6,
    targetBpm,
  });

  if (!isPlaying) return null;

  return (
    <div className={cn('pointer-events-none', className)}>
      <BeatSyncBackground
        isPlaying={isPlaying}
        intensity={intensity}
        beatPhase={beatPhase}
        isBeat={isBeat}
        lowFreq={lowFreq}
        midFreq={midFreq}
        highFreq={highFreq}
        bpm={bpm}
      />
    </div>
  );
};