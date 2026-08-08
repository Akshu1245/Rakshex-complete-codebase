"use client";
import { useEffect, useRef } from "react";

export function WaveDotsCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number | null = null;
    let time = 0;

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    };
    canvas.addEventListener("mousemove", onMouseMove);

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const dotSpacing = 22; // wider spacing for bigger, more visible dots
    const perspective = 420;
    const fov = 320;
    const TEAL_CREST_THRESHOLD = 28;

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;

      // Mouse influence offset
      const mx = (mouseRef.current.x - 0.5) * 30;
      const my = (mouseRef.current.y - 0.5) * 20;

      const dots: {
        sx: number;
        sy: number;
        r: number;
        alpha: number;
        teal: boolean;
        waveZ: number;
      }[] = [];

      const cols = Math.ceil(w / dotSpacing) + 6;
      const rows = Math.ceil(h / dotSpacing) + 6;

      for (let col = -cols / 2; col < cols / 2; col++) {
        for (let row = -rows / 2; row < rows / 2; row++) {
          const x3 = col * dotSpacing;
          const y3 = row * dotSpacing;

          // Richer multi-frequency wave
          const waveZ =
            Math.sin(col * 0.1 + time * 0.018 + mx * 0.02) * 50 +
            Math.sin(col * 0.05 + row * 0.07 + time * 0.012) * 30 +
            Math.cos(row * 0.09 + time * 0.009 + my * 0.02) * 20 +
            Math.sin((col + row) * 0.06 + time * 0.006) * 15;

          const z3 = waveZ + perspective;
          const scale = fov / z3;
          const sx = cx + x3 * scale;
          const sy = cy + y3 * scale;

          if (sx < -4 || sx > w + 4 || sy < -4 || sy > h + 4) continue;

          const depthFactor = scale;
          // Larger dots — min 1.2, scale up to ~4px
          const r = Math.max(1.2, 3.5 * depthFactor);
          const alpha = Math.min(0.9, 0.2 + depthFactor * 0.65);

          dots.push({ sx, sy, r, alpha, teal: waveZ > TEAL_CREST_THRESHOLD, waveZ });
        }
      }

      // Draw gray/white dots
      for (const dot of dots) {
        if (dot.teal) continue;
        ctx.beginPath();
        ctx.arc(dot.sx, dot.sy, dot.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 210, 220, ${dot.alpha * 0.75})`;
        ctx.fill();
      }

      // Draw teal crest dots with glow
      for (const dot of dots) {
        if (!dot.teal) continue;
        const glowAlpha = Math.min(1, dot.alpha + 0.2);

        // Glow halo
        ctx.shadowBlur = 8;
        ctx.shadowColor = `rgba(20, 184, 166, 0.7)`;
        ctx.beginPath();
        ctx.arc(dot.sx, dot.sy, dot.r * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(20, 184, 166, ${glowAlpha * 0.4})`;
        ctx.fill();

        // Core dot
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(dot.sx, dot.sy, dot.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(20, 184, 166, ${glowAlpha})`;
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      time++;
      animationId = requestAnimationFrame(draw);
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const stop = () => {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    };

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
      canvas.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "auto" }}
    />
  );
}
