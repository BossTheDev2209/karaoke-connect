import React from 'react';

export const StageBackground: React.FC = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
  >
    <div className="animate-ambient-drift absolute inset-[-8%] bg-[radial-gradient(circle_at_50%_38%,hsl(var(--ambient)/0.18),transparent_68%)] motion-reduce:animate-none" />
  </div>
);
