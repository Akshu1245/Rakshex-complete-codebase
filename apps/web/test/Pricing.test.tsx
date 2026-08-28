import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import PricingPage from "../app/pricing/page";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
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

describe("PricingPage", () => {
  it("renders the evaluation catalog without waiting on getPlans", () => {
    render(<PricingPage />);

    expect(screen.queryByText("Loading plans…")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /evaluation pricing/i })).toBeInTheDocument();
    expect(screen.getByText("Rakshex Free")).toBeInTheDocument();
    expect(screen.getByText("Rakshex Pro")).toBeInTheDocument();
    expect(screen.getByText("Rakshex Enterprise")).toBeInTheDocument();
    expect(screen.getByText("$99")).toBeInTheDocument();
    expect(screen.getByText("$499")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /join waitlist/i }).length).toBe(3);
    expect(screen.queryByRole("button", { name: /upgrade to pro/i })).not.toBeInTheDocument();
  });
});
