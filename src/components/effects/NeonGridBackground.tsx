import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface NeonGridBackgroundProps {
  isPlaying: boolean;
  intensity: number;
  beatPhase: number;
  isBeat: boolean;
  className?: string;
}

export const NeonGridBackground: React.FC<NeonGridBackgroundProps> = ({
  isPlaying,
  intensity,
  beatPhase,
  isBeat,
  className,
}) => {
  const tilt = useMemo(() => {
    return Math.sin(beatPhase * Math.PI) * 5 * intensity;
  }, [beatPhase, intensity]);

  if (!isPlaying) return null;

  return (
    <div className={cn('absolute inset-0 overflow-hidden pointer-events-none perspective-[1000px]', className)}>
      <div 
        className="absolute inset-0 origin-bottom transition-transform duration-100 ease-out"
        style={{
          transform: `rotateX(60deg) translateY(${tilt}px)`,
          backgroundImage: `
            linear-gradient(to right, hsl(var(--primary) / 0.2) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--primary) / 0.2) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      >
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, transparent, hsl(var(--background)) 80%)',
          }}
        />
      </div>

      {/* Horizon glow */}
      <div 
        className="absolute top-1/2 left-0 right-0 h-40 -translate-y-1/2"
        style={{
          background: `radial-gradient(ellipse at center, hsl(var(--primary) / ${0.2 + intensity * 0.3}), transparent 70%)`,
          filter: 'blur(40px)',
          opacity: isBeat ? 0.8 : 0.4,
          transition: 'opacity 100ms ease-out',
        }}
      />

      {/* Retro Sun */}
      <div 
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[120%] w-64 h-64 rounded-full"
        style={{
          background: 'linear-gradient(to bottom, #ff0080, #ff8c00)',
          boxShadow: `0 0 60px #ff008066, 0 0 100px #ff8c0033`,
          clipPath: 'polygon(0% 0%, 100% 0%, 100% 70%, 0% 70%, 0% 75%, 100% 75%, 100% 80%, 0% 80%, 0% 85%, 100% 85%, 100% 90%, 0% 90%, 0% 95%, 100% 95%, 100% 100%, 0% 100%)',
          transform: `scale(${1 + intensity * 0.05})`,
          transition: 'transform 100ms ease-out',
        }}
      />
    </div>
  );
};
