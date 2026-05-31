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
    <div className="flex items-center gap-2">
      <span className="hidden text-xs uppercase tracking-wider text-muted-foreground sm:inline">Room</span>
      <span className="font-mono text-lg font-bold tracking-widest text-primary sm:text-xl">
        {code}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        className="h-11 w-11"
        aria-label="Copy room code"
      >
        {copied ? (
          <Check className="w-4 h-4 text-[hsl(var(--success))]" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
};
