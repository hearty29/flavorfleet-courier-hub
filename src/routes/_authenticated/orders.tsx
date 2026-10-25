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

function OrderTracker({ status }: { status: string }) {
  if (status === "cancelled") return null;

  const currentIdx = TRACKING_STEPS.findIndex((s) => s.id === status);
  const progressPercent =
    currentIdx <= 0 ? 0 : (currentIdx / (TRACKING_STEPS.length - 1)) * 100;

  return (
    <div className="relative my-6 px-1 sm:px-3">
      <div className="flex items-center justify-between">
        {TRACKING_STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center text-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-300 sm:h-10 sm:w-10 ${
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground shadow-md ring-4 ring-primary/20"
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
              <span className="hidden text-[10px] text-muted-foreground md:inline">{step.desc}</span>
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

function Orders() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const uid = session?.user.id;

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("customer_id", uid!)
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
        () => qc.invalidateQueries({ queryKey: ["my-orders"] })
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
      {isLoading && <p className="mt-4 text-muted-foreground">Loading orders...</p>}
      {!isLoading && !orders.length && (
        <p className="mt-4 text-muted-foreground">No orders yet. Head to the menu to place an order!</p>
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
              <StatusBadge status={o.status} />
            </div>

            {/* Live Visual Tracker */}
            <OrderTracker status={o.status} />

            <ul className="mt-4 divide-y divide-border/40 text-sm">
              {o.order_items.map((it) => (
                <li key={it.id} className="py-1">
                  {it.quantity}× {it.name}
                </li>
              ))}
            </ul>

            <p className="mt-3 text-sm text-muted-foreground">
              Cash on delivery · {o.address}
            </p>

            {o.status === "pending" && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => cancel(o.id)}
              >
                Cancel order
              </Button>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
