import React from 'react';
import { cn } from '@/lib/utils';

interface LightStickProps {
  color?: string;
  isWaving?: boolean;
  intensity?: number; // 0-1 for audio reactivity
  beatPhase?: number; // 0-1 phase within beat cycle
  isBeat?: boolean;   // true on beat moment
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LightStick: React.FC<LightStickProps> = ({
  color = 'hsl(var(--primary))',
  isWaving = false,
  intensity = 0,
  beatPhase = 0,
  isBeat = false,
  size = 'md',
  className,
}) => {
  const sizeConfig = {
    sm: { width: 24, height: 60 },
    md: { width: 32, height: 80 },
    lg: { width: 40, height: 100 },
  };
  
  const { width, height } = sizeConfig[size];
  const glowIntensity = Math.max(0.3, intensity);
  
  // Calculate wave rotation based on beat phase (synced to BPM)
  // Swing from -20deg to +20deg following the beat
  const beatWaveAngle = isWaving 
    ? Math.sin(beatPhase * Math.PI * 2) * 20 
    : 0;
  
  // Extra "pop" on beat
  const beatScale = isBeat ? 1.1 : 1;
  const beatGlow = isBeat ? 30 : 8 + intensity * 20;
  
  return (
    <div
      className={cn(
        'relative transition-all duration-75',
        className
      )}
      style={{
        transformOrigin: 'bottom center',
        transform: `rotate(${beatWaveAngle}deg) scale(${beatScale})`,
        filter: `drop-shadow(0 0 ${beatGlow}px ${color})`,
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox="0 0 40 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Handle */}
        <rect
          x="15"
          y="55"
          width="10"
          height="40"
          rx="2"
          fill="hsl(var(--muted))"
        />
        <rect
          x="16"
          y="57"
          width="3"
          height="35"
          rx="1"
          fill="hsl(var(--muted-foreground) / 0.3)"
        />
        
        {/* Light bulb base */}
        <ellipse
          cx="20"
          cy="55"
          rx="8"
          ry="3"
          fill="hsl(var(--muted))"
        />
        
        {/* Light bulb */}
        <ellipse
          cx="20"
          cy="30"
          rx="16"
          ry="28"
          fill={color}
          style={{
            opacity: 0.7 + glowIntensity * 0.3,
          }}
        />
        
        {/* Inner glow - pulses brighter on beat */}
        <ellipse
          cx="20"
          cy="28"
          rx="10"
          ry="18"
          fill="white"
          style={{
            opacity: isBeat ? 0.8 : 0.3 + glowIntensity * 0.4,
            transition: 'opacity 0.05s ease-out',
          }}
        />
        
        {/* Highlight */}
        <ellipse
          cx="14"
          cy="20"
          rx="4"
          ry="6"
          fill="white"
          opacity="0.5"
        />
      </svg>
    </div>
  );
};

// Light stick colors for different users
export const LIGHTSTICK_COLORS = [
  'hsl(var(--neon-pink))',
  'hsl(var(--neon-purple))',
  'hsl(var(--neon-blue))',
  'hsl(var(--neon-green))',
  'hsl(var(--neon-yellow))',
  'hsl(var(--neon-orange))',
];