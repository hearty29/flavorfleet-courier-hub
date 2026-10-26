import { useState } from "react";
import { Camera, CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

interface ProofOfDeliveryProps {
  orderId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function ProofOfDeliveryModal({ orderId, onSuccess, onClose }: ProofOfDeliveryProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmitDelivery = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);

      // 1. Upload image to Supabase Storage bucket ('delivery-proofs')
      const fileName = `pod_${orderId}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("delivery-proofs")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // 2. Get public URL of the uploaded image
      const { data: publicUrlData } = supabase.storage
        .from("delivery-proofs")
        .getPublicUrl(fileName);

      const photoUrl = publicUrlData.publicUrl;

      // 3. Update the cafe_orders table with status and the photo URL
      const { error: updateError } = await supabase
        .from("cafe_orders")
        .update({
          status: "delivered",
          proof_of_delivery_url: photoUrl,
          delivered_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (updateError) throw updateError;

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error uploading proof of delivery:", error);
      alert("Failed to upload proof of delivery. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl border">
        <div className="flex items-center justify-between border-b pb-4">
          <h3 className="text-lg font-bold">Proof of Delivery</h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          Snap a quick photo of the delivered items or drop-off location to complete this order.
        </p>

        <div className="mt-5">
          {previewUrl ? (
            <div className="relative overflow-hidden rounded-xl border aspect-video bg-muted">
              <img src={previewUrl} alt="Delivery preview" className="h-full w-full object-cover" />
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
                className="absolute top-2 right-2 rounded-full bg-black/70 p-1.5 text-white hover:bg-black"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 cursor-pointer hover:border-primary transition-colors bg-muted/30">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                <Camera className="h-6 w-6" />
              </div>
              <span className="text-sm font-semibold">Take or Upload Photo</span>
              <span className="text-xs text-muted-foreground">Opens camera on mobile devices</span>
              {/* capture="environment" automatically forces the phone's back camera */}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="w-1/2" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button
            className="w-1/2"
            disabled={!selectedFile || uploading}
            onClick={handleSubmitDelivery}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Complete Delivery
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
