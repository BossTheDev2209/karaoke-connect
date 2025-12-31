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
    sm: 'w-10 h-10 text-lg',
    md: 'w-14 h-14 text-2xl',
    lg: 'w-20 h-20 text-4xl',
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
          'text-xs text-muted-foreground truncate max-w-16',
          user.isSpeaking && 'text-neon-green font-medium'
        )}>
          {user.nickname}
        </span>
      )}
    </div>
  );
};
