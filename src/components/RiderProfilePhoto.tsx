import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, LoaderCircle, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { signedProfilePhotoUrl, uploadPath, validateUpload } from "@/lib/verification";

export const riderPhotoQuery = (userId: string | undefined) => ({
  queryKey: ["rider-photo", userId],
  enabled: Boolean(userId),
  queryFn: async () => {
    if (!userId) return { hasPhoto: false, url: null };
    const [profile, saved] = await Promise.all([
      supabase.from("profiles").select("profile_image_url").eq("id", userId).maybeSingle(),
      supabase.rpc("has_rider_photo", { _user: userId }),
    ]);
    if (profile.error) throw profile.error;
    if (saved.error) throw saved.error;
    return {
      hasPhoto: Boolean(saved.data),
      url: await signedProfilePhotoUrl(profile.data?.profile_image_url ?? null),
    };
  },
});

export function RiderProfilePhoto({ userId }: { userId: string }) {
  const { data, isPending, isError } = useQuery(riderPhotoQuery(userId));
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    const problem = validateUpload(file, "photo");
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setBusy(true);
    const path = uploadPath(userId, file);
    let uploaded = false;
    try {
      const result = await supabase.storage
        .from("profile-pictures")
        .upload(path, file, { contentType: file.type });
      if (result.error) throw result.error;
      uploaded = true;
      const { data: url } = supabase.storage.from("profile-pictures").getPublicUrl(path);
      const saved = await supabase
        .from("profiles")
        .upsert({ id: userId, profile_image_url: url.publicUrl }, { onConflict: "id" })
        .select("id")
        .single();

      if (saved.error) throw saved.error;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["rider-photo", userId] }),
        qc.invalidateQueries({ queryKey: ["verification", userId] }),
        qc.invalidateQueries({ queryKey: ["order-rider"] }),
      ]);
      toast.success("Profile picture saved");
    } catch (e) {
      if (uploaded) await supabase.storage.from("profile-pictures").remove([path]);
      setError(e instanceof Error ? e.message : "Your picture could not be saved.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      aria-label="Rider profile picture"
      className="my-6 flex flex-wrap items-center gap-4 border-y py-5"
    >
      <div className="size-20 shrink-0 overflow-hidden rounded-full border bg-secondary">
        {data?.url ? (
          <img src={data.url} alt="Your rider profile picture" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center">
            <UserRound className="size-8 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold">
          Rider profile picture <span className="text-xs text-destructive">Required</span>
        </h2>
        <p role="status" className="text-sm text-muted-foreground">
          {busy
            ? "Uploading…"
            : isPending
              ? "Loading…"
              : isError
                ? "Picture status unavailable"
                : data?.hasPhoto
                  ? "Picture saved"
                  : "No picture uploaded"}
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <input
        ref={input}
        type="file"
        aria-label="Upload rider profile picture"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void upload(file);
        }}
      />
      <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <Camera />}
        {data?.hasPhoto ? "Change picture" : "Upload picture"}
      </Button>
    </section>
  );
}
