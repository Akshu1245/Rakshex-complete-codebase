"use client";

import React from "react";

interface Tweet {
  handle: string;
  name: string;
  avatarGradient: string;
  text: string;
  date: string;
}

const tweets: Tweet[] = [
  {
    handle: "@devesh_k_r",
    name: "Devesh K. R.",
    avatarGradient: "from-teal-500 to-cyan-500",
    text: "@rakshexhq found a production OpenAI key in our test collection.\nOne that was about to go live. Not a drill.",
    date: "May 2026",
  },
  {
    handle: "@aarti_builds",
    name: "Aarti S.",
    avatarGradient: "from-purple-500 to-indigo-500",
    text: "The @rakshexhq kill switch tripped automatically on a runaway agent loop.\nSaved us ~$8K. This feature alone is worth it.",
    date: "May 2026",
  },
  {
    handle: "@siddharth_swe",
    name: "Siddharth",
    avatarGradient: "from-orange-500 to-red-500",
    text: "SOC2 evidence prep used to be 3 days of pain. @rakshexhq generates\nthe bundle in one click. Our auditor was genuinely confused.",
    date: "May 2026",
  },
  {
    handle: "@priya_appsec",
    name: "Priya M.",
    avatarGradient: "from-emerald-500 to-green-500",
    text: "Thinking token attribution from @rakshexhq is wild. 40% of our Claude\nbill was reasoning tokens from a single misconfigured endpoint.",
    date: "April 2026",
  },
  {
    handle: "@nikhil_founder",
    name: "Nikhil",
    avatarGradient: "from-blue-500 to-purple-500",
    text: "@rakshexhq in GitHub Actions is a no-brainer. Every PR gets security\nscore + cost delta in USD and INR. Team loves it.",
    date: "April 2026",
  },
  {
    handle: "@arjun_fintech",
    name: "Arjun",
    avatarGradient: "from-pink-500 to-rose-500",
    text: "Shadow API discovery found 7 forgotten endpoints. Two had zero auth.\n@rakshexhq is now mandatory before every release.",
    date: "April 2026",
  },
  {
    handle: "@meera_devops",
    name: "Meera",
    avatarGradient: "from-yellow-500 to-amber-500",
    text: "Deployed @rakshexhq in 4 minutes. No config. Scanned 340 endpoints.\nFound a JWT secret we had no idea existed.",
    date: "March 2026",
  },
  {
    handle: "@rohan_ml",
    name: "Rohan",
    avatarGradient: "from-cyan-500 to-blue-500",
    text: "The MCP governance layer from @rakshexhq is exactly what AI agent\nsecurity needed. Nothing else does this.",
    date: "March 2026",
  },
];

export function TestimonialsSection() {
  // Let's divide them into 4 columns of 2 cards each:
  const columns = [
    [tweets[0], tweets[4]],
    [tweets[1], tweets[5]],
    [tweets[2], tweets[6]],
    [tweets[3], tweets[7]],
  ];

  return (
    <section className="w-full flex flex-col items-center gap-10 pt-20 pb-16 bg-transparent">
      <div className="max-w-[1280px] mx-auto px-6 flex flex-col items-center gap-10 w-full">
        {/* Title and description */}
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-[32px] leading-10 font-bold text-white font-manrope">
            Join our Community
          </h2>
          <p className="text-lg leading-7 font-normal text-neutral-400 font-manrope max-w-xl">
            See what developers and security engineers are saying about RakshEx
          </p>
        </div>

        {/* GitHub & Discord Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            aria-label="Click to visit RakshEx GitHub discussions"
            className="w-48 h-11 flex items-center gap-2.5 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 rounded transition-all duration-200 border border-[#414141] hover:border-neutral-600 justify-center group"
            href="https://github.com/rakshex-hq/rakshex"
            rel="noopener noreferrer"
            target="_blank"
          >
            <svg
              className="text-neutral-400 group-hover:text-white transition-colors"
              fill="none"
              height="20"
              viewBox="0 0 20 20"
              width="20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g clipPath="url(#github_svg__a)">
                <path
                  clipRule="evenodd"
                  d="M10 0c5.523 0 10 4.59 10 10.253 0 4.529-2.862 8.371-6.833 9.728-.507.101-.687-.22-.687-.492 0-.338.012-1.442.012-2.814 0-.956-.32-1.58-.679-1.898 2.227-.254 4.567-1.121 4.567-5.06 0-1.12-.388-2.033-1.03-2.751.104-.26.447-1.302-.098-2.714 0 0-.838-.275-2.747 1.051A9.4 9.4 0 0 0 10 4.958a9.4 9.4 0 0 0-2.503.345C5.586 3.977 4.746 4.252 4.746 4.252c-.543 1.412-.2 2.455-.097 2.714-.639.718-1.03 1.632-1.03 2.752 0 3.928 2.335 4.808 4.556 5.067-.286.256-.545.708-.635 1.37-.57.263-2.018.716-2.91-.85 0 0-.529-.986-1.533-1.058 0 0-.975-.013-.068.623 0 0 .655.315 1.11 1.5 0 0 .587 1.83 3.369 1.21.005.857.014 1.665.014 1.909 0 .27-.184.588-.683.493C2.865 18.627 0 14.782 0 10.252 0 4.59 4.478 0 10 0"
                  fill="currentColor"
                  fillRule="evenodd"
                ></path>
              </g>
              <defs>
                <clipPath id="github_svg__a">
                  <path d="M0 0h20v20H0z" fill="currentColor"></path>
                </clipPath>
              </defs>
            </svg>
            <span className="text-neutral-300 group-hover:text-white text-sm font-medium font-manrope">
              GitHub Discussion
            </span>
          </a>

          <a
            aria-label="Click to join RakshEx Discord"
            className="w-48 h-11 flex items-center gap-2.5 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 rounded transition-all duration-200 border border-[#414141] hover:border-neutral-600 justify-center group"
            href="https://discord.gg/rakshex"
            rel="noopener noreferrer"
            target="_blank"
          >
            <svg
              className="text-neutral-400 group-hover:text-white transition-colors"
              fill="none"
              height="20"
              width="20"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
            >
              <path
                d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.11 18.1.128 18.116a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"
                fill="currentColor"
              ></path>
            </svg>
            <span className="text-neutral-300 group-hover:text-white text-sm font-medium font-manrope">
              Join Discord
            </span>
          </a>
        </div>

        {/* Twitter/X style cards in masonry grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-stretch w-full mt-6">
          {columns.map((column, colIdx) => (
            <div key={colIdx} className="flex flex-col gap-3 h-full">
              {column.map((tweet, idx) => (
                <article
                  key={idx}
                  className="relative flex flex-col gap-3.5 px-6 py-5 bg-transparent border border-white/10 rounded transition-colors hover:bg-white/5 text-left"
                >
                  {/* Invisible Link covering the card */}
                  <a
                    aria-label={`View post by ${tweet.name}`}
                    className="absolute inset-0 z-0 rounded"
                    href={`https://x.com/${tweet.handle.slice(1)}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  ></a>

                  {/* Header: User Info */}
                  <div className="flex items-center gap-3">
                    <div className="relative z-10 w-9 h-9 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-xs bg-gradient-to-br text-white shadow-inner select-none uppercase tracking-wider">
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${tweet.avatarGradient} opacity-90`}
                      />
                      <span className="relative z-10">
                        {tweet.name
                          .split(" ")
                          .map((w) => w[0])
                          .join("")}
                      </span>
                    </div>
                    <div className="flex flex-col justify-center min-w-0">
                      <span className="text-white font-semibold text-sm leading-tight truncate">
                        {tweet.name}
                      </span>
                      <span className="text-neutral-500 font-medium text-xs leading-none mt-0.5 truncate hover:underline relative z-10">
                        {tweet.handle}
                      </span>
                    </div>
                  </div>

                  {/* Body: Tweet text */}
                  <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed font-manrope whitespace-pre-line relative z-10 flex-grow">
                    {tweet.text}
                  </p>

                  {/* Footer: Date */}
                  <span className="text-[10px] text-neutral-500 font-mono mt-auto relative z-10">
                    {tweet.date}
                  </span>
                </article>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
