import React from 'react';
import { User } from '@/types/karaoke';
import { UserAvatar } from './UserAvatar';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Volume2, VolumeX } from 'lucide-react';

interface UserAvatarRowProps {
  users: User[];
  currentUserId: string | null;
  wavingUsers?: Set<string>;
  userVolumes?: Record<string, number>;
  onVolumeChange?: (userId: string, volume: number) => void;
}

export const UserAvatarRow: React.FC<UserAvatarRowProps> = ({ 
  users, 
  currentUserId,
  wavingUsers = new Set(),
  userVolumes = {},
  onVolumeChange,
}) => {
  const sortedUsers = [...users].sort((a, b) => {
    if (a.id === currentUserId) return -1;
    if (b.id === currentUserId) return 1;
    return 0;
  });

  const renderUser = (user: User) => {
    const isWaving = wavingUsers.has(user.id);
    return (
      <div key={user.id} className="flex items-end gap-1 group relative">
        <div className={cn(
          'transition-transform duration-300',
          isWaving && 'animate-bounce-subtle'
        )}>
          <Popover>
            <PopoverTrigger asChild>
              <button className="outline-none focus:ring-2 focus:ring-primary rounded-full transition-transform active:scale-95">
                <UserAvatar user={user} size="lg" showName />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4 glass backdrop-blur-xl border-primary/20" side="top">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <Volume2 className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{user.nickname}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">User Volume</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-primary">
                    {Math.round((userVolumes[user.id] ?? 100))}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <VolumeX className="w-4 h-4 text-muted-foreground" />
                  <Slider
                    value={[userVolumes[user.id] ?? 100]}
                    max={200}
                    step={1}
                    onValueChange={([val]) => onVolumeChange?.(user.id, val)}
                    className="flex-1"
                  />
                  <Volume2 className="w-4 h-4 text-primary" />
                </div>
                <p className="text-[10px] text-center text-muted-foreground italic">
                  Volume changes are saved locally to your browser.
                </p>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    );
  };

  return (
    <div className="glass rounded-2xl p-6 bg-gradient-to-t from-background/80 to-transparent backdrop-blur-xl">
      <h3 className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-4">Singers</h3>
      <div className="flex items-end justify-center gap-8 flex-wrap">
        {sortedUsers.map(renderUser)}
        {users.length === 0 && (
          <p className="text-muted-foreground">No singers yet — invite friends!</p>
        )}
      </div>
    </div>
  );
};
