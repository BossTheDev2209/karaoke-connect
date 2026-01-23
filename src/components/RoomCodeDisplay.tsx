import React from 'react';
import { Copy, Check, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface RoomCodeDisplayProps {
  code: string;
}

export const RoomCodeDisplay: React.FC<RoomCodeDisplayProps> = ({ code }) => {
  const [copied, setCopied] = useState(false);
  
  // Generate the join URL for the QR code
  const joinUrl = `${window.location.origin}/room/${code}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast({
      title: 'Room code copied!',
      description: 'Share this code with your friends.',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(joinUrl);
    toast({
      title: 'Join link copied!',
      description: 'Share this link to let others join directly.',
    });
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
      
      {/* QR Code Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Show QR Code"
          >
            <QrCode className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="start">
          <div className="flex flex-col items-center gap-3">
            <h4 className="font-semibold text-sm">Scan to Join</h4>
            <div className="bg-white p-3 rounded-lg">
              <QRCodeSVG 
                value={joinUrl} 
                size={160}
                level="M"
                includeMargin={false}
              />
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-2">
                Or share the link:
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="text-xs"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy Link
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
