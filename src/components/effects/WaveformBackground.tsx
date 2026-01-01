import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface WaveformBackgroundProps {
  isPlaying: boolean;
  lowFreq: number;
  midFreq: number;
  highFreq: number;
  beatPhase: number;
  className?: string;
}

export const WaveformBackground: React.FC<WaveformBackgroundProps> = ({
  isPlaying,
  lowFreq,
  midFreq,
  highFreq,
  beatPhase,
  className,
}) => {
  const waves = useMemo(() => {
    return [
      { color: 'var(--primary)', freq: 1, amp: lowFreq * 100, speed: 1 },
      { color: 'var(--secondary)', freq: 2, amp: midFreq * 60, speed: 1.5 },
      { color: 'var(--accent)', freq: 3, amp: highFreq * 40, speed: 2 },
    ];
  }, [lowFreq, midFreq, highFreq]);

  if (!isPlaying) return null;

  return (
    <div className={cn('absolute inset-0 overflow-hidden pointer-events-none flex items-center', className)}>
      <svg className="w-full h-64 overflow-visible opacity-50">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        {waves.map((wave, i) => {
          const points = Array.from({ length: 50 }).map((_, x) => {
            const xPos = (x / 49) * 1000;
            const yPos = 120 + Math.sin((x / 10) + (beatPhase * wave.speed * Math.PI * 2)) * wave.amp;
            return `${xPos},${yPos}`;
          }).join(' ');

          return (
            <polyline
              key={i}
              points={points}
              fill="none"
              stroke={`hsl(var(${wave.color}))`}
              strokeWidth="3"
              strokeLinecap="round"
              filter="url(#glow)"
              style={{ transition: 'all 100ms ease-out' }}
            />
          );
        })}
      </svg>
      
      {/* Background glow base */}
      <div 
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at center, hsl(var(--primary) / 0.1), transparent 70%)`,
        }}
      />
    </div>
  );
};
