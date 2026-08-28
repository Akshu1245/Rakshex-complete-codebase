import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { HeroSection } from "@/components/home/HeroSection";
import { FeatureCards } from "@/components/home/FeatureCards";
import { PublicHeader } from "@/components/PublicHeader";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/lib/animations/countdown", () => ({
  useCountdown: () => ({ days: 0, hours: 0, minutes: 0, seconds: 0 }),
}));

vi.mock("@/lib/animations/megamenu", () => ({
  useMegaMenu: () => ({
    activeMenu: null,
    handleMouseEnter: () => undefined,
    handleMouseLeave: () => undefined,
    forceClose: () => undefined,
  }),
}));

const homepageDir = path.resolve(__dirname, "../components/home");
const homepageFiles = [
  path.resolve(__dirname, "../app/page.tsx"),
  path.resolve(__dirname, "../app/HomePageClient.tsx"),
  path.resolve(__dirname, "../app/layout.tsx"),
  path.resolve(__dirname, "../app/overview/page.tsx"),
  path.join(homepageDir, "HeroSection.tsx"),
  path.join(homepageDir, "FeatureCards.tsx"),
  path.join(homepageDir, "ChangelogSection.tsx"),
  path.join(homepageDir, "TerminalDemo.tsx"),
  path.join(homepageDir, "BenchmarkSection.tsx"),
  path.join(homepageDir, "OverviewSplash.tsx"),
  path.join(homepageDir, "OneOnOneMatrix.tsx"),
  path.join(homepageDir, "ArchitectureCompareSlider.tsx"),
];

const leftoverCopy = [
  /Activate Anti-Gravity/i,
  /Deactivate Anti-Gravity/i,
  /Platform Statistics/,
  /Metrics will appear here once the platform has usage data/,
  /Get started free/i,
  /Start free trial/i,
  /Sign up free/i,
  /1,000\+ tests passing/,
  /26 migrations/,
  /Shadow API Discovery/,
  /Credential Scanner/,
  /bash — agent firewall/,
  /Discover without exfiltration/,
  /Interactive demo scanner/,
  /14-day free trial/,
  /discover shadow APIs/i,
  /Prompt Injection & LLM Cost Control/,
];

describe("homepage private-beta cut", () => {
  it("does not ship leftover IDE chrome, empty stats, scanner hero cards, or vanity metrics", () => {
    const violations: string[] = [];
    for (const file of homepageFiles) {
      const source = fs.readFileSync(file, "utf8");
      for (const pattern of leftoverCopy) {
        if (pattern.test(source)) {
          violations.push(
            `${path.relative(path.resolve(__dirname, ".."), file)} matched ${pattern}`,
          );
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("does not keep an Anti-Gravity homepage module", () => {
    expect(fs.existsSync(path.join(homepageDir, "AntiGravity.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(homepageDir, "antigravity-snippet.html"))).toBe(false);
  });

  it("renders Request beta access to /waitlist and keeps the Action Ledger claim", () => {
    render(<HeroSection />);

    const cta = screen.getByRole("link", { name: /^request beta access$/i });
    expect(cta).toHaveAttribute("href", "/waitlist");
    expect(screen.getByRole("link", { name: /see pricing/i })).toHaveAttribute("href", "/pricing");
    expect(screen.getByText("Hash-chained Action Ledger")).toBeInTheDocument();
    expect(screen.queryByText(/get started free/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/activate anti-gravity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/1,000\+ tests passing/i)).not.toBeInTheDocument();
  });

  it("uses Request beta access on the public header, pointing at /waitlist", () => {
    render(<PublicHeader />);

    const ctas = screen.getAllByRole("link", { name: /^request beta access$/i });
    expect(ctas.length).toBeGreaterThanOrEqual(1);
    for (const cta of ctas) {
      expect(cta).toHaveAttribute("href", "/waitlist");
    }
    expect(screen.queryByText(/^Start Free$/)).not.toBeInTheDocument();
  });

  it("keeps Agent Firewall product cards and drops scanner/discovery cards", () => {
    render(<FeatureCards />);

    expect(screen.getByRole("heading", { name: "Agent Firewall" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Credential Broker" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Delegated Authority" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Action Ledger" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Shadow API Discovery" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Credential Scanner" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /learn more/i })[0]).toHaveAttribute(
      "href",
      "/overview",
    );
  });

  it("hero, header, and overview labels are exactly Request beta access to /waitlist", () => {
    const files = [
      path.join(homepageDir, "HeroSection.tsx"),
      path.resolve(__dirname, "../components/PublicHeader.tsx"),
      path.resolve(__dirname, "../app/overview/page.tsx"),
    ];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      expect(source, path.basename(file)).toMatch(/Request beta access/);
      expect(source, path.basename(file)).toMatch(/href="\/waitlist"/);
      expect(source, path.basename(file)).not.toMatch(/Get started free/);
      expect(source, path.basename(file)).not.toMatch(/Start Free/);
      expect(source, path.basename(file)).not.toMatch(/Join the waitlist/);
    }
  });
});
