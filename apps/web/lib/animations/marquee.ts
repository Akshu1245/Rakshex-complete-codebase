import { useState } from "react";

export function useMarqueeSpeedControl() {
  const [isPaused, setIsPaused] = useState(false);

  const pause = () => setIsPaused(true);
  const play = () => setIsPaused(false);

  return {
    isPaused,
    pause,
    play,
    marqueeStyle: {
      animationPlayState: isPaused ? "paused" : "running",
    },
  };
}
