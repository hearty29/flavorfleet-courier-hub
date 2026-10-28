import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Trophy, Activity } from "lucide-react";
import {
  matchLabel,
  roundLabel,
  type TournamentTeam,
  type TournamentMatch,
} from "@/lib/tournaments";
import "./bracket.css";

const sections = [
  {
    key: "winners",
    title: "Winner Bracket",
    className: "arena-winners",
    stroke: "#51f59b",
  },
  {
    key: "losers",
    title: "Loser Bracket",
    className: "arena-losers",
    stroke: "#ff647c",
  },
  {
    key: "championship",
    title: "Championship Bracket",
    className: "arena-finals",
    stroke: "#eac46a",
  },
] as const;
function BracketSection({
  section,
  matches,
  allMatches,
  renderMatch,
  champion,
}: {
  champion?: TournamentTeam | undefined;
  section: (typeof sections)[number];
  matches: TournamentMatch[];
  allMatches: TournamentMatch[];
  renderMatch: (m: TournamentMatch) => ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
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
      const terminal = [...matches]
        .sort((a, b) => b.round_no - a.round_no)
        .find((m) => m.state !== "not_needed");
      const finalNode = terminal
        ? root
            .querySelector<HTMLElement>('[data-match-id="' + terminal.id + '"]')
            ?.getBoundingClientRect()
        : null;
      const championNode = root
        .querySelector<HTMLElement>(".arena-champion-card")
        ?.getBoundingClientRect();
      if (finalNode && championNode) {
        const x1 = finalNode.right - rect.left,
          x2 = championNode.left - rect.left;
        const y1 = finalNode.top + finalNode.height / 2 - rect.top,
          y2 = championNode.top + championNode.height / 2 - rect.top;
        next.push("M " + x1 + " " + y1 + " H " + (x1 + x2) / 2 + " V " + y2 + " H " + x2);
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
    <section className={"arena-section " + section.className} aria-label={section.title}>
      <div className="arena-section-heading">
        <h4>
          <span className="arena-dot" />
          {section.title}
        </h4>
        <div className="arena-navigation">
          <button
            type="button"
            aria-label={"Scroll " + section.title + " left"}
            onClick={() => scroller.current?.scrollBy({ left: -280, behavior: "smooth" })}
          >
            <ChevronLeft size={17} />
          </button>
          <button
            type="button"
            aria-label={"Scroll " + section.title + " right"}
            onClick={() => scroller.current?.scrollBy({ left: 280, behavior: "smooth" })}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      {section.key === "championship" && (
        <p className="arena-reset-note">
          The unbeaten finalist must lose twice. A reset final is played only if the Loser Bracket
          finalist wins the first final.
        </p>
      )}
      <div
        ref={scroller}
        className="arena-scroll"
        tabIndex={0}
        aria-label={section.title + " rounds"}
      >
        <div ref={container} className="arena-grid">
          <svg className="arena-connectors" aria-hidden="true">
            {paths.map((d, i) => (
              <path key={i} d={d} stroke={section.stroke} strokeWidth={2} fill="none" />
            ))}
          </svg>
          {rounds.map((round) => (
            <div key={round} className="arena-round">
              <h5 className="arena-round-title">
                {section.key === "championship"
                  ? round === 1
                    ? "Grand final"
                    : "Reset final · if needed"
                  : section.key === "winners"
                    ? roundLabel(round, rounds.at(-1) ?? 1)
                    : "Round " + round}
              </h5>
              <div className="arena-round-matches">
                {matches
                  .filter((m) => m.round_no === round)
                  .map((match) => (
                    <div key={match.id} data-match-id={match.id} className="arena-match-node">
                      {renderMatch(match)}
                      <p className="arena-source">
                        {sourceLabel(match.source_a_match, match.source_a_outcome)} ·{" "}
                        {sourceLabel(match.source_b_match, match.source_b_outcome)}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          ))}
          {(section.key === "championship" ||
            !allMatches.some((m) => m.bracket === "championship")) && (
            <aside className="arena-champion" aria-label="Championship winner">
              <span className="arena-round-title">Champion</span>
              <div className="arena-champion-card">
                <div className="arena-trophy">
                  <Trophy size={38} strokeWidth={1.4} />
                </div>
                <p className="arena-eyebrow">{champion ? "Title secured" : "The title awaits"}</p>
                <h5>{champion?.name ?? "Who will take the crown?"}</h5>
                <p>
                  {champion
                    ? champion.player_one + " & " + champion.player_two
                    : "Follow the bracket. Every point brings a team closer."}
                </p>
                <span className="arena-champion-badge">
                  {champion ? "CHAMPION" : "ROAD TO GLORY"}
                </span>
              </div>
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}
export function BracketBoard({
  matches,
  renderMatch,
  title = "Pickleball tournament",
  status = "in_progress",
  champion,
}: {
  title?: string;
  status?: string;
  champion?: TournamentTeam | undefined;
  matches: TournamentMatch[];
  renderMatch: (match: TournamentMatch) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const arena = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!expanded) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    const root = arena.current;
    root?.querySelector<HTMLButtonElement>(".arena-expand")?.focus();
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setExpanded(false);
      }
      if (event.key === "Tab" && root) {
        const items = [
          ...root.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
          ),
        ].filter((el) => el.getClientRects().length > 0);
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = previous;
      previousFocus?.focus();
      document.removeEventListener("keydown", escape);
    };
  }, [expanded]);
  if (!matches.length) return null;
  const played = matches.filter((m) => m.state === "completed").length;
  const remaining = matches.filter((m) => ["ready", "waiting"].includes(m.state)).length;
  return (
    <div
      ref={arena}
      className={"tournament-arena" + (expanded ? " arena-expanded" : "")}
      role={expanded ? "dialog" : undefined}
      aria-modal={expanded ? true : undefined}
      aria-label="Live tournament bracket"
    >
      <header className="arena-header">
        <div className="arena-brand">
          <span className="arena-logo">
            <Trophy size={24} />
          </span>
          <div>
            <p className="arena-eyebrow">Roadside Paddles · Tournament central</p>
            <h3>LIVE TOURNAMENT BRACKET</h3>
            <p className="arena-event-title">{title}</p>
          </div>
        </div>
        <button
          type="button"
          className="arena-expand"
          aria-label={expanded ? "Close expanded bracket" : "Expand bracket"}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          <span>{expanded ? "Close" : "Expand"}</span>
        </button>
      </header>
      <div className="arena-scoreboard">
        <span className={"arena-status " + (status === "in_progress" ? "is-live" : "")}>
          <Activity size={13} />
          {status === "in_progress"
            ? "LIVE"
            : status === "completed"
              ? "FINAL RESULTS"
              : status === "cancelled"
                ? "CANCELLED"
                : "DRAW PREVIEW"}
        </span>
        <span>
          <strong>{played}</strong> matches played
        </span>
        <span>
          <strong>{remaining}</strong> awaiting results
        </span>
        <span className="arena-scroll-hint">Swipe or use arrows to explore →</span>
      </div>
      {sections.map((section) => {
        const selected = matches.filter((m) => (m.bracket ?? "winners") === section.key);
        return selected.length ? (
          <BracketSection
            key={section.key}
            champion={champion}
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
