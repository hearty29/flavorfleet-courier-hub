import { useEffect, useRef, useState, type ReactNode } from "react";
import { matchLabel, type TournamentMatch } from "@/lib/tournaments";

const sections = [
  {
    key: "winners",
    title: "Winner Bracket",
    className: "border-green-600 bg-green-50 text-green-950",
    stroke: "#15803d",
  },
  {
    key: "losers",
    title: "Loser Bracket",
    className: "border-red-600 bg-red-50 text-red-950",
    stroke: "#b91c1c",
  },
  {
    key: "championship",
    title: "Championship Bracket",
    className: "border-amber-500 bg-amber-50 text-amber-950",
    stroke: "#b45309",
  },
] as const;
function BracketSection({
  section,
  matches,
  allMatches,
  renderMatch,
}: {
  section: (typeof sections)[number];
  matches: TournamentMatch[];
  allMatches: TournamentMatch[];
  renderMatch: (m: TournamentMatch) => ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const rounds = [...new Set(matches.map((m) => m.round_no))].sort((a, b) => a - b);
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const draw = () => {
      const rect = root.getBoundingClientRect();
      const next: string[] = [];
      for (const match of matches) {
        const to = root
          .querySelector<HTMLElement>('[data-match-id="' + match.id + '"]')
          ?.getBoundingClientRect();
        if (!to) continue;
        for (const source of [match.source_a_match, match.source_b_match]) {
          if (!source) continue;
          const from = root
            .querySelector<HTMLElement>('[data-match-id="' + source + '"]')
            ?.getBoundingClientRect();
          if (!from) continue;
          const x1 = from.right - rect.left,
            y1 = from.top + from.height / 2 - rect.top;
          const x2 = to.left - rect.left,
            y2 = to.top + to.height / 2 - rect.top;
          if (x2 <= x1) continue;
          const middle = (x1 + x2) / 2;
          next.push("M " + x1 + " " + y1 + " H " + middle + " V " + y2 + " H " + x2);
        }
      }
      setPaths(next);
    };
    const observer = new ResizeObserver(draw);
    observer.observe(root);
    root.querySelectorAll("[data-match-id]").forEach((node) => observer.observe(node));
    draw();
    return () => observer.disconnect();
  }, [matches]);
  const sourceLabel = (id: string | null, outcome: string) => {
    const source = allMatches.find((m) => m.id === id);
    return source
      ? (outcome === "loser" ? "Loser" : "Winner") + " of " + matchLabel(source)
      : "Seed / bye";
  };
  return (
    <section
      className={"overflow-hidden rounded-2xl border-l-4 " + section.className}
      aria-label={section.title}
    >
      <h4 className="px-4 pt-4 text-lg font-extrabold">{section.title}</h4>
      {section.key === "championship" && (
        <p className="px-4 pt-1 text-xs">
          The unbeaten finalist must lose twice. A reset final is played only if the Loser Bracket
          finalist wins the first final.
        </p>
      )}
      <div className="overflow-x-auto p-4" tabIndex={0} aria-label={section.title + " rounds"}>
        <div ref={container} className="relative flex min-w-max gap-10">
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            {paths.map((d, i) => (
              <path key={i} d={d} stroke={section.stroke} strokeWidth={2} fill="none" />
            ))}
          </svg>
          {rounds.map((round) => (
            <div key={round} className="relative flex w-72 shrink-0 flex-col">
              <h5 className="mb-3 text-sm font-bold">
                {section.key === "championship"
                  ? round === 1
                    ? "Grand final"
                    : "Reset final · if needed"
                  : "Round " + round}
              </h5>
              <div className="flex flex-1 flex-col justify-around gap-5">
                {matches
                  .filter((m) => m.round_no === round)
                  .map((match) => (
                    <div key={match.id} data-match-id={match.id} className="relative">
                      {renderMatch(match)}
                      <p className="mt-1 px-1 text-[11px]">
                        {sourceLabel(match.source_a_match, match.source_a_outcome)} ·{" "}
                        {sourceLabel(match.source_b_match, match.source_b_outcome)}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
export function BracketBoard({
  matches,
  renderMatch,
}: {
  matches: TournamentMatch[];
  renderMatch: (match: TournamentMatch) => ReactNode;
}) {
  return (
    <div className="space-y-5">
      {sections.map((section) => {
        const selected = matches.filter((m) => (m.bracket ?? "winners") === section.key);
        return selected.length ? (
          <BracketSection
            key={section.key}
            section={section}
            matches={selected}
            allMatches={matches}
            renderMatch={renderMatch}
          />
        ) : null;
      })}
    </div>
  );
}
