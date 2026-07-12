import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

global.fetch = vi.fn();

function Compliance() {
  const [reports, setReports] = React.useState<any[]>([]);
  const [generating, setGenerating] = React.useState(false);

  React.useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    const res = await fetch("/api/compliance/reports");
    const data = await res.json();
    setReports(data.reports || []);
  };

  const generateReport = async () => {
    setGenerating(true);
    await fetch("/api/compliance/generate", {
      method: "POST",
      body: JSON.stringify({ reportType: "pci_dss" }),
    });
    setGenerating(false);
    fetchReports();
  };

  const exportPDF = async (reportId: string) => {
    const res = await fetch(`/api/compliance/${reportId}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance-report-${reportId}.pdf`;
    a.click();
  };

  return (
    <div data-testid="compliance-page">
      <h1>Compliance Reports</h1>

      <button onClick={generateReport} disabled={generating} data-testid="generate-btn">
        {generating ? "Generating..." : "Generate Report"}
      </button>

      <div data-testid="reports-list">
        {reports.map((r) => (
          <div key={r.id} data-testid={`report-${r.id}`}>
            <span>{r.reportType}</span>
            <span data-testid={`score-${r.id}`}>Score: {r.complianceScore}%</span>
            <button onClick={() => exportPDF(r.id)} data-testid={`export-${r.id}`}>
              Export PDF
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

describe("Compliance", () => {
  const mockReports = [
    {
      id: "r1",
      reportType: "pci_dss",
      complianceScore: 85,
      createdAt: "2024-01-01",
    },
    {
      id: "r2",
      reportType: "owasp",
      complianceScore: 92,
      createdAt: "2024-01-15",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockImplementation((url: string) => {
      if (url === "/api/compliance/reports") {
        return Promise.resolve({
          json: () => Promise.resolve({ reports: mockReports }),
          ok: true,
        });
      }
      return Promise.resolve({
        json: () => Promise.resolve({ success: true }),
        blob: () => Promise.resolve(new Blob()),
        ok: true,
      });
    });
  });

  it("renders compliance page", async () => {
    render(<Compliance />);

    await waitFor(() => {
      expect(screen.getByTestId("compliance-page")).toBeInTheDocument();
    });
  });

  it("shows generate report button", async () => {
    render(<Compliance />);

    await waitFor(() => {
      expect(screen.getByTestId("generate-btn")).toBeInTheDocument();
    });

    expect(screen.getByTestId("generate-btn")).toHaveTextContent("Generate Report");
  });

  it("triggers report generation", async () => {
    const user = userEvent.setup();
    render(<Compliance />);

    await waitFor(() => {
      expect(screen.getByTestId("generate-btn")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("generate-btn"));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/compliance/generate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reportType: "pci_dss" }),
      }),
    );
  });

  it("displays compliance reports", async () => {
    render(<Compliance />);

    await waitFor(() => {
      expect(screen.getByTestId("reports-list")).toBeInTheDocument();
    });

    expect(screen.getByTestId("report-r1")).toBeInTheDocument();
    expect(screen.getByTestId("score-r1")).toHaveTextContent("Score: 85%");
    expect(screen.getByTestId("score-r2")).toHaveTextContent("Score: 92%");
  });

  it("shows PDF export button for each report", async () => {
    render(<Compliance />);

    await waitFor(() => {
      expect(screen.getByTestId("export-r1")).toBeInTheDocument();
    });

    expect(screen.getByTestId("export-r1")).toHaveTextContent("Export PDF");
    expect(screen.getByTestId("export-r2")).toHaveTextContent("Export PDF");
  });
});
