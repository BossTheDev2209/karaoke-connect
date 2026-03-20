import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AvatarPicker } from '@/components/AvatarPicker';
import { generateRoomCode, isValidRoomCode } from '@/lib/roomCode';
import { useUserSetup } from '@/hooks/useUserSetup';
import { Music, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const Index = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home');
  const [roomCode, setRoomCode] = useState('');

  const {
    nickname, setNickname,
    avatarId, setAvatarId,
    customAvatarNormal, customAvatarSpeaking,
    handleCustomAvatarsChange, saveUser,
  } = useUserSetup();

  const handleCreate = () => {
    if (!saveUser()) return;
    navigate(`/room/${generateRoomCode()}`);
  };

  const handleJoin = () => {
    if (!isValidRoomCode(roomCode)) {
      toast({ title: 'Invalid room code', variant: 'destructive' });
      return;
    }
    if (!saveUser()) return;
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
        
        <div className="flex flex-col gap-4 w-full max-w-md">
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <Button onClick={() => setMode('create')} className="btn-neon flex-1 h-16 text-lg">
              <Music className="w-5 h-5 mr-2" /> Create Room
            </Button>
            <Button onClick={() => setMode('join')} variant="outline" className="flex-1 h-16 text-lg neon-border">
              <Users className="w-5 h-5 mr-2" /> Join Room
            </Button>
          </div>
          
          <Button 
            onClick={() => {
              toast({ 
                title: "Logging in with Discord...",
                description: "This will link your profile in a future update."
              });
              setTimeout(() => {
                setNickname("DiscordUser");
                toast({ title: "Linked Discord Account!" });
                setMode('create');
              }, 1000);
            }} 
            className="w-full h-12 bg-[#5865F2] hover:bg-[#4752C4] text-white flex items-center justify-center gap-2 group transition-all"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0396-.1066c-.65-.2474-1.2651-.549-1.8543-.8953a.0762.0762 0 01-.0033-.1263c.1237-.0926.2474-.1889.3643-.2889a.0724.0724 0 01.0764-.0101c3.8776 1.7744 8.0826 1.7744 11.916 0a.0732.0732 0 01.0776.0102c.1182.1.2413.1963.3663.2889a.0766.0766 0 01-.0027.1263c-.588.3463-1.203.6479-1.8553.8953a.0766.0766 0 00-.0384.1066c.3533.699.7648 1.3638 1.226 1.9942a.077.077 0 00.0842.0276c1.9587-.6066 3.9472-1.5218 6.002-3.0294a.0777.0777 0 00.0322-.0561c.5033-5.2282-.8571-9.7214-3.5707-13.6603a.0664.0664 0 00-.0325-.0277zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9459 2.4189-2.1568 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
            </svg>
            Sign in with Discord
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
