import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, LoaderCircle, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { deliveryProofPath, proofImageUrl, requireDeliveryProof } from "@/lib/delivery-photos";

export function DeliveryProofImage({ path }: { path: string | null }) {
  const { data: url, isError } = useQuery({
    queryKey: ["delivery-proof", path],
    enabled: Boolean(path),
    staleTime: 30 * 60 * 1000,
    queryFn: () => (path ? proofImageUrl(path) : null),
  });
  if (!path) return null;
  return (
    <div className="mt-3">
      <p className="mb-2 text-sm font-semibold">Proof of delivery</p>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open delivery proof">
          <img
            src={url}
            alt="Proof of delivery"
            className="aspect-[4/3] w-full max-w-xs rounded-md border object-cover"
          />
        </a>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          {isError ? "Delivery proof could not be loaded." : "Loading delivery proof…"}
        </p>
      )}
    </div>
  );
}

export function DeliveryProofUpload({ orderId, userId }: { orderId: string; userId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [path, setPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const next = deliveryProofPath(userId, orderId, file);
      const { error } = await supabase.storage
        .from("delivery-proofs")
        .upload(next, file, { contentType: file.type });
      if (error) throw error;
      const previous = path;
      setPath(next);
      if (previous) await supabase.storage.from("delivery-proofs").remove([previous]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delivery proof upload failed.");
    } finally {
      setBusy(false);
    }
  };
  const complete = async () => {
    setError(null);
    setBusy(true);
    try {
      const proof = requireDeliveryProof(path, userId, orderId);
      const { error } = await supabase.rpc("rider_complete_delivery", {
        _order: orderId,
        _proof_path: proof,
      });
      if (error) throw error;
      toast.success("Order delivered — proof saved");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["rider-orders"] }),
        qc.invalidateQueries({ queryKey: ["my-orders"] }),
        qc.invalidateQueries({ queryKey: ["admin-orders"] }),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Order could not be marked delivered.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="w-full space-y-3">
      <p className="text-sm font-semibold">
        Delivery proof <span className="text-xs text-destructive">Required</span>
      </p>
      <input
        ref={input}
        type="file"
        aria-label="Upload delivery proof"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        capture="environment"
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void upload(file);
        }}
      />
      <Button
        variant="outline"
        className="w-full"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <Camera />}
        {path ? "Replace delivery photo" : "Upload delivery photo"}
      </Button>
      <DeliveryProofImage path={path} />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button className="w-full" disabled={!path || busy} onClick={() => void complete()}>
        <PackageCheck />
        Mark delivered
      </Button>
    </div>
  );
}
