import React from 'react';
import { cn } from '@/lib/utils';

interface LightStickProps {
  color?: string;
  isWaving?: boolean;
  intensity?: number; // 0-1 for audio reactivity
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LightStick: React.FC<LightStickProps> = ({
  color = 'hsl(var(--primary))',
  isWaving = false,
  intensity = 0,
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
  
  return (
    <div
      className={cn(
        'relative transition-transform duration-150',
        isWaving && 'animate-lightstick-wave',
        className
      )}
      style={{
        transformOrigin: 'bottom center',
        filter: `drop-shadow(0 0 ${8 + intensity * 20}px ${color})`,
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
        
        {/* Inner glow */}
        <ellipse
          cx="20"
          cy="28"
          rx="10"
          ry="18"
          fill="white"
          style={{
            opacity: 0.3 + glowIntensity * 0.4,
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