import { createFileRoute } from "@tanstack/react-router";
import { Leaderboard } from "@/components/open-play/Leaderboard";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard & Open Play Queue — Roadside Paddles" },
      {
        name: "description",
        content:
          "Live pickleball standings, the open-play queue and court assignments at Roadside Paddles.",
      },
    ],
  }),
  component: Leaderboard,
});
