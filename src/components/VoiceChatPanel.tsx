import React from 'react';
import { Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { User } from '@/types/karaoke';

interface VoiceChatUser {
  odels: string;
  volume: number;
  isMuted: boolean;
}

interface VoiceChatPanelProps {
  isEnabled: boolean;
  isMicMuted: boolean;
  remoteUsers: Record<string, VoiceChatUser>;
  users: User[];
  onToggleVoiceChat: () => void;
  onToggleMicMute: () => void;
  onSetUserVolume: (userId: string, volume: number) => void;
  onSetUserMuted: (userId: string, muted: boolean) => void;
  error: string | null;
}

export const VoiceChatPanel: React.FC<VoiceChatPanelProps> = ({
  isEnabled,
  isMicMuted,
  remoteUsers,
  users,
  onToggleVoiceChat,
  onToggleMicMute,
  onSetUserVolume,
  onSetUserMuted,
  error,
}) => {
  const connectedCount = Object.keys(remoteUsers).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={isEnabled ? 'default' : 'outline'}
          size="sm"
          className={cn(
            'gap-1.5 relative',
            isEnabled && 'bg-primary text-primary-foreground'
          )}
        >
          {isEnabled ? (
            <Phone className="w-4 h-4" />
          ) : (
            <PhoneOff className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">Voice</span>
          {isEnabled && connectedCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-neon-green text-[10px] font-bold flex items-center justify-center text-background">
              {connectedCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Voice Chat</h4>
            <Button
              variant={isEnabled ? 'destructive' : 'default'}
              size="sm"
              onClick={onToggleVoiceChat}
            >
              {isEnabled ? (
                <>
                  <PhoneOff className="w-3 h-3 mr-1" />
                  Leave
                </>
              ) : (
                <>
                  <Phone className="w-3 h-3 mr-1" />
                  Join
                </>
              )}
            </Button>
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          {isEnabled && (
            <>
              {/* Own mic control */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <span className="text-sm font-medium">Your Mic</span>
                <Button
                  variant={isMicMuted ? 'destructive' : 'secondary'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={onToggleMicMute}
                >
                  {isMicMuted ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {/* Remote users */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  {connectedCount > 0 ? 'Connected Users' : 'Waiting for others to join...'}
                </p>
                
                {Object.entries(remoteUsers).map(([odels, userState]) => {
                  const userData = users.find(u => u.id === odels);
                  const name = userData?.nickname || odels.slice(0, 8);
                  
                  return (
                    <div
                      key={odels}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/30"
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => onSetUserMuted(odels, !userState.isMuted)}
                      >
                        {userState.isMuted ? (
                          <VolumeX className="w-3.5 h-3.5 text-destructive" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </Button>
                      <span className="text-sm truncate flex-1">{name}</span>
                      <Slider
                        value={[userState.volume]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={([v]) => onSetUserVolume(odels, v)}
                        className="w-20"
                        disabled={userState.isMuted}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {!isEnabled && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Join voice chat to talk with others in the room
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
