export type OpenPlaySession = {
  id: string;
  title: string;
  venue: string;
  played_on: string;
  status: "open" | "closed";
  created_by: string;
  created_at: string;
};

export type OpenPlayPlayer = {
  id: string;
  session_id: string;
  name: string;
  user_id: string | null;
  queue_status: "waiting" | "playing" | "away";
  queued_at: string;
  created_at: string;
};

export type OpenPlayMatch = {
  id: string;
  session_id: string;
  court: string;
  team_a: string[];
  team_b: string[];
  score_a: number | null;
  score_b: number | null;
  state: "playing" | "completed";
  created_at: string;
  completed_at: string | null;
};

export type StandingRow = {
  rank: number;
  playerId: string;
  name: string;
  wins: number;
  losses: number;
  diff: number;
  games: number;
  winPct: number;
  form: ("W" | "L")[];
};

const FORM_LENGTH = 5;

/**
 * Builds the leaderboard from completed matches.
 * Order: win % (highest first), then point differential, then wins, then name.
 */
export function computeStandings(
  players: Pick<OpenPlayPlayer, "id" | "name">[],
  matches: Pick<OpenPlayMatch, "team_a" | "team_b" | "score_a" | "score_b" | "state" | "completed_at" | "created_at">[],
): StandingRow[] {
  const stats = new Map<string, { wins: number; losses: number; diff: number; form: ("W" | "L")[] }>();
  for (const p of players) stats.set(p.id, { wins: 0, losses: 0, diff: 0, form: [] });

  const finished = matches
    .filter((m) => m.state === "completed" && m.score_a != null && m.score_b != null)
    .sort((a, b) =>
      (a.completed_at ?? a.created_at).localeCompare(b.completed_at ?? b.created_at),
    );

  for (const m of finished) {
    const a = m.score_a as number;
    const b = m.score_b as number;
    const credit = (ids: string[], own: number, other: number) => {
      for (const id of ids) {
        const s = stats.get(id);
        if (!s) continue;
        const won = own > other;
        if (won) s.wins += 1;
        else s.losses += 1;
        s.diff += own - other;
        s.form.push(won ? "W" : "L");
      }
    };
    credit(m.team_a, a, b);
    credit(m.team_b, b, a);
  }

  const rows = players.map((p) => {
    const s = stats.get(p.id)!;
    const games = s.wins + s.losses;
    return {
      playerId: p.id,
      name: p.name,
      wins: s.wins,
      losses: s.losses,
      diff: s.diff,
      games,
      ratio: games ? s.wins / games : 0,
      form: s.form.slice(-FORM_LENGTH),
    };
  });

  rows.sort(
    (x, y) =>
      y.ratio - x.ratio ||
      y.diff - x.diff ||
      y.wins - x.wins ||
      x.name.localeCompare(y.name, undefined, { sensitivity: "base" }),
  );

  return rows.map(({ ratio, ...row }, index) => ({
    ...row,
    rank: index + 1,
    winPct: Math.round(ratio * 100),
  }));
}

/** Waiting players in the order they will be called onto court. */
export function queueOrder(players: OpenPlayPlayer[]) {
  return players
    .filter((p) => p.queue_status === "waiting")
    .sort(
      (a, b) =>
        a.queued_at.localeCompare(b.queued_at) ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id),
    );
}

export function validOpenPlayScore(a: number, b: number) {
  return (
    Number.isInteger(a) &&
    Number.isInteger(b) &&
    Math.min(a, b) >= 0 &&
    Math.max(a, b) <= 99 &&
    Math.abs(a - b) >= 2
  );
}

export function formatDiff(diff: number) {
  return diff > 0 ? `+${diff}` : String(diff);
}
