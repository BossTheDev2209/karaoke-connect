import React from 'react';
import { Confetti } from './Confetti';
import { Fireworks } from './Fireworks';
import { Sparkles } from 'lucide-react';

type CelebrationTheme = 'new-year' | 'christmas' | 'halloween' | 'none';

interface CelebrationOverlayProps {
  theme: CelebrationTheme;
}

export const CelebrationOverlay: React.FC<CelebrationOverlayProps> = ({ theme }) => {
  if (theme === 'none') return null;

  return (
    <>
      {theme === 'new-year' && (
        <>
          <Fireworks />
          <Confetti count={60} />
          {/* New Year Banner */}
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="flex items-center gap-2 px-6 py-2 rounded-full glass border border-neon-yellow/30">
              <Sparkles className="w-5 h-5 text-neon-yellow animate-pulse" />
              <span className="text-lg font-bold text-gradient">Happy New Year 2025!</span>
              <Sparkles className="w-5 h-5 text-neon-yellow animate-pulse" />
            </div>
          </div>
        </>
      )}

      {theme === 'christmas' && (
        <>
          <Confetti count={40} />
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="flex items-center gap-2 px-6 py-2 rounded-full glass border border-neon-green/30">
              <span className="text-2xl">🎄</span>
              <span className="text-lg font-bold text-neon-green">Merry Christmas!</span>
              <span className="text-2xl">🎅</span>
            </div>
          </div>
        </>
      )}

      {theme === 'halloween' && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="flex items-center gap-2 px-6 py-2 rounded-full glass border border-neon-orange/30">
            <span className="text-2xl">🎃</span>
            <span className="text-lg font-bold text-neon-orange">Happy Halloween!</span>
            <span className="text-2xl">👻</span>
          </div>
        </div>
      )}
    </>
  );
};

// Auto-detect current celebration based on date
export const getCurrentCelebration = (): CelebrationTheme => {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const day = now.getDate();

  // New Year (Dec 25 - Jan 5)
  if ((month === 11 && day >= 25) || (month === 0 && day <= 5)) {
    return 'new-year';
  }

  // Christmas (Dec 20 - Dec 24)
  if (month === 11 && day >= 20 && day <= 24) {
    return 'christmas';
  }

  // Halloween (Oct 25 - Oct 31)
  if (month === 9 && day >= 25 && day <= 31) {
    return 'halloween';
  }

  return 'none';
};
