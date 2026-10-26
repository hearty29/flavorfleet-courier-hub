import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { peso } from "@/lib/cart";
import { StatusBadge } from "@/components/StatusBadge";
import { ShoppingBag, ChefHat, Package, Bike, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "My Orders — Roadside Cafe" },
      { name: "description", content: "Track your food orders in real-time." },
    ],
  }),
  component: Orders,
});

function OrderTracker({ status }: { status: string }) {
  const steps = [
    { key: "pending", label: "Placed", icon: ShoppingBag },
    { key: "preparing", label: "Preparing", icon: ChefHat },
    { key: "ready", label: "Ready", icon: Package },
    { key: "picked_up", label: "On the Way", icon: Bike },
    { key: "delivered", label: "Delivered", icon: Check },
  ];

  const getStepState = (stepKey: string) => {
    const orderHierarchy = ["pending", "preparing", "ready", "picked_up", "delivered"];
    const currentIndex = orderHierarchy.indexOf(status);
    const stepIndex = orderHierarchy.indexOf(stepKey);

    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "active";
    return "upcoming";
  };

  return (
    <div className="flex items-center justify-between w-full py-4 relative">
      {steps.map((step) => {
        const state = getStepState(step.key);
        const Icon = step.icon;

        return (
          <div key={step.key} className="flex flex-col items-center z-10 relative">
            <div className="relative">
              {/* Flashing Ping Ring for Active Step */}
              {state === "active" && (
                <span className="absolute -inset-1 rounded-full bg-red-500 opacity-75 animate-ping" />
              )}

              {/* Main Step Icon Circle */}
              <div
                className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 ${
                  state === "completed" || state === "active"
                    ? "bg-red-600 text-white shadow-md"
                    : "bg-muted text-muted-foreground border border-border"
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
            </div>

            {/* Step Label */}
            <span
              className={`mt-2 text-xs font-medium ${
                state === "active" ? "text-red-600 font-bold" : "text-muted-foreground"
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Orders() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const userId = session?.user.id;

  const { data: orders = [] } = useQuery({
    queryKey: ["user-orders", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Real-time subscription to instantly update the timeline when status changes
  useEffect(() => {
    const ch = supabase
      .channel("customer-orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          qc.invalidateQueries({ queryKey: ["user-orders"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold mb-6">My Orders</h1>
      {!orders.length ? (
        <p className="text-muted-foreground">You haven't placed any orders yet.</p>
      ) : (
        <div className="space-y-6">
          {orders.map((o) => (
            <article key={o.id} className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <p className="font-bold font-mono">Order #{o.id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString()}
                  </p>
                </div>
                <StatusBadge status={o.status} />
              </div>

              <div className="my-6">
                <OrderTracker status={o.status} />
              </div>

              <div className="border-t pt-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {o.order_items?.map((i: any) => `${i.quantity}× ${i.name}`).join(", ")}
                  </p>
                </div>
                <p className="font-bold text-lg">{peso(o.total)}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
