import React, { useState, useEffect, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';
import { Lock, Unlock } from 'lucide-react';

interface SyncLockOverlayProps {
  channel: RealtimeChannel | null;
  isHost: boolean;
  currentUserId: string;
  onSyncStart: () => void;
  onCountdownComplete: () => void;
}

interface SyncLockPayload {
  type: 'sync_lock_start' | 'sync_lock_countdown' | 'sync_lock_go';
  payload: {
    initiatorId: string;
    countdown?: number;
    targetTime?: number;
  };
}

export const SyncLockOverlay: React.FC<SyncLockOverlayProps> = ({
  channel,
  isHost,
  currentUserId,
  onSyncStart,
  onCountdownComplete,
}) => {
  const [isActive, setIsActive] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showGo, setShowGo] = useState(false);

  // Listen for sync lock events
  useEffect(() => {
    if (!channel) return;

    const handleSyncLock = ({ payload }: { payload: SyncLockPayload }) => {
      switch (payload.type) {
        case 'sync_lock_start':
          setIsActive(true);
          setCountdown(null);
          setShowGo(false);
          break;
        case 'sync_lock_countdown':
          setCountdown(payload.payload.countdown ?? null);
          break;
        case 'sync_lock_go':
          setShowGo(true);
          setCountdown(null);
          // Trigger playback sync
          setTimeout(() => {
            onCountdownComplete();
            // Hide overlay after brief "GO!" display
            setTimeout(() => {
              setIsActive(false);
              setShowGo(false);
            }, 500);
          }, 100);
          break;
      }
    };

    // Subscribe to sync_lock events - the subscription is managed by the channel lifecycle
    channel.on('broadcast', { event: 'sync_lock' }, handleSyncLock);

    // No cleanup needed as the channel subscription handles this
  }, [channel, onCountdownComplete]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md">
      <div className="flex flex-col items-center gap-6">
        {/* Lock icon animation */}
        <div className={cn(
          "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300",
          countdown !== null || showGo
            ? "bg-primary/20 border-4 border-primary animate-pulse"
            : "bg-muted border-4 border-border"
        )}>
          {showGo ? (
            <Unlock className="w-12 h-12 text-primary" />
          ) : (
            <Lock className={cn(
              "w-12 h-12 transition-colors",
              countdown !== null ? "text-primary" : "text-muted-foreground"
            )} />
          )}
        </div>

        {/* Status text */}
        {!countdown && !showGo && (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">Sync Lock Activated</h2>
            <p className="text-muted-foreground">Preparing to synchronize all users...</p>
          </div>
        )}

        {/* Countdown display */}
        {countdown !== null && (
          <div className="text-center">
            <div 
              key={countdown}
              className="text-[120px] font-black text-primary leading-none animate-bounce"
              style={{
                textShadow: '0 0 40px hsl(var(--primary) / 0.5)',
              }}
            >
              {countdown}
            </div>
            <p className="text-xl text-muted-foreground mt-4">Get ready!</p>
          </div>
        )}

        {/* GO! display */}
        {showGo && (
          <div className="text-center">
            <div 
              className="text-[120px] font-black text-primary leading-none animate-pulse"
              style={{
                textShadow: '0 0 60px hsl(var(--primary) / 0.8)',
              }}
            >
              GO!
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Hook to manage sync lock state and broadcasting
export const useSyncLock = (
  channel: RealtimeChannel | null,
  isHost: boolean,
  currentUserId: string
) => {
  const [isSyncLockActive, setIsSyncLockActive] = useState(false);

  const startSyncLock = useCallback(async () => {
    if (!channel || !isHost) return;

    // Broadcast start
    channel.send({
      type: 'broadcast',
      event: 'sync_lock',
      payload: {
        type: 'sync_lock_start',
        payload: { initiatorId: currentUserId },
      },
    });

    setIsSyncLockActive(true);

    // Wait a moment for everyone to see the "preparing" message
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Countdown 3, 2, 1
    for (let i = 3; i >= 1; i--) {
      channel.send({
        type: 'broadcast',
        event: 'sync_lock',
        payload: {
          type: 'sync_lock_countdown',
          payload: { initiatorId: currentUserId, countdown: i },
        },
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // GO!
    channel.send({
      type: 'broadcast',
      event: 'sync_lock',
      payload: {
        type: 'sync_lock_go',
        payload: { 
          initiatorId: currentUserId,
          targetTime: Date.now() + 100, // Small buffer for network
        },
      },
    });

    // Reset state after animation completes
    setTimeout(() => {
      setIsSyncLockActive(false);
    }, 1000);
  }, [channel, currentUserId]);

  return {
    isSyncLockActive,
    startSyncLock,
  };
};
