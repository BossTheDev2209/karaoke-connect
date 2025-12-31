import React from 'react';
import { User } from '@/types/karaoke';
import { HumanAvatar } from './HumanAvatar';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  user: User;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ 
  user, 
  size = 'md',
  showName = true 
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

  return (
    <div className="flex flex-col items-center gap-1">
      {hasCustomAvatar ? (
        <div 
          className={cn(
            'relative rounded-full overflow-hidden',
            sizeClasses[size],
            user.isSpeaking && 'avatar-speaking'
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
        <HumanAvatar 
          avatarId={user.avatarId} 
          size={size} 
          isSpeaking={user.isSpeaking}
        />
      )}
      {showName && (
        <span className={cn(
          'text-sm font-medium truncate max-w-24',
          user.isSpeaking ? 'text-neon-green' : 'text-foreground/80'
        )}>
          {user.nickname}
        </span>
      )}
    </div>
  );
};
