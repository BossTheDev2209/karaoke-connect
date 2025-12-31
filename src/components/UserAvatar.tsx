import React from 'react';
import { cn } from '@/lib/utils';
import { getAvatar } from '@/data/avatars';
import { User } from '@/types/karaoke';

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
  const avatar = getAvatar(user.avatarId);
  
  const sizeClasses = {
    sm: 'w-12 h-12 text-xl',
    md: 'w-20 h-20 text-4xl',
    lg: 'w-28 h-28 text-5xl',
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          'rounded-full flex items-center justify-center bg-gradient-to-br transition-all duration-300',
          avatar.color,
          sizeClasses[size],
          user.isSpeaking && 'avatar-speaking ring-2 ring-neon-green'
        )}
      >
        <span role="img" aria-label={avatar.name}>
          {avatar.emoji}
        </span>
      </div>
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
