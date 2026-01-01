import React, { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Music, Music2, Music3, Music4 } from 'lucide-react';

// Musical note particle
interface MusicNote {
  id: number;
  x: number;
  y: number;
  icon: number; // 0-3 for different icons
  rotation: number;
  delay: number;
}

// Dust particle
interface DustParticle {
  id: number;
  x: number;
  delay: number;
  size: number;
  duration: number;
}

interface SingerSpotlightProps {
  isMainSinger: boolean;
  audioLevel?: number;
  className?: string;
}

export const SingerSpotlight: React.FC<SingerSpotlightProps> = ({
  isMainSinger,
  audioLevel = 0,
  className
}) => {
  if (!isMainSinger) return null;

  const spotlightIntensity = 0.3 + audioLevel * 0.5;

  return (
    <div className={cn("absolute inset-0 pointer-events-none z-0", className)}>
      {/* Main spotlight beam from top */}
      <div 
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-40 h-56"
        style={{
          background: `conic-gradient(from 160deg at 50% 0%, transparent 0deg, rgba(255,255,255,${spotlightIntensity}) 15deg, rgba(255,255,255,${spotlightIntensity * 0.6}) 30deg, transparent 45deg)`,
          filter: 'blur(2px)',
        }}
      />
      
      {/* Secondary glow rays */}
      <div 
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-48 h-48"
        style={{
          background: `radial-gradient(ellipse at top, hsla(var(--primary) / ${spotlightIntensity * 0.4}), transparent 70%)`,
        }}
      />
      
      {/* Ground glow */}
      <div 
        className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-32 h-8 rounded-full"
        style={{
          background: `radial-gradient(ellipse, hsla(var(--primary) / ${spotlightIntensity * 0.6}), transparent 70%)`,
          filter: 'blur(8px)',
        }}
      />
    </div>
  );
};

interface MusicNotesEffectProps {
  isActive: boolean;
  audioLevel?: number;
  className?: string;
}

export const MusicNotesEffect: React.FC<MusicNotesEffectProps> = ({
  isActive,
  audioLevel = 0,
  className
}) => {
  const [notes, setNotes] = useState<MusicNote[]>([]);
  const noteIdRef = useRef(0);
  const lastSpawnRef = useRef(0);

  useEffect(() => {
    if (!isActive || audioLevel < 0.1) return;

    const spawnInterval = Math.max(150, 400 - audioLevel * 300);
    const now = Date.now();
    
    if (now - lastSpawnRef.current < spawnInterval) return;
    lastSpawnRef.current = now;

    const newNote: MusicNote = {
      id: noteIdRef.current++,
      x: 30 + Math.random() * 40, // Center area
      y: 100,
      icon: Math.floor(Math.random() * 4),
      rotation: -30 + Math.random() * 60,
      delay: Math.random() * 0.2,
    };

    setNotes(prev => [...prev.slice(-10), newNote]); // Keep max 10 notes
  }, [isActive, audioLevel]);

  // Cleanup old notes
  useEffect(() => {
    const cleanup = setInterval(() => {
      setNotes(prev => prev.slice(-8));
    }, 2000);
    return () => clearInterval(cleanup);
  }, []);

  const NoteIcon = ({ icon }: { icon: number }) => {
    const icons = [Music, Music2, Music3, Music4];
    const Icon = icons[icon % icons.length];
    return <Icon className="w-4 h-4" />;
  };

  return (
    <div className={cn("absolute inset-0 pointer-events-none overflow-hidden", className)}>
      {notes.map(note => (
        <div
          key={note.id}
          className="absolute text-primary animate-float-up opacity-0"
          style={{
            left: `${note.x}%`,
            bottom: '10%',
            transform: `rotate(${note.rotation}deg)`,
            animationDelay: `${note.delay}s`,
          }}
        >
          <NoteIcon icon={note.icon} />
        </div>
      ))}
    </div>
  );
};

interface ScreenShakeEffectProps {
  audioLevel: number;
  threshold?: number;
  children: React.ReactNode;
  className?: string;
}

export const ScreenShakeEffect: React.FC<ScreenShakeEffectProps> = ({
  audioLevel,
  threshold = 0.6,
  children,
  className
}) => {
  const shouldShake = audioLevel > threshold;
  const intensity = shouldShake ? (audioLevel - threshold) / (1 - threshold) : 0;
  
  return (
    <div 
      className={cn("transition-transform", className)}
      style={{
        transform: shouldShake 
          ? `translate(${(Math.random() - 0.5) * intensity * 4}px, ${(Math.random() - 0.5) * intensity * 2}px)` 
          : 'none',
      }}
    >
      {children}
    </div>
  );
};

interface DustFallEffectProps {
  isActive: boolean;
  intensity?: number;
  className?: string;
}

export const DustFallEffect: React.FC<DustFallEffectProps> = ({
  isActive,
  intensity = 0.5,
  className
}) => {
  const [particles, setParticles] = useState<DustParticle[]>([]);
  const particleIdRef = useRef(0);

  useEffect(() => {
    if (!isActive) {
      setParticles([]);
      return;
    }

    const particleCount = Math.floor(10 + intensity * 15);
    const newParticles: DustParticle[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: particleIdRef.current++,
        x: Math.random() * 100,
        delay: Math.random() * 2,
        size: 2 + Math.random() * 3,
        duration: 3 + Math.random() * 4,
      });
    }
    
    setParticles(newParticles);
  }, [isActive, intensity]);

  if (!isActive) return null;

  return (
    <div className={cn("absolute inset-0 pointer-events-none overflow-hidden", className)}>
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute rounded-full bg-foreground/20 animate-dust-fall"
          style={{
            left: `${particle.x}%`,
            top: '-5%',
            width: particle.size,
            height: particle.size,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
          }}
        />
      ))}
    </div>
  );
};

// Combined effect for the main singer area
interface MainSingerEffectsProps {
  isMainSinger: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  children: React.ReactNode;
}

export const MainSingerEffects: React.FC<MainSingerEffectsProps> = ({
  isMainSinger,
  isSpeaking,
  audioLevel,
  children
}) => {
  const showIntenseEffects = isMainSinger && isSpeaking && audioLevel > 0.5;

  return (
    <div className="relative">
      <SingerSpotlight isMainSinger={isMainSinger} audioLevel={audioLevel} />
      <MusicNotesEffect isActive={isMainSinger && isSpeaking} audioLevel={audioLevel} />
      {children}
    </div>
  );
};
