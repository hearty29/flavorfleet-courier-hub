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
  RefreshCw, 
  X,
  Medal,
  Settings,
  Trash2,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

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
}

const TOURNAMENT_ID = "roadside-open-2026";

function TournamentsPage() {
  const { roles } = useAuth();
  const isAdminUser = roles.includes("admin");

  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isAdminEditOpen, setIsAdminEditOpen] = useState(false);

  // Form states
  const [editDate, setEditDate] = useState("");
  const [editPrize, setEditPrize] = useState("");
  const [editCourts, setEditCourts] = useState("");

  const [teamName, setTeamName] = useState("");
  const [player1, setPlayer1] = useState("");
  const [player2, setPlayer2] = useState("");
  const [contact, setContact] = useState("");
  const [skill, setSkill] = useState<"Beginner" | "Intermediate" | "Advanced">("Intermediate");

  // Fetch all data from Supabase
  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch Tournament Details
      const { data: tourneyData } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", TOURNAMENT_ID)
        .single();

      if (tourneyData) {
        setTournament({
          id: tourneyData.id,
          title: tourneyData.title,
          date: tourneyData.date,
          entryFee: Number(tourneyData.entry_fee),
          prizePool: tourneyData.prize_pool,
          courtsText: tourneyData.courts_text,
          status: tourneyData.status,
        });
        setEditDate(tourneyData.date);
        setEditPrize(tourneyData.prize_pool);
        setEditCourts(tourneyData.courts_text);
      }

      // Fetch Teams
      const { data: teamData } = await supabase
        .from("tournament_teams")
        .select("*")
        .eq("tournament_id", TOURNAMENT_ID)
        .order("created_at", { ascending: true });

      if (teamData) {
        setTeams(
          teamData.map((t: any) => ({
            id: t.id,
            name: t.name,
            player1: t.player1,
            player2: t.player2,
            contact: t.contact,
            skillLevel: t.skill_level,
          }))
        );
      }

      // Fetch Matches
      const { data: matchData } = await supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_id", TOURNAMENT_ID)
        .order("match_number", { ascending: true });

      if (matchData) {
        setMatches(
          matchData.map((m: any) => ({
            id: m.id,
            round: m.round,
            matchNumber: m.match_number,
            score1: m.score1,
            score2: m.score2,
            court: m.court,
            timeSlot: m.time_slot,
            status: m.status,
            winnerId: m.winner_id,
          }))
        );
      }
    } catch (err: any) {
      console.error("Error loading tournament data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Admin: Remove Team directly from Supabase
  const handleRemoveTeam = async (teamId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    const { error } = await supabase
      .from("tournament_teams")
      .delete()
      .eq("id", teamId);

    if (error) {
      toast.error("Failed to delete team: " + error.message);
    } else {
      toast.success(`Team "${name}" deleted successfully.`);
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
    }
  };

  // Admin: Save Settings to Supabase
  const handleSaveAdminSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from("tournaments")
      .update({
        date: editDate,
        prize_pool: editPrize,
        courts_text: editCourts,
      })
      .eq("id", TOURNAMENT_ID);

    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      toast.success("Tournament details saved.");
      setTournament((prev) =>
        prev
          ? { ...prev, date: editDate, prizePool: editPrize, courtsText: editCourts }
          : null
      );
      setIsAdminEditOpen(false);
    }
  };

  // Public: Register Team to Supabase
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !player1.trim() || !contact.trim()) {
      toast.error("Please fill in Team Name, Player 1, and Contact.");
      return;
    }

    if (teams.length >= 8) {
      toast.error("Tournament is full!");
      setIsRegisterOpen(false);
      return;
    }

    const newTeam = {
      id: `t_${Date.now()}`,
      tournament_id: TOURNAMENT_ID,
      name: teamName.trim(),
      player1: player1.trim(),
      player2: player2.trim() || "TBA",
      contact: contact.trim(),
      skill_level: skill,
    };

    const { error } = await supabase.from("tournament_teams").insert([newTeam]);

    if (error) {
      toast.error("Registration failed: " + error.message);
    } else {
      toast.success(`Team "${newTeam.name}" registered!`);
      setIsRegisterOpen(false);
      setTeamName("");
      setPlayer1("");
      setPlayer2("");
      setContact("");
      fetchData(); // Refresh list
    }
  };

  const getTeam = (teamId?: string): Team | undefined => {
    if (!teamId) return undefined;
    return teams.find((t) => t.id === teamId);
  };

  const enrichedMatches = matches.map((m) => {
    if (m.round === 1) {
      if (m.matchNumber === 1) return { ...m, team1: teams[0], team2: teams[1] };
      if (m.matchNumber === 2) return { ...m, team1: teams[2], team2: teams[3] };
      if (m.matchNumber === 3) return { ...m, team1: teams[4], team2: teams[5] };
      if (m.matchNumber === 4) return { ...m, team1: teams[6], team2: teams[7] };
    } else if (m.round === 2) {
      const qf1Winner = matches.find((x) => x.id === "m1")?.winnerId;
      const qf2Winner = matches.find((x) => x.id === "m2")?.winnerId;
      const qf3Winner = matches.find((x) => x.id === "m3")?.winnerId;
      const qf4Winner = matches.find((x) => x.id === "m4")?.winnerId;

      if (m.matchNumber === 5) return { ...m, team1: getTeam(qf1Winner), team2: getTeam(qf2Winner) };
      if (m.matchNumber === 6) return { ...m, team1: getTeam(qf3Winner), team2: getTeam(qf4Winner) };
    } else if (m.round === 3) {
      const sf1Winner = matches.find((x) => x.id === "m5")?.winnerId;
      const sf2Winner = matches.find((x) => x.id === "m6")?.winnerId;
      return { ...m, team1: getTeam(sf1Winner), team2: getTeam(sf2Winner) };
    }
    return m;
  });

  const finalMatch = enrichedMatches.find((m) => m.id === "m7");
  const champion = getTeam(finalMatch?.winnerId);

  if (loading) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
                  {tournament?.status}
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                {tournament?.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground sm:text-sm">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-primary" /> {tournament?.date}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-primary" /> {tournament?.courtsText}
                </span>
                <span className="flex items-center gap-1">
                  <Trophy className="h-4 w-4 text-amber-500" /> Prize: {tournament?.prizePool}
                </span>
              </div>
            </div>

            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Button onClick={() => setIsRegisterOpen(true)} className="flex-1 gap-1.5 sm:flex-initial">
                <PlusCircle className="h-4 w-4" /> Register Team (₱{tournament?.entryFee})
              </Button>
              {isAdminUser && (
                <Button variant="outline" size="sm" onClick={() => setIsAdminEditOpen(true)}>
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

      {/* Registered Teams Directory with Admin Remove */}
      <section className="mx-auto max-w-6xl px-4 pt-8">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-foreground">Registered Teams ({teams.length}/8)</h3>
            <span className="text-xs text-muted-foreground">Standard 2v2 format</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            {teams.map((team, idx) => (
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
