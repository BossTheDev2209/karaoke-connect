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
  return (
    <div className="flex flex-col items-center gap-1">
      <HumanAvatar 
        avatarId={user.avatarId} 
        size={size} 
        isSpeaking={user.isSpeaking}
      />
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
