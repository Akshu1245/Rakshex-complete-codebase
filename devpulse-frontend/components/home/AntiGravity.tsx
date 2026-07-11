"use client";

import { useEffect, useRef, useState } from "react";
import { Shield, Power, Brain, Key, AlertTriangle, CheckCircle, Zap, Share2 } from "lucide-react";

interface FloatingItem {
  element: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  vr: number;
  originalTransition: string;
}

interface Vulnerability {
  id: string;
  name: string;
  type: "key" | "injection" | "cost" | "shadow";
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  vr: number;
  status: "active" | "scanning" | "secured";
  age: number;
  maxAge: number;
}

interface AntiGravityProps {
  active: boolean;
  setActive: (active: boolean) => void;
}

// ponytail: synthesiser logic kept fully native and self-contained
let audioCtx: AudioContext | null = null;
const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
};

const playWhoosh = () => {
  try {
    initAudio();
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(60, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, audioCtx.currentTime + 0.8);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(200, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.8);
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.25);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.8);
  } catch {
    // Audio feedback is optional and must never block the visual interaction.
  }
};

const playPing = () => {
  try {
    initAudio();
    if (!audioCtx) return;
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(960, audioCtx.currentTime);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1440, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    osc1.start();
    osc2.start();
    osc1.stop(audioCtx.currentTime + 0.5);
    osc2.stop(audioCtx.currentTime + 0.5);
  } catch {
    // Audio feedback is optional and must never block the visual interaction.
  }
};

const playScanTick = () => {
  try {
    initAudio();
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.03, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.08);
  } catch {
    // Audio feedback is optional and must never block the visual interaction.
  }
};

export function AntiGravity({ active, setActive }: AntiGravityProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const elementsRef = useRef<FloatingItem[]>([]);
  const vulnerabilitiesRef = useRef<Vulnerability[]>([]);
  const requestRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [hudScore, setHudScore] = useState(78);
  const [timeLeft, setTimeLeft] = useState(45);
  const [hudLogs, setHudLogs] = useState<string[]>(["[SYSTEM] Ready to defy gravity risks..."]);
  const [activeVulnerabilities, setActiveVulnerabilities] = useState<Vulnerability[]>([]);

  const addLog = (msg: string) => {
    setHudLogs((prev) => [msg, ...prev.slice(0, 15)]);
  };

  // LocalStorage state loading
  useEffect(() => {
    const saved = localStorage.getItem("rakshex_antigravity");
    if (saved === "true" && !active) {
      setActive(true);
    }
  }, [setActive]);

  // Synchronize localStorage
  useEffect(() => {
    localStorage.setItem("rakshex_antigravity", active ? "true" : "false");
  }, [active]);

  // 45s Countdown & Escape Key handler
  useEffect(() => {
    if (active) {
      setTimeLeft(45);
      countdownIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleRestoreGravity();
            addLog("⏰ Safety limit (45s) reached. Auto-deactivating...");
            return 45;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    }

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [active]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && active) {
        handleRestoreGravity();
        addLog("🛑 Escape pressed. Gravity restored.");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active]);

  // Konami Code Egg
  useEffect(() => {
    const konami = [
      "ArrowUp",
      "ArrowUp",
      "ArrowDown",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ArrowLeft",
      "ArrowRight",
      "b",
      "a",
    ];
    let konamiIndex = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === konami[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konami.length) {
          setActive(!active);
          konamiIndex = 0;
          addLog("✨ Konami Code Activated! Anti-Gravity Toggled.");
        }
      } else {
        konamiIndex = 0;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, setActive]);

  const handleRestoreGravity = () => {
    setActive(false);
    vulnerabilitiesRef.current = [];
    setActiveVulnerabilities([]);
    setHudScore(78);
    addLog("🔴 Releasing anti-gravity core...");
  };

  const spawnVulnerability = (initialX?: number, initialY?: number) => {
    const vulnNames = [
      { name: "⚠️ Exposed Stripe Secret", type: "key" as const },
      { name: "⚠️ SQL Injection vector", type: "injection" as const },
      { name: "⚠️ Prompt Injection payload", type: "injection" as const },
      { name: "⚠️ Runaway AI spend ($54/hr)", type: "cost" as const },
      { name: "⚠️ Unauthenticated Shadow API", type: "shadow" as const },
    ];

    const info = vulnNames[Math.floor(Math.random() * vulnNames.length)];
    const id = Math.random().toString(36).substring(2, 9);

    const x = initialX !== undefined ? initialX : Math.random() * (window.innerWidth - 240) + 120;
    const y = initialY !== undefined ? initialY : window.innerHeight + 50;

    const newVuln: Vulnerability = {
      id,
      name: info.name,
      type: info.type,
      x,
      y,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -1.0 - Math.random() * 1.0,
      r: (Math.random() - 0.5) * 30,
      vr: (Math.random() - 0.5) * 0.5,
      status: "active",
      age: 0,
      maxAge: 800 + Math.random() * 200, // longer lifespan for slow scans
    };

    vulnerabilitiesRef.current.push(newVuln);
    setActiveVulnerabilities([...vulnerabilitiesRef.current]);
    addLog(`⚠️ Anomaly detected: ${info.name}`);
    playScanTick();
  };

  // Main Canvas & CSS Float Physics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    // Particles system
    const particleCount = 80;
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
    }> = [];
    const colors = ["#14B8A6", "#06b6d4", "#d946ef", "#ef4444"];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.2 - Math.random() * 0.6,
        size: Math.random() * 2 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.5 + 0.3,
      });
    }

    // Capture & Add Interactivity to Floating HTML Elements
    if (active && elementsRef.current.length === 0) {
      playWhoosh();
      const domElements = document.querySelectorAll(".anti-gravity-float");
      const list: FloatingItem[] = [];

      domElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        const capturedItem = {
          element: htmlEl,
          x: 0,
          y: 0,
          vx: (Math.random() - 0.5) * 0.6,
          vy: -1.0 - Math.random() * 1.5,
          r: 0,
          vr: (Math.random() - 0.5) * 0.3,
          originalTransition: htmlEl.style.transition,
        };
        list.push(capturedItem);

        htmlEl.style.transition = "none";
        htmlEl.style.willChange = "transform";

        // Click handler: trigger local scan
        const handleClick = (e: MouseEvent) => {
          if (!active) return;
          e.preventDefault();
          e.stopPropagation();

          htmlEl.classList.add("shadow-[0_0_25px_#14B8A6]");
          setTimeout(() => htmlEl.classList.remove("shadow-[0_0_25px_#14B8A6]"), 600);

          playPing();
          const nodeName = htmlEl.innerText.split("\n")[0] || "Target Node";
          addLog(`🔬 [DEMO] Clicked node: ${nodeName}. Sweeping scanner...`);

          const rect = htmlEl.getBoundingClientRect();
          spawnVulnerability(rect.left + rect.width / 2, rect.top);
        };

        // Mobile Drag Physics
        let touchStartX = 0;
        let touchStartY = 0;
        let itemStartX = 0;
        let itemStartY = 0;
        let isDragging = false;
        let lastTime = 0;

        const handleTouchStart = (e: TouchEvent) => {
          if (!active) return;
          const touch = e.touches[0];
          touchStartX = touch.clientX;
          touchStartY = touch.clientY;
          itemStartX = capturedItem.x;
          itemStartY = capturedItem.y;
          capturedItem.vx = 0;
          capturedItem.vy = 0;
          isDragging = true;
          lastTime = performance.now();
        };

        const handleTouchMove = (e: TouchEvent) => {
          if (!active || !isDragging) return;
          const touch = e.touches[0];
          const dx = touch.clientX - touchStartX;
          const dy = touch.clientY - touchStartY;

          capturedItem.x = itemStartX + dx;
          capturedItem.y = itemStartY + dy;

          const now = performance.now();
          const dt = now - lastTime;
          if (dt > 0) {
            capturedItem.vx = (dx / dt) * 6;
            capturedItem.vy = (dy / dt) * 6;
          }
          lastTime = now;
        };

        const handleTouchEnd = () => {
          isDragging = false;
          capturedItem.vr = (Math.random() - 0.5) * 1.0;
        };

        htmlEl.addEventListener("click", handleClick);
        htmlEl.addEventListener("touchstart", handleTouchStart, { passive: true });
        htmlEl.addEventListener("touchmove", handleTouchMove, { passive: true });
        htmlEl.addEventListener("touchend", handleTouchEnd, { passive: true });

        (htmlEl as any)._agCleanup = () => {
          htmlEl.removeEventListener("click", handleClick);
          htmlEl.removeEventListener("touchstart", handleTouchStart);
          htmlEl.removeEventListener("touchmove", handleTouchMove);
          htmlEl.removeEventListener("touchend", handleTouchEnd);
        };
      });

      elementsRef.current = list;
      addLog("🚀 Anti-Gravity active: suspends gravity via custom frame-loop.");
      addLog("[SCANNER] Scanning for security anomalies in orbit...");
    }

    let lastSpawnTime = 0;

    // Loop
    const loop = (timestamp: number) => {
      ctx.fillStyle = "rgba(10, 10, 10, 0.15)";
      ctx.fillRect(0, 0, width, height);

      // Grid background
      ctx.strokeStyle = "rgba(20, 184, 166, 0.02)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Update Particles
      particles.forEach((p) => {
        if (active) {
          p.vy -= 0.02;
          if (p.vy < -3.5) p.vy = -3.5;
        } else {
          p.vy = (p.vy + 0.1) * 0.9;
          if (p.vy > -0.2) p.vy = -0.2 - Math.random() * 0.4;
        }
        p.x += p.vx;
        p.y += p.vy;

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });

      // HTML Elements buoyancy
      const springStrength = 0.08;
      const friction = 0.88;

      elementsRef.current.forEach((item) => {
        if (active) {
          item.vy -= 0.035;
          item.vx += (Math.random() - 0.5) * 0.08;
          item.vx *= 0.98;
          item.vy *= 0.98;
          item.vr *= 0.98;

          item.x += item.vx;
          item.y += item.vy;
          item.r += item.vr;

          const rect = item.element.getBoundingClientRect();
          if (rect.bottom < 0) {
            const originalTop = rect.top - item.y;
            item.y = height - originalTop + 50;
            item.x = (Math.random() - 0.5) * 60;
            item.vy = -1.0 - Math.random() * 1.5;
          }
        } else {
          const ax = -item.x * springStrength;
          const ay = -item.y * springStrength;
          const ar = -item.r * springStrength;

          item.vx = (item.vx + ax) * friction;
          item.vy = (item.vy + ay) * friction;
          item.vr = (item.vr + ar) * friction;

          item.x += item.vx;
          item.y += item.vy;
          item.r += item.vr;
        }

        item.element.style.transform = `translate3d(${item.x}px, ${item.y}px, 0) rotate(${item.r}deg)`;
      });

      // Dock elements
      if (!active && elementsRef.current.length > 0) {
        const finished = elementsRef.current.every(
          (item) => Math.abs(item.x) < 0.05 && Math.abs(item.y) < 0.05 && Math.abs(item.r) < 0.05,
        );
        if (finished) {
          elementsRef.current.forEach((item) => {
            item.element.style.transform = "";
            item.element.style.transition = item.originalTransition;
            item.element.style.willChange = "";
            if ((item.element as any)._agCleanup) {
              (item.element as any)._agCleanup();
              delete (item.element as any)._agCleanup;
            }
          });
          elementsRef.current = [];
          addLog("🌍 Normal gravity restored. Elements docked.");
        }
      }

      // Threats and Scanning
      if (active) {
        if (timestamp - lastSpawnTime > 7000 + Math.random() * 5000) {
          spawnVulnerability();
          lastSpawnTime = timestamp;
        }

        const scanY = ((timestamp / 10) % (height + 200)) - 100;
        ctx.strokeStyle = "rgba(20, 184, 166, 0.4)";
        ctx.lineWidth = 3;
        ctx.shadowColor = "#14B8A6";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(0, scanY);
        ctx.lineTo(width, scanY);
        ctx.stroke();
        ctx.shadowBlur = 0;

        vulnerabilitiesRef.current.forEach((v) => {
          v.vy -= 0.012; // slow rise
          v.vx += (Math.random() - 0.5) * 0.12;
          v.vx *= 0.98;
          v.vy *= 0.98;
          v.x += v.vx;
          v.y += v.vy;
          v.r += v.vr;
          v.age++;

          // Scan detection (secures after ~10 seconds lifespan or sweep intersection)
          // ponytail: let scan sweep trigger scans easily or secure automatically after 10s age
          if (v.status === "active" && (Math.abs(v.y - scanY) < 18 || v.age >= 600)) {
            v.status = "scanning";
            v.vy = -0.15;
            v.vx = 0;
            addLog(`🔬 [SCANNER] Active scan sweep locking on: ${v.name}...`);
            playScanTick();

            // Secure after a scan window delay
            setTimeout(() => {
              if (v.status === "scanning") {
                v.status = "secured";
                v.vy = -3.5;
                v.vx = (Math.random() - 0.5) * 2.5;
                addLog(`🛡️ [SECURED] Neutralised security threat: ${v.name.replace("⚠️ ", "")}!`);
                playPing();
                setHudScore((prev) => Math.min(prev + 4, 99));
              }
            }, 1800);
          }
        });

        // Filter expired
        const count = vulnerabilitiesRef.current.length;
        vulnerabilitiesRef.current = vulnerabilitiesRef.current.filter(
          (v) => v.y > -80 && v.age < v.maxAge,
        );
        if (vulnerabilitiesRef.current.length !== count) {
          setActiveVulnerabilities([...vulnerabilitiesRef.current]);
        }
      } else {
        vulnerabilitiesRef.current.forEach((v) => {
          v.vy += 0.4;
          v.y += v.vy;
        });
        vulnerabilitiesRef.current = vulnerabilitiesRef.current.filter((v) => v.y < height + 80);
        if (vulnerabilitiesRef.current.length === 0 && activeVulnerabilities.length > 0) {
          setActiveVulnerabilities([]);
        }
      }

      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      window.removeEventListener("resize", resize);
      elementsRef.current.forEach((item) => {
        if ((item.element as any)._agCleanup) {
          (item.element as any)._agCleanup();
        }
      });
    };
  }, [active]);

  const handleShare = () => {
    playPing();
    const text = `I just defied AI risks and suspended gravity on RakshEx! 🚀 Try the interactive security scanner yourself: https://www.devpulse.ai/ %23AISecurity %23AntiGravity`;
    const url = `https://twitter.com/intent/tweet?text=${text}`;
    window.open(url, "_blank", "width=600,height=400");
    addLog("✨ Share link triggered. Defy AI risks together!");
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none transition-opacity duration-1000 bg-transparent"
        style={{
          zIndex: active ? 5 : -1,
          opacity: active ? 0.8 : 0.05,
        }}
      />

      {active && (
        <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
          {activeVulnerabilities.map((v) => {
            let colorClass =
              "border-red-500/40 bg-red-950/20 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.2)]";
            let statusText = "THREAT";
            let Icon = AlertTriangle;

            if (v.status === "scanning") {
              colorClass =
                "border-amber-500/40 bg-amber-950/20 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)] animate-pulse";
              statusText = "SCANNING";
              Icon = Zap;
            } else if (v.status === "secured") {
              colorClass =
                "border-teal-500/40 bg-teal-950/20 text-teal-400 shadow-[0_0_12px_rgba(20,184,166,0.3)]";
              statusText = "SECURED";
              Icon = CheckCircle;
            }

            return (
              <div
                key={v.id}
                className={`absolute pointer-events-auto select-none rounded-[6px] border px-4 py-2 flex items-center gap-2 font-mono text-xs transition-colors duration-300 ${colorClass}`}
                style={{
                  left: `${v.x}px`,
                  top: `${v.y}px`,
                  transform: `rotate(${v.r}deg)`,
                  willChange: "transform, top, left",
                  maxWidth: "280px",
                }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <div className="flex flex-col text-left">
                  <span className="font-semibold leading-none mb-0.5">{v.name}</span>
                  <span className="text-[9px] opacity-60 font-sans tracking-wide">
                    STATUS: {statusText}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        className={`fixed bottom-6 right-6 w-80 bg-black/85 border border-[#14B8A6]/25 rounded-lg p-4 font-mono transition-all duration-500 shadow-2xl backdrop-blur-md ${
          active
            ? "translate-y-0 opacity-100 scale-100 z-50 pointer-events-auto"
            : "translate-y-12 opacity-0 scale-95 z-[-1] pointer-events-none"
        }`}
        aria-hidden={!active}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#14B8A6] animate-pulse" />
            <span className="text-xs text-white font-semibold tracking-wider font-sans uppercase">
              RaksHex Anti-Gravity Core
            </span>
          </div>
          <button
            onClick={handleRestoreGravity}
            className="text-[10px] text-red-400 hover:text-red-300 font-bold border border-red-500/30 hover:border-red-400 bg-red-950/10 px-2 py-0.5 rounded cursor-pointer transition-colors"
          >
            RESTORE GRAVITY
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-white/5 border border-white/5 p-2 rounded text-center">
            <p className="text-[9px] text-[#9CA3AF] font-sans font-medium uppercase mb-0.5">
              Shield Status
            </p>
            <p className="text-xs text-[#14B8A6] font-bold tracking-widest">ACTIVE</p>
          </div>
          <div className="bg-white/5 border border-white/5 p-2 rounded text-center">
            <p className="text-[9px] text-[#9CA3AF] font-sans font-medium uppercase mb-0.5">
              Safety Shutoff
            </p>
            <p className="text-xs text-white font-bold tracking-widest">{timeLeft}s</p>
          </div>
        </div>

        <div className="bg-[#14B8A6]/5 border border-[#14B8A6]/20 p-2.5 rounded text-center mb-3 flex items-center justify-between">
          <span className="text-[10px] font-sans font-semibold text-[#9CA3AF] uppercase">
            Security Score:
          </span>
          <span className="text-sm font-bold text-white tracking-widest">{hudScore}/100</span>
        </div>

        <div className="h-24 bg-black/40 border border-white/5 p-2 rounded text-[10px] overflow-y-auto flex flex-col-reverse text-left space-y-1 font-mono text-[#9CA3AF] scrollbar-thin mb-3">
          {hudLogs.map((log, i) => {
            let color = "text-[#9CA3AF]";
            if (log.startsWith("⚠️")) color = "text-red-400";
            if (log.startsWith("🛡️") || log.startsWith("✨") || log.startsWith("🚀"))
              color = "text-[#14B8A6]";
            if (log.includes("[SCANNER]")) color = "text-amber-400";
            if (log.includes("[DEMO]")) color = "text-fuchsia-400";
            return (
              <p key={i} className={`${color} leading-relaxed`}>
                {log}
              </p>
            );
          })}
        </div>

        <button
          onClick={handleShare}
          className="w-full py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-sans text-xs font-semibold rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-fuchsia-500/30"
        >
          <Share2 className="w-3.5 h-3.5" />
          Share Orbit
        </button>
      </div>
    </>
  );
}
