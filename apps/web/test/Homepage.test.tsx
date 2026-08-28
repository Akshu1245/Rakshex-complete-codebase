import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { HeroSection } from "@/components/home/HeroSection";
import { FeatureCards } from "@/components/home/FeatureCards";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const homepageDir = path.resolve(__dirname, "../components/home");
const homepageFiles = [
  path.resolve(__dirname, "../app/page.tsx"),
  path.join(homepageDir, "HeroSection.tsx"),
  path.join(homepageDir, "FeatureCards.tsx"),
  path.join(homepageDir, "ChangelogSection.tsx"),
  path.join(homepageDir, "TerminalDemo.tsx"),
  path.join(homepageDir, "BenchmarkSection.tsx"),
  path.join(homepageDir, "OverviewSplash.tsx"),
  path.join(homepageDir, "OneOnOneMatrix.tsx"),
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
];

describe("homepage private-beta cut", () => {
  it("does not ship leftover IDE chrome, empty stats, scanner hero cards, or vanity metrics", () => {
    const violations: string[] = [];
    for (const file of homepageFiles) {
      const source = fs.readFileSync(file, "utf8");
      for (const pattern of leftoverCopy) {
        if (pattern.test(source)) {
          violations.push(`${path.relative(path.resolve(__dirname, ".."), file)} matched ${pattern}`);
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

    const cta = screen.getByRole("link", { name: /request beta access/i });
    expect(cta).toHaveAttribute("href", "/waitlist");
    expect(screen.getByRole("link", { name: /see pricing/i })).toHaveAttribute("href", "/pricing");
    expect(screen.getByText("Hash-chained Action Ledger")).toBeInTheDocument();
    expect(screen.queryByText(/get started free/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/activate anti-gravity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/1,000\+ tests passing/i)).not.toBeInTheDocument();
  });

  it("keeps Agent Firewall product cards and drops scanner/discovery cards", () => {
    render(<FeatureCards />);

    expect(screen.getByRole("heading", { name: "Agent Firewall" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Credential Broker" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Delegated Authority" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Action Ledger" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Shadow API Discovery" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Credential Scanner" })).not.toBeInTheDocument();
  });
});
