import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mic, Music, Users } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { StageBackground } from '@/components/StageBackground';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { generateRoomCode, isValidRoomCode } from '@/lib/roomCode';

const Index = () => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home');
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');

  const handleCreate = () => {
    if (!nickname.trim()) {
      toast({ title: 'Enter a nickname', variant: 'destructive' });
      return;
    }
    const code = generateRoomCode();
    const userData = {
      id: crypto.randomUUID(),
      nickname: nickname.trim(),
      avatarId: '',
      isSpeaking: false,
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
      avatarId: '',
      isSpeaking: false,
    };
    sessionStorage.setItem('karaoke_user', JSON.stringify(userData));
    navigate(`/room/${roomCode.toUpperCase()}`);
  };

  const entrance = {
    initial: reduceMotion ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduceMotion ? 0 : 0.26, ease: 'easeOut' as const },
  };

  if (mode === 'home') {
    return (
      <div className="relative isolate min-h-screen overflow-hidden">
        <StageBackground />
        <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-10 px-4 py-12 sm:px-6">
          <motion.header {...entrance} className="max-w-3xl text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-primary/50 bg-primary/10 text-primary">
              <Mic className="h-7 w-7" strokeWidth={1.8} />
            </div>
            <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.34em] text-primary">
              KodHard presents
            </p>
            <h1 className="font-display text-[clamp(2.5rem,7vw,5rem)] font-bold leading-[0.95] tracking-[-0.03em] text-foreground">
              Karaoke
              <span className="block text-primary">Party</span>
            </h1>
            <p className="mx-auto mt-5 max-w-md text-base text-muted-foreground sm:text-lg">
              One room. One screen. Sing together, anywhere.
            </p>
          </motion.header>

          <motion.section
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.26, delay: reduceMotion ? 0 : 0.06, ease: 'easeOut' }}
            className="grid w-full max-w-3xl gap-4 md:grid-cols-2"
            aria-label="Room actions"
          >
            <div className="flex flex-col gap-6 rounded-[var(--radius)] border border-[hsl(var(--border)/0.6)] bg-[hsl(var(--surface)/0.6)] p-6 backdrop-blur-xl sm:p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Music className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-2xl">Start stage</h2>
                <p className="text-sm text-muted-foreground">
                  Open a room and put the shared screen in control.
                </p>
              </div>
              <Button onClick={() => setMode('create')} className="mt-auto h-12 w-full text-base">
                Create Room
              </Button>
            </div>

            <div className="flex flex-col gap-6 rounded-[var(--radius)] border border-[hsl(var(--border)/0.6)] bg-[hsl(var(--surface)/0.6)] p-6 backdrop-blur-xl sm:p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/40 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-2xl">Join chorus</h2>
                <p className="text-sm text-muted-foreground">
                  Enter a four-letter room code and sing along.
                </p>
              </div>
              <Button onClick={() => setMode('join')} variant="outline" className="mt-auto h-12 w-full text-base">
                Join Room
              </Button>
            </div>
          </motion.section>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.24, delay: reduceMotion ? 0 : 0.12, ease: 'easeOut' }}
            className="w-full max-w-3xl"
          >
            <Button
              onClick={() => {
                toast({
                  title: 'Logging in with Discord...',
                  description: 'This will link your profile in a future update.',
                });
                // Mock auth
                setTimeout(() => {
                  setNickname('DiscordUser');
                  toast({ title: 'Linked Discord Account!' });
                  setMode('create');
                }, 1000);
              }}
              className="h-12 w-full bg-[#5865F2] text-white hover:bg-[#4752C4]"
            >
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0396-.1066c-.65-.2474-1.2651-.549-1.8543-.8953a.0762.0762 0 01-.0033-.1263c.1237-.0926.2474-.1889.3643-.2889a.0724.0724 0 01.0764-.0101c3.8776 1.7744 8.0826 1.7744 11.916 0a.0732.0732 0 01.0776.0102c.1182.1.2413.1963.3663.2889a.0766.0766 0 01-.0027.1263c-.588.3463-1.203.6479-1.8553.8953a.0766.0766 0 00-.0384.1066c.3533.699.7648 1.3638 1.226 1.9942a.077.077 0 00.0842.0276c1.9587-.6066 3.9472-1.5218 6.002-3.0294a.0777.0777 0 00.0322-.0561c.5033-5.2282-.8571-9.7214-3.5707-13.6603a.0664.0664 0 00-.0325-.0277zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9459 2.4189-2.1568 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
              </svg>
              Sign in with Discord
            </Button>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <StageBackground />
      <main className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6">
        <motion.section
          {...entrance}
          className="w-full max-w-md rounded-[var(--radius)] border border-[hsl(var(--border)/0.6)] bg-[hsl(var(--surface)/0.6)] p-6 backdrop-blur-xl sm:p-8"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode('home')}
            className="-ml-3 mb-8 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="space-y-2">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-primary">
              {mode === 'create' ? 'Open stage' : 'Enter stage'}
            </p>
            <h1 className="font-display text-3xl">
              {mode === 'create' ? 'Create a room' : 'Join a room'}
            </h1>
            <p className="text-sm text-muted-foreground">Pick a nickname to get started.</p>
          </div>

          <div className="mt-8 space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">Nickname</span>
              <Input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="Your nickname"
                maxLength={15}
                autoFocus
                className="h-12 rounded-xl border-border bg-background/60 px-4 text-base"
              />
            </label>

            {mode === 'join' && (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">Room code</span>
                <Input
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                  placeholder="ABCD"
                  maxLength={4}
                  className="h-16 rounded-xl border-border bg-background/60 px-4 text-center font-mono text-2xl font-bold uppercase tracking-[0.32em]"
                />
              </label>
            )}
          </div>

          <Button
            onClick={mode === 'create' ? handleCreate : handleJoin}
            className="mt-8 h-12 w-full text-base"
          >
            {mode === 'create' ? 'Create Room' : 'Join Room'}
          </Button>
        </motion.section>
      </main>
    </div>
  );
};

export default Index;
