import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface BeatSyncBackgroundProps {
  isPlaying: boolean;
  intensity: number;
  beatPhase: number;
  isBeat: boolean;
  lowFreq: number;
  midFreq: number;
  highFreq: number;
  bpm: number;
  className?: string;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
  startTime: number;
}

export const BeatSyncBackground: React.FC<BeatSyncBackgroundProps> = ({
  isPlaying,
  intensity,
  beatPhase,
  isBeat,
  lowFreq,
  midFreq,
  highFreq,
  bpm,
  className,
}) => {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const rippleIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Create ripple on beat
  useEffect(() => {
    if (isBeat && isPlaying) {
      const newRipple: Ripple = {
        id: rippleIdRef.current++,
        x: 30 + Math.random() * 40, // Random position 30-70%
        y: 40 + Math.random() * 30, // Random position 40-70%
        startTime: Date.now(),
      };
      
      setRipples(prev => [...prev.slice(-4), newRipple]); // Keep max 5 ripples
    }
  }, [isBeat, isPlaying]);

  // Cleanup old ripples
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRipples(prev => prev.filter(r => now - r.startTime < 2000));
    }, 500);
    
    return () => clearInterval(interval);
  }, []);

  if (!isPlaying) return null;

  // Calculate pulse scale based on beat phase (peaks at beat, decays after)
  const pulseScale = 1 + Math.exp(-beatPhase * 5) * 0.15 * intensity;
  
  // Color intensity based on frequency bands
  const bassGlow = lowFreq * 0.4;
  const midGlow = midFreq * 0.3;
  const trebleGlow = highFreq * 0.2;

  return (
    <div 
      ref={containerRef}
      className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}
    >
      {/* Base ambient gradient - pulses with beat */}
      <div 
        className="absolute inset-0 transition-transform duration-100"
        style={{
          background: `
            radial-gradient(ellipse 120% 80% at 50% 100%, 
              hsl(var(--primary) / ${bassGlow}) 0%, 
              hsl(var(--neon-purple) / ${midGlow * 0.5}) 40%,
              transparent 70%
            )
          `,
          transform: `scale(${pulseScale})`,
        }}
      />

      {/* Corner light beams that pulse */}
      <div 
        className="absolute -left-20 -bottom-20 w-96 h-96 rounded-full transition-all duration-150"
        style={{
          background: `radial-gradient(circle, hsl(var(--neon-blue) / ${bassGlow * 0.6}) 0%, transparent 60%)`,
          transform: `scale(${1 + lowFreq * 0.3})`,
          filter: `blur(${40 + lowFreq * 20}px)`,
        }}
      />
      
      <div 
        className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full transition-all duration-150"
        style={{
          background: `radial-gradient(circle, hsl(var(--neon-pink) / ${midGlow * 0.5}) 0%, transparent 60%)`,
          transform: `scale(${1 + midFreq * 0.25})`,
          filter: `blur(${30 + midFreq * 15}px)`,
        }}
      />

      {/* Moving light orbs synced to beat phase */}
      <div
        className="absolute w-32 h-32 rounded-full"
        style={{
          left: `${20 + Math.sin(beatPhase * Math.PI * 2) * 10}%`,
          top: `${30 + Math.cos(beatPhase * Math.PI * 2) * 15}%`,
          background: `radial-gradient(circle, hsl(var(--neon-purple) / ${0.2 + highFreq * 0.3}) 0%, transparent 70%)`,
          filter: 'blur(20px)',
        }}
      />
      
      <div
        className="absolute w-24 h-24 rounded-full"
        style={{
          right: `${15 + Math.cos(beatPhase * Math.PI * 2 + 1) * 8}%`,
          top: `${20 + Math.sin(beatPhase * Math.PI * 2 + 1) * 10}%`,
          background: `radial-gradient(circle, hsl(var(--primary) / ${0.15 + midFreq * 0.25}) 0%, transparent 70%)`,
          filter: 'blur(15px)',
        }}
      />

      {/* Beat ripples */}
      {ripples.map(ripple => {
        const age = (Date.now() - ripple.startTime) / 1000;
        const scale = 1 + age * 3;
        const opacity = Math.max(0, 0.5 - age * 0.25);
        
        return (
          <div
            key={ripple.id}
            className="absolute rounded-full border-2 border-primary/40"
            style={{
              left: `${ripple.x}%`,
              top: `${ripple.y}%`,
              width: '100px',
              height: '100px',
              transform: `translate(-50%, -50%) scale(${scale})`,
              opacity,
              boxShadow: `0 0 20px hsl(var(--primary) / ${opacity * 0.5}), inset 0 0 20px hsl(var(--primary) / ${opacity * 0.3})`,
              transition: 'none',
            }}
          />
        );
      })}

      {/* Horizontal light bar at bottom - audio visualizer style */}
      <div className="absolute bottom-0 left-0 right-0 h-1 flex gap-0.5 px-4 opacity-60">
        {Array.from({ length: 32 }).map((_, i) => {
          const freq = i < 8 ? lowFreq : i < 20 ? midFreq : highFreq;
          const variance = Math.sin(i * 0.5 + beatPhase * Math.PI * 2) * 0.3;
          const barHeight = Math.max(2, (freq + variance) * 30 * intensity);
          
          return (
            <div
              key={i}
              className="flex-1 rounded-t-full transition-all duration-75"
              style={{
                height: `${barHeight}px`,
                background: `linear-gradient(to top, 
                  hsl(var(--primary) / 0.8), 
                  hsl(var(--neon-pink) / ${0.4 + freq * 0.4})
                )`,
                boxShadow: isBeat ? `0 0 10px hsl(var(--primary))` : 'none',
              }}
            />
          );
        })}
      </div>

      {/* Beat flash overlay */}
      <div
        className="absolute inset-0 bg-primary/5 transition-opacity duration-75"
        style={{
          opacity: isBeat ? 1 : 0,
        }}
      />

      {/* Scanline effect for retro vibe */}
      <div 
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(var(--foreground)) 2px, hsl(var(--foreground)) 4px)',
        }}
      />
    </div>
  );
};
