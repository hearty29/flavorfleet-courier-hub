import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Check, ChefHat, Bike, PackageCheck, ShoppingBag, MessageSquare, Headphones } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { peso, signedUrl } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ChatModal } from "@/components/ChatModal";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "My orders — Roadside Paddles" },
      { name: "description", content: "Track your food deliveries." },
    ],
  }),
  component: Orders,
});

const TRACKING_STEPS = [
  { id: "pending", label: "Placed", desc: "Order received", icon: ShoppingBag },
  { id: "preparing", label: "Preparing", desc: "In the kitchen", icon: ChefHat },
  { id: "ready", label: "Ready", desc: "Waiting for pickup", icon: PackageCheck },
  { id: "picked_up", label: "On the Way", desc: "Rider is heading to you", icon: Bike },
  { id: "delivered", label: "Delivered", desc: "Enjoy your meal!", icon: Check },
];

function OrderTracker({ status }: { status: string }) {
  if (status === "cancelled") return null;
  const currentIdx = TRACKING_STEPS.findIndex((s) => s.id === status);
  const progressPercent = currentIdx <= 0 ? 0 : (currentIdx / (TRACKING_STEPS.length - 1)) * 100;
  const isOrderDelivered = status === "delivered";

  return (
    <div className="relative my-6 px-1 sm:px-3">
      <div className="flex items-center justify-between">
        {TRACKING_STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isDone = idx < currentIdx || (isOrderDelivered && idx === currentIdx);
          const isCurrent = !isOrderDelivered && idx === currentIdx;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center text-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all sm:h-10 sm:w-10 ${
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground shadow-md ring-4 ring-primary/40 animate-pulse"
                    : isDone
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30 bg-background text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className={`mt-2 text-[11px] font-semibold sm:text-xs ${isCurrent ? "text-primary" : isDone ? "text-foreground" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="absolute top-[18px] left-6 right-6 -z-0 h-1 -translate-y-1/2 bg-muted sm:top-[20px] sm:left-8 sm:right-8">
        <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }} />
      </div>
    </div>
  );
}

function Orders() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeChat, setActiveChat] = useState<{
    conversationId: string;
    title: string;
    subtitle?: string;
    isDelivered?: boolean;
  } | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ["my-bookings", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("court_bookings").select("*, courts(name)").eq("user_id", user!.id).order("booking_date", { ascending: false })).data ?? [],
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`orders-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["my-orders"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

  const openOrderChat = async (orderId: string, riderId: string | null, isDelivered: boolean) => {
    if (!user) return;
    let { data: conv } = await supabase
      .from("chat_conversations")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();

    if (!conv) {
      const { data: created } = await supabase
        .from("chat_conversations")
        .insert({
          type: "order",
          order_id: orderId,
          customer_id: user.id,
          rider_id: riderId,
        })
        .select("id")
        .single();
      conv = created;
    }

    if (conv) {
      setActiveChat({
        conversationId: conv.id,
        title: "Chat with Delivery Rider",
        subtitle: `Order #${orderId.slice(0, 8)}`,
        isDelivered,
      });
    }
  };

  const openSupportChat = async () => {
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
        title: "Customer Support Admin",
        subtitle: "We typically reply in a few minutes",
        isDelivered: false,
      });
    }
  };

  const cancel = async (id: string) => {
    const { error } = await supabase.rpc("cancel_my_order", { _order_id: id });
    if (error) toast.error(error.message);
    else {
      toast.success("Order cancelled");
      qc.invalidateQueries({ queryKey: ["my-orders"] });
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Orders</h1>
        <Button variant="outline" size="sm" className="gap-2" onClick={openSupportChat}>
          <Headphones className="w-4 h-4 text-primary" />
          Support Chat
        </Button>
      </div>

      {isLoading && <p className="mt-4 text-muted-foreground">Loading orders...</p>}
      {!isLoading && !orders.length && (
        <p className="mt-4 text-muted-foreground">No orders yet. Head to the menu to place an order!</p>
      )}

      <div className="mt-6 space-y-4">
        {orders.map((o) => {
          const isDelivered = o.status === "delivered";
          return (
            <article key={o.id} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-muted-foreground">
                    #{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleString()}
                  </p>
                  <p className="text-xl font-bold">{peso(o.total)}</p>
                </div>
                <StatusBadge status={o.status} />
              </div>

              <OrderTracker status={o.status} />

              {/* Rider assigned details & Chat Button */}
              {o.rider_id && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-y py-3">
                  <div className="flex items-center gap-2">
                    <Bike className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Assigned Delivery Rider</p>
                      <p className="text-sm font-semibold">On the road</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                    onClick={() => openOrderChat(o.id, o.rider_id, isDelivered)}
                  >
                    <MessageSquare className="h-4 w-4" />
                    {isDelivered ? "Past Rider Chat" : "Chat with Rider"}
                  </Button>
                </div>
              )}

              <ul className="mt-4 divide-y divide-border/40 text-sm">
                {(o.items as any[]).map((it, idx) => (
                  <li key={idx} className="py-1 flex justify-between">
                    <span>{it.qty}× {it.name}</span>
                    <span>{peso(it.price * it.qty)}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-3 text-sm text-muted-foreground">
                {o.payment_method.toUpperCase()} · {o.address}
              </p>

              {o.status === "pending" && (
                <Button variant="outline" size="sm" className="mt-4" onClick={() => cancel(o.id)}>
                  Cancel order
                </Button>
              )}
            </article>
          );
        })}
      </div>

      {/* Court Bookings */}
      <h2 className="mt-12 text-2xl font-bold">Court Bookings</h2>
      {!bookings.length && <p className="mt-4 text-muted-foreground">No bookings yet.</p>}
      <div className="mt-4 space-y-3">
        {bookings.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 text-sm">
            <span className="font-semibold">{(b.courts as any)?.name}</span>
            <span>{b.booking_date} · {b.start_hour}:00–{b.start_hour + 1}:00</span>
            <span>{peso(b.total)}</span>
            <span className="ml-auto"><StatusBadge status={b.status} /></span>
          </div>
        ))}
      </div>

      {/* Realtime Chat Dialog */}
      {activeChat && (
        <ChatModal
          isOpen={Boolean(activeChat)}
          onClose={() => setActiveChat(null)}
          conversationId={activeChat.conversationId}
          title={activeChat.title}
          subtitle={activeChat.subtitle}
          userRole="customer"
          isOrderDelivered={activeChat.isDelivered}
          onOpenAdminSupport={openSupportChat}
        />
      )}
    </main>
  );
}
