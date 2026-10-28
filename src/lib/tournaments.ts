export type Tournament = {
  id: string;
  title: string;
  description: string;
  venue: string;
  starts_at: string;
  max_teams: number;
  points_to_win: number;
  status: "registration" | "in_progress" | "completed" | "cancelled";
  created_by: string;
  created_at: string;
};
export type TournamentTeam = {
  id: string;
  tournament_id: string;
  captain_id: string;
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
  state: "waiting" | "ready" | "completed" | "bye";
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
