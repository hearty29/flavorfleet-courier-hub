import type { TournamentPrize } from "./tournaments";

export type PrizeDraft = Omit<
  TournamentPrize,
  "tournament_id" | "sort_order" | "amount" | "placement"
> & {
  amount: string;
  placement: string;
};
export function prizeDrafts(prizes: TournamentPrize[]): PrizeDraft[] {
  return prizes.map((prize) => ({
    ...prize,
    amount: prize.amount == null ? "" : String(prize.amount),
    placement: prize.placement == null ? "" : String(prize.placement),
  }));
}
export function prizePayload(prizes: PrizeDraft[]) {
  return prizes.map((p) => ({
    id: p.id,
    title: p.title,
    amount: p.amount === "" ? null : Number(p.amount),
    description: p.description,
    non_cash_reward: p.non_cash_reward,
    placement: p.placement === "" ? null : Number(p.placement),
    recipient_team_id: p.placement ? null : p.recipient_team_id,
    recipient_player: p.placement ? null : p.recipient_player,
  }));
}
