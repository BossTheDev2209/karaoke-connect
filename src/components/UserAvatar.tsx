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
  showName = true,
}) => {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-28 h-28',
  };

  const hasCustomAvatar = user.customAvatarNormal;
  const currentImage = user.customAvatarNormal;

  return (
    <div className="flex flex-col items-center gap-1 relative">
      {hasCustomAvatar ? (
        <div className={cn(
          'relative rounded-full overflow-hidden border-2 border-transparent transition-all duration-300',
          sizeClasses[size]
        )}>
          <img 
            src={currentImage} 
            alt={user.nickname}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="relative">
          <HumanAvatar avatarId={user.avatarId} size={size} />
        </div>
      )}
      {showName && (
        <span className="text-sm font-medium truncate max-w-24 px-2 py-0.5 rounded text-foreground/80">
          {user.nickname}
        </span>
      )}
    </div>
  );
};
