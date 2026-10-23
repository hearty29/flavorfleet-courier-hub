import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { MapPin, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { peso } from "@/lib/cart";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/rider")({
  head: () => ({ meta: [{ title: "Rider dashboard — Roadside Cafe" }, { name: "description", content: "Accept and deliver Roadside Cafe orders." }, { property: "og:title", content: "Rider dashboard — Roadside Cafe" }, { property: "og:description", content: "Accept and deliver Roadside Cafe orders." }] }),
  component: Rider,
});

function Rider() {
  const { session, roles, loading } = useAuth();
  const qc = useQueryClient();
  const uid = session?.user.id;
  const isRider = roles.includes("rider");
  const { data: orders = [] } = useQuery({
    queryKey: ["rider-orders", uid],
    enabled: isRider,
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*, order_items(*)").in("status", ["ready", "picked_up", "delivered"]).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!isRider) return;
    const ch = supabase.channel(`rider-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => qc.invalidateQueries({ queryKey: ["rider-orders"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isRider, qc]);

  if (loading) return null;
  if (!isRider) return <main className="mx-auto max-w-md px-4 py-16 text-center"><h1 className="text-2xl font-bold">Riders only</h1><p className="mt-2 text-muted-foreground">Apply as a rider to access this dashboard.</p></main>;

  const act = async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await fn();
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["rider-orders"] });
  };

  const available = orders.filter((o) => !o.rider_id && o.status === "ready");
  const mine = orders.filter((o) => o.rider_id === uid && o.status !== "delivered");
  const done = orders.filter((o) => o.rider_id === uid && o.status === "delivered");

  const Card = ({ o, children }: { o: (typeof orders)[number]; children?: React.ReactNode }) => (
    <article className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between"><p className="font-bold">{o.customer_name || "Customer"} · {peso(o.total)}</p><StatusBadge status={o.status} /></div>
      <p className="mt-2 flex gap-2 text-sm"><MapPin className="h-4 w-4 shrink-0 text-primary" />{o.address}</p>
      <p className="flex gap-2 text-sm"><Phone className="h-4 w-4 shrink-0 text-primary" /><a href={`tel:${o.phone}`} className="underline">{o.phone}</a></p>
      {o.notes && <p className="mt-1 text-sm text-muted-foreground">Note: {o.notes}</p>}
      <p className="mt-2 text-sm">{o.order_items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</p>
      <p className="mt-1 text-sm font-medium">Collect cash: {peso(o.total)}</p>
      <div className="mt-3 flex gap-2">{children}</div>
    </article>
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Rider dashboard</h1>
      <p className="text-muted-foreground">Delivered today: {done.filter((o) => new Date(o.updated_at).toDateString() === new Date().toDateString()).length}</p>
      <section className="mt-6">
        <h2 className="text-xl font-bold">My active deliveries</h2>
        {!mine.length && <p className="text-sm text-muted-foreground">None right now.</p>}
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {mine.map((o) => (
            <Card key={o.id} o={o}>
              {o.status === "ready" && <Button onClick={() => act(() => supabase.rpc("rider_update_status", { _order: o.id, _status: "picked_up" }))}>Picked up</Button>}
              {o.status === "picked_up" && <Button onClick={() => act(() => supabase.rpc("rider_update_status", { _order: o.id, _status: "delivered" }))}>Mark delivered</Button>}
            </Card>
          ))}
        </div>
      </section>
      <section className="mt-8">
        <h2 className="text-xl font-bold">Available orders</h2>
        {!available.length && <p className="text-sm text-muted-foreground">No orders waiting for pickup.</p>}
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {available.map((o) => (
            <Card key={o.id} o={o}><Button onClick={() => act(() => supabase.rpc("rider_accept_order", { _order: o.id }))}>Accept delivery</Button></Card>
          ))}
        </div>
      </section>
    </main>
  );
}
