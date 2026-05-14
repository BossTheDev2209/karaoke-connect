import React from 'react';
import { User } from '@/types/karaoke';
import { UserAvatar } from './UserAvatar';

interface UserAvatarRowProps {
  users: User[];
  currentUserId: string | null;
}

export const UserAvatarRow: React.FC<UserAvatarRowProps> = ({
  users,
  currentUserId,
}) => {
  const sortedUsers = [...users].sort((a, b) => {
    if (a.id === currentUserId) return -1;
    if (b.id === currentUserId) return 1;
    return 0;
  });

  if (users.length === 0) return null;

  return (
    <div className="glass rounded-2xl p-6 bg-gradient-to-t from-background/80 to-transparent backdrop-blur-xl">
      <h3 className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-4">Singers</h3>
      <div className="flex items-end justify-center gap-8 flex-wrap">
        {sortedUsers.map((user) => (
          <UserAvatar key={user.id} user={user} size="lg" showName />
        ))}
      </div>
    </div>
  );
};
