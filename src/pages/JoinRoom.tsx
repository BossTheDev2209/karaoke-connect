import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AvatarPicker } from '@/components/AvatarPicker';
import { useUserSetup } from '@/hooks/useUserSetup';
import { toast } from '@/hooks/use-toast';
import { ArrowRight } from 'lucide-react';

const JoinRoom = () => {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const [isJoining, setIsJoining] = useState(false);

  const {
    nickname, setNickname,
    avatarId, setAvatarId,
    customAvatarNormal, customAvatarSpeaking,
    handleCustomAvatarsChange, saveUser,
  } = useUserSetup();

  const handleJoin = () => {
    if (!code) {
      toast({ title: 'Invalid room code', variant: 'destructive' });
      return;
    }
    if (!saveUser()) return;
    setIsJoining(true);
    navigate(`/room/${code.toUpperCase()}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="card-karaoke w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-3">🎤</div>
          <h2 className="text-2xl font-bold mb-2">Join Karaoke Party</h2>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <span className="text-sm">Room Code:</span>
            <span className="font-mono text-lg font-bold text-neon-purple tracking-widest">
              {code?.toUpperCase()}
            </span>
          </div>
        </div>

        <AvatarPicker 
          selectedId={avatarId} 
          onSelect={setAvatarId}
          customAvatarNormal={customAvatarNormal}
          customAvatarSpeaking={customAvatarSpeaking}
          onCustomAvatarsChange={handleCustomAvatarsChange}
        />

        <Input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
          placeholder="Enter your nickname"
          maxLength={15}
          className="text-center text-lg h-12"
          autoFocus
        />

        <Button 
          onClick={handleJoin} 
          className="btn-neon w-full h-14 text-lg"
          disabled={isJoining}
        >
          {isJoining ? 'Joining...' : (
            <>Join the Party <ArrowRight className="w-5 h-5 ml-2" /></>
          )}
        </Button>

        <Button 
          variant="ghost" 
          onClick={() => navigate('/')} 
          className="w-full text-muted-foreground"
        >
          ← Back to Home
        </Button>
      </div>
    </div>
  );
};

export default JoinRoom;
