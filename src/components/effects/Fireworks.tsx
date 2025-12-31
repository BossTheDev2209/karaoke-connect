import React, { useEffect, useState } from 'react';

interface Firework {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
}

const COLORS = [
  'hsl(var(--neon-pink))',
  'hsl(var(--neon-purple))',
  'hsl(var(--neon-blue))',
  'hsl(var(--neon-yellow))',
  'hsl(45, 100%, 50%)',
];

export const Fireworks: React.FC = () => {
  const [fireworks, setFireworks] = useState<Firework[]>([]);

  useEffect(() => {
    const createFirework = () => {
      const id = Date.now() + Math.random();
      const firework: Firework = {
        id,
        x: 10 + Math.random() * 80,
        y: 20 + Math.random() * 40,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 100 + Math.random() * 100,
      };

      setFireworks((prev) => [...prev, firework]);

      setTimeout(() => {
        setFireworks((prev) => prev.filter((f) => f.id !== id));
      }, 1500);
    };

    // Create initial fireworks
    for (let i = 0; i < 3; i++) {
      setTimeout(createFirework, i * 500);
    }

    const interval = setInterval(createFirework, 2000 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-40">
      {fireworks.map((fw) => (
        <div
          key={fw.id}
          className="absolute animate-firework-explode"
          style={{
            left: `${fw.x}%`,
            top: `${fw.y}%`,
            width: fw.size,
            height: fw.size,
          }}
        >
          {/* Explosion particles */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full animate-firework-particle"
              style={{
                backgroundColor: fw.color,
                boxShadow: `0 0 8px ${fw.color}, 0 0 16px ${fw.color}`,
                transform: `rotate(${i * 30}deg) translateY(-${fw.size / 2}px)`,
                animationDelay: `${i * 0.02}s`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};
