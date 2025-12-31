import React, { useEffect, useState } from 'react';

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
  rotation: number;
}

const COLORS = [
  'hsl(var(--neon-pink))',
  'hsl(var(--neon-purple))',
  'hsl(var(--neon-blue))',
  'hsl(var(--neon-yellow))',
  'hsl(var(--neon-green))',
  'hsl(45, 100%, 50%)', // gold
];

export const Confetti: React.FC<{ count?: number }> = ({ count = 50 }) => {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    const newPieces: ConfettiPiece[] = [];
    for (let i = 0; i < count; i++) {
      newPieces.push({
        id: i,
        x: Math.random() * 100,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: Math.random() * 5,
        duration: 3 + Math.random() * 4,
        size: 6 + Math.random() * 8,
        rotation: Math.random() * 360,
      });
    }
    setPieces(newPieces);
  }, [count]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${piece.x}%`,
            width: piece.size,
            height: piece.size * 0.6,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            transform: `rotate(${piece.rotation}deg)`,
            boxShadow: `0 0 6px ${piece.color}`,
          }}
        />
      ))}
    </div>
  );
};
