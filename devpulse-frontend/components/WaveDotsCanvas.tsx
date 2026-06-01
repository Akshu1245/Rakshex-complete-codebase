"use client";
import { useEffect, useRef } from "react";

export function WaveDotsCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
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

          dots.push({ sx, sy, r, alpha, teal: false });
        }
      }

      // Draw back dots first (sort by depth not needed for additive blending)
      for (const dot of dots) {
        ctx.beginPath();
        ctx.arc(dot.sx, dot.sy, dot.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 180, 180, ${dot.alpha})`;
        ctx.fill();
      }

      time++;
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
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
