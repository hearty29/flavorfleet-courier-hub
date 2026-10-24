import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, Check, FileCheck2, FileText, LoaderCircle, ShieldCheck, Upload, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { ID_TYPES, uploadPath, validateUpload, verificationQuery, verificationSubmission } from "@/lib/verification";

export const Route = createFileRoute("/_authenticated/verification")({
  head: () => ({ meta: [
    { title: "Rider verification — Roadside Paddles" },
    { name: "description", content: "Manage your Roadside Paddles profile picture and securely submit your rider identification." },
    { property: "og:title", content: "Rider verification — Roadside Paddles" },
    { property: "og:description", content: "Manage your profile photo and rider identification." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  loader: async ({ context }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("Please sign in to view verification.");
    await context.queryClient.ensureQueryData(verificationQuery(data.user.id));
    return { userId: data.user.id };
  },
  component: Verification,
});

type UploadState = "idle" | "uploading" | "saved" | "error";
function UploadBadge({ state, saved }: { state: UploadState; saved: boolean }) {
  if (state === "uploading") return <span role="status" className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold"><LoaderCircle className="size-3 animate-spin motion-reduce:animate-none" />Uploading</span>;
  if (state === "error") return <span role="status" className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">Upload failed</span>;
  return <span role="status" className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${saved || state === "saved" ? "bg-success/15 text-foreground" : "bg-muted text-muted-foreground"}`}>{(saved || state === "saved") && <Check className="size-3" />}{saved || state === "saved" ? "Uploaded" : "Not uploaded"}</span>;
}

function Verification() {
  const { userId } = Route.useLoaderData();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(verificationQuery(userId));
  const [photoState, setPhotoState] = useState<UploadState>("idle");
  const [idState, setIdState] = useState<UploadState>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const [idType, setIdType] = useState(data.verification?.id_type ?? "");
  const photoInput = useRef<HTMLInputElement>(null);
  const idInput = useRef<HTMLInputElement>(null);
  const id = data.verification;

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    const channel = supabase.channel(`verification-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rider_verifications", filter: `user_id=eq.${userId}` }, () => queryClient.invalidateQueries({ queryKey: ["verification", userId] }))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  const upload = async (event: ChangeEvent<HTMLInputElement>, kind: "photo" | "id") => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const setState = kind === "photo" ? setPhotoState : setIdState;
    const setError = kind === "photo" ? setPhotoError : setIdError;
    const problem = validateUpload(file, kind) ?? (kind === "id" && !ID_TYPES.some((type) => type === idType) ? "Choose an ID type first." : null);
    if (problem) { setError(problem); setState("error"); return; }
    setError(null);
    setState("uploading");
    if (kind === "photo") setPreview(URL.createObjectURL(file));
    const bucket = kind === "photo" ? "profile-pictures" : "rider-ids";
    const path = uploadPath(userId, file);
    let uploaded = false;
    try {
      const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      uploaded = true;
      if (kind === "photo") {
        const { data: url } = supabase.storage.from(bucket).getPublicUrl(path);
        const { data: saved, error: saveError } = await supabase.from("profiles").update({ profile_image_url: url.publicUrl }).eq("id", userId).select("id").single();
        if (saveError || !saved) throw saveError ?? new Error("Your photo could not be saved.");
      } else {
        const { error: saveError } = await supabase.from("rider_verifications").upsert(verificationSubmission(userId, path, idType), { onConflict: "user_id" });
        if (saveError) throw saveError;
      }
      await queryClient.invalidateQueries({ queryKey: ["verification", userId] });
      setState("saved");
      toast.success(kind === "photo" ? "Profile picture saved" : "ID submitted for verification");
    } catch (error) {
      if (uploaded) await supabase.storage.from(bucket).remove([path]);
      const message = error instanceof Error ? error.message : "Upload failed. Please try again.";
      setError(message);
      setState("error");
      if (kind === "photo") setPreview(null);
    }
  };

  const viewId = async () => {
    if (!id?.id_document_path) return;
    const { data: signed, error } = await supabase.storage.from("rider-ids").createSignedUrl(id.id_document_path, 60);
    if (error || !signed) { toast.error("Your ID could not be opened. Try again."); return; }
    window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
  };

  return <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
    <div className="mb-8 border-b pb-8">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary"><ShieldCheck className="size-5" />RIDER ACCOUNT</div>
      <h1 className="text-3xl font-extrabold sm:text-4xl">Rider verification</h1>
      <p className="mt-3 text-muted-foreground">{data.profile.full_name ? `Welcome, ${data.profile.full_name}.` : "Your rider account."}</p>
    </div>
    <section aria-labelledby="photo-heading" className="grid gap-6 border-b pb-8 sm:grid-cols-[1fr_1.3fr]">
      <div><h2 id="photo-heading" className="flex items-center gap-2 text-xl font-bold"><Camera className="size-5 text-primary" />Profile picture</h2><div className="mt-3"><UploadBadge state={photoState} saved={!!data.profile.profile_image_url} /></div></div>
      <div className="flex flex-col items-center gap-4 sm:items-start">
        <div className="relative size-36 shrink-0 overflow-hidden rounded-full border-4 border-card bg-secondary ring-1 ring-border">
          {preview || data.photoUrl ? <img src={preview ?? data.photoUrl ?? ""} alt="Your profile picture" className="size-full object-cover" /> : <div className="grid size-full place-items-center"><UserRound className="size-16 text-muted-foreground" /></div>}
        </div>
        <input ref={photoInput} id="profile-photo" aria-label="Choose profile picture" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="sr-only" disabled={photoState === "uploading"} onChange={(event) => void upload(event, "photo")} />
        <Button variant="outline" disabled={photoState === "uploading"} onClick={() => photoInput.current?.click()}><Camera />{data.profile.profile_image_url ? "Change picture" : "Choose picture"}</Button>
        {photoError && <p role="alert" className="text-sm text-destructive">{photoError}</p>}
      </div>
    </section>
    <section aria-labelledby="id-heading" className="grid gap-6 border-b py-8 sm:grid-cols-[1fr_1.3fr]">
      <div><h2 id="id-heading" className="flex items-center gap-2 text-xl font-bold"><FileCheck2 className="size-5 text-primary" />Valid ID upload</h2><div className="mt-3 flex flex-wrap items-center gap-2"><UploadBadge state={idState} saved={!!id?.id_document_path} />{id?.id_document_path && <StatusBadge status={id.id_verification_status} />}</div><p className="mt-4 text-sm text-muted-foreground">Private · Visible only to you and authorized reviewers</p></div>
      <div className="min-w-0 space-y-4">
        <div className="space-y-2"><Label htmlFor="id-type">ID type</Label><Select value={idType} onValueChange={setIdType} disabled={idState === "uploading"}><SelectTrigger id="id-type" className="w-full"><SelectValue placeholder="Select ID type" /></SelectTrigger><SelectContent>{ID_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="id-document">ID document</Label><input ref={idInput} id="id-document" aria-label="Upload ID document" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf" disabled={!idType || idState === "uploading"} onChange={(event) => void upload(event, "id")} className="block w-full min-w-0 rounded-md border bg-card p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-secondary-foreground disabled:opacity-50" /><p className="text-xs text-muted-foreground">Image or PDF · Maximum 10MB</p></div>
        {id?.id_document_path && <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-3"><div className="flex min-w-0 items-center gap-2 text-sm"><FileText className="size-5 shrink-0 text-primary" /><span>{id.id_type} · {id.id_document_path.endsWith(".pdf") ? "PDF" : "Image"}</span></div><Button variant="ghost" size="sm" onClick={() => void viewId()}>View ID</Button></div>}
        {idState === "uploading" && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Upload className="size-4" />Saving your document…</p>}
        {idError && <p role="alert" className="text-sm text-destructive">{idError}</p>}
      </div>
    </section>
    <div className="mt-6"><Button asChild variant="ghost"><Link to="/apply-rider">Rider application</Link></Button></div>
  </main>;
}