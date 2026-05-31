import { ArrowRight, Mic2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { StageBackground } from '@/components/StageBackground';

const Index = () => (
  <div className="relative isolate min-h-screen overflow-hidden">
    <StageBackground />
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-between px-6 py-7 sm:px-10 sm:py-9">
      <header className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
        <Mic2 className="h-4 w-4 text-primary" />
        KodHard
      </header>

      <section className="max-w-3xl py-20">
        <p className="mb-5 text-sm font-medium text-primary">Shared karaoke rooms</p>
        <h1 className="max-w-2xl text-[clamp(4rem,13vw,9.5rem)] font-semibold leading-[0.86] tracking-[-0.09em] text-foreground">
          Sing in sync.
        </h1>
        <p className="mt-7 max-w-md text-base leading-7 text-muted-foreground sm:text-lg">
          One room. One queue. Playback and timed lyrics shared across every screen.
        </p>
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center" aria-label="Room actions">
        <Button asChild size="lg" className="h-12 rounded-full px-6 text-base">
          <Link to="/create">
            Start Room
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="lg" className="h-12 rounded-full px-6 text-base">
          <Link to="/join">Join Room</Link>
        </Button>
        <p className="text-sm text-muted-foreground sm:ml-auto">Works best with one shared stage screen.</p>
      </section>
    </main>
  </div>
);

export default Index;
