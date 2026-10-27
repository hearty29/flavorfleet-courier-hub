import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, MapPin, Users, Shield, Trash2, Edit3, Plus, CheckCircle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client'; // Adjust to your Supabase client import
import { useToast } from '@/hooks/use-toast';
import { createFileRoute } from '@tanstack/react-router';
import Tournaments from '@/pages/Tournaments'; // Adjust path to where you saved the component

export const Route = createFileRoute('/tournaments')({
  component: Tournaments,
});

export default function Tournaments() {
  const { toast } = useToast();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  
  // Admin Mode State
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [editingTournament, setEditingTournament] = useState<any>(null);

  // Registration Form State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [playerOne, setPlayerOne] = useState('');
  const [playerTwo, setPlayerTwo] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  useEffect(() => {
    fetchTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournament) {
      fetchTeams(selectedTournament.id);
    }
  }, [selectedTournament]);

  const fetchTournaments = async () => {
    const { data, error } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Error fetching tournaments', description: error.message, variant: 'destructive' });
    } else {
      setTournaments(data || []);
      if (data && data.length > 0 && !selectedTournament) {
        setSelectedTournament(data[0]);
      }
    }
  };

  const fetchTeams = async (tournamentId: string) => {
    const { data, error } = await supabase.from('tournament_teams').select('*').eq('tournament_id', tournamentId);
    if (error) {
      toast({ title: 'Error fetching teams', description: error.message, variant: 'destructive' });
    } else {
      setTeams(data || []);
    }
  };

  const handleRegisterTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTournament) return;

    if (teams.length >= selectedTournament.max_teams) {
      toast({ title: 'Tournament is full!', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('tournament_teams').insert([
      {
        tournament_id: selectedTournament.id,
        team_name: teamName,
        player_one: playerOne,
        player_two: playerTwo,
        contact_number: contactNumber,
      },
    ]);

    if (error) {
      toast({ title: 'Registration failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Successfully registered for the tournament!' });
      setShowRegisterModal(false);
      setTeamName('');
      setPlayerOne('');
      setPlayerTwo('');
      setContactNumber('');
      fetchTeams(selectedTournament.id);
    }
  };

  const handleRemoveTeam = async (teamId: string) => {
    if (!isAdminMode) return;
    const { error } = await supabase.from('tournament_teams').delete().eq('id', teamId);
    if (error) {
      toast({ title: 'Failed to remove team', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Team removed successfully' });
      fetchTeams(selectedTournament.id);
    }
  };

  const handleSaveTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from('tournaments')
      .update({
        title: editingTournament.title,
        date: editingTournament.date,
        venue: editingTournament.venue,
        max_teams: editingTournament.max_teams,
        prize_pool: editingTournament.prize_pool,
      })
      .eq('id', editingTournament.id);

    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Tournament updated successfully!' });
      setEditingTournament(null);
      fetchTournaments();
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple admin check (change 'admin123' or connect to your auth role)
    if (adminPassword === 'admin123') {
      setIsAdminMode(true);
      setShowAdminLogin(false);
      setAdminPassword('');
      toast({ title: 'Admin Mode Enabled' });
    } else {
      toast({ title: 'Invalid Admin Password', variant: 'destructive' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header & Admin Toggle */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Trophy className="w-8 h-8 text-amber-500" /> Pickleball Tournaments
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Join upcoming competitive events or track registered teams.</p>
        </div>

        <div className="flex items-center gap-3">
          {isAdminMode ? (
            <button
              onClick={() => setIsAdminMode(false)}
              className="bg-red-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-red-600 transition"
            >
              <Shield className="w-4 h-4" /> Exit Admin Mode
            </button>
          ) : (
            <button
              onClick={() => setShowAdminLogin(true)}
              className="bg-slate-800 text-white dark:bg-slate-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-slate-900 transition"
            >
              <Shield className="w-4 h-4" /> Admin Login
            </button>
          )}
        </div>
      </div>

      {/* Tournament Selector Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tournaments.map((t) => (
          <div
            key={t.id}
            onClick={() => setSelectedTournament(t)}
            className={`p-5 rounded-xl border cursor-pointer transition shadow-sm ${
              selectedTournament?.id === t.id
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                {t.status}
              </span>
              {isAdminMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTournament(t);
                  }}
                  className="text-slate-500 hover:text-emerald-600 p-1"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{t.title}</h3>
            <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {t.date}</div>
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {t.venue}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Selected Tournament Details & Registered Teams */}
      {selectedTournament && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedTournament.title}</h2>
              <p className="text-sm text-slate-500 mt-1">Prize Pool: <span className="font-semibold text-emerald-600">{selectedTournament.prize_pool || 'TBD'}</span></p>
            </div>
            <button
              onClick={() => setShowRegisterModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition shadow-sm"
            >
              <Plus className="w-5 h-5" /> Register Team
            </button>
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <Users className="w-5 h-5 text-emerald-500" /> Registered Teams ({teams.length} / {selectedTournament.max_teams})
              </h3>
            </div>

            {teams.length === 0 ? (
              <p className="text-slate-500 py-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                No teams registered yet. Be the first to join!
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map((team, idx) => (
                  <div key={team.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                        <h4 className="font-bold text-slate-900 dark:text-white">{team.team_name}</h4>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{team.player_one} & {team.player_two}</p>
                      {team.contact_number && <p className="text-xs text-slate-400 mt-1">{team.contact_number}</p>}
                    </div>
                    {isAdminMode && (
                      <button
                        onClick={() => handleRemoveTeam(team.id)}
                        className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                        title="Remove Team"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin Login Modal */}
      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleAdminLogin} className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-sm w-full space-y-4 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Admin Authentication</h3>
              <button type="button" onClick={() => setShowAdminLogin(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-500">Enter your admin password to manage tournaments and teams.</p>
            <input
              type="password"
              placeholder="Password (default: admin123)"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white"
              autoFocus
            />
            <button type="submit" className="w-full bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white py-2.5 rounded-xl font-semibold transition">
              Login as Admin
            </button>
          </form>
        </div>
      )}

      {/* Edit Tournament Modal (Admin) */}
      {editingTournament && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSaveTournament} className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-md w-full space-y-4 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Edit Tournament Info</h3>
              <button type="button" onClick={() => setEditingTournament(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Tournament Title</label>
              <input
                type="text"
                value={editingTournament.title}
                onChange={(e) => setEditingTournament({ ...editingTournament, title: e.target.value })}
                className="w-full px-4 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 mt-1"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Date</label>
              <input
                type="text"
                value={editingTournament.date}
                onChange={(e) => setEditingTournament({ ...editingTournament, date: e.target.value })}
                className="w-full px-4 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 mt-1"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Venue</label>
              <input
                type="text"
                value={editingTournament.venue}
                onChange={(e) => setEditingTournament({ ...editingTournament, venue: e.target.value })}
                className="w-full px-4 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 mt-1"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Max Teams</label>
              <input
                type="number"
                value={editingTournament.max_teams}
                onChange={(e) => setEditingTournament({ ...editingTournament, max_teams: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 mt-1"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Prize Pool</label>
              <input
                type="text"
                value={editingTournament.prize_pool || ''}
                onChange={(e) => setEditingTournament({ ...editingTournament, prize_pool: e.target.value })}
                className="w-full px-4 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 mt-1"
              />
            </div>
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-semibold transition">
              Save Changes
            </button>
          </form>
        </div>
      )}

      {/* Team Registration Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleRegisterTeam} className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-md w-full space-y-4 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Register for Tournament</h3>
              <button type="button" onClick={() => setShowRegisterModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Team Name</label>
              <input
                type="text"
                placeholder="e.g. Smash Masters"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full px-4 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 mt-1"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Player 1 Name</label>
              <input
                type="text"
                placeholder="Full Name"
                value={playerOne}
                onChange={(e) => setPlayerOne(e.target.value)}
                className="w-full px-4 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 mt-1"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Player 2 Name</label>
              <input
                type="text"
                placeholder="Full Name"
                value={playerTwo}
                onChange={(e) => setPlayerTwo(e.target.value)}
                className="w-full px-4 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 mt-1"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Contact Number</label>
              <input
                type="text"
                placeholder="09123456789"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                className="w-full px-4 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 mt-1"
              />
            </div>
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-semibold transition">
              Confirm Registration
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
