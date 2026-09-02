interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

const MARK_BODY =
  "M68 50 L57 62 L48 81 L47 106 L53 124 L58 132 L180 255 L62 374 L57 382 L50 403 L50 421 L55 438 L63 452 L73 462 L82 468 L102 475 L126 476 L146 471 L165 461 L274 380 L293 368 L398 474 L450 474 L345 368 L341 362 L465 236 L415 236 L323 331 L315 337 L147 168 L89 112 L84 101 L84 93 L88 84 L96 77 L105 74 L306 74 L323 79 L336 87 L345 96 L354 111 L358 125 L358 144 L354 159 L345 175 L284 240 L309 265 L375 197 L386 181 L392 168 L398 142 L397 117 L389 91 L375 69 L363 57 L345 45 L327 38 L310 35 L104 35 L87 39 Z M266 341 L259 348 L146 431 L137 436 L127 439 L104 438 L95 433 L87 423 L85 409 L88 398 L92 392 L205 279 Z";
const MARK_DOT =
  "M258 139 L247 147 L243 157 L244 166 L252 177 L259 180 L270 180 L279 175 L283 170 L285 165 L285 154 L277 142 L265 138 Z";

function LogoMark({ size, className }: { size: number; className: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={MARK_BODY} fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
      <path d={MARK_DOT} fill="currentColor" />
    </svg>
  );
}

export function RaksHexLogo({
  className = "h-8 w-8 text-white",
  size = 32,
  showText = false,
}: LogoProps) {
  return (
    <div className="flex select-none items-center gap-2.5">
      <LogoMark size={size} className={`shrink-0 text-white ${className}`} />
      {showText && (
        <span className="text-xl font-extrabold tracking-[-0.035em] text-white">RaksHex</span>
      )}
    </div>
  );
}

export function RaksHexIcon({
  size = 24,
  className = "h-6 w-6 text-white",
}: {
  size?: number;
  className?: string;
}) {
  return <LogoMark size={size} className={className} />;
}
