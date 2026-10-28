import { createFileRoute } from "@tanstack/react-router";
import { Tournaments } from "@/components/tournaments/TournamentManager";

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
