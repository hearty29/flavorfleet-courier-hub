import type { TournamentStream } from "./tournament-stream";
export type Tournament = {
  id: string;
  title: string;
  description: string;
  venue: string;
  starts_at: string;
  max_teams: number;
  points_to_win: number;
  status: "registration" | "in_progress" | "completed" | "cancelled";
  format: "single" | "double";
  requires_approval: boolean;
  currency: string;
  prize_pool: number | null;
  livestream?: TournamentStream;
  revision: number;
  created_by: string;
  created_at: string;
};
export type TournamentTeam = {
  id: string;
  tournament_id: string;
  captain_id: string | null;
  registration_status: "pending" | "approved" | "rejected" | "withdrawn";
  name: string;
  player_one: string;
  player_two: string;
  created_at: string;
};
export type TournamentMatch = {
  id: string;
  tournament_id: string;
  round_no: number;
  position: number;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_id: string | null;
  score_a: number | null;
  score_b: number | null;
  state: "waiting" | "ready" | "completed" | "bye" | "empty" | "not_needed";
  bracket: "winners" | "losers" | "championship";
  source_a_match: string | null;
  source_b_match: string | null;
  source_a_outcome: "winner" | "loser";
  source_b_outcome: "winner" | "loser";
  seed_a_id: string | null;
  seed_b_id: string | null;
  activation_match: string | null;
  court: string;
  scheduled_at: string | null;
};
export const tournamentStatus = {
  registration: "Registration open",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};
export function roundLabel(round: number, lastRound: number) {
  const remaining = lastRound - round;
  return remaining === 0
    ? "Final"
    : remaining === 1
      ? "Semifinals"
      : remaining === 2
        ? "Quarterfinals"
        : `Round ${round}`;
}
export function localDateTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function validMatchScore(a: number, b: number, target: number) {
  return (
    Number.isInteger(a) &&
    Number.isInteger(b) &&
    Math.min(a, b) >= 0 &&
    Math.max(a, b) <= 999 &&
    Math.max(a, b) >= target &&
    Math.abs(a - b) >= 2
  );
}

export type TournamentPrize = {
  id: string;
  tournament_id: string;
  title: string;
  amount: number | null;
  description: string;
  non_cash_reward: string;
  placement: number | null;
  recipient_team_id: string | null;
  recipient_player: string | null;
  sort_order: number;
};
export type TournamentResult = {
  tournament_id: string;
  team_id: string;
  placement: number | null;
  status: "placed" | "withdrawn";
};
export type TournamentAudit = {
  id: string;
  tournament_id: string;
  action: string;
  reason: string;
  created_at: string;
  before_data: unknown;
  after_data: unknown;
};
export function prizeMoney(amount: number, currency = "PHP") {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(amount);
}
export function matchLabel(match: Pick<TournamentMatch, "bracket" | "round_no" | "position">) {
  return `${match.bracket === "losers" ? "L" : match.bracket === "championship" ? "C" : "W"}${match.round_no}-${match.position}`;
}
