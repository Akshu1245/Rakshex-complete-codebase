"use client";
import { useEffect, useRef } from "react";

export function WaveDotsCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number | null = null;
    let time = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    // 3D perspective wave grid
    const dotSpacing = 14;
    const perspective = 400;
    const fov = 300;

    // Dots riding the crest of the wave (waveZ above this threshold) pick up
    // the brand teal instead of neutral gray — ties the accent color to the
    // wave motion itself rather than a static or random sprinkle.
    const TEAL_CREST_THRESHOLD = 32;

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;

      // Build all dots with 3D positions
      const dots: { sx: number; sy: number; r: number; alpha: number; teal: boolean }[] = [];

      const cols = Math.ceil(w / dotSpacing) + 8;
      const rows = Math.ceil(h / dotSpacing) + 8;

      for (let col = -cols / 2; col < cols / 2; col++) {
        for (let row = -rows / 2; row < rows / 2; row++) {
          // 3D world coordinates
          const x3 = col * dotSpacing;
          const y3 = row * dotSpacing;

          // Wave modulation on Z (creates the sheet curve)
          const waveZ =
            Math.sin(col * 0.12 + time * 0.015) * 40 +
            Math.sin(col * 0.06 + row * 0.08 + time * 0.01) * 25 +
            Math.cos(row * 0.1 + time * 0.008) * 15;

          const z3 = waveZ + perspective;

          // Perspective projection
          const scale = fov / z3;
          const sx = cx + x3 * scale;
          const sy = cy + y3 * scale;

          // Skip if off-screen
          if (sx < -2 || sx > w + 2 || sy < -2 || sy > h + 2) continue;

          // Size and opacity based on depth
          const depthFactor = scale;
          const r = Math.max(0.4, 1.8 * depthFactor);
          const alpha = Math.min(0.8, 0.15 + depthFactor * 0.5);

          dots.push({ sx, sy, r, alpha, teal: waveZ > TEAL_CREST_THRESHOLD });
        }
      }

      // Draw neutral dots first, then teal crest dots on top so the accent
      // color reads clearly instead of blending under overlapping gray dots.
      for (const dot of dots) {
        if (dot.teal) continue;
        ctx.beginPath();
        ctx.arc(dot.sx, dot.sy, dot.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 180, 180, ${dot.alpha})`;
        ctx.fill();
      }
      for (const dot of dots) {
        if (!dot.teal) continue;
        ctx.beginPath();
        ctx.arc(dot.sx, dot.sy, dot.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(20, 184, 166, ${Math.min(1, dot.alpha + 0.15)})`;
        ctx.fill();
      }

      time++;
      animationId = requestAnimationFrame(draw);
    };

    // Respect prefers-reduced-motion: render a single static frame instead
    // of an infinite requestAnimationFrame loop.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const stop = () => {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    };

    // Pause the loop when the tab isn't visible instead of burning CPU/battery
    // on a purely decorative background.
    const handleVisibility = () => {
      if (document.hidden) {
        stop();
      } else if (!reduceMotion && animationId === null) {
        draw();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    if (reduceMotion) {
      draw();
      stop();
    } else {
      draw();
    }

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "none" }}
    />
  );
}
