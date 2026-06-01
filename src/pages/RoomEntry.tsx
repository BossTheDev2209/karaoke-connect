import { useState } from 'react';
import { ArrowLeft, ArrowRight, Mic2 } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StageBackground } from '@/components/StageBackground';
import { toast } from '@/hooks/use-toast';
import { generateRoomCode, isValidRoomCode } from '@/lib/roomCode';
import { roomCodeFromSearch, roleFromSearch } from '@/lib/remoteJoin';

export type EntryMode = 'create' | 'join';

interface RoomEntryProps {
  mode: EntryMode;
}

const RoomEntry = ({ mode }: RoomEntryProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState(() => roomCodeFromSearch(location.search));

  const enterRoom = () => {
    if (!nickname.trim()) {
      toast({ title: 'Enter a nickname', variant: 'destructive' });
      return;
    }
    if (mode === 'join' && !isValidRoomCode(roomCode)) {
      toast({ title: 'Invalid room code', variant: 'destructive' });
      return;
    }

    sessionStorage.setItem('karaoke_user', JSON.stringify({
      id: crypto.randomUUID(),
      nickname: nickname.trim(),
      avatarId: '',
      isSpeaking: false,
    }));
    const remoteSearch = mode === 'join' && roleFromSearch(location.search) === 'remote' ? '?role=remote' : '';
    navigate(`/room/${mode === 'create' ? generateRoomCode() : roomCode.toUpperCase()}${remoteSearch}`);
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <StageBackground />
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-7 sm:px-10 sm:py-9">
        <header className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
            <Mic2 className="h-4 w-4 text-primary" />
            KodHard
          </Link>
          <Button asChild variant="ghost" size="sm" className="rounded-full text-muted-foreground">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        </header>

        <section className="flex flex-1 items-center py-16">
          <div className="w-full max-w-md">
            <p className="mb-3 text-sm font-medium text-primary">{mode === 'create' ? 'Start room' : 'Join room'}</p>
            <h1 className="text-5xl font-semibold tracking-[-0.07em] text-foreground sm:text-6xl">
              {mode === 'create' ? 'Set your name.' : 'Enter the room.'}
            </h1>
            <p className="mt-4 max-w-sm text-base leading-7 text-muted-foreground">
              {mode === 'create'
                ? 'Create a four-letter code, then share it with your singers.'
                : 'Use room code from shared stage screen.'}
            </p>

            <div className="mt-10 space-y-5">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">Nickname</span>
                <Input
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && enterRoom()}
                  placeholder="Your nickname"
                  maxLength={15}
                  autoFocus
                  className="h-12 rounded-xl border-border bg-[hsl(var(--surface))] px-4 text-base"
                />
              </label>

              {mode === 'join' && (
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-foreground">Room code</span>
                  <Input
                    value={roomCode}
                    onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                    onKeyDown={(event) => event.key === 'Enter' && enterRoom()}
                    placeholder="ABCD"
                    maxLength={4}
                    className="h-16 rounded-xl border-border bg-[hsl(var(--surface))] px-4 text-center font-mono text-2xl font-bold uppercase tracking-[0.32em]"
                  />
                </label>
              )}
            </div>

            <Button onClick={enterRoom} size="lg" className="mt-8 h-12 rounded-full px-6 text-base">
              {mode === 'create' ? 'Create Room' : 'Join Room'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default RoomEntry;
