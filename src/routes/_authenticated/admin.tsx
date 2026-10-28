import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Volume2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeliveryProofImage } from "@/components/DeliveryProof";

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

function playNewOrderSound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

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

      </div>

      <Tabs defaultValue="orders" className="mt-6">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="riders">Rider applications</TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <OrdersTab />
        </TabsContent>
        <TabsContent value="menu">
          <MenuTab />
        </TabsContent>
        <TabsContent value="riders">
          <RidersTab />
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

function OrdersTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("active");

  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders"],
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            playNewOrderSound();
            const newOrder = payload.new as { id?: string; customer_name?: string };
            toast.info("🔔 New order received!", {
              description: `Order #${newOrder.id ? newOrder.id.slice(0, 8) : "New"} · ${newOrder.customer_name || "Customer"}`,
            });
          }
          qc.invalidateQueries({ queryKey: ["admin-orders"] });
        }
      )
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
    else qc.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  const today = orders.filter(
    (o) => new Date(o.created_at).toDateString() === new Date().toDateString()
  );
  const revenue = today
    .filter((o) => o.status === "delivered")
    .reduce((s, o) => s + Number(o.total), 0);
  const shown =
    filter === "active"
      ? orders.filter((o) => !["delivered", "cancelled"].includes(o.status))
      : orders;

  return (
    <div className="mt-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Orders today" value={String(today.length)} />
        <Stat
          label="Active"
          value={String(
            orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length
          )}
        />
        <Stat label="Delivered revenue today" value={peso(revenue)} />
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          variant={filter === "active" ? "default" : "secondary"}
          onClick={() => setFilter("active")}
        >
          Active
        </Button>
        <Button
          size="sm"
          variant={filter === "all" ? "default" : "secondary"}
          onClick={() => setFilter("all")}
        >
          All
        </Button>
      </div>
      <div className="mt-4 space-y-3">
        {!shown.length && <p className="text-muted-foreground">No orders.</p>}
        {shown.map((o) => (
          <article
            key={o.id}
            className="flex flex-wrap items-start gap-4 rounded-2xl border bg-card p-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold">#{o.id.slice(0, 8)}</p>
                <StatusBadge status={o.status} />
              </div>
              <p className="text-sm">
                {o.customer_name} · {o.phone}
              </p>
              <p className="text-sm text-muted-foreground">{o.address}</p>
              <p className="mt-1 text-sm">
                {o.order_items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
              </p>
              {o.notes && <p className="text-sm text-muted-foreground">Note: {o.notes}</p>}
              <DeliveryProofImage path={o.proof_of_delivery_path} />
              <p className="text-xs text-muted-foreground">
                {new Date(o.created_at).toLocaleString()} ·{" "}
                {o.rider_id ? (
                  <span className="font-medium text-foreground">
                    Rider Assigned: {riderMap[o.rider_id] || "Rider assigned"}
                  </span>
                ) : (
                  "No rider yet"
                )}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <p className="text-lg font-bold">{peso(o.total)}</p>
              <Select
                value={o.status}
                onValueChange={(v) => setStatus(o.id, v as OrderStatus)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </article>
        ))}
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
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setEditing(m)}
              aria-label="Edit"
            >
              <Pencil />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => remove(m.id)}
              aria-label="Delete"
            >
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
              <Textarea
                id="md"
                name="description"
                defaultValue={editing?.description ?? ""}
              />
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
