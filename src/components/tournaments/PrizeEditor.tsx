import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { tournamentCurrencies } from "@/lib/tournament-currencies";
import { prizeMoney, type TournamentPrize, type TournamentTeam } from "@/lib/tournaments";

import type { PrizeDraft } from "@/lib/tournament-prizes";

export function PrizeEditor({
  currency,
  onCurrency,
  pool,
  onPool,
  prizes,
  onChange,
  teams = [],
}: {
  currency: string;
  onCurrency: (value: string) => void;
  pool: string;
  onPool: (value: string) => void;
  prizes: PrizeDraft[];
  onChange: (value: PrizeDraft[]) => void;
  teams?: TournamentTeam[];
}) {
  const digits = tournamentCurrencies.find((c) => c.code === currency)?.decimals ?? 2;
  const step = 10 ** -digits;
  const update = (id: string, patch: Partial<PrizeDraft>) =>
    onChange(prizes.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  return (
    <section className="space-y-4 rounded-xl border p-4" aria-label="Prize configuration">
      <h3 className="font-bold">Prizes & rewards</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          Currency
          <select
            aria-label="Prize currency"
            value={currency}
            onChange={(e) => onCurrency(e.target.value)}
            className="h-10 w-full rounded-md border bg-background px-2"
          >
            {tournamentCurrencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          Total prize pool (optional)
          <Input
            aria-label="Total prize pool"
            type="number"
            min={0}
            max={999999999}
            step={step}
            value={pool}
            onChange={(e) => onPool(e.target.value)}
            placeholder="Not announced"
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Amounts are per recipient. Teams tied at a placement each receive its listed reward. The
        announced pool is entered separately. Changing currency does not convert amounts.
      </p>
      {prizes.map((p, index) => (
        <fieldset key={p.id} className="space-y-3 rounded-lg border bg-background p-3">
          <legend className="px-1 text-sm font-semibold">Prize {index + 1}</legend>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <Label htmlFor={p.id + "-title"}>Prize title</Label>
              <Input
                id={p.id + "-title"}
                required
                maxLength={100}
                value={p.title}
                onChange={(e) => update(p.id, { title: e.target.value })}
                placeholder="Champion, MVP, Best team…"
              />
            </div>
            <Button
              className="mt-5"
              type="button"
              variant="ghost"
              onClick={() => onChange(prizes.filter((prize) => prize.id !== p.id))}
              aria-label={`Remove prize ${index + 1}`}
            >
              Remove
            </Button>
          </div>
          <label className="block text-sm">
            Cash amount (optional)
            <Input
              aria-label={`Prize ${index + 1} amount`}
              type="number"
              min={0}
              max={999999999}
              step={step}
              value={p.amount}
              onChange={(e) => update(p.id, { amount: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Non-cash reward
            <Input
              aria-label={`Prize ${index + 1} non-cash reward`}
              maxLength={1000}
              value={p.non_cash_reward}
              onChange={(e) => update(p.id, { non_cash_reward: e.target.value })}
              placeholder="Trophy, medals, equipment…"
            />
          </label>
          <label className="block text-sm">
            Description
            <Textarea
              aria-label={`Prize ${index + 1} description`}
              maxLength={2000}
              value={p.description}
              onChange={(e) => update(p.id, { description: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Award assignment
            <select
              aria-label={`Prize ${index + 1} assignment`}
              className="h-10 w-full rounded-md border bg-background px-2"
              value={p.placement ? "placement" : "manual"}
              onChange={(e) =>
                update(p.id, {
                  placement: e.target.value === "placement" ? "1" : "",
                  recipient_team_id: null,
                  recipient_player: null,
                })
              }
            >
              <option value="manual">Custom award / choose recipient</option>
              <option value="placement">Automatic final placement</option>
            </select>
          </label>
          {p.placement ? (
            <label className="block text-sm">
              Final placement
              <Input
                aria-label={`Prize ${index + 1} placement`}
                type="number"
                required
                min={1}
                max={32}
                step={1}
                value={p.placement}
                onChange={(e) => update(p.id, { placement: e.target.value })}
              />
            </label>
          ) : (
            <>
              <label className="block text-sm">
                Recipient team
                <select
                  aria-label={`Prize ${index + 1} recipient`}
                  className="h-10 w-full rounded-md border bg-background px-2"
                  value={p.recipient_team_id ?? ""}
                  onChange={(e) =>
                    update(p.id, {
                      recipient_team_id: e.target.value || null,
                      recipient_player: null,
                    })
                  }
                >
                  <option value="">To be announced</option>
                  {teams
                    .filter((t) => ["approved", "withdrawn"].includes(t.registration_status))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </label>
              {p.recipient_team_id && (
                <label className="block text-sm">
                  Recipient player (optional)
                  <select
                    aria-label={`Prize ${index + 1} player`}
                    className="h-10 w-full rounded-md border bg-background px-2"
                    value={p.recipient_player ?? ""}
                    onChange={(e) => update(p.id, { recipient_player: e.target.value || null })}
                  >
                    <option value="">Whole team</option>
                    {[
                      teams.find((t) => t.id === p.recipient_team_id)?.player_one,
                      teams.find((t) => t.id === p.recipient_team_id)?.player_two,
                    ]
                      .filter(Boolean)
                      .map((player, i) => (
                        <option key={i} value={player}>
                          {player}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </>
          )}
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange([
            ...prizes,
            {
              id: crypto.randomUUID(),
              title: "",
              amount: "",
              description: "",
              non_cash_reward: "",
              placement: "",
              recipient_team_id: null,
              recipient_player: null,
            },
          ])
        }
      >
        Add prize
      </Button>
    </section>
  );
}

export function PrizeList({
  prizes,
  currency,
  pool,
}: {
  prizes: TournamentPrize[];
  currency: string;
  pool: number | null;
}) {
  return (
    <section className="rounded-2xl border bg-card p-5" aria-label="Tournament prizes">
      <h3 className="text-lg font-bold">Prizes & rewards</h3>
      {pool != null && (
        <p className="mt-2 text-xl font-bold text-primary">
          {prizeMoney(pool, currency)} total prize pool
        </p>
      )}
      {!prizes.length && (
        <p className="mt-2 text-sm text-muted-foreground">Prizes have not been announced.</p>
      )}
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {prizes.map((p) => (
          <li key={p.id} className="min-w-0 rounded-xl bg-muted/50 p-4">
            <h4 className="break-words font-bold">{p.title}</h4>
            {p.placement && (
              <p className="text-xs text-muted-foreground">Placement {p.placement} · per team</p>
            )}
            {p.amount != null && (
              <p className="mt-1 font-semibold">{prizeMoney(p.amount, currency)}</p>
            )}
            {p.non_cash_reward && <p className="mt-1 break-words text-sm">{p.non_cash_reward}</p>}
            {p.description && (
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                {p.description}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
