import React from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

interface RoomCodeDisplayProps {
  code: string;
}

export const RoomCodeDisplay: React.FC<RoomCodeDisplayProps> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast({
      title: 'Room code copied!',
      description: 'Share this code with your friends.',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 glass rounded-xl px-4 py-2">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">Room</span>
      <span className="font-mono text-xl font-bold text-neon-purple tracking-widest">
        {code}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        className="h-8 w-8"
      >
        {copied ? (
          <Check className="w-4 h-4 text-neon-green" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
};
