import React from 'react';
import { TeamBattleOverlay } from '@/components/TeamBattleOverlay';
import { VoteKickOverlay } from '@/components/VoteKick';
import { LyricsSelector } from '@/components/LyricsSelector';

export interface RoomOverlaysProps {
  showTeamBattle: boolean;
  teamBattleProps: React.ComponentProps<typeof TeamBattleOverlay>;
  showVoteKick: boolean;
  voteKickProps: React.ComponentProps<typeof VoteKickOverlay>;
  showLyricsSelector: boolean;
  lyricsSelectorProps: React.ComponentProps<typeof LyricsSelector>;
}

export const RoomOverlays: React.FC<RoomOverlaysProps> = ({
  showTeamBattle,
  teamBattleProps,
  showVoteKick,
  voteKickProps,
  showLyricsSelector,
  lyricsSelectorProps,
}) => {
  return (
    <>
      {showTeamBattle && <TeamBattleOverlay {...teamBattleProps} />}
      {showVoteKick && <VoteKickOverlay {...voteKickProps} />}
      {showLyricsSelector && <LyricsSelector {...lyricsSelectorProps} />}
    </>
  );
};
