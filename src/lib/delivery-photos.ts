import { supabase } from "@/integrations/supabase/client";
import { uploadPath, validateUpload } from "@/lib/verification";

export function requireRiderPhoto(hasPhoto: boolean) {
  if (!hasPhoto) throw new Error("Upload your profile picture first.");
}

export function deliveryProofPath(
  userId: string,
  orderId: string,
  file: Pick<File, "type" | "size">,
) {
  const error = validateUpload(file, "photo");
  if (error) throw new Error(error);
  return uploadPath(`${userId}/${orderId}`, file);
}

export function requireDeliveryProof(path: string | null, userId: string, orderId: string) {
  if (!path || !path.startsWith(`${userId}/${orderId}/`))
    throw new Error("Upload a delivery proof photo first.");
  return path;
}

export async function proofImageUrl(path: string) {
  const { data, error } = await supabase.storage
    .from("delivery-proofs")
    .createSignedUrl(path, 3600);
  if (error || !data) throw error ?? new Error("Delivery proof unavailable.");
  return data.signedUrl;
}
