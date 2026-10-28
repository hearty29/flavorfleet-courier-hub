import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { Check, ChefHat, Bike, PackageCheck, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { peso } from "@/lib/cart";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { loadAssignedRider } from "@/lib/order-rider";
import { signedProfilePhotoUrl } from "@/lib/verification";
import { DeliveryProofImage } from "@/components/DeliveryProof";
import { ChatButton, SupportInbox } from "@/components/SupportChat";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "My orders — Roadside Paddles" },
      { name: "description", content: "Track your food deliveries." },
      { property: "og:title", content: "My orders — Roadside Paddles" },
      { property: "og:description", content: "Track your food deliveries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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

function OrderTracker({ status, isCounter }: { status: string; isCounter: boolean }) {
  const steps = isCounter
    ? TRACKING_STEPS.filter((step) => step.id !== "picked_up").map((step) =>
        step.id === "delivered" ? { ...step, label: "Claimed" } : step,
      )
    : TRACKING_STEPS;
  if (status === "cancelled") return null;

  const currentIdx = steps.findIndex((s) => s.id === status);
  const progressPercent = currentIdx <= 0 ? 0 : (currentIdx / (steps.length - 1)) * 100;

  const isOrderDelivered = status === "delivered";

  return (
    <div className="relative my-6 px-1 sm:px-3">
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isDone = idx < currentIdx || (isOrderDelivered && idx === currentIdx);
          const isCurrent = !isOrderDelivered && idx === currentIdx;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center text-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-300 sm:h-10 sm:w-10 ${
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground shadow-md ring-4 ring-primary/40 animate-pulse"
                    : isDone
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30 bg-background text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span
                className={`mt-2 text-[11px] font-semibold sm:text-xs ${
                  isCurrent ? "text-primary" : isDone ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
              <span className="hidden text-[10px] text-muted-foreground md:inline">
                {step.desc}
              </span>
            </div>
          );
        })}
      </div>

      <div className="absolute top-[18px] left-6 right-6 -z-0 h-1 -translate-y-1/2 bg-muted sm:top-[20px] sm:left-8 sm:right-8">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}

function AssignedRider({
  order,
  customerId,
}: {
  order: { id: string; rider_id: string | null };
  customerId: string | undefined;
}) {
  const {
    data: rider,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["order-rider", customerId, order.id, order.rider_id],
    enabled: Boolean(customerId && order.rider_id),
    refetchInterval: 30000,
    queryFn: async () => {
      const result = await supabase.rpc("order_rider", { _order: order.id });
      const name = await loadAssignedRider(order, () => Promise.resolve(result));
      const photo = await signedProfilePhotoUrl(result.data?.[0]?.profile_image_url ?? null);
      return { name, photo };
    },
  });

  if (!order.rider_id) return null;

  return (
    <div className="mt-4 flex items-center gap-3 border-y border-border py-3">
      {rider?.photo ? (
        <img
          src={rider.photo}
          alt="Your delivery rider"
          className="size-12 shrink-0 rounded-full border object-cover"
        />
      ) : (
        <Bike className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      )}
      <div className="min-w-0" aria-live="polite">
        <p className="text-xs text-muted-foreground">Your delivery rider</p>
        <p className="break-words text-sm font-semibold">
          {isPending
            ? "Loading rider…"
            : isError
              ? "Rider details unavailable"
              : rider?.name || "Rider assigned"}
        </p>
      </div>
    </div>
  );
}

function Orders() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const uid = session?.user.id;

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders", uid],
    enabled: !!uid,
    refetchInterval: 15000,
    queryFn: async () => {
      if (!uid) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("customer_id", uid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`my-orders-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `customer_id=eq.${uid}` },
        () => qc.invalidateQueries({ queryKey: ["my-orders"] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid, qc]);

  const cancel = async (id: string) => {
    const { error } = await supabase.rpc("cancel_my_order", { _order: id });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Order cancelled");
      qc.invalidateQueries({ queryKey: ["my-orders"] });
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">My orders</h1>
      <div className="mt-3">
        <ChatButton kind="customer_admin" />
      </div>
      {isLoading && <p className="mt-4 text-muted-foreground">Loading orders...</p>}
      {!isLoading && !orders.length && (
        <p className="mt-4 text-muted-foreground">
          No orders yet. Head to the menu to place an order!
        </p>
      )}

      <div className="mt-6 space-y-4">
        {orders.map((o) => (
          <article key={o.id} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">
                  #{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleString()}
                </p>
                <p className="text-xl font-bold">{peso(o.total)}</p>
              </div>
              <StatusBadge
                status={
                  o.order_type === "counter" && o.status === "delivered" ? "claimed" : o.status
                }
              />
            </div>

            {/* Live Visual Tracker */}
            <p className="mt-2 text-sm font-medium">
              {o.order_type === "counter" ? "Counter / Walk-in" : "Delivery"}
            </p>
            <OrderTracker status={o.status} isCounter={o.order_type === "counter"} />
            <AssignedRider order={o} customerId={uid} />
            {o.rider_id && (
              <div className="mt-3">
                <ChatButton kind="order_rider" orderId={o.id} label="Chat with rider" />
              </div>
            )}
            <DeliveryProofImage path={o.proof_of_delivery_path} />

            <ul className="mt-4 divide-y divide-border/40 text-sm">
              {o.order_items.map((it) => (
                <li key={it.id} className="py-1">
                  {it.quantity}× {it.name}
                </li>
              ))}
            </ul>

            <p className="mt-3 text-sm text-muted-foreground">
              {o.order_type === "counter"
                ? "Pay at counter · Collect at the counter"
                : `Cash on delivery · ${o.address}`}
            </p>

            {o.status === "pending" && (
              <Button variant="outline" size="sm" className="mt-4" onClick={() => cancel(o.id)}>
                Cancel order
              </Button>
            )}
          </article>
        ))}
      </div>
      <section className="mt-8">
        <h2 className="mb-3 text-xl font-bold">My conversations</h2>
        <SupportInbox />
      </section>
    </main>
  );
}
