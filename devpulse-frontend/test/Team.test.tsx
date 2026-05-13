import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

global.fetch = vi.fn();

function Team() {
  const [members, setMembers] = React.useState<any[]>([]);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("viewer");
  const [invited, setInvited] = React.useState(false);

  React.useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    const res = await fetch("/api/team");
    const data = await res.json();
    setMembers(data.members || []);
  };

  const inviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/team/invite", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
    setEmail("");
    setInvited(true);
    fetchMembers();
  };

  const updateRole = async (memberId: string, newRole: string) => {
    await fetch(`/api/team/${memberId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role: newRole }),
    });
    fetchMembers();
  };

  return (
    <div data-testid="team-page">
      <h1>Team Management</h1>

      <form onSubmit={inviteMember} data-testid="invite-form">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Enter email"
          data-testid="email-input"
          required
        />
        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          data-testid="role-select"
        >
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" data-testid="invite-btn">
          Invite
        </button>
      </form>

      {invited && <div data-testid="success-msg">Invitation sent!</div>}

      <ul data-testid="members-list">
        {members.map(m => (
          <li key={m.id} data-testid={`member-${m.id}`}>
            <span>{m.email}</span>
            <span data-testid={`member-role-${m.id}`}>{m.role}</span>
            <select
              value={m.role}
              onChange={e => updateRole(m.id, e.target.value)}
              data-testid={`role-update-${m.id}`}
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}

describe("Team", () => {
  const mockMembers = [
    { id: "m1", email: "alice@example.com", role: "admin" },
    { id: "m2", email: "bob@example.com", role: "viewer" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockImplementation((url: string) => {
      if (url === "/api/team") {
        return Promise.resolve({
          json: () => Promise.resolve({ members: mockMembers }),
          ok: true,
        });
      }
      return Promise.resolve({ json: () => Promise.resolve({}), ok: true });
    });
  });

  it("renders invite form", async () => {
    render(<Team />);

    await waitFor(() => {
      expect(screen.getByTestId("invite-form")).toBeInTheDocument();
    });

    expect(screen.getByTestId("email-input")).toBeInTheDocument();
    expect(screen.getByTestId("role-select")).toBeInTheDocument();
  });

  it("submits invite with email and role", async () => {
    const user = userEvent.setup();
    render(<Team />);

    await waitFor(() => {
      expect(screen.getByTestId("email-input")).toBeInTheDocument();
    });

    await user.type(screen.getByTestId("email-input"), "new@example.com");
    await user.selectOptions(screen.getByTestId("role-select"), "editor");
    await user.click(screen.getByTestId("invite-btn"));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/team/invite",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "new@example.com", role: "editor" }),
      })
    );
  });

  it("shows success message after invite", async () => {
    const user = userEvent.setup();
    render(<Team />);

    await waitFor(() => {
      expect(screen.getByTestId("email-input")).toBeInTheDocument();
    });

    await user.type(screen.getByTestId("email-input"), "new@example.com");
    await user.click(screen.getByTestId("invite-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("success-msg")).toBeInTheDocument();
    });
  });

  it("lists team members", async () => {
    render(<Team />);

    await waitFor(() => {
      expect(screen.getByTestId("members-list")).toBeInTheDocument();
    });

    expect(screen.getByTestId("member-m1")).toHaveTextContent(
      "alice@example.com"
    );
    expect(screen.getByTestId("member-role-m1")).toHaveTextContent("admin");
  });

  it("updates member role", async () => {
    const user = userEvent.setup();
    render(<Team />);

    await waitFor(() => {
      expect(screen.getByTestId("role-update-m2")).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByTestId("role-update-m2"), "editor");

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/team/m2/role",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ role: "editor" }),
      })
    );
  });
});
