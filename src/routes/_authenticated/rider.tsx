import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { MapPin, Phone, MessageSquare, Volume2, Upload, Headphones } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { peso, uploadPrivate } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ChatModal } from "@/components/ChatModal";

export const Route = createFileRoute("/_authenticated/rider")({
  head: () => ({
    meta: [
      { title: "Rider Dashboard — Roadside Paddles" },
      { name: "description", content: "Accept and deliver orders." },
    ],
  }),
  component: Rider,
});

function playRiderPickupSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
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
    console.error(e);
  }
}

function Rider() {
  const { user, roles, loading } = useAuth();
  const qc = useQueryClient();
  const isRider = roles.includes("rider");

  const [activeChat, setActiveChat] = useState<{
    conversationId: string;
    title: string;
    subtitle?: string;
  } | null>(null);

  const { data: orders = [] } = useQuery({
    queryKey: ["rider-orders", user?.id],
    enabled: isRider,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!isRider) return;
    const ch = supabase
      .channel(`rider-live-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        const nextOrder = payload.new as any;
        if (nextOrder?.status === "preparing" && !nextOrder?.rider_id) {
          playRiderPickupSound();
          toast.info("🛵 New order available for pickup!");
        }
        qc.invalidateQueries({ queryKey: ["rider-orders"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [isRider, qc]);

  if (loading) return null;
  if (!isRider)
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Riders Only</h1>
        <p className="mt-2 text-muted-foreground">Apply as a rider to access deliveries.</p>
      </main>
    );

  const updateStatus = async (id: string, patch: any) => {
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["rider-orders"] });
  };

  const openCustomerChat = async (order: any) => {
    let { data: conv } = await supabase
      .from("chat_conversations")
      .select("id")
      .eq("order_id", order.id)
      .maybeSingle();

    if (!conv) {
      const { data: created } = await supabase
        .from("chat_conversations")
        .insert({
          type: "order",
          order_id: order.id,
          customer_id: order.user_id,
          rider_id: user?.id,
        })
        .select("id")
        .single();
      conv = created;
    }

    if (conv) {
      setActiveChat({
        conversationId: conv.id,
        title: `Chat with ${order.customer_name || "Customer"}`,
        subtitle: `Order #${order.id.slice(0, 8)}`,
      });
    }
  };

  const openAdminSupportChat = async () => {
    if (!user) return;
    let { data: conv } = await supabase
      .from("chat_conversations")
      .select("id")
      .eq("customer_id", user.id)
      .eq("type", "support")
      .maybeSingle();

    if (!conv) {
      const { data: created } = await supabase
        .from("chat_conversations")
        .insert({
          type: "support",
          customer_id: user.id,
        })
        .select("id")
        .single();
      conv = created;
    }

    if (conv) {
      setActiveChat({
        conversationId: conv.id,
        title: "Rider Support Admin",
        subtitle: "Direct line to management",
      });
    }
  };

  const available = orders.filter((o) => !o.rider_id && o.status !== "delivered" && o.status !== "cancelled");
  const mine = orders.filter((o) => o.rider_id === user?.id && o.status !== "delivered");
  const done = orders.filter((o) => o.rider_id === user?.id && o.status === "delivered");

  const OrderCard = ({ o, children }: { o: any; children?: React.ReactNode }) => {
    const cleanPhone = o.phone ? o.phone.replace(/[^0-9+]/g, "") : "";
    return (
      <article className="rounded-2xl border bg-card p-4 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <p className="font-bold">{o.customer_name} · {peso(o.total)}</p>
            <StatusBadge status={o.status} />
          </div>
          <p className="mt-2 flex gap-2 text-sm text-foreground">
            <MapPin className="h-4 w-4 shrink-0 text-primary mt-0.5" />
            <span>{o.address}</span>
          </p>

          {/* Contact Bar */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {cleanPhone && (
              <>
                <Button asChild size="sm" variant="outline" className="h-8 gap-1 border-emerald-600/30 text-emerald-700">
                  <a href={`tel:${cleanPhone}`}><Phone className="h-3.5 w-3.5" /> Call</a>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8 gap-1 border-blue-600/30 text-blue-700">
                  <a href={`sms:${cleanPhone}`}><MessageSquare className="h-3.5 w-3.5" /> SMS</a>
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => openCustomerChat(o)}>
              <MessageSquare className="h-3.5 w-3.5 text-primary" /> In-App Chat
            </Button>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            {(o.items as any[]).map((i) => `${i.qty}× ${i.name}`).join(", ")}
          </p>
          <p className="mt-1 text-sm font-semibold">Collect: {peso(o.total)} ({o.payment_method.toUpperCase()})</p>
        </div>
        <div className="mt-4 flex gap-2">{children}</div>
      </article>
    );
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Rider Dashboard</h1>
          <p className="text-muted-foreground">Delivered today: {done.length}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={openAdminSupportChat}>
            <Headphones className="h-4 w-4 text-primary" /> Support Admin
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={playRiderPickupSound}>
            <Volume2 className="h-4 w-4" /> Test Chime
          </Button>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="text-xl font-bold">My Active Deliveries ({mine.length})</h2>
        {!mine.length && <p className="text-sm text-muted-foreground mt-1">None right now.</p>}
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {mine.map((o) => (
            <OrderCard key={o.id} o={o}>
              {o.status === "preparing" && (
                <Button className="w-full" onClick={() => updateStatus(o.id, { status: "picked_up" })}>
                  Picked up from Store
                </Button>
              )}
              {o.status === "picked_up" && (
                <Button className="w-full" onClick={() => updateStatus(o.id, { status: "delivered" })}>
                  Mark as Delivered
                </Button>
              )}
            </OrderCard>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">Available Orders ({available.length})</h2>
        {!available.length && <p className="text-sm text-muted-foreground mt-1">No orders waiting.</p>}
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {available.map((o) => (
            <OrderCard key={o.id} o={o}>
              <Button className="w-full" onClick={() => updateStatus(o.id, { rider_id: user?.id, status: "preparing" })}>
                Accept Order
              </Button>
            </OrderCard>
          ))}
        </div>
      </section>

      {activeChat && (
        <ChatModal
          isOpen={Boolean(activeChat)}
          onClose={() => setActiveChat(null)}
          conversationId={activeChat.conversationId}
          title={activeChat.title}
          subtitle={activeChat.subtitle}
          userRole="rider"
        />
      )}
    </main>
  );
}
