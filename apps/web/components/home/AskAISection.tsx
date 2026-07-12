"use client";

import { sanitizeHtml } from "@/lib/sanitizeHtml";

export function AskAISection() {
  const items = [
    {
      name: "Gemini",
      url: "https://gemini.google.com/app?q=Explain+RakshEx+(rakshex.in)+to+a+security+engineer.+Cover+API+security+scanning,+LLM+cost+monitoring,+prompt+injection+blocking,+and+compliance+reporting.+Summarize+from+https://rakshex.in",
      svg: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8">
          <path d="M12 3v4M12 17v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M3 12h4M17 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      `,
    },
    {
      name: "ChatGPT",
      url: "https://chat.openai.com?q=Explain+RakshEx+(rakshex.in)+to+a+security+engineer.+Cover+API+security+scanning,+LLM+cost+monitoring,+prompt+injection+blocking,+and+compliance+reporting.+Summarize+from+https://rakshex.in",
      svg: `
        <svg viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8">
          <path d="M22.28 9.82a6 6 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9 6.07 6.07 0 0 0-10.27 2.17 6 6 0 0 0-4 2.9 6.05 6.05 0 0 0 .74 7.1 6 6 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.51 2.9 6.07 6.07 0 0 0 10.27-2.17 6 6 0 0 0 4-2.9 6.05 6.05 0 0 0-.74-7.1zm-9.02 12.61a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76c.25-.14.39-.42.39-.68v-6.74l2.02 1.17c.02.01.03.03.04.05v5.58a4.5 4.5 0 0 1-4.49 4.49zm-9.66-4.13a4.47 4.47 0 0 1-.53-3.01l.14.09 4.78 2.76c.24.14.54.14.78 0l5.84-3.37v2.33c0 .02-.01.05-.03.06l-4.83 2.79a4.5 4.5 0 0 1-6.14-1.65zM2.34 7.9a4.49 4.49 0 0 1 2.37-1.97v5.68c0 .26.14.53.39.68l5.81 3.35-2.02 1.17a.08.08 0 0 1-.07 0L4 14.03a4.5 4.5 0 0 1-1.66-6.13zm16.6 3.86l-5.84-3.37 2.02-1.17a.08.08 0 0 1 .07 0l4.83 2.79a4.49 4.49 0 0 1-.68 8.1v-5.68a.79.79 0 0 0-.41-.67zM19.92 6a4.49 4.49 0 0 1 .68 4.66l-2.02-1.17c-.25-.14-.54-.14-.78 0L12 12.86v-2.33c0-.02.01-.05.03-.06l4.83-2.79a4.5 4.5 0 0 1 3.06-1.68zM8.31 12.86l-2.02-1.16a.08.08 0 0 1-.04-.06V6.07a4.5 4.5 0 0 1 7.38-3.45l-.14.08-4.78 2.76c-.25.14-.39.42-.39.68v6.72zm1.1-2.37l2.6-1.5 2.61 1.5v3l-2.6 1.5-2.61-1.5v-3z" />
        </svg>
      `,
    },
    {
      name: "Claude",
      url: "https://claude.ai/new?q=Explain+RakshEx+(rakshex.in)+to+a+security+engineer.+Cover+API+security+scanning,+LLM+cost+monitoring,+prompt+injection+blocking,+and+compliance+reporting.+Summarize+from+https://rakshex.in",
      svg: `
        <svg viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8">
          <path d="M5.92417 15.2958L9.8575 13.09L9.92417 12.8983L9.8575 12.7917H9.66667L9.00833 12.7517L6.76 12.6908L4.81083 12.61L2.9225 12.5083L2.44667 12.4075L2 11.82L2.04583 11.5267L2.44583 11.2592L3.0175 11.3092L4.28417 11.395L6.1825 11.5267L7.55917 11.6075L9.6 11.82H9.92417L9.97 11.6892L9.85833 11.6075L9.7725 11.5267L7.8075 10.1967L5.68083 8.79L4.5675 7.98L3.96417 7.57083L3.66083 7.18583L3.52917 6.34583L4.07583 5.74417L4.81 5.79417L4.9975 5.845L5.74167 6.41667L7.33167 7.64667L9.4075 9.17417L9.71167 9.4275L9.8325 9.34167L9.84833 9.28083L9.71167 9.0525L8.5825 7.01417L7.3775 4.93917L6.84083 4.07917L6.69917 3.56333C6.64519 3.36521 6.61608 3.16114 6.6125 2.95583L7.23583 2.11167L7.58 2L8.41 2.11167L8.76 2.415L9.27667 3.59333L10.1117 5.45083L11.4075 7.97583L11.7875 8.72417L11.99 9.4175L12.0658 9.63H12.1975V9.50833L12.3042 8.08667L12.5017 6.34083L12.6933 4.095L12.76 3.46167L13.0733 2.70333L13.6958 2.29333L14.1825 2.52667L14.5825 3.0975L14.5267 3.4675L14.2883 5.01L13.8225 7.42917L13.5192 9.0475H13.6958L13.8983 8.84583L14.7192 7.7575L16.0958 6.0375L16.7042 5.35417L17.4125 4.60083L17.8683 4.24167H18.7292L19.3625 5.1825L19.0792 6.15417L18.1925 7.27667L17.4583 8.22833L16.405 9.645L15.7467 10.7783L15.8075 10.87L15.9642 10.8533L18.3442 10.3483L19.63 10.115L21.1642 9.8525L21.8583 10.1758L21.9342 10.505L21.6608 11.1775L20.02 11.5825L18.0958 11.9675L15.23 12.645L15.195 12.67L15.2358 12.7208L16.5267 12.8425L17.0783 12.8725H18.43L20.9467 13.06L21.605 13.495L22 14.0267L21.9342 14.4308L20.9217 14.9475L19.555 14.6233L16.3642 13.865L15.2708 13.5908H15.1192V13.6825L16.03 14.5725L17.7017 16.0808L19.7925 18.0225L19.8983 18.5042L19.63 18.8833L19.3467 18.8425L17.5092 17.4617L16.8 16.8392L15.195 15.4892H15.0883V15.6308L15.4583 16.1717L17.4125 19.1058L17.5142 20.0058L17.3725 20.3L16.8658 20.4775L16.3092 20.3758L15.1642 18.7717L13.985 16.9658L13.0325 15.3467L12.9158 15.4133L12.3542 21.4583L12.0908 21.7667L11.4833 22L10.9775 21.6158L10.7092 20.9933L10.9775 19.7633L11.3017 18.16L11.5642 16.885L11.8025 15.3017L11.9442 14.775L11.9342 14.74L11.8175 14.755L10.6225 16.3942L8.80583 18.8483L7.3675 20.3858L7.0225 20.5225L6.425 20.2142L6.48083 19.6625L6.815 19.1717L8.805 16.6417L10.005 15.0733L10.78 14.1683L10.775 14.0367H10.7292L5.44333 17.4667L4.50167 17.5883L4.09583 17.2083L4.14667 16.5867L4.33917 16.3842L5.92917 15.2908L5.92417 15.2958Z" />
        </svg>
      `,
    },
    {
      name: "Grok",
      url: "https://grok.com?q=Explain+RakshEx+(rakshex.in)+to+a+security+engineer.",
      svg: `
        <svg viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      `,
    },
    {
      name: "Perplexity",
      url: "https://perplexity.ai?q=Explain+RakshEx+(rakshex.in)+to+a+security+engineer.",
      svg: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8">
          <path d="M12 2v20M2 12h20M5.64 5.64l12.72 12.72M5.64 18.36L12 12M12 12l6.36-6.36" />
        </svg>
      `,
    },
  ];

  return (
    <section
      id="deeplink"
      className="w-full max-w-[1280px] mx-auto px-6 py-24 border-b border-[#1A1F2E] select-none bg-transparent"
    >
      <div className="flex flex-col items-center justify-center gap-6">
        <h2 className="text-[32px] leading-tight font-bold font-sans text-center text-white tracking-[-0.02em]">
          What's RakshEx? Ask AI.
        </h2>
        <p className="text-neutral-400 text-sm font-sans tracking-wide text-center -mt-3">
          Get an instant explanation from your preferred AI.
        </p>
        <div className="flex flex-row flex-wrap items-center justify-center gap-10 mt-4">
          {items.map((item, idx) => (
            <a
              key={idx}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-block text-neutral-400 hover:text-white transition-all duration-200"
              title={`Ask ${item.name}`}
            >
              <div
                className="opacity-60 group-hover:opacity-100 transition-all duration-200"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.svg) }}
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
