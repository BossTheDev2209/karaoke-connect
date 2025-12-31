import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface LightStickProps {
  color?: string;
  isWaving?: boolean;
  intensity?: number; // 0-1 for audio reactivity
  beatPhase?: number; // 0-1 phase within beat cycle
  isBeat?: boolean;   // true on beat moment
  bpm?: number;       // beats per minute for animation timing
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LightStick: React.FC<LightStickProps> = ({
  color = 'hsl(var(--primary))',
  isWaving = false,
  intensity = 0,
  beatPhase = 0,
  isBeat = false,
  bpm = 120,
  size = 'md',
  className,
}) => {
  const sizeConfig = {
    sm: { width: 24, height: 60 },
    md: { width: 32, height: 80 },
    lg: { width: 40, height: 100 },
  };
  
  const { width, height } = sizeConfig[size];
  
  // Calculate animation duration based on BPM
  const beatDuration = useMemo(() => 60000 / bpm, [bpm]);
  
  // Glow intensity follows the beat decay curve
  const beatDecay = Math.exp(-beatPhase * 4);
  const glowIntensity = Math.max(0.3, 0.3 + beatDecay * 0.7 * intensity);
  
  // Wave motion synced to beat - complete swing cycle per beat
  // Use sine wave that peaks at different points in the beat cycle
  const waveAngle = useMemo(() => {
    if (!isWaving) return 0;
    
    // Swing follows beat: forward on beat, back after
    // Creates a natural "pumping" motion synced to music
    const swingPhase = beatPhase * 2 * Math.PI; // Full cycle per beat
    const primarySwing = Math.sin(swingPhase) * 25; // Main swing ±25°
    
    // Add a smaller secondary oscillation for energy
    const secondarySwing = Math.sin(swingPhase * 2) * 5;
    
    return primarySwing + secondarySwing;
  }, [isWaving, beatPhase]);
  
  // Scale pop on beat with quick attack, slow decay
  const beatScale = 1 + beatDecay * 0.15 * (isBeat ? 1.5 : 1);
  
  // Glow radius pulses with beat
  const glowRadius = 8 + beatDecay * 25 * intensity;
  const innerGlowOpacity = 0.3 + beatDecay * 0.5;
  
  // Slight y-translation on beat for "bounce" effect
  const bounceY = beatDecay * -5 * intensity;

  return (
    <div
      className={cn(
        'relative',
        className
      )}
      style={{
        transformOrigin: 'bottom center',
        transform: `rotate(${waveAngle}deg) scale(${beatScale}) translateY(${bounceY}px)`,
        filter: `drop-shadow(0 0 ${glowRadius}px ${color})`,
        transition: `transform ${beatDuration / 8}ms cubic-bezier(0.4, 0, 0.2, 1)`,
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
        
        {/* Light bulb - outer glow */}
        <ellipse
          cx="20"
          cy="30"
          rx="16"
          ry="28"
          fill={color}
          style={{
            opacity: 0.6 + glowIntensity * 0.4,
          }}
        />
        
        {/* Light bulb - mid layer pulsing */}
        <ellipse
          cx="20"
          cy="28"
          rx="13"
          ry="23"
          fill={color}
          style={{
            opacity: 0.7 + beatDecay * 0.3,
            filter: `blur(${2 + beatDecay * 3}px)`,
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
            opacity: innerGlowOpacity,
          }}
        />
        
        {/* Core bright spot */}
        <ellipse
          cx="20"
          cy="25"
          rx="6"
          ry="10"
          fill="white"
          style={{
            opacity: 0.5 + beatDecay * 0.5,
          }}
        />
        
        {/* Highlight */}
        <ellipse
          cx="14"
          cy="20"
          rx="4"
          ry="6"
          fill="white"
          opacity="0.6"
        />
      </svg>
      
      {/* External glow rays on beat */}
      {isBeat && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 50% 30%, ${color.replace(')', ' / 0.4)')}, transparent 50%)`,
          }}
        />
      )}
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