interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

function LogoMark({ size, className }: { size: number; className: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M16 2.9 27.2 9.4v13.2L16 29.1 4.8 22.6V9.4L16 2.9Z"
        fill="#07110F"
        stroke="#14B8A6"
        strokeWidth="1.6"
      />
      <path
        d="M10.1 9.7h6.6c3.1 0 5 1.6 5 4.3 0 1.8-.9 3.2-2.6 3.9l3.2 4.4h-3.7l-2.8-3.9h-2.5v3.9h-3.2V9.7Zm3.2 2.7v3.3h3.1c1.3 0 2-.6 2-1.7 0-1-.7-1.6-2-1.6h-3.1Z"
        fill="#E9FFFC"
      />
      <circle cx="24.4" cy="8.1" r="1.35" fill="#14B8A6" />
    </svg>
  );
}

export function RaksHexLogo({ className = "h-8 w-8", size = 32, showText = true }: LogoProps) {
  return (
    <div className="flex select-none items-center gap-2.5">
      <LogoMark size={size} className={`shrink-0 ${className}`} />
      {showText && (
        <span className="flex items-center text-xl font-extrabold tracking-[-0.035em] text-white">
          Raks<span className="text-[#14B8A6]">Hex</span>
        </span>
      )}
    </div>
  );
}

export function RaksHexIcon({
  size = 24,
  className = "h-6 w-6",
}: {
  size?: number;
  className?: string;
}) {
  return <LogoMark size={size} className={className} />;
}
