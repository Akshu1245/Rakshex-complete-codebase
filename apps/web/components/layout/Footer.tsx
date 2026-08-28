import Link from "next/link";
import { ExternalLink, Github, Mail } from "lucide-react";
import { RaksHexLogo } from "@/components/common/RaksHexLogo";

const VSCODE_URL =
  "https://marketplace.visualstudio.com/items?itemName=rakshex.rakshex-vscode";
const GITHUB_URL = "https://github.com/Akshu1245/Rakshex-complete-codebase";

export function Footer() {
  return (
    <footer className="relative w-full border-t border-white/[0.08] bg-[#070A0F]/70 py-12">
      <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-6 xl:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.35fr_repeat(3,0.75fr)]">
          <div className="max-w-sm">
            <Link href="/" className="inline-flex no-underline" aria-label="RaksHex home">
              <RaksHexLogo size={30} />
            </Link>
            <p className="mt-4 text-sm leading-6 text-neutral-500">
              The AI Action Control Plane for teams that need to authorize consequential agent
              actions before execution and keep verifiable evidence afterward.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 px-3 text-xs font-medium text-neutral-300 no-underline hover:border-white/20 hover:text-white"
              >
                <Github className="h-4 w-4" aria-hidden="true" /> GitHub
              </a>
              <a
                href={VSCODE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 px-3 text-xs font-medium text-neutral-300 no-underline hover:border-white/20 hover:text-white"
              >
                VS Code <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>

          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              Product
            </p>
            <div className="mt-4 flex flex-col gap-3 text-sm">
              <Link href="/overview" className="w-fit text-neutral-400 no-underline hover:text-white">
                Overview
              </Link>
              <Link href="/demo" className="w-fit text-neutral-400 no-underline hover:text-white">
                Public demo
              </Link>
              <Link href="/pricing" className="w-fit text-neutral-400 no-underline hover:text-white">
                Pricing
              </Link>
              <Link href="/changelog" className="w-fit text-neutral-400 no-underline hover:text-white">
                Changelog
              </Link>
            </div>
          </div>

          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              Developers
            </p>
            <div className="mt-4 flex flex-col gap-3 text-sm">
              <Link href="/docs" className="w-fit text-neutral-400 no-underline hover:text-white">
                Documentation
              </Link>
              <Link href="/docs/agent-firewall" className="w-fit text-neutral-400 no-underline hover:text-white">
                Agent Firewall
              </Link>
              <a
                href={VSCODE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1.5 text-neutral-400 no-underline hover:text-white"
              >
                VS Code extension <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1.5 text-neutral-400 no-underline hover:text-white"
              >
                Source repository <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
          </div>

          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              Trust
            </p>
            <div className="mt-4 flex flex-col gap-3 text-sm">
              <Link href="/trust" className="w-fit text-neutral-400 no-underline hover:text-white">
                Trust Center
              </Link>
              <Link href="/privacy" className="w-fit text-neutral-400 no-underline hover:text-white">
                Privacy
              </Link>
              <Link href="/terms" className="w-fit text-neutral-400 no-underline hover:text-white">
                Terms
              </Link>
              <Link href="/legal/dpa" className="w-fit text-neutral-400 no-underline hover:text-white">
                DPA
              </Link>
              <Link href="/legal/refund" className="w-fit text-neutral-400 no-underline hover:text-white">
                Refund policy
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/[0.08] pt-6 text-sm text-neutral-500 md:flex-row md:items-center md:justify-between">
          <p>© 2026 RaksHex by Rashi Technologies. Bengaluru, India.</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a
              href="mailto:akshay@rakshex.in"
              className="inline-flex items-center gap-1.5 text-neutral-400 no-underline hover:text-white"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden="true" /> akshay@rakshex.in
            </a>
            <Link href="/status" className="inline-flex items-center gap-2 text-neutral-400 no-underline hover:text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-[#14B8A6]" aria-hidden="true" />
              Service status
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
