"use client";

import React from "react";
import Image from "next/image";

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export function RaksHexLogo({ className = "w-7 h-7", size = 28, showText = true }: LogoProps) {
  return (
    <div className="flex items-center gap-2.5 select-none group">
      <div
        className={`relative shrink-0 flex items-center justify-center overflow-hidden rounded-lg border border-[#14B8A6]/30 shadow-[0_0_12px_rgba(20,184,166,0.2)] transition-all duration-300 group-hover:border-[#14B8A6]/60 group-hover:shadow-[0_0_20px_rgba(20,184,166,0.4)] ${className}`}
      >
        <Image
          src="/logo.png"
          alt="RaksHex Logo"
          width={size}
          height={size}
          className="object-cover w-full h-full"
          priority
          unoptimized
        />
      </div>
      {showText && (
        <span className="text-xl font-extrabold font-sans tracking-tight text-white flex items-center">
          Raks<span className="text-[#14B8A6]">Hex</span>
        </span>
      )}
    </div>
  );
}

export function RaksHexIcon({
  size = 24,
  className = "w-6 h-6",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`relative shrink-0 flex items-center justify-center overflow-hidden rounded-lg border border-[#14B8A6]/30 shadow-[0_0_10px_rgba(20,184,166,0.2)] ${className}`}
    >
      <Image
        src="/logo.png"
        alt="RaksHex Icon"
        width={size}
        height={size}
        className="object-cover w-full h-full"
        priority
        unoptimized
      />
    </div>
  );
}
