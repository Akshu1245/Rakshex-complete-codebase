"use client";

export function TestimonialsSection() {
  return (
    <section className="relative w-full max-w-[1280px] mx-auto py-20 px-6 xl:px-8 bg-transparent">
      <div className="flex flex-col items-center gap-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Trusted by developers</h2>
        <p className="text-[#9CA3AF] text-sm">
          Real metrics from open-source distribution channels
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a href="https://www.npmjs.com/package/rakshex" target="_blank" rel="noopener noreferrer">
            <img
              src="https://img.shields.io/npm/dm/rakshex?style=for-the-badge&logo=npm&color=14B8A6&labelColor=1A1F2E"
              alt="npm downloads"
              className="h-8"
            />
          </a>
          <a
            href="https://marketplace.visualstudio.com/items?itemName=rakshex.rakshex-vscode"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src="https://img.shields.io/visual-studio-marketplace/i/rakshex.rakshex-vscode?style=for-the-badge&logo=visual-studio-code&color=14B8A6&labelColor=1A1F2E"
              alt="VS Code installs"
              className="h-8"
            />
          </a>
          <a
            href="https://github.com/Akshu1245/devpulse-complete-codebase"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src="https://img.shields.io/github/stars/Akshu1245/devpulse-complete-codebase?style=for-the-badge&logo=github&color=14B8A6&labelColor=1A1F2E"
              alt="GitHub stars"
              className="h-8"
            />
          </a>
        </div>
      </div>
    </section>
  );
}
