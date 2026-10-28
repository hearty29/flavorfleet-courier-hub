import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Database } from "@/integrations/supabase/types";
import { RiderProfilePhoto, riderPhotoQuery } from "@/components/RiderProfilePhoto";
import { DeliveryProofImage, DeliveryProofUpload } from "@/components/DeliveryProof";
import { requireRiderPhoto } from "@/lib/delivery-photos";
import { toast } from "sonner";
import { MapPin, Phone, MessageSquare, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { peso } from "@/lib/cart";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ChatButton, SupportInbox } from '@/components/SupportChat';

export const Route = createFileRoute("/_authenticated/rider")({
  head: () => ({
    meta: [
      { title: "Rider dashboard — Roadside Cafe" },
      { name: "description", content: "Accept and deliver Roadside Cafe orders." },
      { property: "og:title", content: "Rider dashboard — Roadside Cafe" },
      { property: "og:description", content: "Accept and deliver Roadside Cafe orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Rider,
});

// Upbeat 3-tone chime when an order is ready for pickup
function playRiderPickupSound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [659.25, 830.61, 987.77].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.12;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.3, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.28);
    });
  } catch (e) {
    console.error("Audio error:", e);
  }
}

function OrderCard({
    o,
    children,
  }: {
    o: Database["public"]["Tables"]["orders"]["Row"] & { order_items: Database["public"]["Tables"]["order_items"]["Row"][] };
    children?: React.ReactNode;
  }) {
    const cleanPhone = o.phone ? o.phone.replace(/[^0-9+]/g, "") : "";
    const customerGreeting = o.customer_name ? ` ${o.customer_name}` : "";
    const smsText = encodeURIComponent(
      `Hello${customerGreeting}! I'm your Roadside Cafe delivery rider. I'm on my way with your order.`
    );

    return (
      <article className="rounded-2xl border bg-card p-4 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <p className="font-bold">
              {o.customer_name || "Customer"} · {peso(o.total)}
            </p>
            <StatusBadge status={o.status} />
          </div>

          <p className="mt-2 flex gap-2 text-sm text-foreground">
            <MapPin className="h-4 w-4 shrink-0 text-primary mt-0.5" />
            <span>{o.address}</span>
          </p>

          {/* Quick Contact Buttons */}
          {cleanPhone && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400"
              >
                <a href={`tel:${cleanPhone}`}>
                  <Phone className="h-3.5 w-3.5 text-emerald-600" />
                  Call
                </a>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 border-blue-600/30 text-blue-700 hover:bg-blue-50 dark:text-blue-400"
              >
                <a href={`sms:${cleanPhone}?body=${smsText}`}>
                  <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                  SMS
                </a>
              </Button>
              <span className="text-xs text-muted-foreground font-mono">{o.phone}</span>
            </div>
          )}

          {o.notes && <p className="mt-2 text-sm text-muted-foreground">Note: {o.notes}</p>}
          <p className="mt-2 text-sm text-muted-foreground">
            {o.order_items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
          </p>
          <p className="mt-1 text-sm font-semibold">Collect cash: {peso(o.total)}</p>
          {o.rider_id && <div className="mt-3"><ChatButton kind="order_rider" orderId={o.id} label="Chat with customer" /></div>}
        </div>

        <div className="mt-4 flex gap-2">{children}</div>
      </article>
    );
  }


function Rider() {
  const { session, roles, loading } = useAuth();
  const qc = useQueryClient();
  const uid = session?.user.id;
  const isRider = roles.includes("rider");
  const { data: photo } = useQuery(riderPhotoQuery(uid));

  const { data: orders = [] } = useQuery({
    queryKey: ["rider-orders", uid],
    enabled: isRider,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .in("status", ["ready", "picked_up", "delivered"])
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!isRider) return;
    const ch = supabase
      .channel(`rider-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          const nextOrder = payload.new as {
            status?: string;
            rider_id?: string | null;
            id?: string;
          };
          // Alert rider if an order just became ready and hasn't been taken yet
          if (nextOrder?.status === "ready" && !nextOrder?.rider_id) {
            playRiderPickupSound();
            toast.success("🛵 New order ready for pickup!", {
              description: "Check Available Orders below to accept.",
            });
          }
          qc.invalidateQueries({ queryKey: ["rider-orders"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [isRider, qc]);

  if (loading) return null;
  if (!isRider)
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Riders only</h1>
        <p className="mt-2 text-muted-foreground">Apply as a rider to access this dashboard.</p>
      </main>
    );

  const act = async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await fn();
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["rider-orders"] });
  };

  const available = orders.filter((o) => !o.rider_id && o.status === "ready");
  const mine = orders.filter((o) => o.rider_id === uid && o.status !== "delivered");
  const done = orders.filter((o) => o.rider_id === uid && o.status === "delivered");


  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Rider dashboard</h1>
          <p className="text-muted-foreground">
            Delivered today:{" "}
            {
              done.filter(
                (o) => new Date(o.updated_at).toDateString() === new Date().toDateString()
              ).length
            }
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={() => {
            playRiderPickupSound();
            toast.success("Rider alert chime played!");
          }}
        >
          <Volume2 className="h-4 w-4" />
          Test Rider Chime
        </Button>
      </div>

      {uid && <RiderProfilePhoto userId={uid} />}
      <div className="mt-4"><ChatButton kind="rider_admin" label="Contact admin" /></div>

      <section className="mt-6">
        <h2 className="text-xl font-bold">My active deliveries</h2>
        {!mine.length && <p className="text-sm text-muted-foreground mt-1">None right now.</p>}
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {mine.map((o) => (
            <OrderCard key={o.id} o={o}>
              {o.status === "ready" && (
                <Button
                  className="w-full"
                  onClick={() =>
                    act(() =>
                      supabase.rpc("rider_update_status", {
                        _order: o.id,
                        _status: "picked_up",
                      })
                    )
                  }
                >
                  Picked up Order
                </Button>
              )}
              {o.status === "picked_up" && uid && <DeliveryProofUpload orderId={o.id} userId={uid} />}
            </OrderCard>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">Available orders</h2>
        {!available.length && (
          <p className="text-sm text-muted-foreground mt-1">No orders waiting for pickup.</p>
        )}
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {available.map((o) => (
            <OrderCard key={o.id} o={o}>
              <Button
                className="w-full"
                disabled={!photo?.hasPhoto}
                onClick={() => {
                  try { requireRiderPhoto(Boolean(photo?.hasPhoto)); }
                  catch (e) { toast.error(e instanceof Error ? e.message : "Upload your profile picture first."); return; }
                  void act(() => supabase.rpc("rider_accept_order", { _order: o.id }));
                }}
              >
                Accept Order
              </Button>
            </OrderCard>
          ))}
        </div>
      </section>
      <section className="mt-8">
        <h2 className="text-xl font-bold">Completed deliveries</h2>
        {!done.length && <p className="mt-1 text-sm text-muted-foreground">No completed deliveries yet.</p>}
        <div className="mt-3 grid gap-4 md:grid-cols-2">{done.map((o) => <OrderCard key={o.id} o={o}><DeliveryProofImage path={o.proof_of_delivery_path} /></OrderCard>)}</div>
      </section>
      <section className="mt-8"><h2 className="mb-3 text-xl font-bold">My conversations</h2><SupportInbox /></section>
    </main>
  );
}
