import React from 'react';
import { User } from '@/types/karaoke';
import { HumanAvatar } from './HumanAvatar';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  user: User;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  isMainSinger?: boolean;
  audioLevel?: number;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ 
  user, 
  size = 'md',
  showName = true,
  isMainSinger = false,
  audioLevel = 0
}) => {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-28 h-28',
  };

  // Use custom avatar if available
  const hasCustomAvatar = user.customAvatarNormal;
  const currentImage = user.isSpeaking && user.customAvatarSpeaking 
    ? user.customAvatarSpeaking 
    : user.customAvatarNormal;

  // Dynamic glow intensity based on audio level
  const glowIntensity = isMainSinger ? 0.5 + audioLevel * 0.5 : 0;

  return (
    <div className="flex flex-col items-center gap-1 relative">
      {/* Enhanced spotlight down effect */}
      {isMainSinger && (
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-56 h-56 pointer-events-none z-0">
          {/* Main spotlight cone */}
          <div 
            className="w-full h-full transition-opacity duration-300"
            style={{
              background: `conic-gradient(from 155deg at 50% 0%, transparent 0deg, rgba(255,255,255,${0.15 + audioLevel * 0.2}) 20deg, rgba(255,255,255,${0.08 + audioLevel * 0.1}) 35deg, transparent 50deg)`,
              filter: 'blur(3px)',
            }}
          />
          {/* Center beam */}
          <div 
            className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-40 transition-opacity duration-300"
            style={{
              background: `linear-gradient(to bottom, rgba(255,255,255,${0.3 + audioLevel * 0.2}), transparent)`,
              filter: 'blur(2px)',
            }}
          />
          {/* Animated rays */}
          <div 
            className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32"
            style={{
              background: `radial-gradient(ellipse at top, hsla(var(--primary) / ${0.3 + audioLevel * 0.3}), transparent 70%)`,
            }}
          />
        </div>
      )}

      {/* Ground glow for main singer */}
      {isMainSinger && (
        <div 
          className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-40 h-10 rounded-full pointer-events-none z-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(ellipse, hsla(var(--primary) / ${0.4 + audioLevel * 0.4}), transparent 70%)`,
            filter: 'blur(10px)',
          }}
        />
      )}

      {hasCustomAvatar ? (
        <div 
          className={cn(
            'relative rounded-full overflow-hidden border-2 transition-all duration-300',
            sizeClasses[size],
            user.isSpeaking && 'avatar-speaking',
            isMainSinger ? 'border-primary shadow-[0_0_20px_hsl(var(--primary)/0.5)]' : 'border-transparent'
          )}
        >
          <img 
            src={currentImage} 
            alt={user.nickname}
            className="w-full h-full object-cover"
          />
          {/* Speaking glow effect when no speaking image */}
          {user.isSpeaking && !user.customAvatarSpeaking && (
            <div className="absolute inset-0 bg-neon-green/20 animate-pulse" />
          )}
        </div>
      ) : (
        <div className={cn(
          "relative transition-all duration-300",
          isMainSinger && "main-singer-spotlight"
        )}
        style={{
          filter: isMainSinger ? `drop-shadow(0 0 ${15 + audioLevel * 20}px hsl(var(--primary) / ${glowIntensity}))` : 'none',
        }}
        >
          <HumanAvatar 
            avatarId={user.avatarId} 
            size={size} 
            isSpeaking={user.isSpeaking}
          />
        </div>
      )}
      {showName && (
        <span className={cn(
          'text-sm font-medium truncate max-w-24 px-2 py-0.5 rounded transition-all duration-300',
          user.isSpeaking ? 'text-neon-green' : 'text-foreground/80',
          isMainSinger && 'bg-primary/20 text-primary font-bold scale-110'
        )}>
          {user.nickname}
        </span>
      )}
    </div>
  );
};
