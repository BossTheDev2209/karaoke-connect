import React, { useState, useEffect, useRef, useMemo } from 'react';
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

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  hue: number;
  life: number;
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
  const [particles, setParticles] = useState<Particle[]>([]);
  const rippleIdRef = useRef(0);
  const particleIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate light rays based on beat
  const lightRays = useMemo(() => {
    return Array.from({ length: 8 }).map((_, i) => ({
      angle: (i * 45) + (beatPhase * 10),
      opacity: 0.1 + (i % 2 === 0 ? lowFreq : midFreq) * 0.3,
      width: 2 + (i % 3) * 2,
    }));
  }, [beatPhase, lowFreq, midFreq]);

  // Create ripple on beat
  useEffect(() => {
    if (isBeat && isPlaying) {
      const newRipple: Ripple = {
        id: rippleIdRef.current++,
        x: 30 + Math.random() * 40,
        y: 40 + Math.random() * 30,
        startTime: Date.now(),
      };
      setRipples(prev => [...prev.slice(-4), newRipple]);

      // Spawn particles on beat
      const newParticles: Particle[] = Array.from({ length: 8 }).map(() => ({
        id: particleIdRef.current++,
        x: 40 + Math.random() * 20,
        y: 80 + Math.random() * 20,
        vx: (Math.random() - 0.5) * 2,
        vy: -1 - Math.random() * 3,
        size: 2 + Math.random() * 4,
        opacity: 0.6 + Math.random() * 0.4,
        hue: Math.random() * 60 + 280, // Purple to pink range
        life: 100,
      }));
      setParticles(prev => [...prev.slice(-30), ...newParticles]);
    }
  }, [isBeat, isPlaying]);

  // Animate particles
  useEffect(() => {
    if (!isPlaying || particles.length === 0) return;

    const interval = setInterval(() => {
      setParticles(prev => 
        prev
          .map(p => ({
            ...p,
            x: p.x + p.vx * 0.3,
            y: p.y + p.vy * 0.5,
            vy: p.vy + 0.02, // Slight gravity
            opacity: p.opacity * 0.98,
            life: p.life - 2,
          }))
          .filter(p => p.life > 0 && p.opacity > 0.05)
      );
    }, 32);

    return () => clearInterval(interval);
  }, [isPlaying, particles.length]);

  // Cleanup old ripples
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRipples(prev => prev.filter(r => now - r.startTime < 2000));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  if (!isPlaying) return null;

  const pulseScale = 1 + Math.exp(-beatPhase * 5) * 0.15 * intensity;
  const bassGlow = lowFreq * 0.4;
  const midGlow = midFreq * 0.3;
  const trebleGlow = highFreq * 0.2;

  return (
    <div 
      ref={containerRef}
      className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}
    >
      {/* Animated gradient mesh background */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 20% 80%, hsl(280 80% 50% / ${bassGlow * 0.4}) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 80% 70%, hsl(320 80% 50% / ${midGlow * 0.3}) 0%, transparent 50%),
            radial-gradient(ellipse 100% 60% at 50% 100%, hsl(var(--primary) / ${bassGlow * 0.5}) 0%, transparent 60%)
          `,
          transform: `scale(${pulseScale})`,
          transition: 'transform 100ms ease-out',
        }}
      />

      {/* Rotating light rays from bottom center */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
        {lightRays.map((ray, i) => (
          <div
            key={i}
            className="absolute bottom-0 origin-bottom"
            style={{
              width: `${ray.width}px`,
              height: '400px',
              background: `linear-gradient(to top, hsl(var(--primary) / ${ray.opacity}), transparent)`,
              transform: `rotate(${ray.angle - 90}deg)`,
              filter: 'blur(4px)',
            }}
          />
        ))}
      </div>

      {/* Floating orbs */}
      <div
        className="absolute w-40 h-40 rounded-full"
        style={{
          left: `${15 + Math.sin(beatPhase * Math.PI * 2) * 10}%`,
          top: `${20 + Math.cos(beatPhase * Math.PI * 2) * 15}%`,
          background: `radial-gradient(circle, hsl(280 70% 60% / ${0.15 + midFreq * 0.2}) 0%, transparent 70%)`,
          filter: 'blur(30px)',
          transform: `scale(${1 + lowFreq * 0.3})`,
        }}
      />
      <div
        className="absolute w-32 h-32 rounded-full"
        style={{
          right: `${10 + Math.cos(beatPhase * Math.PI * 2 + 2) * 12}%`,
          top: `${15 + Math.sin(beatPhase * Math.PI * 2 + 2) * 10}%`,
          background: `radial-gradient(circle, hsl(320 70% 60% / ${0.1 + highFreq * 0.25}) 0%, transparent 70%)`,
          filter: 'blur(25px)',
        }}
      />
      <div
        className="absolute w-24 h-24 rounded-full"
        style={{
          left: `${50 + Math.sin(beatPhase * Math.PI * 4) * 15}%`,
          top: `${40 + Math.cos(beatPhase * Math.PI * 4) * 10}%`,
          background: `radial-gradient(circle, hsl(var(--neon-blue) / ${0.1 + trebleGlow * 0.3}) 0%, transparent 70%)`,
          filter: 'blur(20px)',
        }}
      />

      {/* Corner accent lights */}
      <div 
        className="absolute -left-20 -bottom-20 w-96 h-96 rounded-full"
        style={{
          background: `radial-gradient(circle, hsl(var(--neon-blue) / ${bassGlow * 0.5}) 0%, transparent 60%)`,
          transform: `scale(${1 + lowFreq * 0.4})`,
          filter: `blur(${40 + lowFreq * 25}px)`,
        }}
      />
      <div 
        className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full"
        style={{
          background: `radial-gradient(circle, hsl(var(--neon-pink) / ${midGlow * 0.4}) 0%, transparent 60%)`,
          transform: `scale(${1 + midFreq * 0.35})`,
          filter: `blur(${30 + midFreq * 20}px)`,
        }}
      />

      {/* Beat ripples */}
      {ripples.map(ripple => {
        const age = (Date.now() - ripple.startTime) / 1000;
        const scale = 1 + age * 4;
        const opacity = Math.max(0, 0.6 - age * 0.3);
        
        return (
          <div
            key={ripple.id}
            className="absolute rounded-full"
            style={{
              left: `${ripple.x}%`,
              top: `${ripple.y}%`,
              width: '80px',
              height: '80px',
              transform: `translate(-50%, -50%) scale(${scale})`,
              opacity,
              border: '2px solid hsl(var(--primary) / 0.5)',
              boxShadow: `
                0 0 20px hsl(var(--primary) / ${opacity * 0.4}),
                0 0 40px hsl(var(--neon-pink) / ${opacity * 0.2}),
                inset 0 0 20px hsl(var(--primary) / ${opacity * 0.2})
              `,
            }}
          />
        );
      })}

      {/* Floating particles */}
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            background: `hsl(${particle.hue} 80% 60%)`,
            opacity: particle.opacity,
            boxShadow: `0 0 ${particle.size * 2}px hsl(${particle.hue} 80% 60% / 0.5)`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}

      {/* Horizontal audio visualizer bars */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 flex gap-0.5 px-4 opacity-70">
        {Array.from({ length: 40 }).map((_, i) => {
          const freq = i < 10 ? lowFreq : i < 25 ? midFreq : highFreq;
          const variance = Math.sin(i * 0.4 + beatPhase * Math.PI * 2) * 0.25;
          const barHeight = Math.max(2, (freq + variance) * 35 * intensity);
          
          return (
            <div
              key={i}
              className="flex-1 rounded-t-full"
              style={{
                height: `${barHeight}px`,
                background: `linear-gradient(to top, 
                  hsl(var(--primary)), 
                  hsl(${280 + (i / 40) * 60} 80% 60% / ${0.5 + freq * 0.5})
                )`,
                boxShadow: isBeat ? `0 0 8px hsl(var(--primary))` : 'none',
                transition: 'height 50ms ease-out',
              }}
            />
          );
        })}
      </div>

      {/* Center spotlight pulse */}
      <div
        className="absolute left-1/2 bottom-0 -translate-x-1/2"
        style={{
          width: '300px',
          height: '200px',
          background: `conic-gradient(from 180deg at 50% 100%, 
            transparent 0deg, 
            hsl(var(--primary) / ${bassGlow * 0.3}) 30deg,
            hsl(var(--neon-purple) / ${midGlow * 0.2}) 60deg,
            transparent 90deg,
            transparent 270deg,
            hsl(var(--neon-purple) / ${midGlow * 0.2}) 300deg,
            hsl(var(--primary) / ${bassGlow * 0.3}) 330deg,
            transparent 360deg
          )`,
          filter: 'blur(20px)',
          transform: `scaleY(${pulseScale})`,
          transformOrigin: 'bottom center',
        }}
      />

      {/* Beat flash overlay */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent"
        style={{
          opacity: isBeat ? 0.8 : 0,
          transition: 'opacity 50ms ease-out',
        }}
      />

      {/* Vignette effect */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 50%, transparent 30%, hsl(var(--background) / 0.4) 100%)',
        }}
      />

      {/* Subtle scanlines */}
      <div 
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(var(--foreground)) 2px, hsl(var(--foreground)) 4px)',
        }}
      />
    </div>
  );
};
