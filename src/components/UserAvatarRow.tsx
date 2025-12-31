import React from 'react';
import { User } from '@/types/karaoke';
import { UserAvatar } from './UserAvatar';
import { LightStick, LIGHTSTICK_COLORS } from './effects/LightStick';
import { cn } from '@/lib/utils';

interface UserAvatarRowProps {
  users: User[];
  currentUserId: string | null;
  wavingUsers?: Set<string>;
  audioIntensity?: number;
}

export const UserAvatarRow: React.FC<UserAvatarRowProps> = ({ 
  users, 
  currentUserId,
  wavingUsers = new Set(),
  audioIntensity = 0,
}) => {
  // Sort to put current user first
  const sortedUsers = [...users].sort((a, b) => {
    if (a.id === currentUserId) return -1;
    if (b.id === currentUserId) return 1;
    return 0;
  });

  // Assign consistent colors to users based on their index
  const getUserColor = (userId: string) => {
    const index = users.findIndex(u => u.id === userId);
    return LIGHTSTICK_COLORS[index % LIGHTSTICK_COLORS.length];
  };

  return (
    <div className="glass rounded-2xl p-6 bg-gradient-to-t from-background/80 to-transparent backdrop-blur-xl">
      <h3 className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-4">Singers</h3>
      <div className="flex items-end justify-center gap-8 flex-wrap">
        {sortedUsers.map((user) => {
          const isWaving = wavingUsers.has(user.id);
          const color = getUserColor(user.id);
          
          return (
            <div key={user.id} className="flex items-end gap-1">
              {/* Light stick on left side */}
              {isWaving && (
                <div className="relative -mr-2 z-10">
                  <LightStick
                    color={color}
                    isWaving={true}
                    intensity={audioIntensity}
                    size="sm"
                    className="transform -rotate-12"
                  />
                </div>
              )}
              
              <div className={cn(
                'transition-transform duration-300',
                isWaving && 'animate-bounce-subtle'
              )}>
                <UserAvatar
                  user={user}
                  size="lg"
                  showName
                />
              </div>
            </div>
          );
        })}
        {users.length === 0 && (
          <p className="text-muted-foreground">No singers yet — invite friends!</p>
        )}
      </div>
    </div>
  );
};