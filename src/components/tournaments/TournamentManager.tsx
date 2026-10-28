import { prizeDrafts, prizePayload } from "@/lib/tournament-prizes";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CalendarDays, MapPin, Medal, Plus, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  localDateTime,
  matchLabel,
  type TournamentPrize,
  tournamentStatus,
  validMatchScore,
  type Tournament,
  type TournamentMatch,
  type TournamentTeam,
} from "@/lib/tournaments";
import { PrizeEditor, PrizeList } from "./PrizeEditor";
import {
  AdminDialog,
  TeamManager,
  PrizeManager,
  MoveTeams,
  CorrectionFields,
  FinalResults,
  MatchHistory,
} from "./AdminControls";
import { BracketBoard } from "./BracketBoard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function EventForm({
  event,
  prizes,
  teams,
  onSaved,
}: {
  event: Tournament | null;
  prizes: TournamentPrize[];
  teams: TournamentTeam[];
  onSaved: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(() => prizeDrafts(prizes));
  const [currency, setCurrency] = useState(event?.currency ?? "PHP");
  const [pool, setPool] = useState(event?.prize_pool == null ? "" : String(event.prize_pool));
  const locked = !!event && event.status !== "registration";

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("save_pickleball_event", {
        _title: String(form.get("title")),
        _description: String(form.get("description")),
        _venue: String(form.get("venue")),
        _starts_at: new Date(String(form.get("starts"))).toISOString(),
        _max_teams: Number(form.get("capacity")),
        _points_to_win: Number(form.get("points")),
        _id: event?.id ?? null,
        _format: String(form.get("format")),
        _requires_approval: form.get("approval") === "on",
        _currency: currency,
        _pool: pool === "" ? null : Number(pool),
        _prizes: prizePayload(draft),
        _revision: event?.revision ?? null,
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
      <fieldset disabled={locked} className="grid grid-cols-2 gap-4">
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
      </fieldset>
      <label className="block text-sm">
        Bracket format
        <select
          name="format"
          defaultValue={event?.format ?? "double"}
          disabled={locked}
          className="h-10 w-full rounded-md border bg-background px-2"
        >
          <option value="double">Double elimination · Winner, Loser & Championship</option>
          <option value="single">Single elimination</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="approval"
          defaultChecked={event?.requires_approval ?? true}
          disabled={locked}
        />
        Require admin approval for teams
      </label>
      {locked && (
        <>
          <input type="hidden" name="capacity" value={event.max_teams} />
          <input type="hidden" name="points" value={event.points_to_win} />
          <input type="hidden" name="format" value={event.format} />
          {event.requires_approval && <input type="hidden" name="approval" value="on" />}
        </>
      )}
      <p className="text-sm text-muted-foreground">
        Doubles · win by 2. Format and scoring rules lock once the draw starts.
      </p>
      <PrizeEditor
        currency={currency}
        onCurrency={setCurrency}
        pool={pool}
        onPool={setPool}
        prizes={draft}
        onChange={setDraft}
        teams={teams}
      />
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
      toast.success("Registration submitted. Check your team’s approval status below.");
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
  const [editRevision, setEditRevision] = useState(event.revision);
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
    if (form.get("clear") !== "on" && !validMatchScore(a, b, event.points_to_win)) {
      toast.error(`Reach ${event.points_to_win} points and win by at least two.`);
      return;
    }
    void run(
      () =>
        supabase.rpc("admin_record_pickleball_result", {
          _match: match.id,
          _score_a: a,
          _score_b: b,
          _clear: form.get("clear") === "on",
          _reason: String(form.get("reason") ?? ""),
          _confirm: form.get("confirm") === "on",
          _revision: editRevision,
        }),
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
        : match.state === "not_needed"
          ? "Not required"
          : "Awaiting team";
  return (
    <article className="arena-match" aria-label={"Match " + matchLabel(match)}>
      <div className="arena-match-meta">
        <span>Match {matchLabel(match)}</span>
        <span className="capitalize">
          {match.state === "bye"
            ? "Automatic advance"
            : match.state === "not_needed"
              ? "Not needed"
              : match.state === "empty"
                ? "Empty / bye"
                : match.state}
        </span>
      </div>
      {[
        { id: match.team_a_id, score: match.score_a },
        { id: match.team_b_id, score: match.score_b },
      ].map((side, index) => (
        <div
          key={index}
          className={"arena-team" + (side.id && match.winner_id === side.id ? " is-winner" : "")}
        >
          <span className="arena-team-name">{name(side.id)}</span>
          <span className="arena-team-score">
            {side.score ?? (side.id && match.winner_id === side.id ? "✓" : "—")}
          </span>
        </div>
      ))}
      {(match.court || match.scheduled_at) && (
        <p className="arena-schedule">
          {match.court}
          {match.court && match.scheduled_at ? " · " : ""}
          {match.scheduled_at ? new Date(match.scheduled_at).toLocaleString() : ""}
        </p>
      )}
      {isAdmin && ["in_progress", "completed"].includes(event.status) && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {["ready", "completed"].includes(match.state) && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setEditRevision(event.revision);
                  setEditing(!editing);
                }}
              >
                {match.state === "completed" ? "Correct result" : "Enter score"}
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
          {editing && ["ready", "completed"].includes(match.state) && (
            <form onSubmit={score} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor={`a-${match.id}`}>{name(match.team_a_id)}</Label>
                  <Input
                    id={`a-${match.id}`}
                    name="a"
                    type="number"
                    min={0}
                    max={999}
                    defaultValue={match.score_a ?? 0}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor={`b-${match.id}`}>{name(match.team_b_id)}</Label>
                  <Input
                    id={`b-${match.id}`}
                    name="b"
                    type="number"
                    min={0}
                    max={999}
                    defaultValue={match.score_b ?? 0}
                    required
                  />
                </div>
              </div>
              {match.state === "completed" ? (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <input name="clear" type="checkbox" />
                    Clear result for replay
                  </label>
                  <CorrectionFields />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Saving advances the winner and routes the losing team to its next match.
                </p>
              )}
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

export function Tournaments() {
  const { session, roles, loading } = useAuth();
  const isAdmin = roles.includes("admin");
  const uid = session?.user.id;
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<{ event: Tournament | null } | null>(null);
  const [registering, setRegistering] = useState(false);
  const [adminPanel, setAdminPanel] = useState<"prizes" | "move" | null>(null);
  const [teamForm, setTeamForm] = useState<{ team: TournamentTeam | null } | null>(null);
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
  const prizes = useQuery({
    queryKey: ["tournaments", "prizes", eventId],
    enabled: !!eventId,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pickleball_prizes")
        .select("*")
        .eq("tournament_id", eventId!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const results = useQuery({
    queryKey: ["tournaments", "results", eventId],
    enabled: !!eventId,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pickleball_results")
        .select("*")
        .eq("tournament_id", eventId!)
        .order("placement");
      if (error) throw error;
      return data;
    },
  });
  const history = useQuery({
    queryKey: ["tournaments", "history", eventId, uid, isAdmin],
    enabled: !!eventId && isAdmin,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pickleball_audit")
        .select("*")
        .eq("tournament_id", eventId!)
        .order("created_at", { ascending: false })
        .limit(100);
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
    for (const table of [
      "pickleball_tournaments",
      "pickleball_teams",
      "pickleball_matches",
      "pickleball_prizes",
      "pickleball_results",
    ]) {
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
    setAdminPanel(null);
    setTeamForm(null);
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
  const champion =
    event?.status === "completed"
      ? teams.get(results.data?.find((r) => r.placement === 1)?.team_id ?? "")
      : null;
  const activeTeams =
    entries.data?.filter((t) =>
      ["pending", "approved"].includes(t.registration_status ?? "approved"),
    ) ?? [];
  const approvedTeams =
    entries.data?.filter((t) => (t.registration_status ?? "approved") === "approved") ?? [];
  const registrationOpen =
    event?.status === "registration" && new Date(event.starts_at).getTime() > Date.now();
  const full = activeTeams.length >= (event?.max_teams ?? 0);
  const dataFailed = entries.isError || matches.isError;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
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
                        : `${activeTeams.length} / ${event.max_teams} teams · ${approvedTeams.length} approved`}
                  </span>
                </div>
                {event.description && (
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm">
                    {event.description}
                  </p>
                )}
                <p className="mt-4 text-sm text-muted-foreground">
                  One game to {event.points_to_win}, win by 2 · Doubles ·{" "}
                  {event.format === "double" ? "Double elimination" : "Single elimination"}
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
                  {!loading && isAdmin && (
                    <>
                      <Button
                        variant="outline"
                        disabled={!prizes.isSuccess}
                        onClick={() => setForm({ event })}
                      >
                        Edit event
                      </Button>
                      <Button
                        variant="outline"
                        disabled={!prizes.isSuccess}
                        onClick={() => setAdminPanel("prizes")}
                      >
                        Manage prizes
                      </Button>
                      {event.status === "registration" && (
                        <Button variant="outline" onClick={() => setTeamForm({ team: null })}>
                          Add team
                        </Button>
                      )}
                      {["in_progress", "completed"].includes(event.status) && (
                        <Button
                          variant="outline"
                          disabled={!matches.isSuccess}
                          onClick={() => setAdminPanel("move")}
                        >
                          Move teams
                        </Button>
                      )}
                    </>
                  )}
                  {!loading && isAdmin && event.status === "registration" && (
                    <>
                      <Button
                        variant="outline"
                        disabled={entries.isPending || entries.isError || approvedTeams.length < 2}
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
              {prizes.isSuccess && (
                <PrizeList
                  prizes={prizes.data}
                  currency={event.currency ?? "PHP"}
                  pool={event.prize_pool ?? null}
                />
              )}
              {(prizes.isError || results.isError) && (
                <p role="alert">
                  Could not load prizes or final standings.{" "}
                  <Button variant="outline" onClick={refresh}>
                    Retry
                  </Button>
                </p>
              )}
              {results.isSuccess && prizes.isSuccess && (
                <FinalResults
                  event={event}
                  results={results.data}
                  prizes={prizes.data}
                  teams={teams}
                />
              )}
              {isAdmin && history.isSuccess && (
                <MatchHistory entries={history.data} teams={teams} />
              )}
              {isAdmin && history.isError && (
                <p role="alert">
                  History could not be loaded.{" "}
                  <Button onClick={refresh} variant="outline">
                    Retry
                  </Button>
                </p>
              )}
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
                          <p className="mt-2 text-xs font-semibold capitalize">
                            {team.registration_status ?? "approved"}
                          </p>
                          {isAdmin && event.status !== "cancelled" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              disabled={!contacts.isSuccess}
                              onClick={() => setTeamForm({ team })}
                            >
                              Manage team
                            </Button>
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
                    <BracketBoard
                      title={event.title}
                      status={event.status}
                      champion={champion ?? undefined}
                      matches={matches.data ?? []}
                      renderMatch={(match) => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          teams={teams}
                          event={event}
                          isAdmin={isAdmin}
                          onChanged={refresh}
                        />
                      )}
                    />
                  </section>
                </>
              )}
            </section>
          )}
        </div>
      )}
      {event && teamForm && (
        <AdminDialog
          title={teamForm.team ? "Manage team" : "Register team"}
          onClose={() => setTeamForm(null)}
        >
          <TeamManager
            event={event}
            team={teamForm.team}
            phone={contacts.data?.find((c) => c.team_id === teamForm.team?.id)?.phone ?? ""}
            onSaved={() => {
              setTeamForm(null);
              refresh();
            }}
          />
        </AdminDialog>
      )}
      {event && adminPanel && (
        <AdminDialog
          title={
            adminPanel === "prizes" ? "Manage tournament prizes" : "Correct bracket placements"
          }
          onClose={() => setAdminPanel(null)}
        >
          {adminPanel === "prizes" ? (
            <PrizeManager
              event={event}
              prizes={prizes.data ?? []}
              teams={entries.data ?? []}
              onSaved={() => {
                setAdminPanel(null);
                refresh();
              }}
            />
          ) : (
            <MoveTeams
              event={event}
              matches={matches.data ?? []}
              teams={teams}
              onSaved={() => {
                setAdminPanel(null);
                refresh();
              }}
            />
          )}
        </AdminDialog>
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
              prizes={form.event ? (prizes.data ?? []) : []}
              teams={form.event ? (entries.data ?? []) : []}
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
              ? "This closes registration and randomly seeds approved teams. Pending or rejected teams are excluded. Byes advance automatically. Later corrections require a reason and reset affected results."
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
    </div>
  );
}
