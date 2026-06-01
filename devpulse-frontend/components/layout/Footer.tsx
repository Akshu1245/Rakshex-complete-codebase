"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full bg-transparent py-10 border-t border-white/8 z-5 relative select-none">
      <div className="min-h-[112px] max-w-[1280px] mx-auto px-6 sm:px-10 flex flex-col justify-between gap-y-10">
        {/* Top Grid / Row */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
          {/* Left Side: Logo + Vertical Line + Social Icons */}
          <div className="flex flex-col items-start justify-between">
            <div className="flex flex-row flex-wrap items-center gap-x-6 gap-y-4">
              <Link className="flex items-center gap-2 no-underline shrink-0" href="/">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-6 h-6 text-[#06b6d4] shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  <span className="text-xl font-bold font-manrope tracking-tight text-white">
                    RakshEx
                  </span>
                </div>
              </Link>

              <div className="hidden sm:block w-px h-6 bg-[#414141]"></div>

              {/* Social links */}
              <div className="flex flex-row gap-4 items-center justify-start text-neutral-400">
                {/* Discord */}
                <a
                  aria-label="Click to visit RakshEx's discord page"
                  className="flex items-center justify-center cursor-pointer hover:text-white transition-colors duration-200"
                  href="https://discord.gg/rakshex"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <svg
                    fill="currentColor"
                    height="20"
                    width="20"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                  >
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.11 18.1.128 18.116a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                  </svg>
                </a>

                {/* GitHub */}
                <a
                  aria-label="Click to visit RakshEx's github page"
                  className="flex items-center justify-center cursor-pointer hover:text-white transition-colors duration-200"
                  href="https://github.com/rakshex-hq"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <svg
                    fill="currentColor"
                    height="20"
                    width="20"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                    />
                  </svg>
                </a>

                {/* Twitter */}
                <a
                  aria-label="Click to visit RakshEx's x page"
                  className="flex items-center justify-center cursor-pointer hover:text-white transition-colors duration-200"
                  href="https://twitter.com/rakshexhq"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <svg
                    fill="currentColor"
                    height="20"
                    width="20"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Right Side: Links Row (Blog | Docs | Pricing | Contact | Privacy Policy | Terms | Trust Center) */}
          <div className="flex flex-wrap justify-start gap-x-8 gap-y-4 sm:gap-x-10 lg:justify-end xl:gap-x-12">
            <Link
              href="/blog"
              className="w-fit shrink-0 whitespace-nowrap text-base text-neutral-400 hover:text-white transition-all duration-200 font-manrope relative hover:text-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
            >
              Blog
            </Link>
            <Link
              href="/docs"
              className="w-fit shrink-0 whitespace-nowrap text-base text-neutral-400 hover:text-white transition-all duration-200 font-manrope relative hover:text-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
            >
              Docs
            </Link>
            <Link
              href="/pricing"
              className="w-fit shrink-0 whitespace-nowrap text-base text-neutral-400 hover:text-white transition-all duration-200 font-manrope relative hover:text-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
            >
              Pricing
            </Link>
            <a
              href="mailto:akshay@rakshex.in"
              className="w-fit shrink-0 whitespace-nowrap text-base text-neutral-400 hover:text-white transition-all duration-200 font-manrope relative hover:text-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
            >
              Contact
            </a>
            <Link
              href="/privacy"
              className="w-fit shrink-0 whitespace-nowrap text-base text-neutral-400 hover:text-white transition-all duration-200 font-manrope relative hover:text-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="w-fit shrink-0 whitespace-nowrap text-base text-neutral-400 hover:text-white transition-all duration-200 font-manrope relative hover:text-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
            >
              Terms &amp; Conditions
            </Link>
            <Link
              href="/trust"
              className="w-fit shrink-0 whitespace-nowrap text-base text-neutral-400 hover:text-white transition-all duration-200 font-manrope relative hover:text-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
            >
              Trust Center
            </Link>
          </div>
        </div>

        {/* Bottom Section: Operational dot and copyright */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-white/8 pt-6">
          <p className="text-sm font-normal text-neutral-400 font-manrope text-left order-2 md:order-1">
            © 2026 RakshEx by Rashi Technologies. Bengaluru, India.
          </p>
          <Link
            href="/status"
            className="flex items-center gap-2 text-sm text-neutral-400 font-manrope hover:text-white transition-colors duration-200 order-1 md:order-2 w-fit"
          >
            <span className="w-2 h-2 rounded-full bg-[#14B8A6] animate-pulse" />
            <span>All systems operational</span>
          </Link>
        </div>
      </div>
    </footer>
  );
}
