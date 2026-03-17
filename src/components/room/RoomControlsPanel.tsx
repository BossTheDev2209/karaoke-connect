import React from 'react';
import { RemoteControl } from '@/components/RemoteControl';
import { ReactionBar } from '@/components/Reactions';

export interface RoomControlsPanelProps {
  remoteControlProps: React.ComponentProps<typeof RemoteControl>;
  reactionBarProps: {
    onReact: (emoji: string) => void;
    isWaving: boolean;
    onWaveToggle: () => void;
  };
}

export const RoomControlsPanel: React.FC<RoomControlsPanelProps> = ({
  remoteControlProps,
  reactionBarProps,
}) => {
  return (
    <div className="lg:col-span-3 flex flex-col order-2 lg:order-3 h-full">
      <RemoteControl {...remoteControlProps} />
      <div className="mt-auto pt-4">
        <ReactionBar
          onReact={reactionBarProps.onReact}
          isWaving={reactionBarProps.isWaving}
          onWaveToggle={reactionBarProps.onWaveToggle}
        />
      </div>
    </div>
  );
};
