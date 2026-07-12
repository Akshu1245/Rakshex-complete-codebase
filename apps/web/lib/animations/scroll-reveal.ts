import { useState, useEffect, useRef, RefObject } from "react";

export function useScrollReveal(
  threshold: number = 0.1,
  rootMargin: string = "0px",
): { isRevealed: boolean; elementRef: RefObject<HTMLDivElement | null> } {
  const [isRevealed, setIsRevealed] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && active) {
          setIsRevealed(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin },
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      active = false;
      observer.disconnect();
    };
  }, [threshold, rootMargin]);

  return { isRevealed, elementRef };
}
