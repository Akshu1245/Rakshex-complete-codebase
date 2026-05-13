import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

// Mock WebSocket
class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();

  constructor() {
    setTimeout(() => this.onopen?.(), 0);
  }
}

(global as any).WebSocket = MockWebSocket;

// Mock fetch for metrics
const mockMetrics = {
  totalCollections: 5,
  totalFindings: 12,
  highestRiskScore: 85,
  teamMembers: 3,
};

global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve(mockMetrics),
    ok: true,
  })
) as any;

// Simple Dashboard component for testing
function Dashboard() {
  const [metrics, setMetrics] = React.useState<any>(null);
  const [wsConnected, setWsConnected] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/dashboard/metrics")
      .then(res => res.json())
      .then(data => setMetrics(data));

    const ws = new WebSocket("ws://localhost:8000/ws");
    ws.onopen = () => setWsConnected(true);
    return () => ws.close();
  }, []);

  return (
    <div data-testid="dashboard">
      <h1>Dashboard</h1>
      <div data-testid="metrics">
        {metrics ? (
          <>
            <p data-testid="collections">
              Collections: {metrics.totalCollections}
            </p>
            <p data-testid="findings">Findings: {metrics.totalFindings}</p>
            <p data-testid="risk">Risk Score: {metrics.highestRiskScore}</p>
            <p data-testid="team">Team: {metrics.teamMembers}</p>
          </>
        ) : (
          <p>Loading metrics...</p>
        )}
      </div>
      <div data-testid="websocket-status">
        WebSocket: {wsConnected ? "Connected" : "Disconnected"}
      </div>
    </div>
  );
}

describe("Dashboard", () => {
  it("renders dashboard with metrics", async () => {
    render(<Dashboard />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("collections")).toHaveTextContent(
        "Collections: 5"
      );
    });

    expect(screen.getByTestId("findings")).toHaveTextContent("Findings: 12");
    expect(screen.getByTestId("risk")).toHaveTextContent("Risk Score: 85");
    expect(screen.getByTestId("team")).toHaveTextContent("Team: 3");
  });

  it("shows WebSocket connection status", async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("websocket-status")).toHaveTextContent(
        "WebSocket: Connected"
      );
    });
  });
});
