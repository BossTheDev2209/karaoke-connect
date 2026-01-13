import React from 'react';
import { User } from '@/types/karaoke';
import { HumanAvatar } from './HumanAvatar';
import { cn } from '@/lib/utils';
import { Mic, MicOff } from 'lucide-react';

interface UserAvatarProps {
  user: User;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  isMainSinger?: boolean;
  audioLevel?: number;
  isExtraLoud?: boolean;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ 
  user, 
  size = 'md',
  showName = true,
  isMainSinger = false,
  audioLevel = 0,
  isExtraLoud = false
}) => {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-28 h-28',
  };

  // Mic indicator sizes based on avatar size
  const micIndicatorSize = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  // Use custom avatar if available
  const hasCustomAvatar = user.customAvatarNormal;
  const currentImage = user.isSpeaking && user.customAvatarSpeaking 
    ? user.customAvatarSpeaking 
    : user.customAvatarNormal;

  return (
    <div className="flex flex-col items-center gap-1 relative">
      {/* Mic status indicator */}
      {user.isMicEnabled !== undefined && (
        <div className={cn(
          "absolute -top-1 -right-1 z-20 rounded-full p-1 shadow-lg border transition-all duration-300",
          user.isMicEnabled 
            ? "bg-neon-green/20 border-neon-green/50 text-neon-green" 
            : "bg-muted/80 border-border text-muted-foreground"
        )}>
          {user.isMicEnabled ? (
            <Mic className={cn(micIndicatorSize[size], user.isSpeaking && "animate-pulse")} />
          ) : (
            <MicOff className={micIndicatorSize[size]} />
          )}
        </div>
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
        <div className="relative">
          <HumanAvatar 
            avatarId={user.avatarId} 
            size={size} 
            isSpeaking={user.isSpeaking}
          />
        </div>
      )}
      {showName && (
        <span className={cn(
          'text-sm font-medium truncate max-w-24 px-2 py-0.5 rounded',
          user.isSpeaking ? 'text-neon-green' : 'text-foreground/80',
          isMainSinger && 'bg-primary/20 text-primary font-bold'
        )}>
          {user.nickname}
        </span>
      )}
    </div>
  );
};
