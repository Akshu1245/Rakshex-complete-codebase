import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

global.fetch = vi.fn();

function Billing() {
  const [currentPlan, setCurrentPlan] = React.useState("free");
  const [plans, setPlans] = React.useState<any[]>([]);
  const [upgrading, setUpgrading] = React.useState(false);

  React.useEffect(() => {
    fetchPlans();
    fetchCurrentPlan();
  }, []);

  const fetchPlans = async () => {
    const res = await fetch("/api/payment/plans");
    const data = await res.json();
    setPlans(data.plans || []);
  };

  const fetchCurrentPlan = async () => {
    const res = await fetch("/api/payment/current-plan");
    const data = await res.json();
    setCurrentPlan(data.plan);
  };

  const upgrade = async (planId: string) => {
    setUpgrading(true);
    await fetch("/api/payment/upgrade", {
      method: "POST",
      body: JSON.stringify({ plan: planId }),
    });
    setUpgrading(false);
    fetchCurrentPlan();
  };

  return (
    <div data-testid="billing-page">
      <h1>Billing</h1>

      <div data-testid="current-plan">
        <h2>Current Plan: {currentPlan}</h2>
      </div>

      <div data-testid="plans-list">
        {plans.map(p => (
          <div key={p.id} data-testid={`plan-${p.id}`}>
            <h3>{p.name}</h3>
            <p>
              ${p.amount / 100}/{p.interval}
            </p>
            <ul data-testid={`features-${p.id}`}>
              {p.features?.map((f: string, i: number) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
            {currentPlan !== p.id && (
              <button
                onClick={() => upgrade(p.id)}
                disabled={upgrading}
                data-testid={`upgrade-${p.id}`}
              >
                {upgrading ? "Processing..." : "Upgrade"}
              </button>
            )}
            {currentPlan === p.id && (
              <span data-testid={`active-${p.id}`}>Current Plan</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

describe("Billing", () => {
  const mockPlans = [
    {
      id: "free",
      name: "Free",
      amount: 0,
      interval: "month",
      features: ["1 Collection", "5 Scans/month"],
    },
    {
      id: "pro",
      name: "Pro",
      amount: 99900,
      interval: "month",
      features: ["Unlimited Collections", "Unlimited Scans", "Team Access"],
    },
    {
      id: "enterprise",
      name: "Enterprise",
      amount: 499900,
      interval: "month",
      features: [
        "Everything in Pro",
        "SSO",
        "Priority Support",
        "Custom Contracts",
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockImplementation((url: string) => {
      if (url === "/api/payment/plans") {
        return Promise.resolve({
          json: () => Promise.resolve({ plans: mockPlans }),
          ok: true,
        });
      }
      if (url === "/api/payment/current-plan") {
        return Promise.resolve({
          json: () => Promise.resolve({ plan: "free" }),
          ok: true,
        });
      }
      return Promise.resolve({
        json: () => Promise.resolve({ success: true }),
        ok: true,
      });
    });
  });

  it("displays current plan", async () => {
    render(<Billing />);

    await waitFor(() => {
      expect(screen.getByTestId("current-plan")).toHaveTextContent("free");
    });
  });

  it("lists all available plans", async () => {
    render(<Billing />);

    await waitFor(() => {
      expect(screen.getByTestId("plan-free")).toBeInTheDocument();
    });

    expect(screen.getByTestId("plan-pro")).toBeInTheDocument();
    expect(screen.getByTestId("plan-enterprise")).toBeInTheDocument();
  });

  it("shows plan features", async () => {
    render(<Billing />);

    await waitFor(() => {
      expect(screen.getByTestId("features-pro")).toBeInTheDocument();
    });

    expect(screen.getByTestId("features-pro")).toHaveTextContent(
      "Unlimited Collections"
    );
    expect(screen.getByTestId("features-enterprise")).toHaveTextContent("SSO");
  });

  it("shows upgrade button for non-current plans", async () => {
    render(<Billing />);

    await waitFor(() => {
      expect(screen.getByTestId("upgrade-pro")).toBeInTheDocument();
    });

    expect(screen.getByTestId("upgrade-pro")).toHaveTextContent("Upgrade");
    expect(screen.getByTestId("upgrade-enterprise")).toBeInTheDocument();
  });

  it("shows current plan badge for active plan", async () => {
    render(<Billing />);

    await waitFor(() => {
      expect(screen.getByTestId("active-free")).toBeInTheDocument();
    });

    expect(screen.getByTestId("active-free")).toHaveTextContent("Current Plan");
  });

  it("triggers upgrade flow", async () => {
    const user = userEvent.setup();
    render(<Billing />);

    await waitFor(() => {
      expect(screen.getByTestId("upgrade-pro")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("upgrade-pro"));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/payment/upgrade",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ plan: "pro" }),
      })
    );
  });
});
