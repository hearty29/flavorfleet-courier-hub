import { RiderIdUpload } from "@/components/RiderIdUpload";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, Check, LoaderCircle, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { uploadPath, validateUpload, verificationQuery } from "@/lib/verification";

export const Route = createFileRoute("/_authenticated/verification")({
  head: () => ({
    meta: [
      { title: "Rider verification — Roadside Paddles" },
      {
        name: "description",
        content:
          "Manage your Roadside Paddles profile picture and securely submit your rider identification.",
      },
      { property: "og:title", content: "Rider verification — Roadside Paddles" },
      {
        property: "og:description",
        content: "Manage your profile photo and rider identification.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
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
  if (state === "uploading")
    return (
      <span
        role="status"
        className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold"
      >
        <LoaderCircle className="size-3 animate-spin motion-reduce:animate-none" />
        Uploading
      </span>
    );
  if (state === "error")
    return (
      <span
        role="status"
        className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive"
      >
        Upload failed
      </span>
    );
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${saved || state === "saved" ? "bg-success/15 text-foreground" : "bg-muted text-muted-foreground"}`}
    >
      {(saved || state === "saved") && <Check className="size-3" />}
      {saved || state === "saved" ? "Uploaded" : "Not uploaded"}
    </span>
  );
}

function Verification() {
  const { userId } = Route.useLoaderData();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(verificationQuery(userId));
  const [photoState, setPhotoState] = useState<UploadState>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEffect(() => {
    const channel = supabase
      .channel(`verification-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rider_verifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["verification", userId] });
          void queryClient.invalidateQueries({ queryKey: ["rider-id", userId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const setState = setPhotoState;
    const setError = setPhotoError;
    const problem = validateUpload(file, "photo");
    if (problem) {
      setError(problem);
      setState("error");
      return;
    }
    setError(null);
    setState("uploading");
    setPreview(URL.createObjectURL(file));
    const bucket = "profile-pictures";
    const path = uploadPath(userId, file);
    let uploaded = false;
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      uploaded = true;
      {
        const { data: url } = supabase.storage.from(bucket).getPublicUrl(path);
        const { data: saved, error: saveError } = await supabase
          .from("profiles")
          .update({ profile_image_url: url.publicUrl })
          .eq("id", userId)
          .select("id")
          .single();
        if (saveError || !saved) throw saveError ?? new Error("Your photo could not be saved.");
      }
      await queryClient.invalidateQueries({ queryKey: ["verification", userId] });
      setState("saved");
      toast.success("Profile picture saved");
    } catch (error) {
      if (uploaded) await supabase.storage.from(bucket).remove([path]);
      const message = error instanceof Error ? error.message : "Upload failed. Please try again.";
      setError(message);
      setState("error");
      setPreview(null);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 border-b pb-8">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
          <ShieldCheck className="size-5" />
          RIDER ACCOUNT
        </div>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Rider verification</h1>
        <p className="mt-3 text-muted-foreground">
          {data.profile.full_name ? `Welcome, ${data.profile.full_name}.` : "Your rider account."}
        </p>
      </div>
      <section
        aria-labelledby="photo-heading"
        className="grid gap-6 border-b pb-8 sm:grid-cols-[1fr_1.3fr]"
      >
        <div>
          <h2 id="photo-heading" className="flex items-center gap-2 text-xl font-bold">
            <Camera className="size-5 text-primary" />
            Profile picture
          </h2>
          <div className="mt-3">
            <UploadBadge state={photoState} saved={!!data.profile.profile_image_url} />
          </div>
        </div>
        <div className="flex flex-col items-center gap-4 sm:items-start">
          <div className="relative size-36 shrink-0 overflow-hidden rounded-full border-4 border-card bg-secondary ring-1 ring-border">
            {preview || data.photoUrl ? (
              <img
                src={preview ?? data.photoUrl ?? ""}
                alt="Your profile picture"
                className="size-full object-cover"
              />
            ) : (
              <div className="grid size-full place-items-center">
                <UserRound className="size-16 text-muted-foreground" />
              </div>
            )}
          </div>
          <input
            ref={photoInput}
            id="profile-photo"
            aria-label="Choose profile picture"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            className="sr-only"
            disabled={photoState === "uploading"}
            onChange={(event) => void upload(event)}
          />
          <Button
            variant="outline"
            disabled={photoState === "uploading"}
            onClick={() => photoInput.current?.click()}
          >
            <Camera />
            {data.profile.profile_image_url ? "Change picture" : "Choose picture"}
          </Button>
          {photoError && (
            <p role="alert" className="text-sm text-destructive">
              {photoError}
            </p>
          )}
        </div>
      </section>
      <RiderIdUpload userId={userId} />
      <div className="mt-6">
        <Button asChild variant="ghost">
          <Link to="/apply-rider">Rider application</Link>
        </Button>
      </div>
    </main>
  );
}
