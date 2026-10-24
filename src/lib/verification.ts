import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ID_TYPES = ["Driver's License", "Passport", "National ID"] as const;
const imageExtensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };

export function validateUpload(file: Pick<File, "size" | "type">, kind: "photo" | "id") {
  if (file.size === 0) return "Choose a file that isn't empty.";
  if (file.size > MAX_UPLOAD_BYTES) return "The file must be 10MB or smaller.";
  if (!imageExtensions[file.type] && !(kind === "id" && file.type === "application/pdf")) return kind === "id" ? "Choose a JPG, PNG, WebP, GIF, AVIF image or PDF." : "Choose a JPG, PNG, WebP, GIF or AVIF image.";
  return null;
}

export function uploadPath(userId: string, file: Pick<File, "type">) {
  return `${userId}/${crypto.randomUUID()}.${imageExtensions[file.type] ?? "pdf"}`;
}

export function verificationSubmission(userId: string, path: string, idType: string) {
  if (!ID_TYPES.some((type) => type === idType)) throw new Error("Choose a valid ID type.");
  return { user_id: userId, id_type: idType, id_document_path: path, id_verification_status: "pending", updated_at: new Date().toISOString() };
}

// Profile photos are stored in a private bucket (public buckets are blocked by workspace
// policy); any signed-in user may read them, so share a short-lived signed URL instead.
export async function signedProfilePhotoUrl(imageUrl: string | null) {
  if (!imageUrl) return null;
  const marker = "/object/public/profile-pictures/";
  const path = imageUrl.split(marker)[1];
  if (!path) return imageUrl;
  const { data } = await supabase.storage.from("profile-pictures").createSignedUrl(decodeURIComponent(path), 3600);
  return data?.signedUrl ?? imageUrl;
}

export const verificationQuery = (userId: string) => queryOptions({
  queryKey: ["verification", userId],
  staleTime: 30_000,
  queryFn: async () => {
    const [profileResult, idResult] = await Promise.all([
      supabase.from("profiles").select("profile_image_url, full_name").eq("id", userId).single(),
      supabase.from("rider_verifications").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (idResult.error) throw idResult.error;
    const photoUrl = await signedProfilePhotoUrl(profileResult.data.profile_image_url);
    return { profile: profileResult.data, verification: idResult.data, photoUrl };
  },
});