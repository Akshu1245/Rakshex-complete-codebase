import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// Mock fetch
global.fetch = vi.fn();

interface Collection {
  id: string;
  name: string;
  format: string;
  totalRequests: number;
  createdAt: string;
}

function Collections() {
  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [showImport, setShowImport] = React.useState(false);
  const [importData, setImportData] = React.useState("");

  React.useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    const res = await fetch("/api/collections");
    const data = await res.json();
    setCollections(data.collections || []);
  };

  const handleCreate = async () => {
    await fetch("/api/collections", {
      method: "POST",
      body: JSON.stringify({
        name: "New Collection",
        format: "postman",
        data: {},
      }),
    });
    fetchCollections();
  };

  const handleImport = async () => {
    await fetch("/api/collections/import", {
      method: "POST",
      body: JSON.stringify({ data: JSON.parse(importData) }),
    });
    setShowImport(false);
    setImportData("");
    fetchCollections();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/collections/${id}`, { method: "DELETE" });
    fetchCollections();
  };

  return (
    <div data-testid="collections-page">
      <h1>Collections</h1>
      <button onClick={handleCreate} data-testid="create-btn">
        Create Collection
      </button>
      <button onClick={() => setShowImport(true)} data-testid="import-btn">
        Import
      </button>

      {showImport && (
        <div data-testid="import-modal">
          <textarea
            data-testid="import-input"
            value={importData}
            onChange={e => setImportData(e.target.value)}
            placeholder="Paste collection JSON"
          />
          <button onClick={handleImport} data-testid="confirm-import">
            Import
          </button>
        </div>
      )}

      <ul data-testid="collections-list">
        {collections.map(c => (
          <li key={c.id} data-testid={`collection-${c.id}`}>
            <span>{c.name}</span>
            <span>({c.format})</span>
            <span>{c.totalRequests} requests</span>
            <button
              onClick={() => handleDelete(c.id)}
              data-testid={`delete-${c.id}`}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

describe("Collections", () => {
  const mockCollections: Collection[] = [
    {
      id: "col1",
      name: "API v1",
      format: "postman",
      totalRequests: 10,
      createdAt: "2024-01-01",
    },
    {
      id: "col2",
      name: "API v2",
      format: "openapi",
      totalRequests: 25,
      createdAt: "2024-01-02",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve({
        json: () => Promise.resolve({ collections: mockCollections }),
        ok: true,
      })
    );
  });

  it("renders collections list", async () => {
    render(<Collections />);

    await waitFor(() => {
      expect(screen.getByTestId("collections-list")).toBeInTheDocument();
    });

    expect(screen.getByTestId("collection-col1")).toHaveTextContent("API v1");
    expect(screen.getByTestId("collection-col2")).toHaveTextContent("API v2");
  });

  it("creates a new collection", async () => {
    const user = userEvent.setup();
    render(<Collections />);

    await waitFor(() => {
      expect(screen.getByTestId("create-btn")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("create-btn"));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/collections",
      expect.any(Object)
    );
  });

  it("opens import modal", async () => {
    const user = userEvent.setup();
    render(<Collections />);

    await waitFor(() => {
      expect(screen.getByTestId("import-btn")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("import-btn"));

    expect(screen.getByTestId("import-modal")).toBeInTheDocument();
    expect(screen.getByTestId("import-input")).toBeInTheDocument();
  });

  it("imports collection data", async () => {
    const user = userEvent.setup();
    render(<Collections />);

    await waitFor(() => {
      expect(screen.getByTestId("import-btn")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("import-btn"));

    const testData = JSON.stringify({ name: "Imported API", item: [] });
    fireEvent.change(screen.getByTestId("import-input"), { target: { value: testData } });
    await user.click(screen.getByTestId("confirm-import"));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/collections/import",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("deletes a collection", async () => {
    const user = userEvent.setup();
    render(<Collections />);

    await waitFor(() => {
      expect(screen.getByTestId("delete-col1")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("delete-col1"));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/collections/col1",
      expect.any(Object)
    );
  });
});
