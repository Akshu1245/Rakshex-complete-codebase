import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { PricingView } from "../app/pricing/PricingView";
import { EVALUATION_PLANS, parseGetPlansPayload } from "../lib/billingCatalog";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const liveCatalog = [
  {
    id: "free",
    name: "Rakshex Free",
    usdAmount: 0,
    amount: 0,
    features: ["Up to 5 API endpoints scanned"],
  },
  {
    id: "pro",
    name: "Rakshex Pro",
    usdAmount: 9900,
    amount: 829900,
    features: ["Up to 10,000 LLM calls/day routed via the gateway"],
  },
  {
    id: "enterprise",
    name: "Rakshex Enterprise",
    usdAmount: 49900,
    amount: 4159900,
    features: ["Up to 250,000 LLM calls/day routed via the gateway"],
  },
];

vi.mock("@/lib/trpc", () => ({
  trpc: {
    payment: {
      getPlans: {
        useQuery: () => ({
          data: liveCatalog,
          isLoading: false,
        }),
      },
    },
    waitlist: {
      join: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
    },
  },
}));

describe("parseGetPlansPayload", () => {
  it("reads amounts from the live tRPC superjson envelope", () => {
    const parsed = parseGetPlansPayload({
      result: {
        data: {
          json: liveCatalog,
        },
      },
    });
    expect(parsed?.map((p) => p.usdAmount)).toEqual([0, 9900, 49900]);
    expect(parsed?.find((p) => p.id === "pro")?.amount).toBe(829900);
  });
});

describe("PricingView", () => {
  it("shows catalog amounts and waitlist CTAs, not self-serve checkout", () => {
    render(<PricingView initialPlans={EVALUATION_PLANS} />);

    expect(screen.queryByText("Loading plans…")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /evaluation pricing/i })).toBeInTheDocument();
    expect(screen.getByText("$99")).toBeInTheDocument();
    expect(screen.getByText("$499")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /join waitlist/i })).toHaveLength(3);
    expect(screen.getByRole("link", { name: /sign in with an invite/i })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.queryByRole("button", { name: /upgrade to pro/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /get started/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /sign up to upgrade/i })).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/register"]')).toBeNull();
  });
});
