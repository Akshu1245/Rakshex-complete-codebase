"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Shield, AlertTriangle, CheckCircle2, XCircle, Sliders, Server } from "lucide-react";

interface ArchitectureCard {
  title: string;
  detail: string;
  tag: string;
  status: string;
  tagColor: string;
  tagBg: string;
}

interface CardPair {
  left: ArchitectureCard;
  right: ArchitectureCard;
}

const CARD_PAIRS: CardPair[] = [
  {
    left: {
      title: "All-or-Nothing Scopes",
      detail: "A valid session can call any action the API key can reach.",
      tag: "No Attenuation",
      status: "Broad Blast Radius",
      tagColor: "text-red-400",
      tagBg: "bg-red-950/40",
    },
    right: {
      title: "Delegated Authority",
      detail:
        "Parent-to-child attenuation — a child authority can never exceed its parent's scope.",
      tag: "Active",
      status: "Enforced",
      tagColor: "text-emerald-400",
      tagBg: "bg-emerald-950/50",
    },
  },
  {
    left: {
      title: "Advisory Denials",
      detail: "A DENY is logged, but the underlying credential still works.",
      tag: "Not Enforced",
      status: "Bypassable",
      tagColor: "text-red-400",
      tagBg: "bg-red-950/40",
    },
    right: {
      title: "Credential Mediation",
      detail: "A DENY blocks the credential itself — the secret never reaches a denied caller.",
      tag: "Broker",
      status: "Fail-closed",
      tagColor: "text-teal-400",
      tagBg: "bg-teal-950/50",
    },
  },
  {
    left: {
      title: "No Audit Trail",
      detail: "No tamper-evident record of which action was authorized and why.",
      tag: "Un-tracked",
      status: "Hard to Dispute",
      tagColor: "text-red-400",
      tagBg: "bg-red-950/40",
    },
    right: {
      title: "Action Ledger",
      detail: "Every decision is recorded tamper-evidently for audit and dispute resolution.",
      tag: "Hash-chained",
      status: "Tamper-evident",
      tagColor: "text-cyan-400",
      tagBg: "bg-cyan-950/50",
    },
  },
];

export function ArchitectureCompareSlider() {
  const [sliderPosition, setSliderPosition] = useState<number>(50); // percentage 0-100
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging) return;
      handleMove(e.touches[0].clientX);
    },
    [isDragging, handleMove],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      handleMove(e.clientX);
    },
    [isDragging, handleMove],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);

  return (
    <section
      id="architecture-slider"
      className="w-full py-12 px-4 md:px-8 bg-[#090D14] relative overflow-hidden scroll-mt-24"
    >
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#14B8A6]/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10 space-y-4">
        {/* Section Header */}
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#14B8A6]/10 border border-[#14B8A6]/30 text-[#14B8A6] text-[11px] font-semibold uppercase tracking-wider font-mono">
            <Sliders className="w-3 h-3" />
            Architecture Comparison
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white font-sans">
            Session-Level vs <span className="text-[#14B8A6]">Action-Level Control</span>
          </h2>
          <p className="text-slate-400 text-xs leading-relaxed">
            Drag the handle to compare governing who has a session against governing what each
            individual action is actually allowed to do.
          </p>
        </div>

        {/* Compact 16:9 Slider Canvas Container */}
        <div
          ref={containerRef}
          className="relative w-full h-[360px] rounded-2xl border border-slate-800 bg-[#060A10] overflow-hidden select-none shadow-2xl cursor-ew-resize"
          onMouseDown={(e) => {
            setIsDragging(true);
            handleMove(e.clientX);
          }}
          onTouchStart={(e) => {
            setIsDragging(true);
            handleMove(e.touches[0].clientX);
          }}
        >
          {/* ======================================================================== */}
          {/* BACKGROUND LAYERS — color/border only, no text (avoids any pixel-wipe    */}
          {/* garbling; all copy renders once via the atomic overlays below)          */}
          {/* ======================================================================== */}
          <div className="absolute inset-0 bg-[#060A10] z-0" />
          <div
            className="absolute inset-y-0 left-0 bg-[#090C12] overflow-hidden border-r-2 border-red-500 z-10 shadow-2xl"
            style={{ width: `${sliderPosition}%` }}
          />

          {/* ======================================================================== */}
          {/* HEADER ROW — rendered once, atomic swap at the same 50% boundary as the  */}
          {/* panel split, so it can never show two overlapping titles/badges          */}
          {/* ======================================================================== */}
          <div
            className="absolute top-0 left-0 right-0 p-5 md:p-6 pb-3 border-b z-20 flex items-center justify-between pointer-events-none"
            style={{
              borderColor: sliderPosition > 50 ? "rgba(239,68,68,0.2)" : "rgba(20,184,166,0.2)",
            }}
          >
            {sliderPosition > 50 ? (
              <>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-red-950/40 border border-red-500/30 flex items-center justify-center text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <h3 className="text-white font-bold text-sm md:text-base font-sans flex items-center gap-2">
                    Session-Level Access
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-950 text-red-400 font-mono border border-red-500/30 uppercase">
                      Coarse-Grained
                    </span>
                  </h3>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-red-400 font-mono bg-red-950/30 px-2.5 py-1 rounded-md border border-red-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                  Advisory Only
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#14B8A6]/10 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6]">
                    <Shield className="w-4 h-4" />
                  </div>
                  <h3 className="text-white font-bold text-sm md:text-base font-sans flex items-center gap-2">
                    RaksHex Agent Firewall
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#14B8A6]/20 text-[#14B8A6] font-mono border border-[#14B8A6]/30 uppercase">
                      Action-Level
                    </span>
                  </h3>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-[#14B8A6] font-mono bg-[#14B8A6]/5 px-2.5 py-1 rounded-md border border-[#14B8A6]/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6] animate-pulse" />
                  Enforcement Active
                </div>
              </>
            )}
          </div>

          {/* ======================================================================== */}
          {/* FOOTER ROW — same atomic-swap treatment as the header row above          */}
          {/* ======================================================================== */}
          <div
            className="absolute bottom-0 left-0 right-0 p-5 md:p-6 pt-2 border-t z-20 flex items-center justify-between text-[11px] font-mono text-slate-400 pointer-events-none"
            style={{
              borderColor: sliderPosition > 50 ? "rgba(239,68,68,0.1)" : "rgba(20,184,166,0.1)",
            }}
          >
            {sliderPosition > 50 ? (
              <>
                <span className="text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Session governed, action ungoverned
                </span>
                <span>Enforcement: None</span>
              </>
            ) : (
              <>
                <span className="text-[#14B8A6] flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5" /> Semantic action authorization
                </span>
                <span>Enforced at the credential</span>
              </>
            )}
          </div>

          {/* ======================================================================== */}
          {/* ARCHITECTURE GRID CARDS — rendered once, each card is an atomic swap       */}
          {/* (never a mid-card text wipe, so dragging the handle can't garble a card)  */}
          {/* ======================================================================== */}
          <div className="absolute left-5 right-5 md:left-6 md:right-6 top-[76px] md:top-[84px] grid grid-cols-3 gap-3 z-20 pointer-events-none">
            {CARD_PAIRS.map((pair, i) => {
              const cardBoundary = ((i + 0.5) / CARD_PAIRS.length) * 100;
              const showLeft = sliderPosition > cardBoundary;
              const card = showLeft ? pair.left : pair.right;
              return (
                <div
                  key={i}
                  className={`rounded-xl p-3 space-y-1.5 ${
                    showLeft
                      ? "bg-[#121620] border border-dashed border-red-500/30"
                      : "bg-[#0D131F] border border-[#14B8A6]/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-semibold text-xs ${showLeft ? "text-slate-200" : "text-white"}`}
                    >
                      {card.title}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        showLeft ? "text-red-400 bg-red-950/40" : `${card.tagColor} ${card.tagBg}`
                      }`}
                    >
                      {card.tag}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-snug">{card.detail}</p>
                  <div
                    className={`flex items-center gap-1 text-[10px] font-mono ${
                      showLeft ? "text-red-400" : card.tagColor
                    }`}
                  >
                    {showLeft ? (
                      <XCircle className="w-3 h-3" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3" />
                    )}{" "}
                    {card.status}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ======================================================================== */}
          {/* SLIDER VERTICAL HANDLE LINE & DRAG BUTTON                                 */}
          {/* ======================================================================== */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-[#14B8A6] cursor-ew-resize z-30 shadow-[0_0_15px_#14B8A6]"
            style={{ left: `${sliderPosition}%` }}
          >
            {/* Draggable Knob */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#0B0F17] border-2 border-[#14B8A6] text-[#14B8A6] flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-transform">
              <span className="font-bold text-xs tracking-tighter">:::</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
