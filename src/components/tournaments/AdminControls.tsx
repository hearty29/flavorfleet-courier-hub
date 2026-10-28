import { prizeDrafts, prizePayload } from "@/lib/tournament-prizes";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PrizeEditor } from "./PrizeEditor";
import {
  matchLabel,
  prizeMoney,
  type Tournament,
  type TournamentTeam,
  type TournamentMatch,
  type TournamentPrize,
  type TournamentResult,
  type TournamentAudit,
} from "@/lib/tournaments";

function mutationError(error: unknown) {
  return error && typeof error === "object" && "message" in error
    ? String(error.message)
    : "Could not save. Please try again.";
}
export function TeamManager({
  event,
  team,
  phone,
  onSaved,
}: {
  event: Tournament;
  team: TournamentTeam | null;
  phone: string;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [revision] = useState(event.revision);
  const [status, setStatus] = useState(team?.registration_status ?? "approved");
  const correction = event.status !== "registration" && status !== team?.registration_status;
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const data = new FormData(e.currentTarget);
        setBusy(true);
        try {
          const { error } = await supabase.rpc("manage_pickleball_team", {
            _tournament: event.id,
            _team: team?.id ?? null,
            _name: String(data.get("name")),
            _player_one: String(data.get("one")),
            _player_two: String(data.get("two")),
            _phone: String(data.get("phone")),
            _status: status,
            _reason: String(data.get("reason") ?? ""),
            _confirm: data.get("confirm") === "on",
            _revision: revision,
          });
          if (error) throw error;
          toast.success("Team updated");
          onSaved();
        } catch (error) {
          toast.error(mutationError(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block text-sm">
        Team name
        <Input name="name" defaultValue={team?.name} required minLength={2} maxLength={60} />
      </label>
      <label className="block text-sm">
        Player 1 full name
        <Input name="one" defaultValue={team?.player_one} required minLength={2} maxLength={100} />
      </label>
      <label className="block text-sm">
        Player 2 full name
        <Input name="two" defaultValue={team?.player_two} required minLength={2} maxLength={100} />
      </label>
      <label className="block text-sm">
        Contact phone
        <Input name="phone" defaultValue={phone} required type="tel" minLength={5} maxLength={30} />
      </label>
      <label className="block text-sm">
        Participation
        <select
          aria-label="Participation"
          value={status}
          onChange={(e) => setStatus(e.target.value as TournamentTeam["registration_status"])}
          className="h-10 w-full rounded-md border bg-background px-2"
        >
          {(event.status === "registration"
            ? ["pending", "approved", "rejected", "withdrawn"]
            : team?.registration_status === "approved"
              ? ["approved", "withdrawn"]
              : [team?.registration_status ?? "withdrawn"]
          ).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      {correction && <CorrectionFields />}
      <p className="text-xs text-muted-foreground">
        Team and player names stay synchronized across all matches and results. Contact details
        remain private.
      </p>
      <Button disabled={busy} type="submit">
        {busy ? "Saving…" : "Save team"}
      </Button>
    </form>
  );
}

export function CorrectionFields() {
  return (
    <div className="space-y-3 rounded-lg border border-amber-400 bg-amber-50 p-3 text-amber-950">
      <label className="block text-sm">
        Reason for correction
        <Input
          name="reason"
          required
          minLength={3}
          maxLength={1000}
          placeholder="Explain the correction"
        />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input name="confirm" type="checkbox" required className="mt-1" />I confirm resetting this
        match and affected later results. Previous results stay in history; final placements and
        awards will be recalculated.
      </label>
    </div>
  );
}

export function PrizeManager({
  event,
  prizes,
  teams,
  onSaved,
}: {
  event: Tournament;
  prizes: TournamentPrize[];
  teams: TournamentTeam[];
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(() => prizeDrafts(prizes));
  const [currency, setCurrency] = useState(event.currency ?? "PHP");
  const [pool, setPool] = useState(event.prize_pool == null ? "" : String(event.prize_pool));
  const [busy, setBusy] = useState(false);
  const [revision] = useState(event.revision);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        try {
          const { error } = await supabase.rpc("save_pickleball_prizes", {
            _event: event.id,
            _currency: currency,
            _pool: pool === "" ? null : Number(pool),
            _prizes: prizePayload(draft),
            _revision: revision,
          });
          if (error) throw error;
          toast.success("Prizes updated");
          onSaved();
        } catch (error) {
          toast.error(mutationError(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <PrizeEditor
        currency={currency}
        onCurrency={setCurrency}
        pool={pool}
        onPool={setPool}
        prizes={draft}
        onChange={setDraft}
        teams={teams}
      />
      <Button disabled={busy} type="submit">
        {busy ? "Saving…" : "Save prizes"}
      </Button>
    </form>
  );
}

export function MoveTeams({
  event,
  matches,
  teams,
  onSaved,
}: {
  event: Tournament;
  matches: TournamentMatch[];
  teams: Map<string, TournamentTeam>;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [revision] = useState(event.revision);
  // The conditional reset final has fixed sources and cannot be manually rewired.
  const slots = matches
    .filter((m) => !m.activation_match)
    .flatMap((m) =>
      (["a", "b"] as const).map((side) => ({
        value: m.id + ":" + side,
        label:
          matchLabel(m) +
          " · " +
          side.toUpperCase() +
          " · " +
          (teams.get(m[side === "a" ? "team_a_id" : "team_b_id"] ?? "")?.name ??
            "Awaiting team / bye"),
      })),
    );
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const form = new FormData(e.currentTarget);
        const [from, fromSlot] = String(form.get("from")).split(":");
        const [to, toSlot] = String(form.get("to")).split(":");
        if (!from || !fromSlot || !to || !toSlot || (from === to && fromSlot === toSlot)) {
          toast.error("Choose two different slots");
          return;
        }
        setBusy(true);
        try {
          const { error } = await supabase.rpc("move_pickleball_slot", {
            _from_match: from,
            _from_slot: fromSlot,
            _to_match: to,
            _to_slot: toSlot,
            _reason: String(form.get("reason")),
            _confirm: form.get("confirm") === "on",
            _revision: revision,
          });
          if (error) throw error;
          toast.success("Bracket placements updated");
          onSaved();
        } catch (error) {
          toast.error(mutationError(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-sm text-muted-foreground">
        Swap two bracket slots, including their winner/loser advancement paths. This can transfer
        teams between brackets. Cycles and teams playing themselves are rejected. W = Winner, L =
        Loser, C = Championship.
      </p>
      {["from", "to"].map((name) => (
        <label key={name} className="block text-sm">
          {name === "from" ? "Move from" : "Swap with"}
          <select
            name={name}
            required
            defaultValue=""
            className="h-10 w-full rounded-md border bg-background px-2"
          >
            <option value="" disabled>
              Choose a match slot
            </option>
            {slots.map((slot) => (
              <option key={slot.value} value={slot.value}>
                {slot.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <CorrectionFields />
      <Button disabled={busy} type="submit">
        {busy ? "Updating…" : "Confirm placement correction"}
      </Button>
    </form>
  );
}

export function AdminDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function FinalResults({
  event,
  results,
  prizes,
  teams,
}: {
  event: Tournament;
  results: TournamentResult[];
  prizes: TournamentPrize[];
  teams: Map<string, TournamentTeam>;
}) {
  if (event.status !== "completed") return null;
  return (
    <section className="rounded-2xl border bg-card p-5" aria-label="Final standings">
      <h3 className="text-lg font-bold">Final placements & awards</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Placements follow elimination round; teams eliminated in the same round share a placement.
      </p>
      <ol className="mt-4 space-y-3">
        {[...results]
          .sort((a, b) => (a.placement ?? 999) - (b.placement ?? 999))
          .map((r) => {
            const awards = prizes.filter((p) =>
              p.placement != null ? p.placement === r.placement : p.recipient_team_id === r.team_id,
            );
            return (
              <li key={r.team_id} className="rounded-xl bg-muted/40 p-3">
                <p className="font-bold">
                  {r.placement === 1
                    ? "Champion"
                    : r.placement === 2
                      ? "Runner-up"
                      : r.placement
                        ? `Placement ${r.placement}`
                        : "Withdrawn"}{" "}
                  · {teams.get(r.team_id)?.name ?? "Team unavailable"}
                </p>
                {awards.length ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {awards.map((p) => (
                      <li key={p.id} className="break-words">
                        {p.title}
                        {p.recipient_player ? ` — ${p.recipient_player}` : ""}
                        {p.amount != null ? ` · ${prizeMoney(p.amount, event.currency)}` : ""}
                        {p.non_cash_reward ? ` · ${p.non_cash_reward}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">No award assigned</p>
                )}
              </li>
            );
          })}
      </ol>
    </section>
  );
}

function historySummary(value: unknown, teams: Map<string, TournamentTeam>) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!("state" in row)) return null;
  const name = (key: string) => teams.get(String(row[key]))?.name ?? "Awaiting team";
  return `${name("team_a_id")} ${row["score_a"] ?? "—"} : ${row["score_b"] ?? "—"} ${name("team_b_id")} (${row["state"]})`;
}
export function MatchHistory({
  entries,
  teams,
}: {
  entries: TournamentAudit[];
  teams: Map<string, TournamentTeam>;
}) {
  return (
    <details className="rounded-2xl border bg-card p-5">
      <summary className="cursor-pointer font-bold">Tournament history</summary>
      <p className="mt-2 text-xs text-muted-foreground">
        Latest 100 changes. Earlier records remain saved in the database.
      </p>
      <ol className="mt-3 space-y-3">
        {entries.map((entry) => (
          <li key={entry.id} className="border-b pb-3 text-sm">
            <p className="font-semibold">{entry.reason}</p>
            <time className="text-xs text-muted-foreground">
              {new Date(entry.created_at).toLocaleString()} · {entry.action.replaceAll("_", " ")}
            </time>
            {historySummary(entry.before_data, teams) && (
              <p>Before: {historySummary(entry.before_data, teams)}</p>
            )}
            {historySummary(entry.after_data, teams) && (
              <p>After: {historySummary(entry.after_data, teams)}</p>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}
