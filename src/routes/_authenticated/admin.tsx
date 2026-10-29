import { RiderIdReview } from "@/components/RiderIdUpload";
import { Tournaments } from "@/components/tournaments/TournamentManager";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Volume2, Store, Bike, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { peso } from "@/lib/cart";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeliveryProofImage } from "@/components/DeliveryProof";
import { SupportInbox } from "@/components/SupportChat";

type MenuItem = Database["public"]["Tables"]["menu_items"]["Row"];
type OrderStatus = Database["public"]["Enums"]["order_status"];

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin panel — Roadside Cafe" },
      { name: "description", content: "Manage orders, menu and riders." },
      { property: "og:title", content: "Admin panel — Roadside Cafe" },
      { property: "og:description", content: "Manage orders, menu and riders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Admin,
});

// Built-in chime using Web Audio API
function playNewOrderSound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Tone 1 (D5)
    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.type = "sine";
    o1.frequency.setValueAtTime(587.33, now);
    g1.gain.setValueAtTime(0.35, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    o1.connect(g1);
    g1.connect(ctx.destination);
    o1.start(now);
    o1.stop(now + 0.35);

    // Tone 2 (A5)
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = "sine";
    o2.frequency.setValueAtTime(880, now + 0.18);
    g2.gain.setValueAtTime(0.4, now + 0.18);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    o2.connect(g2);
    g2.connect(ctx.destination);
    o2.start(now + 0.18);
    o2.stop(now + 0.65);
  } catch (e) {
    console.error("Audio error:", e);
  }
}

function Admin() {
  const { roles, loading } = useAuth();
  if (loading) return null;
  if (!roles.includes("admin"))
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Admins only</h1>
      </main>
    );

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Admin panel</h1>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={() => {
            playNewOrderSound();
            toast.success("Sound test played!");
          }}
        >
          <Volume2 className="h-4 w-4" />
          Test Alert Chime
        </Button>
      </div>

      <Tabs defaultValue="orders" className="mt-6">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="riders">Rider applications</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
          <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
        </TabsList>
        <TabsContent value="tournaments">
          <Tournaments />
        </TabsContent>
        <TabsContent value="orders">
          <OrdersTab />
        </TabsContent>
        <TabsContent value="menu">
          <MenuTab />
        </TabsContent>
        <TabsContent value="riders">
          <RidersTab />
        </TabsContent>
        <TabsContent value="support">
          <SupportInbox admin />
        </TabsContent>
      </Tabs>
    </main>
  );
}

const statuses: OrderStatus[] = [
  "pending",
  "preparing",
  "ready",
  "picked_up",
  "delivered",
  "cancelled",
];

type OrderTypeFilter = "all" | "delivery" | "counter";
type OrderStatusFilter = "active" | "all";

function OrdersTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("active");
  const [typeFilter, setTypeFilter] = useState<OrderTypeFilter>("all");

  const {
    data: orders = [],
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["admin-orders"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  // Lookup map to get the rider's registered full name
  const { data: riderMap = {} } = useQuery({
    queryKey: ["admin-rider-map"],
    queryFn: async () => {
      const [{ data: apps }, { data: profiles }] = await Promise.all([
        supabase.from("rider_applications").select("user_id, full_name"),
        supabase.from("profiles").select("id, full_name"),
      ]);
      const map: Record<string, string> = {};
      profiles?.forEach((p) => {
        if (p.id && p.full_name) map[p.id] = p.full_name.trim();
      });
      apps?.forEach((r) => {
        if (r.user_id && r.full_name) map[r.user_id] = r.full_name.trim();
      });
      return map;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`admin-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        if (payload.eventType === "INSERT") {
          playNewOrderSound();
          const newOrder = payload.new as {
            id?: string;
            customer_name?: string;
            order_type?: string;
          };
          const label =
            newOrder.order_type === "counter" ? "🏪 Counter Order" : "🛵 Delivery Order";
          toast.info(`🔔 ${label} received!`, {
            description: `Order #${newOrder.id ? newOrder.id.slice(0, 8) : "New"} · ${
              newOrder.customer_name || "Customer"
            }`,
          });
        }
        qc.invalidateQueries({ queryKey: ["admin-orders"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const setStatus = async (id: string, status: OrderStatus) => {
    const { error } = await supabase
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Order status updated");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    }
  };

  const markCounterClaimed = async (id: string) => {
    const { error } = await supabase.rpc("admin_claim_counter_order", { _order: id });
    if (error) toast.error(error.message);
    else {
      toast.success("Order marked as claimed!");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    }
  };

  const today = orders.filter(
    (o) => new Date(o.created_at).toDateString() === new Date().toDateString(),
  );
  const revenue = today
    .filter((o) => o.status === "delivered")
    .reduce((s, o) => s + Number(o.total), 0);

  // Filter orders by Type and Status
  const getOrderType = (o: Database["public"]["Tables"]["orders"]["Row"]) => o.order_type;

  const deliveryOrdersCount = orders.filter((o) => getOrderType(o) === "delivery").length;
  const counterOrdersCount = orders.filter((o) => getOrderType(o) === "counter").length;

  const filteredByType = orders.filter((o) => {
    if (typeFilter === "all") return true;
    return getOrderType(o) === typeFilter;
  });

  const shown = filteredByType.filter((o) => {
    if (statusFilter === "active") {
      return !["delivered", "cancelled"].includes(o.status);
    }
    return true;
  });

  return (
    <div className="mt-4 space-y-4">
      {/* Top Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Orders today" value={String(today.length)} />
        <Stat
          label="Active"
          value={String(
            orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length,
          )}
        />
        <Stat label="Delivered revenue today" value={peso(revenue)} />
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-3">
        {/* Order Type Tabs */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <Button
            size="sm"
            variant={typeFilter === "all" ? "default" : "outline"}
            onClick={() => setTypeFilter("all")}
            className="rounded-lg text-xs sm:text-sm"
          >
            All Orders ({orders.length})
          </Button>
          <Button
            size="sm"
            variant={typeFilter === "delivery" ? "default" : "outline"}
            onClick={() => setTypeFilter("delivery")}
            className="rounded-lg text-xs sm:text-sm gap-1.5"
          >
            <Bike className="h-3.5 w-3.5" />
            Delivery ({deliveryOrdersCount})
          </Button>
          <Button
            size="sm"
            variant={typeFilter === "counter" ? "default" : "outline"}
            onClick={() => setTypeFilter("counter")}
            className="rounded-lg text-xs sm:text-sm gap-1.5"
          >
            <Store className="h-3.5 w-3.5" />
            Counter / Walk-in ({counterOrdersCount})
          </Button>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg">
          <button
            onClick={() => setStatusFilter("active")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              statusFilter === "active"
                ? "bg-background shadow-xs text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Active only
          </button>
          <button
            onClick={() => setStatusFilter("all")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              statusFilter === "all"
                ? "bg-background shadow-xs text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All statuses
          </button>
        </div>
      </div>

      {/* Order List */}
      <div className="space-y-3">
        {isPending && <p role="status">Loading orders...</p>}
        {isError && (
          <div role="alert" className="rounded-2xl border p-4">
            Could not load orders. Check the database connection and migrations.
            <Button variant="outline" className="ml-2" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        )}
        {!isPending && !isError && !shown.length && (
          <div className="rounded-2xl border border-dashed py-12 text-center text-sm text-muted-foreground">
            No {typeFilter !== "all" ? typeFilter : ""} orders found under {statusFilter} filter.
          </div>
        )}
        {shown.map((o) => {
          const isCounter = o.order_type === "counter";

          return (
            <article
              key={o.id}
              className={`flex flex-wrap items-start gap-4 rounded-2xl border p-4 transition ${
                isCounter
                  ? "bg-emerald-50/20 border-emerald-500/20 dark:bg-emerald-950/10"
                  : "bg-card"
              }`}
            >
              <div className="min-w-0 flex-1">
                {/* Header Row: ID, Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">#{o.id.slice(0, 8)}</p>
                  <StatusBadge
                    status={isCounter && o.status === "delivered" ? "claimed" : o.status}
                  />

                  {/* Order Type Badge */}
                  {isCounter ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      <Store className="h-3 w-3" /> Counter / Walk-in
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      <Bike className="h-3 w-3" /> Rider Delivery
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm font-medium">
                  {o.customer_name} · {o.phone}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isCounter
                    ? `Location: ${o.address || "Counter Pickup"}`
                    : `Address: ${o.address}`}
                </p>

                {/* Items */}
                <p className="mt-1.5 text-sm">
                  {o.order_items?.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                </p>
                {o.notes && <p className="text-sm text-muted-foreground">Note: {o.notes}</p>}

                {/* Delivery proof photo if available */}
                <DeliveryProofImage path={o.proof_of_delivery_path} />

                {/* Timestamp and Rider status */}
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleString()} ·{" "}
                  {isCounter ? (
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      {o.status === "delivered"
                        ? "Claimed at counter"
                        : "Customer collects at counter"}
                    </span>
                  ) : o.rider_id ? (
                    <span className="font-medium text-foreground">
                      Rider Assigned: {riderMap[o.rider_id] || "Rider assigned"}
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      Awaiting rider pickup
                    </span>
                  )}
                </p>
              </div>

              {/* Action column */}
              <div className="flex flex-col items-end gap-2">
                <p className="text-lg font-bold">{peso(o.total)}</p>

                {/* Fast Claim button for Counter Orders */}
                {isCounter && o.status === "ready" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                    onClick={() => markCounterClaimed(o.id)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Mark Claimed
                  </Button>
                )}

                {/* Status Dropdown */}
                <Select value={o.status} onValueChange={(v) => setStatus(o.id, v as OrderStatus)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses
                      .filter((s) => !isCounter || s !== "picked_up")
                      .map((s) => (
                        <SelectItem
                          key={s}
                          value={s}
                          disabled={
                            isCounter &&
                            s === "delivered" &&
                            o.status !== "ready" &&
                            o.status !== "delivered"
                          }
                          className="capitalize"
                        >
                          {isCounter && s === "delivered" ? "Claimed" : s.replace("_", " ")}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-ink p-4 text-ink-foreground">
      <p className="text-xs opacity-70">{label}</p>
      <p className="font-display text-xl font-bold md:text-2xl">{value}</p>
    </div>
  );
}

function MenuTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<MenuItem> | null>(null);
  const { data: items = [] } = useQuery({
    queryKey: ["admin-menu"],
    queryFn: async () =>
      (await supabase.from("menu_items").select("*").order("category")).data ?? [],
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-menu"] });
    qc.invalidateQueries({ queryKey: ["menu"] });
  };

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const row = {
      name: String(f.get("name")),
      description: String(f.get("description")),
      category: String(f.get("category")),
      price: Number(f.get("price")),
      image_url: String(f.get("image_url")) || null,
      available: editing?.available ?? true,
    };
    const { error } = editing?.id
      ? await supabase.from("menu_items").update(row).eq("id", editing.id)
      : await supabase.from("menu_items").insert(row);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditing(null);
    refresh();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else refresh();
  };
  const toggle = async (m: MenuItem) => {
    await supabase.from("menu_items").update({ available: !m.available }).eq("id", m.id);
    refresh();
  };

  return (
    <div className="mt-4">
      <Button onClick={() => setEditing({ available: true })}>
        <Plus /> Add item
      </Button>
      <div className="mt-4 divide-y rounded-2xl border bg-card">
        {items.map((m) => (
          <div key={m.id} className="flex items-center gap-3 p-3">
            {m.image_url ? (
              <img src={m.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-secondary" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium">{m.name}</p>
              <p className="text-xs text-muted-foreground">
                {m.category} · {peso(m.price)}
              </p>
            </div>
            <Switch
              checked={m.available}
              onCheckedChange={() => toggle(m)}
              aria-label="Available"
            />
            <Button size="icon" variant="ghost" onClick={() => setEditing(m)} aria-label="Edit">
              <Pencil />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => remove(m.id)} aria-label="Delete">
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit item" : "New item"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div>
              <Label htmlFor="mn">Name</Label>
              <Input id="mn" name="name" defaultValue={editing?.name ?? ""} required />
            </div>
            <div>
              <Label htmlFor="md">Description</Label>
              <Textarea id="md" name="description" defaultValue={editing?.description ?? ""} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="mc">Category</Label>
                <Input
                  id="mc"
                  name="category"
                  defaultValue={editing?.category ?? "Rice Meals"}
                  required
                />
              </div>
              <div>
                <Label htmlFor="mp">Price (₱)</Label>
                <Input
                  id="mp"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={editing?.price ?? ""}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="mi">Image URL</Label>
              <Input
                id="mi"
                name="image_url"
                defaultValue={editing?.image_url ?? ""}
                placeholder="https://…"
              />
            </div>
            <Button className="w-full">Save</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RidersTab() {
  const qc = useQueryClient();
  const { data: apps = [] } = useQuery({
    queryKey: ["admin-apps"],
    queryFn: async () =>
      (
        await supabase
          .from("rider_applications")
          .select("*")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const review = async (id: string, approve: boolean) => {
    const { error } = await supabase.rpc("review_rider_application", {
      _app: id,
      _approve: approve,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(approve ? "Rider approved" : "Application rejected");
      qc.invalidateQueries({ queryKey: ["admin-apps"] });
    }
  };
  return (
    <div className="mt-4 space-y-3">
      {!apps.length && <p className="text-muted-foreground">No applications yet.</p>}
      {apps.map((a) => (
        <article
          key={a.id}
          className="flex flex-wrap items-start gap-4 rounded-2xl border bg-card p-4"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-bold">{a.full_name}</p>
              <StatusBadge status={a.status} />
            </div>
            <p className="text-sm">
              {a.phone} · {a.address}
            </p>
            <p className="text-sm capitalize text-muted-foreground">
              {a.vehicle_type}
              {a.plate_number ? ` · ${a.plate_number}` : ""} · License {a.license_number}
            </p>
            {a.experience && <p className="mt-1 text-sm">{a.experience}</p>}
            <RiderIdReview userId={a.user_id} />
            <p className="text-xs text-muted-foreground">
              {new Date(a.created_at).toLocaleString()}
            </p>
          </div>
          {a.status === "pending" && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => review(a.id, true)}>
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => review(a.id, false)}>
                Reject
              </Button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
