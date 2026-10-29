import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ID_TYPES,
  riderIdQuery,
  uploadPath,
  validateUpload,
  verificationSubmission,
} from "@/lib/verification";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";

async function viewId(path: string) {
  const { data, error } = await supabase.storage.from("rider-ids").createSignedUrl(path, 60);
  if (error || !data) throw error ?? new Error("Your ID could not be opened.");
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

export function RiderIdReview({ userId }: { userId: string }) {
  const { data, isPending, isError } = useQuery(riderIdQuery(userId));
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="my-3 rounded-lg border p-3 text-sm">
      <p className="font-semibold">Valid ID</p>
      {isPending ? (
        <p>Loading ID…</p>
      ) : isError ? (
        <p role="alert">ID status unavailable. Retry before approving.</p>
      ) : (
        <>
          <p>
            {data?.verification?.id_type ?? "No ID submitted"}
            {!data?.hasId && " · An accepted ID is required before approval."}
          </p>
          {data?.verification?.id_document_path && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => {
                setError(null);
                void viewId(data.verification!.id_document_path!).catch(() =>
                  setError("The ID could not be opened. Please try again."),
                );
              }}
            >
              View private ID
            </Button>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function RiderIdUpload({ userId }: { userId: string }) {
  const { data, isPending, isError, refetch } = useQuery(riderIdQuery(userId));
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [idType, setIdType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedType =
    idType ||
    (ID_TYPES.some((type) => type === data?.verification?.id_type)
      ? data?.verification?.id_type
      : "") ||
    "";
  const upload = async (file: File | undefined) => {
    if (!file || busy) return;
    const problem =
      validateUpload(file, "id") ?? (!selectedType ? "Choose an ID type first." : null);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    const path = uploadPath(userId, file);
    let uploaded = false;
    try {
      const result = await supabase.storage
        .from("rider-ids")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (result.error) throw result.error;
      uploaded = true;
      const saved = await supabase
        .from("rider_verifications")
        .upsert(verificationSubmission(userId, path, selectedType), { onConflict: "user_id" });
      if (saved.error) throw saved.error;
      uploaded = false; // The file is now referenced; only clean up unsaved uploads.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["rider-id", userId] }),
        qc.invalidateQueries({ queryKey: ["verification", userId] }),
      ]);
    } catch (e) {
      if (uploaded) await supabase.storage.from("rider-ids").remove([path]);
      setError(e instanceof Error ? e.message : "Your ID could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      aria-label="Required valid ID"
      className="my-6 space-y-4 rounded-xl border bg-card p-4"
    >
      <div>
        <h2 className="font-bold">
          Valid ID <span className="text-xs text-destructive">Required</span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Accepted: School ID, National ID, or Passport. Upload a clear image or PDF, up to 10MB.
          Your ID is private and visible only to you and admins.
        </p>
      </div>
      <p role="status" className="text-sm">
        {busy
          ? "Uploading ID…"
          : isPending
            ? "Loading ID status…"
            : isError
              ? "ID status unavailable"
              : data?.hasId
                ? "ID uploaded — ready for application review"
                : "Upload an accepted ID before applying."}
      </p>
      {isError && (
        <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
          Retry ID status
        </Button>
      )}
      {data?.verification?.id_document_path && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>{data.verification.id_type}</span>
          <StatusBadge status={data.verification.id_verification_status} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setError(null);
              void viewId(data.verification!.id_document_path!).catch(() =>
                setError("Your ID could not be opened. Please try again."),
              );
            }}
          >
            View ID
          </Button>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="rider-id-type">ID type</Label>
        <select
          id="rider-id-type"
          value={selectedType}
          onChange={(e) => setIdType(e.target.value)}
          disabled={busy}
          className="block w-full rounded-md border bg-background p-2 text-sm"
        >
          <option value="">Select ID type</option>
          {ID_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="rider-id-file">ID document</Label>
        <input
          ref={input}
          id="rider-id-file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf"
          disabled={busy || !selectedType}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void upload(file);
          }}
          className="block w-full min-w-0 rounded-md border bg-background p-2 text-sm file:mr-2 file:rounded file:border-0 file:bg-secondary file:p-2 disabled:opacity-50"
        />
        <p className="text-xs text-muted-foreground">
          Selecting another type takes effect when you upload its document. Uploading an ID does not
          automatically approve your rider application.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
