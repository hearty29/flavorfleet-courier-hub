import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { 
  Trophy, 
  Swords, 
  PlusCircle, 
  Calendar, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Sparkles, 
  ShieldAlert, 
  X,
  Medal,
  Settings,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/tournaments")({
  head: () => ({
    meta: [
      { title: "Pickleball Tournaments & Live Brackets — Roadside Paddles" },
      { name: "description", content: "View live brackets, team matchups, and register for weekend pickleball tournaments." },
    ],
  }),
  component: TournamentsPage,
});

interface Team {
  id: string;
  name: string;
  player1: string;
  player2: string;
  contact: string;
  skillLevel: "Beginner" | "Intermediate" | "Advanced";
}

interface Match {
  id: string;
  round: 1 | 2 | 3;
  matchNumber: number;
  team1?: Team;
  team2?: Team;
  score1: number;
  score2: number;
  court: string;
  timeSlot: string;
  status: "upcoming" | "live" | "finished";
  winnerId?: string;
}

interface Tournament {
  id: string;
  title: string;
  date: string;
  entryFee: number;
  prizePool: string;
  courtsText: string;
  status: string;
  teams: Team[];
  matches: Match[];
}

const STORAGE_KEY = "roadside_tournament_prod_v2";

const INITIAL_TOURNAMENT: Tournament = {
  id: "roadside-open-2026",
  title: "Roadside Open Doubles Championship",
  date: "Saturday, Nov 14, 2026 • 8:00 AM",
  entryFee: 500,
  prizePool: "₱10,000 Cash + Free Court Vouchers",
  courtsText: "Roadside Courts 1–4",
  status: "In Progress",
  teams: [
    { id: "t1", name: "Kitchen Smashers", player1: "Jessie C.", player2: "Mark R.", contact: "0917-111-2222", skillLevel: "Advanced" },
    { id: "t2", name: "Dink Masters", player1: "Carlos T.", player2: "Benjie S.", contact: "0918-222-3333", skillLevel: "Intermediate" },
    { id: "t3", name: "Drop Shot Kings", player1: "Arnel M.", player2: "Dennis P.", contact: "0919-333-4444", skillLevel: "Intermediate" },
    { id: "t4", name: "Baseline Bandits", player1: "Joel V.", player2: "Paolo D.", contact: "0920-444-5555", skillLevel: "Advanced" },
    { id: "t5", name: "Spin Doctors", player1: "Ryan G.", player2: "Kevin L.", contact: "0921-555-6666", skillLevel: "Beginner" },
    { id: "t6", name: "Erne Attack", player1: "Mico F.", player2: "Leo K.", contact: "0922-666-7777", skillLevel: "Intermediate" },
    { id: "t7", name: "Volley Vipers", player1: "Allan N.", player2: "Chris O.", contact: "0923-777-8888", skillLevel: "Intermediate" },
    { id: "t8", name: "Net Ninjas", player1: "Rico B.", player2: "Dave H.", contact: "0924-888-9999", skillLevel: "Advanced" },
  ],
  matches: [
    { id: "m1", round: 1, matchNumber: 1, score1: 11, score2: 7, court: "Court 1", timeSlot: "08:00 AM", status: "finished", winnerId: "t1" },
    { id: "m2", round: 1, matchNumber: 2, score1: 8, score2: 11, court: "Court 2", timeSlot: "08:00 AM", status: "finished", winnerId: "t4" },
    { id: "m3", round: 1, matchNumber: 3, score1: 11, score2: 9, court: "Court 3", timeSlot: "09:00 AM", status: "finished", winnerId: "t6" },
    { id: "m4", round: 1, matchNumber: 4, score1: 5, score2: 11, court: "Court 4", timeSlot: "09:00 AM", status: "finished", winnerId: "t8" },
    { id: "m5", round: 2, matchNumber: 5, score1: 10, score2: 9, court: "Court 1", timeSlot: "10:30 AM", status: "live" },
    { id: "m6", round: 2, matchNumber: 6, score1: 0, score2: 0, court: "Court 2", timeSlot: "10:30 AM", status: "upcoming" },
    { id: "m7", round: 3, matchNumber: 7, score1: 0, score2: 0, court: "Court 1 — Championship", timeSlot: "01:00 PM", status: "upcoming" },
  ],
};

function TournamentsPage() {
  const { roles } = useAuth();
  const isAdminUser = roles.includes("admin");

  const [tournament, setTournament] = useState<Tournament>(() => {
    if (typeof window === "undefined") return INITIAL_TOURNAMENT;
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return INITIAL_TOURNAMENT;
    try {
      return JSON.parse(cached);
    } catch {
      return INITIAL_TOURNAMENT;
    }
  });

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isAdminEditOpen, setIsAdminEditOpen] = useState(false);

  // Form states for Admin Settings Edit
  const [editDate, setEditDate] = useState(tournament.date);
  const [editPrize, setEditPrize] = useState(tournament.prizePool);
  const [editCourts, setEditCourts] = useState(tournament.courtsText);

  // Registration Form states
  const [teamName, setTeamName] = useState("");
  const [player1, setPlayer1] = useState("");
  const [player2, setPlayer2] = useState("");
  const [contact, setContact] = useState("");
  const [skill, setSkill] = useState<"Beginner" | "Intermediate" | "Advanced">("Intermediate");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tournament));
  }, [tournament]);

  // Admin: Remove Team
  const handleRemoveTeam = (teamId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}"?`)) return;

    setTournament((prev) => ({
      ...prev,
      teams: prev.teams.filter((t) => t.id !== teamId),
    }));
    toast.success(`Team "${name}" removed successfully.`);
  };

  // Admin: Save General Settings (Date, Prize, Courts)
  const handleSaveAdminSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setTournament((prev) => ({
      ...prev,
      date: editDate,
      prizePool: editPrize,
      courtsText: editCourts,
    }));
    toast.success("Tournament details saved.");
    setIsAdminEditOpen(false);
  };

  // Admin: Update Match Court Number
  const handleMatchCourtChange = (matchId: string, newCourt: string) => {
    setTournament((prev) => ({
      ...prev,
      matches: prev.matches.map((m) => (m.id === matchId ? { ...m, court: newCourt } : m)),
    }));
    toast.success("Match court updated.");
  };

  // Admin: Update Score
  const handleScoreChange = (matchId: string, teamNum: 1 | 2, delta: number) => {
    setTournament((prev) => ({
      ...prev,
      matches: prev.matches.map((m) => {
        if (m.id !== matchId) return m;
        const s1 = teamNum === 1 ? Math.max(0, m.score1 + delta) : m.score1;
        const s2 = teamNum === 2 ? Math.max(0, m.score2 + delta) : m.score2;
        return { ...m, score1: s1, score2: s2, status: "live" };
      }),
    }));
  };

  // Admin: Declare Winner
  const handleDeclareWinner = (matchId: string, winningTeamId: string) => {
    setTournament((prev) => ({
      ...prev,
      matches: prev.matches.map((m) => (m.id === matchId ? { ...m, winnerId: winningTeamId, status: "finished" } : m)),
    }));
    toast.success("Match completed! Winner advanced.");
  };

  // Register Team
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !player1.trim() || !contact.trim()) {
      toast.error("Please fill in Team Name, Player 1, and Contact.");
      return;
    }

    if (tournament.teams.length >= 8) {
      toast.error("Tournament is currently full (8/8 teams).");
      setIsRegisterOpen(false);
      return;
    }

    const newTeam: Team = {
      id: `t_${Date.now()}`,
      name: teamName.trim(),
      player1: player1.trim(),
      player2: player2.trim() || "TBA",
      contact: contact.trim(),
      skillLevel: skill,
    };

    setTournament((prev) => ({
      ...prev,
      teams: [...prev.teams, newTeam],
    }));

    toast.success(`Team "${newTeam.name}" registered successfully!`);
    setIsRegisterOpen(false);
    setTeamName("");
    setPlayer1("");
    setPlayer2("");
    setContact("");
  };

  const getTeam = (teamId?: string): Team | undefined => {
    if (!teamId) return undefined;
    return tournament.teams.find((t) => t.id === teamId);
  };

  const enrichedMatches = tournament.matches.map((m) => {
    if (m.round === 1) {
      if (m.matchNumber === 1) return { ...m, team1: tournament.teams[0], team2: tournament.teams[1] };
      if (m.matchNumber === 2) return { ...m, team1: tournament.teams[2], team2: tournament.teams[3] };
      if (m.matchNumber === 3) return { ...m, team1: tournament.teams[4], team2: tournament.teams[5] };
      if (m.matchNumber === 4) return { ...m, team1: tournament.teams[6], team2: tournament.teams[7] };
    } else if (m.round === 2) {
      const qf1Winner = tournament.matches.find((x) => x.id === "m1")?.winnerId;
      const qf2Winner = tournament.matches.find((x) => x.id === "m2")?.winnerId;
      const qf3Winner = tournament.matches.find((x) => x.id === "m3")?.winnerId;
      const qf4Winner = tournament.matches.find((x) => x.id === "m4")?.winnerId;

      if (m.matchNumber === 5) return { ...m, team1: getTeam(qf1Winner), team2: getTeam(qf2Winner) };
      if (m.matchNumber === 6) return { ...m, team1: getTeam(qf3Winner), team2: getTeam(qf4Winner) };
    } else if (m.round === 3) {
      const sf1Winner = tournament.matches.find((x) => x.id === "m5")?.winnerId;
      const sf2Winner = tournament.matches.find((x) => x.id === "m6")?.winnerId;
      return { ...m, team1: getTeam(sf1Winner), team2: getTeam(sf2Winner) };
    }
    return m;
  });

  const finalMatch = enrichedMatches.find((m) => m.id === "m7");
  const champion = getTeam(finalMatch?.winnerId);

  return (
    <main className="min-h-screen bg-muted/20 pb-16">
      {/* Hero Header */}
      <section className="border-b bg-card py-8 shadow-sm">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  <Swords className="h-3.5 w-3.5" /> Roadside Tournaments
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
                  {tournament.status}
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                {tournament.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground sm:text-sm">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-primary" /> {tournament.date}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-primary" /> {tournament.courtsText}
                </span>
                <span className="flex items-center gap-1">
                  <Trophy className="h-4 w-4 text-amber-500" /> Prize: {tournament.prizePool}
                </span>
              </div>
            </div>

            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Button onClick={() => setIsRegisterOpen(true)} className="flex-1 gap-1.5 sm:flex-initial">
                <PlusCircle className="h-4 w-4" /> Register Team (₱{tournament.entryFee})
              </Button>
              {isAdminUser && (
                <Button variant="outline" size="sm" onClick={() => setIsAdminEditOpen(true)} title="Edit Details">
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Champion Banner */}
      {champion && (
        <div className="mx-auto max-w-6xl px-4 pt-6">
          <div className="flex items-center justify-between rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-transparent p-5 shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-amber-500 text-white shadow-md">
                <Medal className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Tournament Champion</p>
                <h3 className="text-xl font-extrabold text-foreground">{champion.name}</h3>
                <p className="text-xs text-muted-foreground">Players: {champion.player1} & {champion.player2}</p>
              </div>
            </div>
            <Sparkles className="h-8 w-8 text-amber-500" />
          </div>
        </div>
      )}

      {/* Elimination Bracket Board */}
      <section className="mx-auto max-w-6xl px-4 pt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Live Elimination Bracket</h2>
          <span className="text-xs text-muted-foreground">8 Teams • Single Elimination</span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4">
            <div className="rounded-lg bg-primary/10 px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wider text-primary">
              Round 1 • Quarterfinals
            </div>
            {enrichedMatches.filter((m) => m.round === 1).map((match) => (
              <MatchCard 
                key={match.id} 
                match={match} 
                isAdmin={isAdminUser}
                onScoreChange={handleScoreChange}
                onDeclareWinner={handleDeclareWinner}
                onCourtChange={handleMatchCourtChange}
              />
            ))}
          </div>

          <div className="space-y-4 lg:pt-12">
            <div className="rounded-lg bg-primary/10 px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wider text-primary">
              Round 2 • Semifinals
            </div>
            {enrichedMatches.filter((m) => m.round === 2).map((match) => (
              <MatchCard 
                key={match.id} 
                match={match} 
                isAdmin={isAdminUser}
                onScoreChange={handleScoreChange}
                onDeclareWinner={handleDeclareWinner}
                onCourtChange={handleMatchCourtChange}
              />
            ))}
          </div>

          <div className="space-y-4 lg:pt-28">
            <div className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wider text-amber-700">
              Championship Final 🏆
            </div>
            {enrichedMatches.filter((m) => m.round === 3).map((match) => (
              <MatchCard 
                key={match.id} 
                match={match} 
                isAdmin={isAdminUser}
                isFinal
                onScoreChange={handleScoreChange}
                onDeclareWinner={handleDeclareWinner}
                onCourtChange={handleMatchCourtChange}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Registered Teams Directory with Admin Remove */}
      <section className="mx-auto max-w-6xl px-4 pt-12">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-foreground">Registered Teams ({tournament.teams.length}/8)</h3>
            <span className="text-xs text-muted-foreground">Standard 2v2 format</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            {tournament.teams.map((team, idx) => (
              <div key={team.id} className="relative rounded-lg border bg-muted/30 p-3 text-xs">
                <div className="flex items-center justify-between font-bold text-foreground">
                  <span>#{idx + 1} {team.name}</span>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{team.skillLevel}</span>
                </div>
                <p className="mt-1.5 text-muted-foreground">{team.player1} & {team.player2}</p>
                <p className="text-[10px] text-muted-foreground/80 mt-0.5">📞 {team.contact}</p>

                {isAdminUser && (
                  <button
                    onClick={() => handleRemoveTeam(team.id, team.name)}
                    className="absolute bottom-2 right-2 rounded p-1 text-red-500 hover:bg-red-500/10"
                    title="Remove Team"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Admin Settings Modal */}
      {isAdminEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-foreground">Edit Tournament Info</h3>
              <button onClick={() => setIsAdminEditOpen(false)} className="rounded p-1 text-muted-foreground hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdminSettings} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-foreground">Date & Schedule</label>
                <input
                  type="text"
                  required
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Prize Pool</label>
                <input
                  type="text"
                  required
                  value={editPrize}
                  onChange={(e) => setEditPrize(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Venue / Courts Assigned</label>
                <input
                  type="text"
                  required
                  value={editCourts}
                  onChange={(e) => setEditCourts(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsAdminEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Registration Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-foreground">Register Team</h3>
              <button onClick={() => setIsRegisterOpen(false)} className="rounded p-1 text-muted-foreground hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRegister} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-foreground">Team Name *</label>
                <input
                  type="text"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-foreground">Player 1 *</label>
                  <input
                    type="text"
                    required
                    value={player1}
                    onChange={(e) => setPlayer1(e.target.value)}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Player 2</label>
                  <input
                    type="text"
                    value={player2}
                    onChange={(e) => setPlayer2(e.target.value)}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Contact *</label>
                <input
                  type="tel"
                  required
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Skill Division</label>
                <select
                  value={skill}
                  onChange={(e) => setSkill(e.target.value as any)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="Beginner">Beginner (1.0 - 2.5)</option>
                  <option value="Intermediate">Intermediate (3.0 - 3.5)</option>
                  <option value="Advanced">Advanced (4.0+)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsRegisterOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Submit Registration</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

interface MatchCardProps {
  match: Match;
  isAdmin: boolean;
  isFinal?: boolean;
  onScoreChange: (matchId: string, teamNum: 1 | 2, delta: number) => void;
  onDeclareWinner: (matchId: string, winningTeamId: string) => void;
  onCourtChange: (matchId: string, newCourt: string) => void;
}

function MatchCard({ match, isAdmin, isFinal, onScoreChange, onDeclareWinner, onCourtChange }: MatchCardProps) {
  const isFinished = match.status === "finished";
  const isLive = match.status === "live";

  return (
    <div className={`relative rounded-xl border bg-card p-4 shadow-sm transition-all ${isFinal ? "border-amber-400/50 bg-gradient-to-b from-amber-500/5 to-card" : ""}`}>
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 font-semibold text-muted-foreground">
          <Clock className="h-3.5 w-3.5 text-primary" /> {match.timeSlot}
        </span>
        <div className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          {isAdmin ? (
            <input
              type="text"
              defaultValue={match.court}
              onBlur={(e) => onCourtChange(match.id, e.target.value)}
              className="w-24 rounded border bg-transparent px-1 py-0.5 text-[11px] font-medium outline-none focus:ring-1 focus:ring-primary"
            />
          ) : (
            <span className="text-muted-foreground">{match.court}</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className={`flex items-center justify-between rounded-lg border p-2.5 text-xs transition-colors ${match.winnerId && match.winnerId === match.team1?.id ? "border-emerald-500 bg-emerald-500/10 font-bold" : "bg-muted/30"}`}>
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold text-foreground truncate">{match.team1?.name || "TBA (Waiting)"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold">{match.score1}</span>
            {isAdmin && !isFinished && match.team1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => onScoreChange(match.id, 1, -1)} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold hover:bg-muted-foreground/20">-</button>
                <button onClick={() => onScoreChange(match.id, 1, 1)} className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/30">+</button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => onDeclareWinner(match.id, match.team1!.id)}>Win</Button>
              </div>
            )}
          </div>
        </div>

        <div className={`flex items-center justify-between rounded-lg border p-2.5 text-xs transition-colors ${match.winnerId && match.winnerId === match.team2?.id ? "border-emerald-500 bg-emerald-500/10 font-bold" : "bg-muted/30"}`}>
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold text-foreground truncate">{match.team2?.name || "TBA (Waiting)"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold">{match.score2}</span>
            {isAdmin && !isFinished && match.team2 && (
              <div className="flex items-center gap-1">
                <button onClick={() => onScoreChange(match.id, 2, -1)} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold hover:bg-muted-foreground/20">-</button>
                <button onClick={() => onScoreChange(match.id, 2, 1)} className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/30">+</button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => onDeclareWinner(match.id, match.team2!.id)}>Win</Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t pt-2.5 text-[10px]">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${isFinished ? "bg-emerald-500/10 text-emerald-600" : isLive ? "bg-primary/10 text-primary animate-pulse" : "bg-muted text-muted-foreground"}`}>
          {isFinished ? <CheckCircle2 className="h-3 w-3" /> : isLive ? <ShieldAlert className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          {isFinished ? "Completed" : isLive ? "Live Now" : "Upcoming"}
        </span>
        {match.winnerId && (
          <span className="font-semibold text-emerald-600">Winner decided</span>
        )}
      </div>
    </div>
  );
}
