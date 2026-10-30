import { describe, expect, it } from "vitest";
import {
  computeStandings,
  queueOrder,
  validOpenPlayScore,
  type OpenPlayPlayer,
} from "../lib/open-play";

const players = ["A", "B", "C", "D", "E"].map((n) => ({ id: n, name: n }));
const done = (a: string[], b: string[], sa: number, sb: number, minute: number) => ({
  team_a: a,
  team_b: b,
  score_a: sa,
  score_b: sb,
  state: "completed" as const,
  completed_at: `2026-10-30T10:0${minute}:00Z`,
  created_at: `2026-10-30T10:0${minute}:00Z`,
});

describe("open play standings", () => {
  const rows = computeStandings(players, [
    done(["A", "B"], ["C", "D"], 11, 7, 1),
    done(["A", "C"], ["B", "D"], 11, 9, 2),
    done(["A", "D"], ["B", "C"], 5, 11, 3),
    {
      ...done(["E"], ["A"], 0, 0, 4),
      state: "playing" as const,
      score_a: null,
      score_b: null,
    },
  ]);

  it("counts wins, losses, point differential and win percentage", () => {
    const b = rows.find((r) => r.name === "B")!;
    expect([b.wins, b.losses, b.diff, b.games, b.winPct]).toEqual([2, 1, 8, 3, 67]);
    expect(b.form).toEqual(["W", "L", "W"]);
  });

  it("breaks win-percentage ties by point differential and ignores matches in progress", () => {
    expect(rows.map((r) => r.name)).toEqual(["B", "C", "A", "E", "D"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(rows.find((r) => r.name === "E")!.games).toBe(0);
  });
});

describe("open play queue", () => {
  it("lists only waiting players, earliest first", () => {
    const base = { session_id: "s", user_id: null, created_at: "2026-10-30T09:00:00Z" };
    const list: OpenPlayPlayer[] = [
      { ...base, id: "3", name: "C", queue_status: "waiting", queued_at: "2026-10-30T10:03:00Z" },
      { ...base, id: "1", name: "A", queue_status: "waiting", queued_at: "2026-10-30T10:01:00Z" },
      { ...base, id: "2", name: "B", queue_status: "playing", queued_at: "2026-10-30T10:02:00Z" },
      { ...base, id: "4", name: "D", queue_status: "away", queued_at: "2026-10-30T10:00:00Z" },
    ];
    expect(queueOrder(list).map((p) => p.name)).toEqual(["A", "C"]);
  });
});

describe("open play scores", () => {
  it("requires a winner who leads by at least two", () => {
    expect(validOpenPlayScore(11, 9)).toBe(true);
    expect(validOpenPlayScore(11, 10)).toBe(false);
    expect(validOpenPlayScore(11, 11)).toBe(false);
    expect(validOpenPlayScore(-1, 11)).toBe(false);
    expect(validOpenPlayScore(11.5, 3)).toBe(false);
  });
});
