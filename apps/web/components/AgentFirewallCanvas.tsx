"use client";
import { useEffect, useRef } from "react";

/**
 * Animated visualization of the Agent Firewall's actual job: a stream of
 * agent actions flowing toward a decision gate, most passing through
 * (ALLOW, teal), a minority stopped at the gate (DENY, red) — a
 * disintegration burst instead of continuing. Not a decorative particle
 * field; the shape of the animation IS the product claim.
 */

interface Particle {
  lane: number;
  x: number;
  y: number;
  speed: number;
  allowed: boolean;
  state: "approaching" | "passed" | "denied";
  deniedAt: number;
  radius: number;
}

interface Ring {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: "teal" | "red";
}

const LANES = 7;
const SPAWN_INTERVAL_MS = 260;
const DENY_RATE = 0.22;
const BASE_SPEED = 0.9;

export function AgentFirewallCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let animationId: number | null = null;
    let lastSpawn = 0;
    let lastFrame = 0;
    const particles: Particle[] = [];
    const rings: Ring[] = [];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const gateXFrac = 0.62;

    const spawnParticle = (w: number, h: number) => {
      const laneIdx = Math.floor(Math.random() * LANES);
      const laneHeight = h / (LANES + 1);
      const y = laneHeight * (laneIdx + 1) + (Math.random() - 0.5) * laneHeight * 0.35;
      particles.push({
        lane: laneIdx,
        x: -10,
        y,
        speed: BASE_SPEED + Math.random() * 0.5,
        allowed: Math.random() > DENY_RATE,
        state: "approaching",
        deniedAt: 0,
        radius: 2 + Math.random() * 1.3,
      });
    };

    const draw = (t: number) => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      const gateX = w * gateXFrac;
      const dt = lastFrame ? Math.min(32, t - lastFrame) : 16;
      lastFrame = t;

      // Trail effect: don't fully clear, fade the previous frame instead.
      ctx.fillStyle = "rgba(10, 10, 12, 0.22)";
      ctx.fillRect(0, 0, w, h);

      // Spawn
      if (t - lastSpawn > SPAWN_INTERVAL_MS) {
        lastSpawn = t;
        spawnParticle(w, h);
      }

      // Gate line — a slow vertical pulse so it reads as "active", not static
      const pulse = 0.35 + 0.15 * Math.sin(t / 900);
      ctx.strokeStyle = `rgba(20, 184, 166, ${pulse})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gateX, 0);
      ctx.lineTo(gateX, h);
      ctx.stroke();
      ctx.shadowBlur = 12;
      ctx.shadowColor = "rgba(20, 184, 166, 0.5)";
      ctx.beginPath();
      ctx.moveTo(gateX, 0);
      ctx.lineTo(gateX, h);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        if (p.state === "approaching") {
          p.x += p.speed * (dt / 16);
          if (p.x >= gateX) {
            if (p.allowed) {
              p.state = "passed";
              rings.push({
                x: gateX,
                y: p.y,
                radius: 1,
                maxRadius: 22,
                alpha: 0.8,
                color: "teal",
              });
            } else {
              p.state = "denied";
              p.deniedAt = t;
              rings.push({
                x: gateX,
                y: p.y,
                radius: 1,
                maxRadius: 26,
                alpha: 0.9,
                color: "red",
              });
            }
          }
        } else if (p.state === "passed") {
          p.x += p.speed * 1.15 * (dt / 16);
        }
        // "denied" particles stop moving and fade in place (handled by trail/alpha below)

        // Remove off-screen or long-dead particles
        if (p.x > w + 10 || (p.state === "denied" && t - p.deniedAt > 700)) {
          particles.splice(i, 1);
          continue;
        }

        const isDenied = p.state === "denied";
        const age = isDenied ? (t - p.deniedAt) / 700 : 0;
        const alpha = isDenied ? Math.max(0, 1 - age) : p.x < gateX ? 0.55 : 0.95;
        const r = isDenied ? p.radius * (1 - age * 0.5) : p.radius;
        const color = isDenied
          ? `rgba(248, 113, 113, ${alpha})`
          : p.state === "passed"
            ? `rgba(20, 184, 166, ${alpha})`
            : `rgba(148, 163, 184, ${alpha})`;

        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0, r), 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      // Rings (decision bursts at the gate)
      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];
        ring.radius += 0.9 * (dt / 16);
        ring.alpha -= 0.03 * (dt / 16);
        if (ring.alpha <= 0 || ring.radius >= ring.maxRadius) {
          rings.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
        ctx.strokeStyle =
          ring.color === "teal"
            ? `rgba(20, 184, 166, ${Math.max(0, ring.alpha)})`
            : `rgba(248, 113, 113, ${Math.max(0, ring.alpha)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      animationId = requestAnimationFrame(draw);
    };

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
        lastFrame = 0;
        animationId = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    if (reduceMotion) {
      // Single static frame: a few settled particles either side of the gate.
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.fillStyle = "rgba(10, 10, 12, 1)";
      ctx.fillRect(0, 0, w, h);
      const gateX = w * gateXFrac;
      ctx.strokeStyle = "rgba(20, 184, 166, 0.4)";
      ctx.beginPath();
      ctx.moveTo(gateX, 0);
      ctx.lineTo(gateX, h);
      ctx.stroke();
      const laneHeight = h / (LANES + 1);
      for (let i = 0; i < LANES; i++) {
        const y = laneHeight * (i + 1);
        const passed = Math.random() > DENY_RATE;
        ctx.beginPath();
        ctx.arc(passed ? gateX + 40 : gateX - 30, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = passed ? "rgba(20, 184, 166, 0.9)" : "rgba(148, 163, 184, 0.6)";
        ctx.fill();
      }
    } else {
      animationId = requestAnimationFrame(draw);
    }

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}
