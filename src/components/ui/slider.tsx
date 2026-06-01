import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

interface SliderProps
  extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  /** YouTube-style seek bar: thin track that thickens on hover, thumb hidden until hover/focus. */
  seek?: boolean;
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, seek = false, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", seek && "group py-1", className)}
    {...props}
  >
    <SliderPrimitive.Track
      className={cn(
        "relative w-full grow overflow-hidden rounded-full bg-primary/20",
        seek ? "h-[3px] transition-[height] duration-150 ease-out group-hover:h-1.5" : "h-2",
      )}
    >
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className={cn(
        "block rounded-full bg-background ring-offset-background transition-[opacity,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        seek
          ? "h-3 w-3 border-0 bg-primary opacity-0 group-hover:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none"
          : "h-5 w-5 border-2 border-primary",
      )}
    />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
