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

const homepageDir = path.resolve(__dirname, "../components/home");
const homepageFiles = [
  path.resolve(__dirname, "../app/page.tsx"),
  path.resolve(__dirname, "../app/HomePageClient.tsx"),
  path.resolve(__dirname, "../app/layout.tsx"),
  path.join(homepageDir, "HeroSection.tsx"),
  path.join(homepageDir, "TerminalDemo.tsx"),
  path.join(homepageDir, "BenchmarkSection.tsx"),
  path.join(homepageDir, "ArchitectureCompareSlider.tsx"),
];

const leftoverCopy = [
  /Activate Anti-Gravity/i,
  /Deactivate Anti-Gravity/i,
  /Platform Statistics/,
  /Get started free/i,
  /Start free trial/i,
  /Sign up free/i,
  /1,000\+ tests passing/,
  /26 migrations/,
  /bash — agent firewall/,
  /Interactive demo scanner/,
  /14-day free trial/,
  /Prompt Injection & LLM Cost Control/,
];

describe("homepage investor/private-beta cut", () => {
  it("does not ship old launch theater or self-serve copy", () => {
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

  it("renders the beta CTA and demo CTA with investor-grade positioning", () => {
    render(<HeroSection />);

    expect(screen.getByRole("link", { name: /request beta access/i })).toHaveAttribute(
      "href",
      "/waitlist",
    );
    expect(screen.getByRole("link", { name: /see an action get blocked/i })).toHaveAttribute(
      "href",
      "/demo",
    );
    expect(screen.getByText(/AI agents don't just generate/i)).toBeInTheDocument();
    expect(screen.getByText("They act.")).toBeInTheDocument();
    expect(screen.getByText("Fail-closed credential broker")).toBeInTheDocument();
    expect(screen.getByText("Hash-chained Action Ledger")).toBeInTheDocument();
    expect(screen.queryByText(/see pricing/i)).not.toBeInTheDocument();
  });

  it("keeps the public header narrow, honest, and free of dead install/community links", () => {
    render(<PublicHeader />);

    const ctas = screen.getAllByRole("link", { name: /request beta access/i });
    expect(ctas.length).toBeGreaterThanOrEqual(1);
    for (const cta of ctas) expect(cta).toHaveAttribute("href", "/waitlist");

    expect(screen.getByRole("link", { name: "Product" })).toHaveAttribute("href", "/overview");
    expect(screen.getByRole("link", { name: "Demo" })).toHaveAttribute("href", "/demo");
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/docs");
    expect(screen.getByRole("link", { name: "Trust" })).toHaveAttribute("href", "/trust");
    expect(screen.queryByText(/npm cli/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/discord/i)).not.toBeInTheDocument();
  });

  it("keeps the core Agent Firewall cards available on deeper product surfaces", () => {
    render(<FeatureCards />);

    expect(screen.getByRole("heading", { name: "Agent Firewall" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Credential Broker" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Delegated Authority" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Action Ledger" })).toBeInTheDocument();
  });

  it("removes the noisy comparison/feature wall from the homepage narrative", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "../app/HomePageClient.tsx"), "utf8");

    expect(source).not.toMatch(/PerformanceCostMatrix/);
    expect(source).not.toMatch(/OneOnOneMatrix/);
    expect(source).not.toMatch(/ComparisonSubNav/);
    expect(source).not.toMatch(/OverviewSplash/);
    expect(source).not.toMatch(/AskAISection/);
    expect(source).not.toMatch(/Signature Dotted Grid Background Pattern/);
    expect(source).toMatch(/Put one consequential AI action behind RaksHex/);
  });

  it("uses accurate homepage metadata and generated brand images", () => {
    const homepage = fs.readFileSync(path.resolve(__dirname, "../app/page.tsx"), "utf8");
    const layout = fs.readFileSync(path.resolve(__dirname, "../app/layout.tsx"), "utf8");
    const logo = fs.readFileSync(
      path.resolve(__dirname, "../components/common/RaksHexLogo.tsx"),
      "utf8",
    );

    expect(homepage).toMatch(/canonical: "\/"/);
    expect(homepage).toMatch(/RaksHex — AI Action Control Plane/);
    expect(layout).toMatch(/RaksHex — AI Action Control Plane/);
    expect(layout).not.toMatch(/og-image\.png/);
    expect(layout).not.toMatch(/fonts\.googleapis\.com/);
    expect(logo).not.toMatch(/logo\.png/);
    expect(fs.existsSync(path.resolve(__dirname, "../app/opengraph-image.tsx"))).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, "../app/icon.tsx"))).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, "../app/apple-icon.tsx"))).toBe(true);
  });

  it("ships 404, safer error state, mobile overflow guardrails, and reduced-motion support", () => {
    const notFound = fs.readFileSync(path.resolve(__dirname, "../app/not-found.tsx"), "utf8");
    const errorPage = fs.readFileSync(path.resolve(__dirname, "../app/error.tsx"), "utf8");
    const betaCss = fs.readFileSync(path.resolve(__dirname, "../app/investor-beta.css"), "utf8");

    expect(notFound).toMatch(/404 · Route not found/);
    expect(notFound).toMatch(/Request beta access/);
    expect(errorPage).toMatch(/Internal exception details are intentionally not exposed/);
    expect(betaCss).toMatch(/overflow-x: clip/);
    expect(betaCss).toMatch(/prefers-reduced-motion: reduce/);
    expect(betaCss).toMatch(/max-width: 1280px/);
  });

  it("keeps waitlist and docs on distinct canonical public routes", () => {
    const waitlist = fs.readFileSync(path.resolve(__dirname, "../app/waitlist/layout.tsx"), "utf8");
    const docs = fs.readFileSync(path.resolve(__dirname, "../app/docs/page.tsx"), "utf8");

    expect(waitlist).toMatch(/canonical: "\/waitlist"/);
    expect(docs).toMatch(/canonical: "\/docs"/);
    expect(docs).toMatch(/title: "Docs — RaksHex Agent Firewall"/);
  });
});
