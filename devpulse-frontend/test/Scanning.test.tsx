import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

global.fetch = vi.fn();

function Scanning() {
  const [scanning, setScanning] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [results, setResults] = React.useState<any>(null);

  const triggerScan = async () => {
    setScanning(true);
    setProgress(0);
    setResults(null);

    // Simulate progress
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + 20;
      });
    }, 100);

    const res = await fetch("/api/scan", { method: "POST" });
    const data = await res.json();
    setResults(data);
    setScanning(false);
  };

  return (
    <div data-testid="scanning-page">
      <h1>Security Scan</h1>
      <button onClick={triggerScan} disabled={scanning} data-testid="scan-btn">
        {scanning ? "Scanning..." : "Start Scan"}
      </button>

      {scanning && (
        <div data-testid="progress-bar">
          <div data-testid="progress-value">{progress}%</div>
          <progress value={progress} max={100} data-testid="progress-meter" />
        </div>
      )}

      {results && (
        <div data-testid="results">
          <h2>Scan Results</h2>
          <p data-testid="risk-score">Risk Score: {results.riskScore}</p>
          <p data-testid="findings-count">Findings: {results.totalFindings}</p>
          <ul data-testid="findings-list">
            {results.findings?.map((f: any, i: number) => (
              <li key={i} data-testid={`finding-${i}`}>
                {f.title} - {f.severity}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

describe("Scanning", () => {
  const mockResults = {
    riskScore: 75,
    totalFindings: 3,
    findings: [
      { title: "Missing Auth", severity: "high" },
      { title: "Insecure Headers", severity: "medium" },
      { title: "Rate Limiting", severity: "low" },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve({
        json: () => Promise.resolve(mockResults),
        ok: true,
      })
    );
  });

  it("triggers scan on button click", async () => {
    const user = userEvent.setup();
    render(<Scanning />);

    await user.click(screen.getByTestId("scan-btn"));

    expect(global.fetch).toHaveBeenCalledWith("/api/scan", expect.any(Object));
  });

  it("displays progress during scan", async () => {
    const user = userEvent.setup();
    render(<Scanning />);

    // Delay the mock so scanning=true renders before the response flips it back
    (global.fetch as any).mockImplementation(() =>
      new Promise(resolve =>
        setTimeout(() =>
          resolve({
            json: () => Promise.resolve(mockResults),
            ok: true,
          }), 300)
      )
    );

    await user.click(screen.getByTestId("scan-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("progress-bar")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId("progress-value")).toHaveTextContent(/\d+%/);
    });
  });

  it("displays scan results", async () => {
    const user = userEvent.setup();
    render(<Scanning />);

    await user.click(screen.getByTestId("scan-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("results")).toBeInTheDocument();
    });

    expect(screen.getByTestId("risk-score")).toHaveTextContent(
      "Risk Score: 75"
    );
    expect(screen.getByTestId("findings-count")).toHaveTextContent(
      "Findings: 3"
    );
    expect(screen.getByTestId("finding-0")).toHaveTextContent(
      "Missing Auth - high"
    );
  });
});
