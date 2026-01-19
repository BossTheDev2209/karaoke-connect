import React from 'react';
import { BattleFormat } from '@/types/karaoke';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Users, Swords, Zap } from 'lucide-react';

interface BattleFormatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFormat: (format: BattleFormat | 'all-out') => void;
  usersCount: number;
}

const formats: Array<{ format: BattleFormat | 'all-out'; label: string; description: string; icon: React.ReactNode; minUsers: number }> = [
  { format: '1v1', label: '1v1', description: 'Solo duel - one singer per team', icon: <Swords className="w-5 h-5" />, minUsers: 2 },
  { format: '2v2', label: '2v2', description: 'Duet battle - two per team', icon: <Users className="w-5 h-5" />, minUsers: 4 },
  { format: '3v3', label: '3v3', description: 'Trio showdown - three per team', icon: <Users className="w-5 h-5" />, minUsers: 6 },
  { format: 'all-out', label: 'All-out War', description: 'Everyone joins - split evenly', icon: <Zap className="w-5 h-5" />, minUsers: 2 },
];

export const BattleFormatModal: React.FC<BattleFormatModalProps> = ({
  isOpen,
  onClose,
  onSelectFormat,
  usersCount,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-primary" />
            Select Battle Format
          </DialogTitle>
          <DialogDescription>
            Choose how teams will be organized ({usersCount} singers in room)
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-3 py-4">
          {formats.map(({ format, label, description, icon, minUsers }) => {
            const isDisabled = usersCount < minUsers && format !== 'all-out';
            return (
              <Button
                key={format}
                variant="outline"
                className="h-auto p-4 flex items-start gap-4 justify-start text-left hover:bg-primary/10 hover:border-primary/50 transition-all disabled:opacity-50"
                disabled={isDisabled}
                onClick={() => {
                  onSelectFormat(format);
                  onClose();
                }}
              >
                <div className="shrink-0 w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                  {icon}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-foreground">{label}</div>
                  <div className="text-sm text-muted-foreground">{description}</div>
                  {isDisabled && (
                    <div className="text-xs text-destructive mt-1">
                      Requires at least {minUsers} singers
                    </div>
                  )}
                </div>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
