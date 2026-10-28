import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CalendarDays, MapPin, Medal, Plus, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  localDateTime,
  roundLabel,
  tournamentStatus,
  validMatchScore,
  type Tournament,
  type TournamentMatch,
  type TournamentTeam,
} from "@/lib/tournaments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/tournaments")({
  head: () => ({
    meta: [
      { title: "Pickleball Tournaments — Roadside Paddles" },
      {
        name: "description",
        content:
          "Find doubles tournaments, register your team, and follow live brackets and results.",
      },
    ],
  }),
  component: Tournaments,
});

function EventForm({
  event,
  onSaved,
}: {
  event: Tournament | null;
  onSaved: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("save_pickleball_tournament", {
        _title: String(form.get("title")),
        _description: String(form.get("description")),
        _venue: String(form.get("venue")),
        _starts_at: new Date(String(form.get("starts"))).toISOString(),
        _max_teams: Number(form.get("capacity")),
        _points_to_win: Number(form.get("points")),
        ...(event ? { _id: event.id } : {}),
      });
      if (error) throw error;
      if (data) onSaved(data);
      toast.success(event ? "Tournament updated" : "Tournament created. Registration is open!");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="event-title">Tournament name</Label>
        <Input
          id="event-title"
          name="title"
          required
          minLength={3}
          maxLength={100}
          defaultValue={event?.title ?? ""}
        />
      </div>
      <div>
        <Label htmlFor="event-description">Details and eligibility</Label>
        <Textarea
          id="event-description"
          name="description"
          maxLength={2000}
          defaultValue={event?.description ?? ""}
          placeholder="Division, check-in time, and what players should bring"
        />
      </div>
      <div>
        <Label htmlFor="event-venue">Venue</Label>
        <Input
          id="event-venue"
          name="venue"
          required
          maxLength={200}
          defaultValue={event?.venue ?? "Roadside Paddles"}
        />
      </div>
      <div>
        <Label htmlFor="event-start">Start date and time (your local time)</Label>
        <Input
          id="event-start"
          name="starts"
          type="datetime-local"
          required
          defaultValue={event ? localDateTime(event.starts_at) : ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="event-capacity">Maximum teams</Label>
          <Input
            id="event-capacity"
            name="capacity"
            type="number"
            min={2}
            max={32}
            required
            defaultValue={event?.max_teams ?? 8}
          />
        </div>
        <div>
          <Label htmlFor="event-points">Points to win</Label>
          <select
            id="event-points"
            name="points"
            defaultValue={event?.points_to_win ?? 11}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            {[11, 15, 21].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Doubles · single elimination · win by 2. Registration closes when the event starts or the
        draw is generated.
      </p>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Saving…" : event ? "Save tournament" : "Create tournament"}
      </Button>
    </form>
  );
}

function errorMessage(error: unknown) {
  return error && typeof error === "object" && "message" in error
    ? String(error.message)
    : "Something went wrong. Please try again.";
}

function RegistrationForm({ eventId, onSaved }: { eventId: string; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const { error } = await supabase.rpc("register_pickleball_team", {
        _tournament: eventId,
        _name: String(form.get("team")),
        _player_one: String(form.get("one")),
        _player_two: String(form.get("two")),
        _phone: String(form.get("phone")),
      });
      if (error) throw error;
      toast.success("Your team is registered!");
      onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="team-name">Team name</Label>
        <Input id="team-name" name="team" required minLength={2} maxLength={60} />
      </div>
      <div>
        <Label htmlFor="player-one">Player 1 full name</Label>
        <Input id="player-one" name="one" required minLength={2} maxLength={100} />
      </div>
      <div>
        <Label htmlFor="player-two">Player 2 full name</Label>
        <Input id="player-two" name="two" required minLength={2} maxLength={100} />
      </div>
      <div>
        <Label htmlFor="team-phone">Contact phone</Label>
        <Input id="team-phone" name="phone" type="tel" required minLength={5} maxLength={30} />
      </div>
      <p className="text-sm text-muted-foreground">
        Team and player names appear in the public draw. Your phone is visible only to you and
        tournament admins. One team per account.
      </p>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Registering…" : "Register team"}
      </Button>
    </form>
  );
}

function MatchCard({
  match,
  teams,
  event,
  isAdmin,
  onChanged,
}: {
  match: TournamentMatch;
  teams: Map<string, TournamentTeam>;
  event: Tournament;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const run = async (
    fn: () => PromiseLike<{ error: { message: string } | null }>,
    done: () => void,
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await fn();
      if (error) throw error;
      done();
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const score = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const a = Number(form.get("a"));
    const b = Number(form.get("b"));
    if (!validMatchScore(a, b, event.points_to_win)) {
      toast.error(`Reach ${event.points_to_win} points and win by at least two.`);
      return;
    }
    void run(
      () => supabase.rpc("score_pickleball_match", { _match: match.id, _score_a: a, _score_b: b }),
      () => {
        setEditing(false);
        toast.success("Result saved. Winner advanced!");
      },
    );
  };
  const schedule = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const time = String(form.get("time"));
    void run(
      () =>
        supabase.rpc("schedule_pickleball_match", {
          _match: match.id,
          _court: String(form.get("court")),
          _scheduled_at: time ? new Date(time).toISOString() : null,
        }),
      () => setScheduling(false),
    );
  };
  const name = (id: string | null) =>
    id
      ? (teams.get(id)?.name ?? "Team unavailable")
      : match.state === "bye"
        ? "Bye"
        : "Awaiting winner";
  return (
    <article
      className="rounded-2xl border bg-card p-4 shadow-sm"
      aria-label={`Match ${match.round_no}-${match.position}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Match {match.round_no}-{match.position}
        </span>
        <span className="capitalize">
          {match.state === "bye" ? "Automatic advance" : match.state}
        </span>
      </div>
      {[
        { id: match.team_a_id, score: match.score_a },
        { id: match.team_b_id, score: match.score_b },
      ].map((side, index) => (
        <div
          key={index}
          className={`flex items-center justify-between gap-2 rounded-lg p-2 ${side.id && match.winner_id === side.id ? "bg-primary/10 font-bold text-primary" : ""}`}
        >
          <span className="break-words">{name(side.id)}</span>
          <span className="shrink-0 tabular-nums">
            {side.score ?? (side.id && match.winner_id === side.id ? "✓" : "—")}
          </span>
        </div>
      ))}
      {(match.court || match.scheduled_at) && (
        <p className="mt-3 text-xs text-muted-foreground">
          {match.court}
          {match.court && match.scheduled_at ? " · " : ""}
          {match.scheduled_at ? new Date(match.scheduled_at).toLocaleString() : ""}
        </p>
      )}
      {isAdmin && event.status === "in_progress" && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {match.state === "ready" && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setEditing(!editing)}
              >
                Enter score
              </Button>
            )}
            {["ready", "waiting"].includes(match.state) && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setScheduling(!scheduling)}
              >
                Schedule
              </Button>
            )}
          </div>
          {editing && match.state === "ready" && (
            <form onSubmit={score} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor={`a-${match.id}`}>{name(match.team_a_id)}</Label>
                  <Input id={`a-${match.id}`} name="a" type="number" min={0} max={999} required />
                </div>
                <div>
                  <Label htmlFor={`b-${match.id}`}>{name(match.team_b_id)}</Label>
                  <Input id={`b-${match.id}`} name="b" type="number" min={0} max={999} required />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Check scores before saving. Results are final and advance the winner.
              </p>
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? "Saving…" : "Save result"}
              </Button>
            </form>
          )}
          {scheduling && ["ready", "waiting"].includes(match.state) && (
            <form onSubmit={schedule} className="space-y-3">
              <div>
                <Label htmlFor={`court-${match.id}`}>Court</Label>
                <Input
                  id={`court-${match.id}`}
                  name="court"
                  maxLength={100}
                  defaultValue={match.court}
                />
              </div>
              <div>
                <Label htmlFor={`time-${match.id}`}>Time (your local time)</Label>
                <Input
                  id={`time-${match.id}`}
                  name="time"
                  type="datetime-local"
                  defaultValue={match.scheduled_at ? localDateTime(match.scheduled_at) : ""}
                />
              </div>
              <Button type="submit" size="sm" disabled={busy}>
                Save schedule
              </Button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}

function Tournaments() {
  const { session, roles, loading } = useAuth();
  const isAdmin = roles.includes("admin");
  const uid = session?.user.id;
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<{ event: Tournament | null } | null>(null);
  const [registering, setRegistering] = useState(false);
  const [action, setAction] = useState<"start" | "cancel" | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["tournaments"] });
  };
  const events = useQuery({
    queryKey: ["tournaments", "events"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pickleball_tournaments")
        .select("*")
        .order("starts_at");
      if (error) throw error;
      return data;
    },
  });
  const event =
    events.data?.find((item) => item.id === selectedId) ??
    events.data?.find((item) => item.status === "registration" || item.status === "in_progress") ??
    events.data?.[0];
  const eventId = event?.id;
  const entries = useQuery({
    queryKey: ["tournaments", "teams", eventId],
    enabled: !!eventId,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pickleball_teams")
        .select("*")
        .eq("tournament_id", eventId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const matches = useQuery({
    queryKey: ["tournaments", "matches", eventId],
    enabled: !!eventId,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pickleball_matches")
        .select("*")
        .eq("tournament_id", eventId!)
        .order("round_no")
        .order("position");
      if (error) throw error;
      return data;
    },
  });
  const myTeam = entries.data?.find((team) => team.captain_id === uid);
  const contacts = useQuery({
    queryKey: ["tournaments", "contacts", eventId, uid, isAdmin],
    refetchInterval: 15000,
    enabled: !!uid && !!entries.data?.length && (isAdmin || !!myTeam),
    queryFn: async () => {
      const ids = isAdmin ? entries.data!.map((team) => team.id) : [myTeam!.id];
      const { data, error } = await supabase
        .from("pickleball_team_contacts")
        .select("*")
        .in("team_id", ids);
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    const channel = supabase.channel(`tournaments-${Math.random().toString(36).slice(2)}`);
    for (const table of ["pickleball_tournaments", "pickleball_teams", "pickleball_matches"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        void qc.invalidateQueries({ queryKey: ["tournaments"] });
      });
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);
  useEffect(() => {
    setRegistering(false);
    setAction(null);
  }, [eventId]);
  const act = async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await fn();
      if (error) throw error;
      setAction(null);
      refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const teams = new Map(entries.data?.map((team) => [team.id, team]));
  const rounds = [...new Set(matches.data?.map((match) => match.round_no))];
  const lastRound = rounds.at(-1) ?? 1;
  const final = matches.data?.find((match) => match.round_no === lastRound && match.position === 1);
  const champion =
    event?.status === "completed" && final?.winner_id ? teams.get(final.winner_id) : null;
  const registrationOpen =
    event?.status === "registration" && new Date(event.starts_at).getTime() > Date.now();
  const full = (entries.data?.length ?? 0) >= (event?.max_teams ?? 0);
  const dataFailed = entries.isError || matches.isError;
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <section className="rounded-3xl bg-foreground p-6 text-background md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Medal className="h-5 w-5" /> Roadside Paddles
            </p>
            <h1 className="text-3xl font-extrabold md:text-5xl">Pickleball tournaments</h1>
            <p className="mt-3 max-w-xl text-sm opacity-80 md:text-base">
              Find your partner. Join the draw. Follow every match from the opening round to the
              championship.
            </p>
          </div>
          {!loading && isAdmin && (
            <Button onClick={() => setForm({ event: null })}>
              <Plus className="mr-2 h-4 w-4" />
              Create tournament
            </Button>
          )}
        </div>
        <div className="mt-6 flex flex-wrap gap-3 text-xs">
          <span className="rounded-full border border-background/25 px-3 py-1.5">
            Doubles teams
          </span>
          <span className="rounded-full border border-background/25 px-3 py-1.5">
            Knockout brackets
          </span>
          <span className="rounded-full border border-background/25 px-3 py-1.5">Live results</span>
        </div>
      </section>
      {events.isPending && (
        <p className="py-12 text-center" role="status">
          Loading tournaments…
        </p>
      )}
      {events.isError && (
        <div role="alert" className="mt-6 rounded-2xl border p-6">
          <h2 className="font-bold">Tournaments are unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Please try again shortly or contact the organizer.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => void events.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {events.isSuccess && !events.data.length && (
        <div className="mt-8 rounded-2xl border border-dashed p-10 text-center">
          <Trophy className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h2 className="text-xl font-bold">The next championship starts here</h2>
          <p className="mt-2 text-muted-foreground">
            No tournaments announced yet. Check back for upcoming events.
          </p>
        </div>
      )}
      {!!events.data?.length && (
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside aria-label="Choose tournament" className="space-y-3">
            <h2 className="font-bold">Events</h2>
            {events.data.map((item) => (
              <button
                key={item.id}
                aria-pressed={item.id === eventId}
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-2xl border p-4 text-left transition hover:border-primary ${item.id === eventId ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card"}`}
              >
                <span className="text-xs font-semibold text-primary">
                  {tournamentStatus[item.status]}
                </span>
                <span className="mt-1 block break-words font-bold">{item.title}</span>
                <span className="mt-2 block text-xs text-muted-foreground">
                  {new Date(item.starts_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </button>
            ))}
          </aside>
          {event && (
            <section className="min-w-0 space-y-6" aria-label="Tournament details">
              <div className="rounded-2xl border bg-card p-5 md:p-6">
                <p className="text-sm font-semibold text-primary">
                  {event.status === "registration" && !registrationOpen
                    ? "Registration closed"
                    : tournamentStatus[event.status]}
                </p>
                <h2 className="mt-1 break-words text-2xl font-bold">{event.title}</h2>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    {new Date(event.starts_at).toLocaleString()}
                  </span>
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0" />
                    {event.venue}
                  </span>
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 shrink-0" />
                    {entries.isPending
                      ? "Loading teams…"
                      : entries.isError
                        ? "Teams unavailable"
                        : `${entries.data?.length ?? 0} / ${event.max_teams} teams`}
                  </span>
                </div>
                {event.description && (
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm">
                    {event.description}
                  </p>
                )}
                <p className="mt-4 text-sm text-muted-foreground">
                  One game to {event.points_to_win}, win by 2 · Doubles · Single elimination
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {registrationOpen &&
                    !entries.isPending &&
                    !entries.isError &&
                    !myTeam &&
                    !full &&
                    !loading &&
                    (uid ? (
                      <Button onClick={() => setRegistering(true)}>Join tournament</Button>
                    ) : (
                      <Button asChild>
                        <Link to="/auth">Sign in to register</Link>
                      </Button>
                    ))}
                  {registrationOpen && full && (
                    <span className="rounded-full bg-muted px-3 py-2 text-sm font-semibold">
                      Tournament full
                    </span>
                  )}
                  {!loading && isAdmin && event.status === "registration" && (
                    <>
                      <Button variant="outline" onClick={() => setForm({ event })}>
                        Edit event
                      </Button>
                      <Button
                        variant="outline"
                        disabled={
                          entries.isPending || entries.isError || (entries.data?.length ?? 0) < 2
                        }
                        onClick={() => setAction("start")}
                      >
                        Generate draw & start
                      </Button>
                    </>
                  )}
                  {!loading &&
                    isAdmin &&
                    ["registration", "in_progress"].includes(event.status) && (
                      <Button variant="ghost" onClick={() => setAction("cancel")}>
                        Cancel event
                      </Button>
                    )}
                </div>
              </div>
              {champion && (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
                  <Trophy className="mx-auto h-9 w-9 text-primary" />
                  <p className="mt-3 text-sm font-semibold text-primary">Tournament champions</p>
                  <h3 className="mt-1 text-2xl font-bold">{champion.name}</h3>
                  <p className="mt-2 text-sm">
                    {champion.player_one} & {champion.player_two}
                  </p>
                </div>
              )}
              {dataFailed && (
                <div role="alert" className="rounded-2xl border p-5">
                  Could not load the teams or bracket.
                  <Button variant="outline" className="ml-2" onClick={refresh}>
                    Retry
                  </Button>
                </div>
              )}
              {(entries.isPending || matches.isPending) && (
                <p role="status">Loading teams and bracket…</p>
              )}
              {!dataFailed && (
                <>
                  <section>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-lg font-bold">Registered teams</h3>
                      {myTeam && <span className="text-sm text-primary">You’re registered</span>}
                    </div>
                    {!entries.isPending && !entries.data?.length && (
                      <p className="text-sm text-muted-foreground">Be the first team to join.</p>
                    )}
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {entries.data?.map((team) => (
                        <li key={team.id} className="rounded-2xl border bg-card p-4">
                          <p className="break-words font-bold">
                            {team.name}
                            {team.id === myTeam?.id ? " · Your team" : ""}
                          </p>
                          <p className="mt-1 break-words text-sm text-muted-foreground">
                            {team.player_one} & {team.player_two}
                          </p>
                          {contacts.data?.find((contact) => contact.team_id === team.id) && (
                            <p className="mt-2 text-sm">
                              Contact:{" "}
                              {contacts.data.find((contact) => contact.team_id === team.id)?.phone}
                            </p>
                          )}
                          {event.status === "registration" &&
                            (isAdmin || team.id === myTeam?.id) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2"
                                disabled={busy}
                                onClick={() => {
                                  if (window.confirm(`Remove ${team.name} from this tournament?`))
                                    void act(() =>
                                      supabase.rpc("withdraw_pickleball_team", { _team: team.id }),
                                    );
                                }}
                              >
                                {isAdmin && team.id !== myTeam?.id
                                  ? "Remove team"
                                  : "Withdraw team"}
                              </Button>
                            )}
                        </li>
                      ))}
                    </ul>
                    {contacts.isError && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Contact details could not be loaded.
                      </p>
                    )}
                  </section>
                  <section>
                    <h3 className="mb-3 text-lg font-bold">Tournament bracket</h3>
                    {!matches.isPending && !matches.data?.length && (
                      <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                        {event.status === "cancelled"
                          ? "This event was cancelled before the draw."
                          : "The bracket will appear when the organizer closes registration and generates the draw."}
                      </div>
                    )}
                    <div
                      className="flex gap-4 overflow-x-auto pb-4"
                      tabIndex={rounds.length ? 0 : undefined}
                      aria-label="Bracket rounds"
                    >
                      {rounds.map((round) => (
                        <div key={round} className="w-64 shrink-0 space-y-3">
                          <h4 className="rounded-lg bg-muted px-3 py-2 text-sm font-bold">
                            {roundLabel(round, lastRound)}
                          </h4>
                          {matches.data
                            ?.filter((match) => match.round_no === round)
                            .map((match) => (
                              <MatchCard
                                key={match.id}
                                match={match}
                                teams={teams}
                                event={event}
                                isAdmin={isAdmin}
                                onChanged={refresh}
                              />
                            ))}
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </section>
          )}
        </div>
      )}
      <Dialog
        open={!!form}
        onOpenChange={(open) => {
          if (!open) setForm(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.event ? "Edit tournament" : "Create tournament"}</DialogTitle>
          </DialogHeader>
          {form && (
            <EventForm
              key={form.event?.id ?? "new"}
              event={form.event}
              onSaved={(id) => {
                setForm(null);
                setSelectedId(id);
                refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={registering} onOpenChange={setRegistering}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register your doubles team</DialogTitle>
          </DialogHeader>
          {eventId && (
            <RegistrationForm
              key={eventId}
              eventId={eventId}
              onSaved={() => {
                setRegistering(false);
                refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!action}
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "start" ? "Generate the tournament draw?" : "Cancel this tournament?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {action === "start"
              ? "This closes registration, locks teams, and randomly seeds a knockout bracket. Any byes advance automatically. The draw cannot be regenerated."
              : "Players can no longer register or play matches. Existing teams and results will remain visible."}
          </p>
          <Button
            disabled={busy}
            variant={action === "cancel" ? "destructive" : "default"}
            onClick={() => {
              if (eventId)
                void act(() =>
                  action === "start"
                    ? supabase.rpc("start_pickleball_tournament", { _tournament: eventId })
                    : supabase.rpc("cancel_pickleball_tournament", { _tournament: eventId }),
                );
            }}
          >
            {busy
              ? "Saving…"
              : action === "start"
                ? "Confirm draw & start"
                : "Confirm cancellation"}
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
