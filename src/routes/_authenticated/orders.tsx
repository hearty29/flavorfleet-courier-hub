import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { peso } from "@/lib/cart";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({ meta: [{ title: "My orders — Roadside Cafe" }, { name: "description", content: "Track your food deliveries." }, { property: "og:title", content: "My orders — Roadside Cafe" }, { property: "og:description", content: "Track your food deliveries." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Orders,
});

const steps = ["pending", "preparing", "ready", "picked_up", "delivered"];

function Orders() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const uid = session?.user.id;
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*, order_items(*)").eq("customer_id", uid!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!uid) return;
    const ch = supabase.channel(`my-orders-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `customer_id=eq.${uid}` }, () => qc.invalidateQueries({ queryKey: ["my-orders"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid, qc]);

  const cancel = async (id: string) => {
    const { error } = await supabase.rpc("cancel_my_order", { _order: id });
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["my-orders"] });
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">My orders</h1>
      {isLoading && <p className="mt-4 text-muted-foreground">Loading…</p>}
      {!isLoading && !orders.length && <p className="mt-4 text-muted-foreground">No orders yet.</p>}
      <div className="mt-6 space-y-4">
        {orders.map((o) => {
          const idx = steps.indexOf(o.status);
          return (
            <article key={o.id} className="rounded-2xl border bg-card p-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-muted-foreground">#{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleString()}</p>
                  <p className="text-xl font-bold">{peso(o.total)}</p>
                </div>
                <StatusBadge status={o.status} />
              </div>
              {o.status !== "cancelled" && (
                <div className="mt-4 grid grid-cols-5 gap-1">
                  {steps.map((s, i) => (
                    <div key={s} className="text-center">
                      <div className={`h-1.5 rounded-full ${i <= idx ? "bg-primary" : "bg-muted"}`} />
                      <p className="mt-1 text-[10px] capitalize text-muted-foreground">{s.replace("_", " ")}</p>
                    </div>
                  ))}
                </div>
              )}
              <ul className="mt-4 text-sm">
                {o.order_items.map((it) => <li key={it.id}>{it.quantity}× {it.name}</li>)}
              </ul>
              <p className="mt-2 text-sm text-muted-foreground">Cash on delivery · {o.address}</p>
              {o.status === "pending" && <Button variant="outline" size="sm" className="mt-3" onClick={() => cancel(o.id)}>Cancel order</Button>}
            </article>
          );
        })}
      </div>
    </main>
  );
}
