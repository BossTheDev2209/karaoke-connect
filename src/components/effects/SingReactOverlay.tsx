import React from 'react';
import { useAudioReactive } from '@/hooks/useAudioReactive';
import { BeatSyncBackground } from './BeatSyncBackground';
import { ParticleBackground } from './ParticleBackground';
import { NeonGridBackground } from './NeonGridBackground';
import { WaveformBackground } from './WaveformBackground';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

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
  const { backgroundEffect } = useTheme();
  const { intensity, isBeat, beatPhase, lowFreq, midFreq, highFreq, bpm } = useAudioReactive({
    enabled: isPlaying && backgroundEffect !== 'none',
    sensitivity: 7,
    smoothing: 0.6,
    targetBpm,
  });

  if (!isPlaying) return null;

  return (
    <div className={cn('pointer-events-none', className)}>
      {backgroundEffect === 'beat-sync' && (
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
      )}
      {backgroundEffect === 'particles' && (
        <ParticleBackground />
      )}
      {backgroundEffect === 'neon-grid' && (
        <NeonGridBackground
          isPlaying={isPlaying}
          intensity={intensity}
          beatPhase={beatPhase}
          isBeat={isBeat}
        />
      )}
      {backgroundEffect === 'wave-form' && (
        <WaveformBackground
          isPlaying={isPlaying}
          lowFreq={lowFreq}
          midFreq={midFreq}
          highFreq={highFreq}
          beatPhase={beatPhase}
        />
      )}
    </div>
  );
};