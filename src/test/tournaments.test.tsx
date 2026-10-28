import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  validMatchScore,
  roundLabel,
  type Tournament,
  type TournamentTeam,
  type TournamentMatch,
} from "@/lib/tournaments";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  error: vi.fn(),
  uid: null as string | null,
  admin: false,
  failed: false,
  events: [] as Tournament[],
  teams: [] as TournamentTeam[],
  matches: [] as TournamentMatch[],
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useNavigate: () => vi.fn(),
  Link: ({ to, children, ...props }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    session: mocks.uid ? { user: { id: mocks.uid } } : null,
    roles: mocks.admin ? ["admin", "rider"] : [],
    loading: false,
  }),
}));
vi.mock("@/lib/cart", () => ({ useCart: () => ({ count: 0 }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc,
    channel: () => {
      const channel = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: vi.fn() } }));
import { Route } from "@/routes/tournaments";
import { SiteHeader } from "@/components/SiteHeader";

const clients: QueryClient[] = [];
function mount(Component: ComponentType = Route.options.component as ComponentType) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <Component />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.uid = null;
  mocks.admin = false;
  mocks.failed = false;
  mocks.events = [
    {
      id: "event",
      title: "Weekend Doubles",
      description: "All levels welcome",
      venue: "Roadside",
      starts_at: "2099-01-01T10:00:00Z",
      max_teams: 8,
      points_to_win: 11,
      status: "registration",
      created_by: "admin",
      created_at: "2026-10-28T00:00:00Z",
    },
  ];
  mocks.teams = [
    {
      id: "alpha",
      tournament_id: "event",
      captain_id: "other",
      name: "Alpha",
      player_one: "Alice",
      player_two: "Alex",
      created_at: "2026-10-28T00:00:00Z",
    },
    {
      id: "beta",
      tournament_id: "event",
      captain_id: "second",
      name: "Beta",
      player_one: "Bea",
      player_two: "Ben",
      created_at: "2026-10-28T00:00:00Z",
    },
  ];
  mocks.matches = [];
  mocks.rpc.mockResolvedValue({ data: "event", error: null });
  mocks.from.mockImplementation((table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      in: () => query,
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({
          data:
            table === "pickleball_tournaments"
              ? mocks.events
              : table === "pickleball_teams"
                ? mocks.teams
                : table === "pickleball_matches"
                  ? mocks.matches
                  : [],
          error: mocks.failed ? { message: "Unavailable" } : null,
        }).then(resolve),
    };
    return query;
  });
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});

describe("tournament visitor and registration", () => {
  it("places the tournament link directly after the pickleball link in the header", () => {
    mount(SiteHeader);
    const links = screen.getAllByRole("link");
    expect(links[links.indexOf(screen.getByRole("link", { name: "Pickleball courts" })) + 1]).toBe(
      screen.getByRole("link", { name: "Pickleball tournaments" }),
    );
    expect(screen.getByRole("link", { name: "Pickleball tournaments" })).toHaveAttribute(
      "href",
      "/tournaments",
    );
  });
  it("shows public team information and asks guests to sign in", async () => {
    mount();
    expect(await screen.findByText("Alice & Alex")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in to register" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create tournament" })).not.toBeInTheDocument();
    expect(mocks.from).not.toHaveBeenCalledWith("pickleball_team_contacts");
  });
  it("registers a doubles team through the database RPC", async () => {
    mocks.uid = "customer";
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Join tournament" }));
    fireEvent.change(screen.getByLabelText("Team name"), { target: { value: "New team" } });
    fireEvent.change(screen.getByLabelText("Player 1 full name"), {
      target: { value: "First Player" },
    });
    fireEvent.change(screen.getByLabelText("Player 2 full name"), {
      target: { value: "Second Player" },
    });
    fireEvent.change(screen.getByLabelText("Contact phone"), { target: { value: "090000" } });
    fireEvent.click(screen.getByRole("button", { name: "Register team" }));
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("register_pickleball_team", {
        _tournament: "event",
        _name: "New team",
        _player_one: "First Player",
        _player_two: "Second Player",
        _phone: "090000",
      }),
    );
  });
  it("hides joining when capacity is reached", async () => {
    mocks.uid = "customer";
    mocks.events[0]!.max_teams = 2;
    mount();
    expect(await screen.findByText("Tournament full")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join tournament" })).not.toBeInTheDocument();
  });
  it("keeps server failures distinct from an empty event list", async () => {
    mocks.failed = true;
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("Tournaments are unavailable");
    expect(
      screen.queryByText("No tournaments announced yet.", { exact: false }),
    ).not.toBeInTheDocument();
  });
});

describe("tournament administration and results", () => {
  beforeEach(() => {
    mocks.uid = "admin";
    mocks.admin = true;
  });
  it("creates an event with capacity and a scoring target", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Create tournament" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Tournament name"), {
      target: { value: "Summer Cup" },
    });
    fireEvent.change(within(dialog).getByLabelText("Start date and time (your local time)"), {
      target: { value: "2099-05-10T09:00" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create tournament" }));
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith(
        "save_pickleball_tournament",
        expect.objectContaining({
          _title: "Summer Cup",
          _venue: "Roadside Paddles",
          _max_teams: 8,
          _points_to_win: 11,
        }),
      ),
    );
  });
  it("requires confirmation before locking the draw", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Generate draw & start" }));
    expect(mocks.rpc).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm draw & start" }));
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("start_pickleball_tournament", {
        _tournament: "event",
      }),
    );
  });
  it("validates and submits scores for a ready match", async () => {
    mocks.events[0]!.status = "in_progress";
    mocks.matches = [
      {
        id: "match",
        tournament_id: "event",
        round_no: 1,
        position: 1,
        team_a_id: "alpha",
        team_b_id: "beta",
        winner_id: null,
        score_a: null,
        score_b: null,
        state: "ready",
        court: "",
        scheduled_at: null,
      },
    ];
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Enter score" }));
    const card = screen.getByRole("article", { name: "Match 1-1" });
    fireEvent.change(within(card).getByLabelText("Alpha"), { target: { value: "11" } });
    fireEvent.change(within(card).getByLabelText("Beta"), { target: { value: "10" } });
    fireEvent.click(within(card).getByRole("button", { name: "Save result" }));
    expect(mocks.error).toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    fireEvent.change(within(card).getByLabelText("Beta"), { target: { value: "9" } });
    fireEvent.click(within(card).getByRole("button", { name: "Save result" }));
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("score_pickleball_match", {
        _match: "match",
        _score_a: 11,
        _score_b: 9,
      }),
    );
  });
  it("shows champions when the final is completed", async () => {
    mocks.events[0]!.status = "completed";
    mocks.matches = [
      {
        id: "final",
        tournament_id: "event",
        round_no: 2,
        position: 1,
        team_a_id: "alpha",
        team_b_id: "beta",
        winner_id: "beta",
        score_a: 9,
        score_b: 11,
        state: "completed",
        court: "Court 2",
        scheduled_at: null,
      },
    ];
    mount();
    expect(await screen.findByText("Tournament champions")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enter score" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join tournament" })).not.toBeInTheDocument();
  });
});

describe("score and round display rules", () => {
  it("accepts deuce, but rejects ties, fractions and a win below the event target", () => {
    expect(validMatchScore(14, 12, 11)).toBe(true);
    expect(validMatchScore(11, 10, 11)).toBe(false);
    expect(validMatchScore(11, 11, 11)).toBe(false);
    expect(validMatchScore(14, 12, 15)).toBe(false);
    expect(validMatchScore(11.5, 1, 11)).toBe(false);
  });
  it("labels the final and semifinals for differently sized brackets", () => {
    expect(roundLabel(1, 1)).toBe("Final");
    expect(roundLabel(2, 3)).toBe("Semifinals");
  });
});
