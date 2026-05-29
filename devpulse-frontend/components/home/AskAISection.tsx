"use client";

export function AskAISection() {
  const items = [
    {
      name: "Gemini",
      url: "https://gemini.google.com/app?q=Explain+RakshEx+(rakshex.in)+to+a+security+engineer.+Cover+API+security+scanning,+LLM+cost+monitoring,+prompt+injection+blocking,+and+compliance+reporting.+Summarize+from+https://rakshex.in",
      svg: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8">
          <!-- Sparkle shape -->
          <path d="M12 3v4M12 17v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M3 12h4M17 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      `,
    },
    {
      name: "ChatGPT",
      url: "https://chat.openai.com?q=Explain+RakshEx+(rakshex.in)+to+a+security+engineer.+Cover+API+security+scanning,+LLM+cost+monitoring,+prompt+injection+blocking,+and+compliance+reporting.+Summarize+from+https://rakshex.in",
      svg: `
        <svg viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8">
          <!-- OpenAI logo shape -->
          <path d="M22.28 9.82a6 6 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9 6.07 6.07 0 0 0-10.27 2.17 6 6 0 0 0-4 2.9 6.05 6.05 0 0 0 .74 7.1 6 6 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.51 2.9 6.07 6.07 0 0 0 10.27-2.17 6 6 0 0 0 4-2.9 6.05 6.05 0 0 0-.74-7.1zm-9.02 12.61a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76c.25-.14.39-.42.39-.68v-6.74l2.02 1.17c.02.01.03.03.04.05v5.58a4.5 4.5 0 0 1-4.49 4.49zm-9.66-4.13a4.47 4.47 0 0 1-.53-3.01l.14.09 4.78 2.76c.24.14.54.14.78 0l5.84-3.37v2.33c0 .02-.01.05-.03.06l-4.83 2.79a4.5 4.5 0 0 1-6.14-1.65zM2.34 7.9a4.49 4.49 0 0 1 2.37-1.97v5.68c0 .26.14.53.39.68l5.81 3.35-2.02 1.17a.08.08 0 0 1-.07 0L4 14.03a4.5 4.5 0 0 1-1.66-6.13zm16.6 3.86l-5.84-3.37 2.02-1.17a.08.08 0 0 1 .07 0l4.83 2.79a4.49 4.49 0 0 1-.68 8.1v-5.68a.79.79 0 0 0-.41-.67zM19.92 6a4.49 4.49 0 0 1 .68 4.66l-2.02-1.17c-.25-.14-.54-.14-.78 0L12 12.86v-2.33c0-.02.01-.05.03-.06l4.83-2.79a4.5 4.5 0 0 1 3.06-1.68zM8.31 12.86l-2.02-1.16a.08.08 0 0 1-.04-.06V6.07a4.5 4.5 0 0 1 7.38-3.45l-.14.08-4.78 2.76c-.25.14-.39.42-.39.68v6.72zm1.1-2.37l2.6-1.5 2.61 1.5v3l-2.6 1.5-2.61-1.5v-3z" />
        </svg>
      `,
    },
    {
      name: "Claude",
      url: "https://claude.ai/new?q=Explain+RakshEx+(rakshex.in)+to+a+security+engineer.+Cover+API+security+scanning,+LLM+cost+monitoring,+prompt+injection+blocking,+and+compliance+reporting.+Summarize+from+https://rakshex.in",
      svg: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8">
          <!-- Anthropic logo representation -->
          <path d="M12 3v18M3 12h18M12 3l9 9-9 9-9-9 9-9z" />
        </svg>
      `,
    },
    {
      name: "Grok",
      url: "https://grok.com?q=Explain+RakshEx+(rakshex.in)+to+a+security+engineer.+Cover+API+security+scanning,+LLM+cost+monitoring,+prompt+injection+blocking,+and+compliance+reporting.+Summarize+from+https://rakshex.in",
      svg: `
        <svg viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8">
          <!-- X / Grok logo representation -->
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      `,
    },
    {
      name: "Perplexity",
      url: "https://perplexity.ai?q=Explain+RakshEx+(rakshex.in)+to+a+security+engineer.+Cover+API+security+scanning,+LLM+cost+monitoring,+prompt+injection+blocking,+and+compliance+reporting.+Summarize+from+https://rakshex.in",
      svg: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8">
          <!-- Star/Asterisk shape -->
          <path d="M12 2v20M2 12h20M5.64 5.64l12.72 12.72M5.64 18.36L12 12M12 12l6.36-6.36" />
        </svg>
      `,
    },
  ];

  return (
    <section
      id="deeplink"
      className="w-full max-w-[1280px] mx-auto px-6 py-24 border-b border-neutral-900 select-none bg-transparent"
    >
      <div className="flex flex-col items-center justify-center gap-8">
        <h2 className="text-[32px] leading-[1.2] font-normal text-center font-manrope text-white">
          What's RakshEx? Ask AI
        </h2>
        <div className="flex flex-row flex-wrap items-center justify-center gap-10">
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
                dangerouslySetInnerHTML={{ __html: item.svg }}
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
