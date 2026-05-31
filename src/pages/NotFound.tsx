import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Mic2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StageBackground } from "@/components/StageBackground";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-6">
      <StageBackground />
      <div className="max-w-md text-center">
        <Mic2 className="mx-auto mb-6 h-5 w-5 text-primary" />
        <p className="font-mono text-xs tracking-[0.3em] text-primary">404</p>
        <h1 className="mt-3 text-5xl font-semibold tracking-[-0.07em]">Room not found.</h1>
        <p className="mt-4 text-base text-muted-foreground">This route left the set.</p>
        <Button asChild variant="ghost" className="mt-6 rounded-full">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Return home
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
