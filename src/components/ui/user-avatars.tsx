import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { useState, KeyboardEvent } from "react";

interface User {
  id: string | number;
  name?: string;
  image: string;
}

interface UserAvatarsProps {
  users: User[];
  size?: number;
  className?: string;
  maxVisible?: number;
  overlap?: number;
  focusScale?: number;
  isRightToLeft?: boolean;
  isOverlapOnly?: boolean;
  tooltipPlacement?: "top" | "bottom";
}

export const UserAvatars = ({
  users,
  size = 56,
  className,
  maxVisible = 7,
  isRightToLeft = false,
  isOverlapOnly = false,
  overlap = 60,
  focusScale = 1.2,
  tooltipPlacement = "bottom",
}: UserAvatarsProps) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const slicedUsers = users.slice(0, Math.min(maxVisible + 1, users.length + 1));
  const exceedMaxLength = users.length > maxVisible;

  const handleKeyEnter = (e: KeyboardEvent, index: number) => {
    if (e.key === "Enter" || e.key === " ") {
      setHoveredIndex(index);
    }
  };

  const diff = 1 - overlap / 100;

  return (
    <div
      className={cn("flex items-center", className)}
      style={{ direction: isRightToLeft ? "rtl" : "ltr" }}
    >
      {slicedUsers.map((user, index) => {
        const isHoveredOne = hoveredIndex === index;
        const isLengthBubble = exceedMaxLength && maxVisible === index;

        const zIndex =
          isHoveredOne && isOverlapOnly
            ? slicedUsers.length
            : isRightToLeft
            ? slicedUsers.length - index
            : index;

        const shouldScale =
          isHoveredOne && (!exceedMaxLength || slicedUsers.length - 1 !== index);

        const shouldShift =
          hoveredIndex !== null &&
          (isRightToLeft ? index < hoveredIndex : index > hoveredIndex) &&
          !isOverlapOnly;

        const baseGap = Number(size) * (overlap / 100);
        const neededGap = (Number(size) * (1 + focusScale)) / 2;
        const shift = Math.max(0, neededGap - baseGap);

        return (
          <motion.div
            key={user.id}
            tabIndex={0}
            role="button"
            aria-label={user.name}
            className="relative outline-none cursor-pointer"
            style={{
              width: size,
              height: size,
              marginLeft: index === 0 ? 0 : -(Number(size) * (overlap / 100)),
              zIndex,
            }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onFocus={() => setHoveredIndex(index)}
            onBlur={() => setHoveredIndex(null)}
            onKeyDown={(e) => handleKeyEnter(e, index)}
            animate={{
              scale: shouldScale ? focusScale : 1,
              x: shouldShift ? shift * (isRightToLeft ? -1 : 1) : 0,
            }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          >
            <div
              className="w-full h-full rounded-full overflow-hidden border-2 border-background bg-muted flex items-center justify-center"
              style={{ width: size, height: size }}
            >
              {isLengthBubble ? (
                <div className="w-full h-full flex items-center justify-center bg-muted text-foreground font-semibold text-sm">
                  +{users.length - maxVisible}
                </div>
              ) : (
                <img
                  src={user.image}
                  alt={user.name ?? ""}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              )}
            </div>

            <AnimatePresence>
              {shouldScale && user.name && (
                <motion.div
                  initial={{ opacity: 0, y: tooltipPlacement === "bottom" ? -4 : 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: tooltipPlacement === "bottom" ? -4 : 4 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    "absolute left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap",
                    tooltipPlacement === "bottom" ? "top-full mt-2" : "bottom-full mb-2"
                  )}
                  style={{ zIndex: 1000 }}
                >
                  <div className="px-2 py-1 rounded-md bg-popover text-popover-foreground text-xs shadow-md border border-border">
                    {user.name}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
};
