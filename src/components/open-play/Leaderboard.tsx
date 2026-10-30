import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MapPin, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  computeStandings,
  formatDiff,
  queueOrder,
  validOpenPlayScore,
  type OpenPlayMatch,
  type OpenPlayPlayer,
  type OpenPlaySession,
} from "@/lib/open-play";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RpcResult = PromiseLike<{ error: { message: string } | null }>;

const DEFAULT_COURTS = ["Court 1", "Court 2", "Court 3", "Court 4"];
const MEDALS = ["🥇", "🥈", "🥉"];
const selectClass =
  "h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const panelClass = "rounded-2xl border bg-card p-5 shadow-sm md:p-6";

function ScoreForm({
  match,
  teamName,
  busy,
  saveLabel,
  onSave,
  onCancel,
  cancelLabel,
}: {
  match: OpenPlayMatch;
  teamName: (ids: string[]) => string;
  busy: boolean;
  saveLabel: string;
  onSave: (a: number, b: number) => void;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  const [a, setA] = useState(match.score_a == null ? "" : String(match.score_a));
  const [b, setB] = useState(match.score_b == null ? "" : String(match.score_b));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const sa = Number(a);
    const sb = Number(b);
    if (a === "" || b === "" || !validOpenPlayScore(sa, sb)) {
      toast.error("Enter whole-number scores where the winner leads by at least 2.");
      return;
    }
    onSave(sa, sb);
  };

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`a-${match.id}`} className="truncate text-xs">
            {teamName(match.team_a)}
          </Label>
          <Input
            id={`a-${match.id}`}
            inputMode="numeric"
            type="number"
            min={0}
            max={99}
            value={a}
            onChange={(e) => setA(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`b-${match.id}`} className="truncate text-xs">
            {teamName(match.team_b)}
          </Label>
          <Input
            id={`b-${match.id}`}
            inputMode="numeric"
            type="number"
            min={0}
            max={99}
            value={b}
            onChange={(e) => setB(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {saveLabel}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onCancel}>
            {cancelLabel ?? "Cancel"}
          </Button>
        )}
      </div>
    </form>
  );
}

export function Leaderboard() {
  const { session: auth, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const userId = auth?.user.id;
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [myName, setMyName] = useState("");
  const [court, setCourt] = useState("");
  const [size, setSize] = useState<2 | 4>(4);

  const sessionsQ = useQuery({
    queryKey: ["op-sessions"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("open_play_sessions")
        .select("*")
        .order("played_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OpenPlaySession[];
    },
  });
  const sessions = sessionsQ.data ?? [];
  const current = sessions.find((s) => s.id === selectedId) ?? sessions[0] ?? null;

  const playersQ = useQuery({
    queryKey: ["op-players", current?.id],
    enabled: !!current,
    refetchInterval: 8000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("open_play_players")
        .select("*")
        .eq("session_id", current!.id);
      if (error) throw error;
      return (data ?? []) as OpenPlayPlayer[];
    },
  });
  const matchesQ = useQuery({
    queryKey: ["op-matches", current?.id],
    enabled: !!current,
    refetchInterval: 8000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("open_play_matches")
        .select("*")
        .eq("session_id", current!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as OpenPlayMatch[];
    },
  });
  const courtsQ = useQuery({
    queryKey: ["op-courts"],
    queryFn: async () => {
      const { data } = await supabase.from("courts").select("name").order("name");
      const names = (data ?? []).map((c) => c.name).filter(Boolean);
      return names.length ? names : DEFAULT_COURTS;
    },
  });

  const players = useMemo(() => playersQ.data ?? [], [playersQ.data]);
  const matches = useMemo(() => matchesQ.data ?? [], [matchesQ.data]);
  const courts = courtsQ.data ?? DEFAULT_COURTS;

  const standings = useMemo(() => computeStandings(players, matches), [players, matches]);
  const queue = useMemo(() => queueOrder(players), [players]);
  const live = matches.filter((m) => m.state === "playing");
  const recent = matches
    .filter((m) => m.state === "completed")
    .sort((x, y) => (y.completed_at ?? "").localeCompare(x.completed_at ?? ""))
    .slice(0, 10);

  const names = useMemo(() => new Map(players.map((p) => [p.id, p.name])), [players]);
  const teamName = (ids: string[]) => ids.map((id) => names.get(id) ?? "Player").join(" & ");

  const busyCourts = new Set(live.map((m) => m.court));
  const freeCourts = courts.filter((c) => !busyCourts.has(c));
  const chosenCourt = freeCourts.includes(court) ? court : (freeCourts[0] ?? "");
  const open = current?.status === "open";
  const mine = userId ? players.find((p) => p.user_id === userId) : undefined;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["op-sessions"] });
    void queryClient.invalidateQueries({ queryKey: ["op-players"] });
    void queryClient.invalidateQueries({ queryKey: ["op-matches"] });
  };

  const call = async (fn: () => RpcResult, success?: string) => {
    if (busy) return false;
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return false;
    }
    if (success) toast.success(success);
    refresh();
    return true;
  };

  const createSession = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const ok = await call(
      () =>
        supabase.rpc("open_play_create_session", {
          _title: String(data.get("title") ?? ""),
          _venue: String(data.get("venue") ?? ""),
          _played_on: String(data.get("date") || new Date().toISOString().slice(0, 10)),
        }),
      "Session created",
    );
    if (ok) {
      form.reset();
      setSelectedId(null);
    }
  };

  const addPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    const ok = await call(
      () => supabase.rpc("open_play_add_player", { _session: current.id, _name: playerName }),
      "Player added to the queue",
    );
    if (ok) setPlayerName("");
  };

  const joinQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    await call(
      () => supabase.rpc("open_play_join_queue", { _session: current.id, _name: myName }),
      "You're in the queue",
    );
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 md:pt-12">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            Open play
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-5xl">
            Roadside Paddles Leaderboard
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Live standings, who's on court, and the queue for the next game.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/pickleball">
            <CalendarDays /> Book a court
          </Link>
        </Button>
      </header>

      {sessionsQ.isLoading && <p className="mt-10 text-muted-foreground">Loading sessions…</p>}
      {sessionsQ.isError && (
        <p role="alert" className="mt-10 text-destructive">
          Couldn't load the leaderboard. Please refresh and try again.
        </p>
      )}

      {!sessionsQ.isLoading && !sessionsQ.isError && !current && (
        <div className={`${panelClass} mt-8 text-center`}>
          <Trophy className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 font-semibold">No open-play sessions yet</p>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Create the first session below to start the queue."
              : "Check back soon — the next session will show up here."}
          </p>
        </div>
      )}

      {current && (
        <>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <Label htmlFor="session-picker" className="sr-only">
                Session
              </Label>
              <select
                id="session-picker"
                className={selectClass}
                value={current.id}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} — {s.played_on}
                  </option>
                ))}
              </select>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  open ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"
                }`}
              >
                {open ? "Open" : "Closed"}
              </span>
              {current.venue && (
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" /> {current.venue}
                </span>
              )}
            </div>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  call(
                    () =>
                      supabase.rpc("open_play_set_session_status", {
                        _session: current.id,
                        _status: open ? "closed" : "open",
                      }),
                    open ? "Session closed" : "Session reopened",
                  )
                }
              >
                {open ? "Close session" : "Reopen session"}
              </Button>
            )}
          </div>

          <section aria-labelledby="standings-title" className={`${panelClass} mt-6`}>
            <h2 id="standings-title" className="text-xl font-bold">
              Standings
            </h2>
            {standings.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No players yet. Join the queue to get on the board.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">#</th>
                      <th className="py-2 pr-3 font-semibold">Player</th>
                      <th className="py-2 pr-3 text-right font-semibold">W</th>
                      <th className="py-2 pr-3 text-right font-semibold">L</th>
                      <th className="py-2 pr-3 text-right font-semibold">Diff</th>
                      <th className="py-2 pr-3 text-right font-semibold">Games</th>
                      <th className="py-2 pr-3 text-right font-semibold">Win %</th>
                      <th className="py-2 font-semibold">Form</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((row) => (
                      <tr key={row.playerId} className="border-b last:border-0">
                        <td className="py-2.5 pr-3 font-semibold">
                          {row.rank <= 3 && row.games > 0 ? (
                            <span role="img" aria-label={`Rank ${row.rank}`}>
                              {MEDALS[row.rank - 1]}
                            </span>
                          ) : (
                            row.rank
                          )}
                        </td>
                        <td className="py-2.5 pr-3 font-medium">{row.name}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{row.wins}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{row.losses}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">
                          {formatDiff(row.diff)}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{row.games}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{row.winPct}%</td>
                        <td className="py-2.5">
                          <span className="inline-flex gap-1">
                            {row.form.map((r, i) => (
                              <span
                                key={i}
                                className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${
                                  r === "W"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {r}
                              </span>
                            ))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Ranked by win %, then point differential. Form shows the last 5 games.
            </p>
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="courts-title" className={panelClass}>
              <h2 id="courts-title" className="text-xl font-bold">
                On court
              </h2>
              {live.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No games in progress.</p>
              ) : (
                <ul className="mt-4 grid gap-3">
                  {live.map((m) => (
                    <li key={m.id} className="rounded-xl border bg-background p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                        {m.court}
                      </p>
                      <p className="mt-1 font-semibold">
                        {teamName(m.team_a)} <span className="text-muted-foreground">vs</span>{" "}
                        {teamName(m.team_b)}
                      </p>
                      {isAdmin && (
                        <ScoreForm
                          match={m}
                          teamName={teamName}
                          busy={busy}
                          saveLabel="Save final score"
                          cancelLabel="Cancel match"
                          onSave={(a, b) =>
                            call(
                              () =>
                                supabase.rpc("open_play_record_score", {
                                  _match: m.id,
                                  _score_a: a,
                                  _score_b: b,
                                }),
                              "Score saved",
                            )
                          }
                          onCancel={() =>
                            call(
                              () => supabase.rpc("open_play_cancel_match", { _match: m.id }),
                              "Match cancelled — players are back in the queue",
                            )
                          }
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {isAdmin && open && (
                <div className="mt-5 border-t pt-4">
                  <p className="text-sm font-semibold">Start the next match</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Label htmlFor="court-pick" className="sr-only">
                      Court
                    </Label>
                    <select
                      id="court-pick"
                      className={selectClass}
                      value={chosenCourt}
                      onChange={(e) => setCourt(e.target.value)}
                      disabled={freeCourts.length === 0}
                    >
                      {freeCourts.length === 0 && <option value="">All courts busy</option>}
                      {freeCourts.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <Label htmlFor="size-pick" className="sr-only">
                      Match type
                    </Label>
                    <select
                      id="size-pick"
                      className={selectClass}
                      value={size}
                      onChange={(e) => setSize(Number(e.target.value) === 2 ? 2 : 4)}
                    >
                      <option value={4}>Doubles (4)</option>
                      <option value={2}>Singles (2)</option>
                    </select>
                    <Button
                      disabled={busy || !chosenCourt || queue.length < size}
                      onClick={() =>
                        call(
                          () =>
                            supabase.rpc("open_play_make_match", {
                              _session: current.id,
                              _court: chosenCourt,
                              _size: size,
                            }),
                          `Match started on ${chosenCourt}`,
                        )
                      }
                    >
                      Start match
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {queue.length < size
                      ? `Need ${size - queue.length} more waiting player${size - queue.length === 1 ? "" : "s"}.`
                      : `Next up: ${queue
                          .slice(0, size)
                          .map((p) => p.name)
                          .join(", ")}`}
                  </p>
                </div>
              )}
            </section>

            <section aria-labelledby="queue-title" className={panelClass}>
              <div className="flex items-center justify-between gap-3">
                <h2 id="queue-title" className="text-xl font-bold">
                  Queue
                </h2>
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" /> {queue.length} waiting
                </span>
              </div>

              {queue.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Nobody is waiting right now.</p>
              ) : (
                <ol className="mt-4 grid gap-2">
                  {queue.map((p, i) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 rounded-xl border bg-background px-4 py-2.5"
                    >
                      <span className="flex items-center gap-3">
                        <span className="w-6 text-sm font-bold text-primary tabular-nums">
                          {i + 1}
                        </span>
                        <span className="font-medium">{p.name}</span>
                        {p.user_id === userId && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            You
                          </span>
                        )}
                      </span>
                      {(isAdmin || p.user_id === userId) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() =>
                            call(() => supabase.rpc("open_play_leave_queue", { _player: p.id }))
                          }
                        >
                          Leave
                        </Button>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              {open && (
                <div className="mt-5 border-t pt-4">
                  {!auth ? (
                    <p className="text-sm text-muted-foreground">
                      <Link to="/auth" className="font-semibold text-primary underline">
                        Sign in
                      </Link>{" "}
                      to join the queue.
                    </p>
                  ) : mine?.queue_status === "playing" ? (
                    <p className="text-sm font-medium">You're on court. Have a great game!</p>
                  ) : mine?.queue_status === "waiting" ? (
                    <p className="text-sm text-muted-foreground">
                      You're in the queue. We'll call you when a court opens up.
                    </p>
                  ) : (
                    <form onSubmit={joinQueue} className="flex flex-wrap items-end gap-2">
                      {!mine && (
                        <div className="grid gap-1.5">
                          <Label htmlFor="my-name">Your name</Label>
                          <Input
                            id="my-name"
                            value={myName}
                            maxLength={60}
                            onChange={(e) => setMyName(e.target.value)}
                            placeholder="Name shown on the board"
                            required
                          />
                        </div>
                      )}
                      <Button type="submit" disabled={busy}>
                        {mine ? "Rejoin the queue" : "Join the queue"}
                      </Button>
                    </form>
                  )}

                  {isAdmin && (
                    <form onSubmit={addPlayer} className="mt-4 flex flex-wrap items-end gap-2">
                      <div className="grid gap-1.5">
                        <Label htmlFor="add-player">Add a walk-in player</Label>
                        <Input
                          id="add-player"
                          value={playerName}
                          maxLength={60}
                          onChange={(e) => setPlayerName(e.target.value)}
                          placeholder="Player name"
                          required
                        />
                      </div>
                      <Button type="submit" variant="secondary" disabled={busy}>
                        Add
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </section>
          </div>

          <section aria-labelledby="results-title" className={`${panelClass} mt-6`}>
            <h2 id="results-title" className="text-xl font-bold">
              Recent results
            </h2>
            {recent.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No finished games yet.</p>
            ) : (
              <ul className="mt-4 grid gap-3">
                {recent.map((m) => {
                  const aWon = (m.score_a ?? 0) > (m.score_b ?? 0);
                  return (
                    <li key={m.id} className="rounded-xl border bg-background p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {m.court}
                        </p>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(editingId === m.id ? null : m.id)}
                          >
                            {editingId === m.id ? "Close" : "Edit score"}
                          </Button>
                        )}
                      </div>
                      <div className="mt-1 grid gap-1 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-4">
                        <p className={aWon ? "font-bold" : "text-muted-foreground"}>
                          {teamName(m.team_a)}
                        </p>
                        <p className="text-lg font-extrabold tabular-nums">
                          {m.score_a} – {m.score_b}
                        </p>
                        <p className={`sm:text-right ${aWon ? "text-muted-foreground" : "font-bold"}`}>
                          {teamName(m.team_b)}
                        </p>
                      </div>
                      {isAdmin && editingId === m.id && (
                        <ScoreForm
                          match={m}
                          teamName={teamName}
                          busy={busy}
                          saveLabel="Update score"
                          onSave={async (a, b) => {
                            const ok = await call(
                              () =>
                                supabase.rpc("open_play_edit_score", {
                                  _match: m.id,
                                  _score_a: a,
                                  _score_b: b,
                                }),
                              "Score updated",
                            );
                            if (ok) setEditingId(null);
                          }}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {isAdmin && (
        <details className={`${panelClass} mt-6`}>
          <summary className="cursor-pointer text-lg font-bold">Create a new session</summary>
          <form onSubmit={createSession} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="session-title">Title</Label>
              <Input
                id="session-title"
                name="title"
                required
                minLength={3}
                maxLength={100}
                placeholder="Friday Night Open Play"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="session-venue">Venue</Label>
              <Input id="session-venue" name="venue" maxLength={200} placeholder="Roadside Paddles" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="session-date">Date</Label>
              <Input
                id="session-date"
                name="date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={busy}>
                Create session
              </Button>
            </div>
          </form>
        </details>
      )}
    </main>
  );
}
