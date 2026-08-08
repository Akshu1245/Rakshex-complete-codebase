"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Shield,
  Zap,
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  XCircle,
  Sliders,
  Cpu,
  Server,
} from "lucide-react";

export function ArchitectureCompareSlider() {
  const [sliderPosition, setSliderPosition] = useState<number>(50); // percentage 0-100
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

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

  const innerWidthStyle = containerWidth ? { width: `${containerWidth}px` } : { width: "100%" };

  return (
    <section
      id="architecture-slider"
      className="w-full py-12 px-4 md:px-8 bg-[#090D14] relative overflow-hidden"
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
          {/* RIGHT PANEL (RAKSHEX ARCHITECTURE - FULL WIDTH UNDERNEATH)              */}
          {/* ======================================================================== */}
          <div className="absolute inset-0 bg-[#060A10] p-5 md:p-6 flex flex-col justify-between z-0">
            {/* Panel Badge */}
            <div className="flex items-center justify-between border-b border-[#14B8A6]/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#14B8A6]/10 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6]">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm md:text-base font-sans flex items-center gap-2">
                    RaksHex Agent Firewall
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#14B8A6]/20 text-[#14B8A6] font-mono border border-[#14B8A6]/30 uppercase">
                      Action-Level
                    </span>
                  </h3>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-[#14B8A6] font-mono bg-[#14B8A6]/5 px-2.5 py-1 rounded-md border border-[#14B8A6]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6] animate-pulse" />
                Enforcement Active
              </div>
            </div>

            {/* Architecture Grid Cards (RaksHex) */}
            <div className="grid grid-cols-3 gap-3 my-2">
              {/* Card 1 */}
              <div className="bg-[#0D131F] border border-[#14B8A6]/30 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold text-xs">Delegated Authority</span>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded">
                    Active
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-snug">
                  Parent-to-child attenuation — a child authority can never exceed its parent&apos;s
                  scope.
                </p>
                <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                  <CheckCircle2 className="w-3 h-3" /> Enforced
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-[#0D131F] border border-[#14B8A6]/30 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold text-xs">Credential Mediation</span>
                  <span className="text-[9px] font-mono text-teal-400 bg-teal-950/50 px-1.5 py-0.5 rounded">
                    Broker
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-snug">
                  A DENY blocks the credential itself — the secret never reaches a denied caller.
                </p>
                <div className="flex items-center gap-1 text-[10px] text-teal-400 font-mono">
                  <CheckCircle2 className="w-3 h-3" /> Fail-closed
                </div>
              </div>

              {/* Card 3 */}
              <div className="bg-[#0D131F] border border-[#14B8A6]/30 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold text-xs">Action Ledger</span>
                  <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/50 px-1.5 py-0.5 rounded">
                    Hash-chained
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-snug">
                  Every decision is recorded tamper-evidently for audit and dispute resolution.
                </p>
                <div className="flex items-center gap-1 text-[10px] text-cyan-400 font-mono">
                  <CheckCircle2 className="w-3 h-3" /> Tamper-evident
                </div>
              </div>
            </div>

            {/* Bottom Footer Info */}
            <div className="border-t border-[#14B8A6]/10 pt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span className="text-[#14B8A6] flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5" /> Semantic action authorization
              </span>
              <span>Enforced at the credential</span>
            </div>
          </div>

          {/* ======================================================================== */}
          {/* LEFT PANEL (SELF-MANAGED ARCHITECTURE - CLIPPED VIA SLIDER PERCENTAGE)    */}
          {/* ======================================================================== */}
          <div
            className="absolute inset-y-0 left-0 bg-[#090C12] overflow-hidden border-r-2 border-red-500 z-10 shadow-2xl"
            style={{ width: `${sliderPosition}%` }}
          >
            <div
              className="absolute top-0 left-0 h-full p-5 md:p-6 flex flex-col justify-between bg-[#090C12]"
              style={innerWidthStyle}
            >
              {/* Panel Badge */}
              <div className="flex items-center justify-between border-b border-red-500/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-red-950/40 border border-red-500/30 flex items-center justify-center text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm md:text-base font-sans flex items-center gap-2">
                      Session-Level Access
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-950 text-red-400 font-mono border border-red-500/30 uppercase">
                        Coarse-Grained
                      </span>
                    </h3>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-red-400 font-mono bg-red-950/30 px-2.5 py-1 rounded-md border border-red-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                  Advisory Only
                </div>
              </div>

              {/* Architecture Grid Cards (Session-level) */}
              <div className="grid grid-cols-3 gap-3 my-2">
                {/* Card 1 */}
                <div className="bg-[#121620] border border-dashed border-red-500/30 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-200 font-semibold text-xs">
                      All-or-Nothing Scopes
                    </span>
                    <span className="text-[9px] font-mono text-red-400 bg-red-950/40 px-1.5 py-0.5 rounded">
                      No Attenuation
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-snug">
                    A valid session can call any action the API key can reach.
                  </p>
                  <div className="flex items-center gap-1 text-[10px] text-red-400 font-mono">
                    <XCircle className="w-3 h-3" /> Broad Blast Radius
                  </div>
                </div>

                {/* Card 2 */}
                <div className="bg-[#121620] border border-dashed border-red-500/30 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-200 font-semibold text-xs">Advisory Denials</span>
                    <span className="text-[9px] font-mono text-red-400 bg-red-950/40 px-1.5 py-0.5 rounded">
                      Not Enforced
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-snug">
                    A DENY is logged, but the underlying credential still works.
                  </p>
                  <div className="flex items-center gap-1 text-[10px] text-red-400 font-mono">
                    <XCircle className="w-3 h-3" /> Bypassable
                  </div>
                </div>

                {/* Card 3 */}
                <div className="bg-[#121620] border border-dashed border-red-500/30 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-200 font-semibold text-xs">No Audit Trail</span>
                    <span className="text-[9px] font-mono text-red-400 bg-red-950/40 px-1.5 py-0.5 rounded">
                      Un-tracked
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-snug">
                    No tamper-evident record of which action was authorized and why.
                  </p>
                  <div className="flex items-center gap-1 text-[10px] text-red-400 font-mono">
                    <XCircle className="w-3 h-3" /> Hard to Dispute
                  </div>
                </div>
              </div>

              {/* Bottom Footer Info */}
              <div className="border-t border-red-500/10 pt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span className="text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Session governed, action ungoverned
                </span>
                <span>Enforcement: None</span>
              </div>
            </div>
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
