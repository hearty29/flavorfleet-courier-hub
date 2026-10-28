import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tournament } from "@/lib/tournaments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function TournamentCleanup({
  events,
  all,
  onClose,
  onDeleted,
  onError,
}: {
  events: Tournament[];
  all: boolean;
  onClose: () => void;
  onDeleted: (ids: string[]) => Promise<void>;
  onError: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const phrase = all ? "DELETE ALL TOURNAMENTS" : events[0]!.title;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            {all ? "Clear all tournaments?" : "Delete tournament?"}
          </DialogTitle>
          <DialogDescription>
            Permanently delete {all ? `all ${events.length} tournaments` : `“${events[0]!.title}”`},
            including teams, private contacts, brackets, scores, final standings, prizes, livestream
            settings and history. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {all && (
          <ul
            aria-label="Tournaments to delete"
            className="max-h-40 list-inside list-disc overflow-y-auto rounded-lg border p-3 text-sm"
          >
            {events.map((event) => (
              <li key={event.id} className="break-words">
                {event.title}
              </li>
            ))}
          </ul>
        )}
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy || !acknowledged || confirmation !== phrase) return;
            setBusy(true);
            setError("");
            try {
              const { error: failure } = await supabase.rpc("admin_delete_pickleball_tournaments", {
                _events: events.map((event) => ({ id: event.id, revision: event.revision })),
                _all: all,
                _confirmation: confirmation,
              });
              if (failure) throw failure;
              await onDeleted(events.map((event) => event.id));
            } catch (failure) {
              setError(
                failure && typeof failure === "object" && "message" in failure
                  ? String(failure.message)
                  : "Could not delete tournaments. Please try again.",
              );
              onError();
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="cleanup-confirmation">Type {phrase} to confirm</Label>
            <Input
              id="cleanup-confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              disabled={busy}
              autoComplete="off"
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              disabled={busy}
              className="mt-1"
            />
            I understand that all selected tournament data and history will be permanently removed.
          </label>
          {error && (
            <p role="alert" className="break-words text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Keep tournaments
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={busy || !acknowledged || confirmation !== phrase}
            >
              {busy
                ? "Deleting…"
                : all
                  ? "Permanently delete all tournaments"
                  : "Permanently delete tournament"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
