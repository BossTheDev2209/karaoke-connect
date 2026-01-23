import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AvatarPicker } from '@/components/AvatarPicker';
import { avatarConfigToId, generateRandomAvatar } from '@/data/avatars';
import { toast } from '@/hooks/use-toast';
import { ArrowRight } from 'lucide-react';

/**
 * Quick Join page - shown when user opens a room link directly
 * without having set up their profile first (e.g., from QR code scan)
 */
const JoinRoom = () => {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  
  const [nickname, setNickname] = useState('');
  const [avatarId, setAvatarId] = useState(() => avatarConfigToId(generateRandomAvatar()));
  const [customAvatarNormal, setCustomAvatarNormal] = useState<string | undefined>();
  const [customAvatarSpeaking, setCustomAvatarSpeaking] = useState<string | undefined>();
  const [isJoining, setIsJoining] = useState(false);

  const handleCustomAvatarsChange = (normal: string | undefined, speaking: string | undefined) => {
    setCustomAvatarNormal(normal);
    setCustomAvatarSpeaking(speaking);
  };

  const handleJoin = () => {
    if (!nickname.trim()) {
      toast({ title: 'Enter a nickname', variant: 'destructive' });
      return;
    }
    
    if (!code) {
      toast({ title: 'Invalid room code', variant: 'destructive' });
      return;
    }

    setIsJoining(true);
    
    // Save user data
    const userData = { 
      id: crypto.randomUUID(), 
      nickname: nickname.trim(), 
      avatarId, 
      customAvatarNormal,
      customAvatarSpeaking,
      isSpeaking: false 
    };
    sessionStorage.setItem('karaoke_user', JSON.stringify(userData));
    
    // Navigate to the room
    navigate(`/room/${code.toUpperCase()}`);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJoin();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="card-karaoke w-full max-w-md space-y-6">
        {/* Header */}
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

        {/* Avatar Picker */}
        <AvatarPicker 
          selectedId={avatarId} 
          onSelect={setAvatarId}
          customAvatarNormal={customAvatarNormal}
          customAvatarSpeaking={customAvatarSpeaking}
          onCustomAvatarsChange={handleCustomAvatarsChange}
        />

        {/* Nickname Input */}
        <Input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter your nickname"
          maxLength={15}
          className="text-center text-lg h-12"
          autoFocus
        />

        {/* Join Button */}
        <Button 
          onClick={handleJoin} 
          className="btn-neon w-full h-14 text-lg"
          disabled={isJoining}
        >
          {isJoining ? (
            'Joining...'
          ) : (
            <>
              Join the Party
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>

        {/* Back to Home */}
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
