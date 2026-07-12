import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

global.fetch = vi.fn();

function KillSwitch() {
  const [budget, setBudget] = React.useState<number>(100);
  const [isActive, setIsActive] = React.useState(false);
  const [currentSpend, setCurrentSpend] = React.useState(0);

  React.useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const res = await fetch("/api/killswitch/settings");
    const data = await res.json();
    setBudget(data.budgetLimitUSD);
    setIsActive(data.isActive);
    setCurrentSpend(data.currentSpendUSD);
  };

  const setBudgetLimit = async () => {
    await fetch("/api/killswitch/budget", {
      method: "POST",
      body: JSON.stringify({ budgetLimitUSD: budget }),
    });
    fetchSettings();
  };

  return (
    <div data-testid="killswitch-page">
      <h1>Kill Switch</h1>

      <div data-testid="budget-section">
        <label>Budget Limit (USD)</label>
        <input
          type="number"
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          data-testid="budget-input"
        />
        <button onClick={setBudgetLimit} data-testid="set-budget-btn">
          Set Budget
        </button>
      </div>

      <div data-testid="status-section">
        <p data-testid="current-budget">Budget: ${budget}</p>
        <p data-testid="current-spend">Current Spend: ${currentSpend}</p>
        <p data-testid="auto-trigger">
          Auto-trigger: {currentSpend >= budget ? "ACTIVE" : "Inactive"}
        </p>
        <div data-testid="trigger-status">Status: {isActive ? "🚨 TRIGGERED" : "✅ Normal"}</div>
      </div>
    </div>
  );
}

describe("KillSwitch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockImplementation((url: string) => {
      if (url === "/api/killswitch/settings") {
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              budgetLimitUSD: 100,
              isActive: false,
              currentSpendUSD: 45,
            }),
          ok: true,
        });
      }
      return Promise.resolve({ json: () => Promise.resolve({}), ok: true });
    });
  });

  it("displays budget settings", async () => {
    render(<KillSwitch />);

    await waitFor(() => {
      expect(screen.getByTestId("current-budget")).toBeInTheDocument();
    });

    expect(screen.getByTestId("current-budget")).toHaveTextContent("Budget: $100");
    expect(screen.getByTestId("current-spend")).toHaveTextContent("Current Spend: $45");
  });

  it("allows setting budget limit", async () => {
    const user = userEvent.setup();
    render(<KillSwitch />);

    await waitFor(() => {
      expect(screen.getByTestId("budget-input")).toBeInTheDocument();
    });

    await user.clear(screen.getByTestId("budget-input"));
    await user.type(screen.getByTestId("budget-input"), "250");
    await user.click(screen.getByTestId("set-budget-btn"));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/killswitch/budget",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ budgetLimitUSD: 250 }),
      }),
    );
  });

  it("shows auto-trigger status", async () => {
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            budgetLimitUSD: 100,
            isActive: true,
            currentSpendUSD: 150,
          }),
        ok: true,
      }),
    );

    render(<KillSwitch />);

    await waitFor(() => {
      expect(screen.getByTestId("auto-trigger")).toBeInTheDocument();
    });

    expect(screen.getByTestId("auto-trigger")).toHaveTextContent("Auto-trigger: ACTIVE");
    expect(screen.getByTestId("trigger-status")).toHaveTextContent("Status: 🚨 TRIGGERED");
  });

  it("shows normal status when under budget", async () => {
    render(<KillSwitch />);

    await waitFor(() => {
      expect(screen.getByTestId("trigger-status")).toBeInTheDocument();
    });

    expect(screen.getByTestId("trigger-status")).toHaveTextContent("Status: ✅ Normal");
  });
});
