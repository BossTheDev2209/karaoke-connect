import React, { useMemo, useEffect, useState } from 'react';
import { User } from '@/types/karaoke';
import { cn } from '@/lib/utils';
import { Trophy, Crown, Mic2, Swords, Medal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import confetti from 'canvas-confetti';

interface TeamBattleOverlayProps {
  users: User[];
  isPlaying: boolean;
  onContinue?: () => void;
  showWinner?: boolean;
  isHost?: boolean;
}

export const TeamBattleOverlay: React.FC<TeamBattleOverlayProps> = ({
  users,
  isPlaying,
  onContinue,
  showWinner = false,
  isHost = false
}) => {
  // Calculate scores
  const { leftScore, rightScore, leftTeam, rightTeam } = useMemo(() => {
    const left = users.filter(u => u.team === 'left');
    const right = users.filter(u => u.team === 'right');
    
    // Sum scores
    // Note: score is accumulated total. 
    // If we want "per song" score, we'd need to reset it or track "songStartScore".
    // For now, let's assume global score is what matters or it's reset per song (which isn't implemented yet).
    // Assuming the user wants an accumulating battle session.
    
    const lScore = left.reduce((acc, u) => acc + (u.score || 0), 0);
    const rScore = right.reduce((acc, u) => acc + (u.score || 0), 0);
    
    return { leftScore: lScore, rightScore: rScore, leftTeam: left, rightTeam: right };
  }, [users]);
  
  // Calculate Progress (50% is tied)
  // Avoid division by zero
  const totalScore = leftScore + rightScore;
  const leftPercent = totalScore === 0 ? 50 : Math.max(10, Math.min(90, (leftScore / totalScore) * 100));

  // Determine winner
  const winner = showWinner 
    ? (leftScore > rightScore ? 'left' : rightScore > leftScore ? 'right' : 'tie')
    : null;
    
  // Confetti effect on winner reveal
  useEffect(() => {
    if (showWinner) {
      const duration = 3000;
      const end = Date.now() + duration;

      const colors = winner === 'left' 
        ? ['#ec4899', '#d946ef'] // Pink/Magenta for Left
        : winner === 'right' 
        ? ['#3b82f6', '#06b6d4'] // Blue/Cyan for Right
        : ['#ffffff']; // White for tie

      (function frame() {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());
    }
  }, [showWinner, winner]);

  return (
    <>
      {/* 1. Real-time Battle Gauge (Top Bar) */}
      <div className="fixed top-16 left-0 right-0 z-50 pointer-events-none px-4 flex justify-center">
        <div className="w-full max-w-4xl bg-black/40 backdrop-blur-md rounded-full border border-white/10 p-1 flex items-center relative overflow-hidden h-12 shadow-2xl">
          
          {/* Left Team Background */}
          <div 
            className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-pink-600 to-purple-600 transition-all duration-500 ease-out"
            style={{ width: `${leftPercent}%` }}
          />
          
          {/* Right Team Background (Fill remaining) */}
          <div 
            className="absolute top-0 bottom-0 right-0 bg-gradient-to-l from-blue-600 to-cyan-600 transition-all duration-500 ease-out"
            style={{ left: `${leftPercent}%` }}
          />
          
          {/* Center Indicator (VS) */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-black rounded-full border-2 border-white/20 flex items-center justify-center z-10 transition-all duration-500"
            style={{ left: `calc(${leftPercent}% - 16px)` }}
          >
            <Swords className="w-4 h-4 text-white" />
          </div>

           {/* Scores & Labels */}
          <div className="absolute inset-0 flex justify-between items-center px-4 font-black tracking-wider text-white drop-shadow-md">
            <div className="flex items-center gap-2">
               <span className="text-xl tabular-nums">{Math.floor(leftScore)}</span>
               <span className="text-xs opacity-80 uppercase">Team Pink</span>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-xs opacity-80 uppercase">Team Blue</span>
               <span className="text-xl tabular-nums">{Math.floor(rightScore)}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* 2. Winner Screen Overlay */}
      {showWinner && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-300">
          <div className="max-w-md w-full mx-4 bg-card border border-border rounded-xl p-8 flex flex-col items-center shadow-2xl transform animate-in zoom-in-95 duration-300">
            
            {winner === 'tie' ? (
              <div className="text-center">
                <Medal className="w-20 h-20 mx-auto text-yellow-400 mb-4 animate-bounce" />
                <h2 className="text-4xl font-black text-white mb-2 uppercase tracking-tight">It's a Tie!</h2>
                <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-blue-500 mb-6">
                  {Math.floor(totalScore / 2)} Pts
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="relative inline-block mb-6">
                   <Trophy className={cn(
                     "w-24 h-24 mx-auto animate-[bounce_2s_infinite]", 
                     winner === 'left' ? "text-pink-500" : "text-blue-500"
                   )} />
                   <Crown className="w-12 h-12 absolute -top-4 left-1/2 -translate-x-1/2 text-yellow-400 animate-pulse" />
                </div>
                
                <h3 className="text-xl text-muted-foreground uppercase tracking-widest mb-1">Winner</h3>
                <h2 className={cn(
                  "text-5xl font-black mb-4 uppercase tracking-tighter",
                  winner === 'left' ? "text-pink-500" : "text-blue-500"
                )}>
                  {winner === 'left' ? 'Team Pink' : 'Team Blue'}
                </h2>
                
                <div className="flex justify-center gap-8 mb-8 text-center">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase">Score</div>
                    <div className="text-3xl font-bold tabular-nums">
                      {Math.floor(winner === 'left' ? leftScore : rightScore)}
                    </div>
                  </div>
                  <div className="opacity-50 scale-75">
                    <div className="text-xs text-muted-foreground uppercase">Opponent</div>
                    <div className="text-3xl font-bold tabular-nums">
                      {Math.floor(winner === 'left' ? rightScore : leftScore)}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* MVP Section - Find player with highest score in winning team */}
            {(winner !== 'tie') && (
               <div className="w-full bg-muted/30 rounded-lg p-4 mb-6">
                 <div className="text-xs font-bold text-muted-foreground uppercase mb-3 flex items-center gap-1">
                   <Medal className="w-3 h-3" /> Match MVP
                 </div>
                 {(() => {
                   const winningTeam = winner === 'left' ? leftTeam : rightTeam;
                   if (winningTeam.length === 0) return null;
                   const mvp = winningTeam.reduce((prev, current) => (prev.score || 0) > (current.score || 0) ? prev : current);
                   return (
                     <div className="flex items-center gap-3">
                       <img src={mvp.avatarId || mvp.customAvatarNormal} alt={mvp.nickname} className="w-10 h-10 rounded-full border-2 border-primary" />
                       <div className="text-left">
                         <div className="font-bold text-sm">{mvp.nickname}</div>
                         <div className="text-xs text-muted-foreground">{Math.floor(mvp.score || 0)} pts</div>
                       </div>
                       <div className="ml-auto text-yellow-500 text-xs font-bold px-2 py-1 bg-yellow-500/10 rounded">
                         MVP
                       </div>
                     </div>
                   );
                 })()}
               </div>
            )}

            {isHost && onContinue && (
              <Button onClick={onContinue} size="lg" className="w-full font-bold">
                Next Round <Swords className="w-4 h-4 ml-2" />
              </Button>
            )}
            {!isHost && (
               <p className="text-xs text-muted-foreground animate-pulse">Waiting for host...</p>
            )}
            
          </div>
        </div>
      )}
    </>
  );
};
