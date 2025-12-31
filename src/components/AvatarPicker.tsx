import React from 'react';
import { AVATARS } from '@/data/avatars';
import { cn } from '@/lib/utils';

interface AvatarPickerProps {
  selectedId: number;
  onSelect: (id: number) => void;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({ selectedId, onSelect }) => {
  return (
    <div className="grid grid-cols-4 gap-3">
      {AVATARS.map((avatar) => (
        <button
          key={avatar.id}
          onClick={() => onSelect(avatar.id)}
          className={cn(
            'w-14 h-14 rounded-full flex items-center justify-center text-2xl bg-gradient-to-br transition-all duration-200',
            avatar.color,
            selectedId === avatar.id 
              ? 'ring-2 ring-neon-purple ring-offset-2 ring-offset-background scale-110' 
              : 'hover:scale-105 opacity-70 hover:opacity-100'
          )}
        >
          {avatar.emoji}
        </button>
      ))}
    </div>
  );
};
