import React from 'react';
import { User } from '@/types/karaoke';
import { UserAvatar } from './UserAvatar';

interface UserAvatarRowProps {
  users: User[];
  currentUserId: string | null;
}

export const UserAvatarRow: React.FC<UserAvatarRowProps> = ({ users, currentUserId }) => {
  // Sort to put current user first
  const sortedUsers = [...users].sort((a, b) => {
    if (a.id === currentUserId) return -1;
    if (b.id === currentUserId) return 1;
    return 0;
  });

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-center gap-4 flex-wrap">
        {sortedUsers.map((user) => (
          <UserAvatar
            key={user.id}
            user={user}
            size="md"
            showName
          />
        ))}
        {users.length === 0 && (
          <p className="text-muted-foreground text-sm">No users in room</p>
        )}
      </div>
    </div>
  );
};
