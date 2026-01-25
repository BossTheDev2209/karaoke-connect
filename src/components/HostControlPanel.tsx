import React, { useState } from 'react';
import { 
  X, Crown, Users, Music, Zap, 
  AlertTriangle, Mic, LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import { User } from '@/types/karaoke';

interface HostControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // Sync
  networkLatency: number;
  onForceSync: () => void;
  // Users
  users: User[];
  onKickUser: (userId: string) => void;
  onForceMuteUser: (userId: string) => void;
  onToggleControlAccess: (userId: string) => void;
  // Current user
  currentUserId: string;
}

type SectionType = 'sync' | 'users';

const navItems: { id: SectionType; label: string; icon: React.ElementType }[] = [
  { id: 'sync', label: 'Sync', icon: Zap },
  { id: 'users', label: 'Users', icon: Users },
];

export const HostControlPanel: React.FC<HostControlPanelProps> = ({
  isOpen,
  onClose,
  networkLatency,
  onForceSync,
  users,
  currentUserId,
  onKickUser,
  onForceMuteUser,
  onToggleControlAccess,
}) => {
  const [activeSection, setActiveSection] = useState<SectionType>('sync');

  if (!isOpen) return null;

  const renderSyncSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Synchronization</h3>
        <p className="text-sm text-muted-foreground">Force sync all connected users</p>
      </div>

      {/* Latency Display */}
      <div className="p-4 rounded-xl bg-muted/30 border border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Network Latency</span>
          <Badge variant={networkLatency < 50 ? 'default' : networkLatency < 100 ? 'secondary' : 'destructive'}>
            {networkLatency}ms
          </Badge>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full transition-all",
              networkLatency < 50 ? "bg-emerald-500" : networkLatency < 100 ? "bg-amber-500" : "bg-destructive"
            )}
            style={{ width: `${Math.min(100, (networkLatency / 200) * 100)}%` }}
          />
        </div>
      </div>

      {/* Force Sync Action - Host Only */}
      <Button variant="destructive" className="w-full gap-2 h-12" onClick={onForceSync}>
        <AlertTriangle className="w-4 h-4" />
        Emergency Resync
        <span className="text-xs opacity-70">(Forces all users)</span>
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Use Emergency Resync if users are experiencing significant playback drift.
      </p>
    </div>
  );

  const renderUsersSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Connected Users</h3>
        <p className="text-sm text-muted-foreground">{users.length} user{users.length !== 1 ? 's' : ''} online</p>
      </div>

      <ScrollArea className="h-[300px]">
        <div className="space-y-2 pr-4">
          {users.map(user => (
            <div
              key={user.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
            >
              <div className={cn(
                "w-3 h-3 rounded-full shrink-0 transition-all",
                user.isSpeaking 
                  ? "bg-primary shadow-[0_0_10px_hsl(var(--primary))] animate-pulse" 
                  : user.isMicEnabled 
                    ? "bg-amber-500" 
                    : "bg-muted"
              )} />
              <span className="flex-1 truncate flex items-center gap-2">
                {user.nickname}
                {user.hasControlAccess && (
                  <Badge variant="outline" className="text-[10px] px-1 h-4 border-amber-500/50 text-amber-500">
                    DJ
                  </Badge>
                )}
              </span>
              
              <div className="flex items-center gap-1">
                {/* Control Access Toggle */}
                {user.id !== currentUserId && (
                  <Button
                      variant={user.hasControlAccess ? "default" : "ghost"}
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => onToggleControlAccess(user.id)}
                      title={user.hasControlAccess ? "Revoke Control Access" : "Grant Control Access"}
                  >
                      <Music className={cn("w-4 h-4", user.hasControlAccess && "text-primary-foreground")} />
                  </Button>
                )}

                {/* Force Mute */}
                {user.id !== currentUserId && (
                  <Button
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onForceMuteUser(user.id)}
                      disabled={!user.isMicEnabled}
                      title="Force Mute"
                  >
                      <Mic className={cn("w-4 h-4", !user.isMicEnabled && "opacity-30")} />
                  </Button>
                )}

                {/* Kick */}
                {user.id !== currentUserId && (
                  <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => onKickUser(user.id)}
                      title="Kick User"
                  >
                      <LogOut className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {user.audioLevel !== undefined && user.audioLevel > 0 && (
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
                  <div 
                    className="h-full bg-primary transition-all duration-75"
                    style={{ width: `${Math.min(100, user.audioLevel * 100)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'sync': return renderSyncSection();
      case 'users': return renderUsersSection();
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-3xl mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Crown className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Host Controls</h2>
              <p className="text-xs text-muted-foreground">Manage your karaoke session</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex min-h-[350px]">
          {/* Sidebar Navigation */}
          <nav className="w-48 shrink-0 border-r border-border p-3 space-y-1 bg-muted/20">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  activeSection === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </nav>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};
