import { useState, useEffect, useRef, RefObject } from "react";

export function useRollingCounter(
  target: number,
  durationMs: number = 1500,
): { count: number; elementRef: RefObject<HTMLDivElement | null> } {
  const [count, setCount] = useState(0);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    const startCount = () => {
      const startTime = performance.now();
      const animate = (currentTime: number) => {
        if (!active) return;
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / durationMs, 1);

        // Easing function: easeOutQuad
        const easeProgress = progress * (2 - progress);

        setCount(Math.floor(easeProgress * target));

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setCount(target);
        }
      };

      requestAnimationFrame(animate);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          startCount();
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      active = false;
      observer.disconnect();
    };
  }, [target, durationMs]);

  return { count, elementRef };
}
