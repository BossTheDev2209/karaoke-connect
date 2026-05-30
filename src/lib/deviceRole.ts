import type { RoomRole } from "@/types/karaoke";

export interface DeviceEnv {
  width: number;
  hasTouch: boolean;
  coarsePointer: boolean;
}

/** Below this width AND touch-like input => treat as a phone remote. */
export const REMOTE_MAX_WIDTH = 768;

export function detectDefaultRole(env: DeviceEnv): RoomRole {
  const isSmall = env.width < REMOTE_MAX_WIDTH;
  const isTouchLike = env.hasTouch || env.coarsePointer;
  return isSmall && isTouchLike ? "remote" : "player";
}

/** Reads the live browser environment. Falls back to a desktop player on SSR. */
export function readDeviceEnv(): DeviceEnv {
  if (typeof window === "undefined") {
    return { width: 1920, hasTouch: false, coarsePointer: false };
  }
  return {
    width: window.innerWidth,
    hasTouch: "ontouchstart" in window || navigator.maxTouchPoints > 0,
    coarsePointer: window.matchMedia?.("(pointer: coarse)").matches ?? false,
  };
}
