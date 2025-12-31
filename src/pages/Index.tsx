import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AvatarPicker } from '@/components/AvatarPicker';
import { generateRoomCode, isValidRoomCode } from '@/lib/roomCode';
import { avatarConfigToId, generateRandomAvatar } from '@/data/avatars';
import { Music, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const Index = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home');
  const [nickname, setNickname] = useState('');
  const [avatarId, setAvatarId] = useState(() => avatarConfigToId(generateRandomAvatar()));
  const [roomCode, setRoomCode] = useState('');
  const [customAvatarNormal, setCustomAvatarNormal] = useState<string | undefined>();
  const [customAvatarSpeaking, setCustomAvatarSpeaking] = useState<string | undefined>();

  const handleCustomAvatarsChange = (normal: string | undefined, speaking: string | undefined) => {
    setCustomAvatarNormal(normal);
    setCustomAvatarSpeaking(speaking);
  };

  const handleCreate = () => {
    if (!nickname.trim()) {
      toast({ title: 'Enter a nickname', variant: 'destructive' });
      return;
    }
    const code = generateRoomCode();
    const userData = { 
      id: crypto.randomUUID(), 
      nickname: nickname.trim(), 
      avatarId, 
      customAvatarNormal,
      customAvatarSpeaking,
      isSpeaking: false 
    };
    sessionStorage.setItem('karaoke_user', JSON.stringify(userData));
    navigate(`/room/${code}`);
  };

  const handleJoin = () => {
    if (!nickname.trim()) {
      toast({ title: 'Enter a nickname', variant: 'destructive' });
      return;
    }
    if (!isValidRoomCode(roomCode)) {
      toast({ title: 'Invalid room code', variant: 'destructive' });
      return;
    }
    const userData = { 
      id: crypto.randomUUID(), 
      nickname: nickname.trim(), 
      avatarId, 
      customAvatarNormal,
      customAvatarSpeaking,
      isSpeaking: false 
    };
    sessionStorage.setItem('karaoke_user', JSON.stringify(userData));
    navigate(`/room/${roomCode.toUpperCase()}`);
  };

  if (mode === 'home') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center mb-12 animate-float">
          <div className="text-6xl mb-4">🎤</div>
          <h1 className="text-5xl font-bold text-gradient mb-2">Karaoke Party</h1>
          <p className="text-muted-foreground text-lg">Sing together, anywhere</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <Button onClick={() => setMode('create')} className="btn-neon flex-1 h-16 text-lg">
            <Music className="w-5 h-5 mr-2" /> Create Room
          </Button>
          <Button onClick={() => setMode('join')} variant="outline" className="flex-1 h-16 text-lg neon-border">
            <Users className="w-5 h-5 mr-2" /> Join Room
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="card-karaoke w-full max-w-md space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">
            {mode === 'create' ? 'Create a Room' : 'Join a Room'}
          </h2>
          <p className="text-muted-foreground text-sm">Customize your avatar and nickname</p>
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
          placeholder="Your nickname"
          maxLength={15}
          className="text-center text-lg h-12"
        />

        {mode === 'join' && (
          <Input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="Room code (e.g. ABCD)"
            maxLength={4}
            className="text-center text-2xl font-mono tracking-widest h-14"
          />
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setMode('home')} className="flex-1">
            Back
          </Button>
          <Button onClick={mode === 'create' ? handleCreate : handleJoin} className="btn-neon flex-1">
            {mode === 'create' ? 'Create' : 'Join'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
