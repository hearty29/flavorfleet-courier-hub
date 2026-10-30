import { RiderIdReview } from "@/components/RiderIdUpload";
import { Tournaments } from "@/components/tournaments/TournamentManager";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Pencil,
  Trash2,
  Plus,
  Volume2,
  Store,
  Bike,
  CheckCircle2,
  ChefHat,
  CalendarDays,
  Users,
  ShieldCheck,
  Clock,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth, type Role } from "@/lib/auth";
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
type CourtBooking = Database["public"]["Tables"]["court_bookings"]["Row"];

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Staff & Admin Portal — Roadside Paddles" },
      { name: "description", content: "Manage orders, kitchen tickets, courts, and staff." },
      { property: "og:title", content: "Staff & Admin Portal — Roadside Paddles" },
      { property: "og:description", content: "Manage orders, kitchen tickets, courts, and staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPortal,
});

// Built-in chime using Web Audio API
function playAlertChime() {
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
    console.error("Audio chime error:", e);
  }
}

function AdminPortal() {
  const { roles, loading, isAdmin, isCashier, isKitchen, isCourtManager, isStaff } = useAuth();

  const defaultTab = useMemo(() => {
    if (isAdmin || isCashier) return "orders";
    if (isKitchen) return "kitchen";
    if (isCourtManager) return "courts";
    return "orders";
  }, [isAdmin, isCashier, isKitchen, isCourtManager]);

  if (loading) return null;

  if (!isStaff) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground opacity-60" />
        <h1 className="mt-4 text-2xl font-bold">Staff Access Required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account does not have staff privileges (Admin, Cashier, Kitchen, or Court Manager).
          Please contact an administrator.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{isAdmin ? "Admin Panel" : "Staff Portal"}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>Roles active:</span>
            {roles
              .filter((r) => ["admin", "cashier", "kitchen", "court_manager"].includes(r))
              .map((r) => (
                <span
                  key={r}
                  className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary capitalize"
                >
                  {r.replace("_", " ")}
                </span>
              ))}
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={() => {
            playAlertChime();
            toast.success("Alert chime played!");
          }}
        >
          <Volume2 className="h-4 w-4" />
          Test Alert Chime
        </Button>
      </div>

      <Tabs defaultValue={defaultTab} className="mt-6">
        <TabsList className="h-auto flex-wrap">
          {isCashier && <TabsTrigger value="orders">Counter & Orders</TabsTrigger>}
          {isKitchen && (
            <TabsTrigger value="kitchen" className="gap-1.5">
              <ChefHat className="h-4 w-4" />
              Kitchen Display
            </TabsTrigger>
          )}
          {isCourtManager && (
            <TabsTrigger value="courts" className="gap-1.5">
              <CalendarDays className="h-4 w-4" />
              Courts & Bookings
            </TabsTrigger>
          )}
          {isAdmin && <TabsTrigger value="menu">Menu</TabsTrigger>}
          {isAdmin && <TabsTrigger value="riders">Rider Applications</TabsTrigger>}
          {isAdmin && <TabsTrigger value="tournaments">Tournaments</TabsTrigger>}
          {isAdmin && <TabsTrigger value="support">Support</TabsTrigger>}
          {isAdmin && (
            <TabsTrigger value="staff" className="gap-1.5">
              <Users className="h-4 w-4" />
              Staff & Roles
            </TabsTrigger>
          )}
        </TabsList>

        {isCashier && (
          <TabsContent value="orders">
            <OrdersTab />
          </TabsContent>
        )}

        {isKitchen && (
          <TabsContent value="kitchen">
            <KitchenTab />
          </TabsContent>
        )}

        {isCourtManager && (
          <TabsContent value="courts">
            <CourtManagerTab />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="menu">
            <MenuTab />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="riders">
            <RidersTab />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="tournaments">
            <Tournaments />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="support">
            <SupportInbox admin />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="staff">
            <StaffRolesTab />
          </TabsContent>
        )}
      </Tabs>
    </main>
  );
}

/* ========================================================================== */
/* CASHIER / ORDERS TAB                                                       */
/* ========================================================================== */

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
  const [statusFilter, setStatusFilter] = useState<"active" | "all">("active");
  const [typeFilter, setTypeFilter] = useState<"all" | "delivery" | "counter">("all");

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
          playAlertChime();
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

  const deliveryOrdersCount = orders.filter((o) => o.order_type === "delivery").length;
  const counterOrdersCount = orders.filter((o) => o.order_type === "counter").length;

  const shown = orders
    .filter((o) => {
      if (typeFilter === "all") return true;
      return o.order_type === typeFilter;
    })
    .filter((o) => {
      if (statusFilter === "active") {
        return !["delivered", "cancelled"].includes(o.status);
      }
      return true;
    });

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Orders today" value={String(today.length)} />
        <Stat
          label="Active"
          value={String(
            orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length,
          )}
        />
        <Stat label="Delivered / Claimed revenue" value={peso(revenue)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-3">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <Button
            size="sm"
            variant={typeFilter === "all" ? "default" : "outline"}
            onClick={() => setTypeFilter("all")}
          >
            All Orders ({orders.length})
          </Button>
          <Button
            size="sm"
            variant={typeFilter === "delivery" ? "default" : "outline"}
            onClick={() => setTypeFilter("delivery")}
            className="gap-1.5"
          >
            <Bike className="h-3.5 w-3.5" />
            Delivery ({deliveryOrdersCount})
          </Button>
          <Button
            size="sm"
            variant={typeFilter === "counter" ? "default" : "outline"}
            onClick={() => setTypeFilter("counter")}
            className="gap-1.5"
          >
            <Store className="h-3.5 w-3.5" />
            Counter / Walk-in ({counterOrdersCount})
          </Button>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg bg-muted/60 p-1">
          <button
            onClick={() => setStatusFilter("active")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              statusFilter === "active"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Active only
          </button>
          <button
            onClick={() => setStatusFilter("all")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              statusFilter === "all"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All statuses
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {isPending && <p role="status">Loading orders...</p>}
        {isError && (
          <div role="alert" className="rounded-2xl border p-4">
            Could not load orders. Check your connection.
            <Button variant="outline" className="ml-2" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        )}
        {!isPending && !isError && !shown.length && (
          <div className="rounded-2xl border border-dashed py-12 text-center text-sm text-muted-foreground">
            No orders found under current filter.
          </div>
        )}

        {shown.map((o) => {
          const isCounter = o.order_type === "counter";

          return (
            <article
              key={o.id}
              className={`flex flex-wrap items-start gap-4 rounded-2xl border p-4 transition ${
                isCounter
                  ? "border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/10"
                  : "bg-card"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">#{o.id.slice(0, 8)}</p>
                  <StatusBadge
                    status={isCounter && o.status === "delivered" ? "claimed" : o.status}
                  />

                  {isCounter ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      <Store className="h-3 w-3" /> Counter / Walk-in
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      <Bike className="h-3 w-3" /> Delivery
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm font-medium">
                  {o.customer_name} · {o.phone}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isCounter ? `Pickup: ${o.address || "Counter"}` : `Address: ${o.address}`}
                </p>

                <p className="mt-1.5 text-sm">
                  {o.order_items?.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                </p>
                {o.notes && <p className="text-sm text-muted-foreground">Note: {o.notes}</p>}

                <DeliveryProofImage path={o.proof_of_delivery_path} />

                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleString()} ·{" "}
                  {isCounter ? (
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      {o.status === "delivered" ? "Claimed at counter" : "Customer counter pickup"}
                    </span>
                  ) : o.rider_id ? (
                    <span className="font-medium text-foreground">
                      Rider: {riderMap[o.rider_id] || "Rider assigned"}
                    </span>
                  ) : (
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      Awaiting rider
                    </span>
                  )}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <p className="text-lg font-bold">{peso(o.total)}</p>

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

/* ========================================================================== */
/* KITCHEN DISPLAY SYSTEM (KDS) TAB                                           */
/* ========================================================================== */

function KitchenTab() {
  const qc = useQueryClient();

  const { data: kitchenOrders = [], isPending } = useQuery({
    queryKey: ["kitchen-tickets"],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .in("status", ["pending", "preparing"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const updatePrepStatus = async (orderId: string, nextStatus: "preparing" | "ready") => {
    const { error } = await supabase
      .from("orders")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", orderId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(nextStatus === "ready" ? "Order marked READY!" : "Prep started");
      qc.invalidateQueries({ queryKey: ["kitchen-tickets"] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between rounded-2xl border bg-card p-4">
        <div>
          <h2 className="text-xl font-bold">Kitchen Order Queue</h2>
          <p className="text-xs text-muted-foreground">
            Auto-refreshes every 10s. Sorted from oldest to newest order.
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-primary">{kitchenOrders.length}</span>
          <p className="text-xs text-muted-foreground">Tickets pending</p>
        </div>
      </div>

      {isPending && <p>Loading kitchen queue...</p>}

      {!isPending && !kitchenOrders.length && (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <ChefHat className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-3 font-semibold text-lg">All caught up!</p>
          <p className="text-xs text-muted-foreground">No pending kitchen tickets right now.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kitchenOrders.map((o) => {
          const elapsedMin = Math.floor(
            (Date.now() - new Date(o.created_at).getTime()) / (1000 * 60),
          );
          const isUrgent = elapsedMin > 15;

          return (
            <div
              key={o.id}
              className={`flex flex-col justify-between rounded-2xl border p-4 shadow-xs transition ${
                o.status === "preparing"
                  ? "border-amber-500 bg-amber-50/20 dark:bg-amber-950/10"
                  : isUrgent
                    ? "border-destructive/60 bg-destructive/5"
                    : "bg-card"
              }`}
            >
              <div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-mono text-lg font-black">#{o.id.slice(0, 6)}</span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <Clock className="h-3.5 w-3.5" />
                    <span className={isUrgent ? "text-destructive font-bold" : ""}>
                      {elapsedMin}m ago
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {o.customer_name}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                      o.order_type === "counter"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    }`}
                  >
                    {o.order_type === "counter" ? "Counter" : "Delivery"}
                  </span>
                </div>

                {o.notes && (
                  <p className="mt-2 rounded-lg bg-amber-100/60 p-2 text-xs font-semibold text-amber-950 dark:bg-amber-950/60 dark:text-amber-200">
                    ⚠️ Note: {o.notes}
                  </p>
                )}

                {/* Items list */}
                <div className="mt-3 divide-y border-t pt-2">
                  {o.order_items?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-1.5">
                      <span className="font-bold text-base text-foreground">
                        {item.quantity}× {item.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 border-t pt-3 flex gap-2">
                {o.status === "pending" ? (
                  <Button
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                    onClick={() => updatePrepStatus(o.id, "preparing")}
                  >
                    Start Cooking
                  </Button>
                ) : (
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1"
                    onClick={() => updatePrepStatus(o.id, "ready")}
                  >
                    <Check className="h-4 w-4" />
                    Mark Ready for Pickup
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* COURT MANAGER TAB                                                          */
/* ========================================================================== */

function CourtManagerTab() {
  const qc = useQueryClient();
  const [selectedCourt, setSelectedCourt] = useState("all");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);

  const { data: bookings = [], isPending } = useQuery({
    queryKey: ["court-manager-bookings", dateFilter],
    refetchInterval: 15000,
    queryFn: async () => {
      const query = supabase
        .from("court_bookings")
        .select("*")
        .eq("booking_date", dateFilter)
        .order("time_slot", { ascending: true });
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CourtBooking[];
    },
  });

  const cancelBooking = async (id: string, slot: string, court: string) => {
    if (!confirm(`Cancel/Free up ${slot} on ${court}?`)) return;
    const { error } = await supabase.from("court_bookings").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Court reservation freed!");
      qc.invalidateQueries({ queryKey: ["court-manager-bookings"] });
    }
  };

  const filtered = bookings.filter((b) => {
    if (selectedCourt === "all") return true;
    return b.court_id === selectedCourt;
  });

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
        <div>
          <h2 className="text-xl font-bold">Pickleball Court Schedule</h2>
          <p className="text-xs text-muted-foreground">Manage reservations across Courts 1 to 4.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <Label htmlFor="bdate" className="text-xs">
              Date:
            </Label>
            <Input
              id="bdate"
              type="date"
              className="w-40"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="bcourt" className="text-xs">
              Court:
            </Label>
            <Select value={selectedCourt} onValueChange={setSelectedCourt}>
              <SelectTrigger id="bcourt" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courts</SelectItem>
                <SelectItem value="court-1">Court 1</SelectItem>
                <SelectItem value="court-2">Court 2</SelectItem>
                <SelectItem value="court-3">Court 3</SelectItem>
                <SelectItem value="court-4">Court 4</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isPending && <p>Loading court bookings...</p>}

      {!isPending && !filtered.length && (
        <div className="rounded-2xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          No bookings scheduled for this date and filter.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((b) => (
          <div key={b.id} className="rounded-2xl border bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm uppercase text-primary">
                {b.court_id.replace("-", " ")}
              </span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">
                {b.time_slot}
              </span>
            </div>

            <p className="mt-2 text-base font-bold">{b.player_name}</p>
            <p className="text-xs text-muted-foreground">Contact: {b.player_contact}</p>

            <div className="mt-2 text-xs flex gap-3 text-muted-foreground">
              <span>Paddles: {b.paddle_count ?? 0}</span>
              <span>Balls: {b.balls ? "Yes (+₱150)" : "No"}</span>
              <span className="font-semibold text-foreground">Total: {peso(b.total_amount)}</span>
            </div>

            <div className="mt-3 border-t pt-2 flex justify-end">
              <Button
                size="sm"
                variant="destructive"
                className="text-xs h-7"
                onClick={() => cancelBooking(b.id, b.time_slot, b.court_id)}
              >
                Cancel / Free Slot
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* STAFF & ROLES ASSIGNMENT TAB (ADMIN ONLY)                                  */
/* ========================================================================== */

interface StaffUser {
  user_id: string;
  email: string;
  full_name: string;
  roles: string[];
}

function StaffRolesTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: users = [], isPending } = useQuery<StaffUser[]>({
    queryKey: ["admin-staff-users"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("admin_list_staff_users");
        if (!error && Array.isArray(data) && data.length > 0) {
          return data as StaffUser[];
        }
      } catch (err) {
        console.warn("admin_list_staff_users fallback:", err);
      }

      // Resilient fallback: read profiles and user_roles
      const [{ data: profiles }, { data: userRoles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      const roleMap = new Map<string, string[]>();
      (userRoles || []).forEach((r) => {
        const list = roleMap.get(r.user_id) || [];
        list.push(r.role);
        roleMap.set(r.user_id, list);
      });

      return (profiles || []).map((p) => ({
        user_id: p.id,
        email: p.full_name || "staff@roadsidepaddles.com",
        full_name: p.full_name || "Staff Member",
        roles: roleMap.get(p.id) || [],
      }));
    },
  });

  const toggleRole = async (userId: string, roleName: Role, currentlyHas: boolean) => {
    let success = false;
    const { error: rpcError } = await supabase.rpc("admin_set_role", {
      _user: userId,
      _role: roleName as Database["public"]["Enums"]["app_role"],
      _grant: !currentlyHas,
    });

    if (!rpcError) {
      success = true;
    } else {
      if (!currentlyHas) {
        const { error: insertErr } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: roleName });
        if (!insertErr) success = true;
        else toast.error(insertErr.message || rpcError.message);
      } else {
        const { error: deleteErr } = await supabase
          .from("user_roles")
          .delete()
          .match({ user_id: userId, role: roleName });
        if (!deleteErr) success = true;
        else toast.error(deleteErr.message || rpcError.message);
      }
    }

    if (success) {
      toast.success(`${roleName.replace("_", " ")} role ${currentlyHas ? "revoked" : "granted"}!`);
      qc.invalidateQueries({ queryKey: ["admin-staff-users"] });
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q);
  });

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
        <div>
          <h2 className="text-xl font-bold">Staff & Access Roles</h2>
          <p className="text-xs text-muted-foreground">
            Assign dedicated roles to employees instead of full Admin rights.
          </p>
        </div>
        <Input
          placeholder="Search by email or name..."
          className="max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isPending && <p>Loading users...</p>}

      <div className="divide-y rounded-2xl border bg-card">
        {filtered.map((u) => {
          const isUserAdmin = u.roles.includes("admin");
          const isUserCashier = u.roles.includes("cashier");
          const isUserKitchen = u.roles.includes("kitchen");
          const isUserCourt = u.roles.includes("court_manager");
          const isUserRider = u.roles.includes("rider");

          return (
            <div
              key={u.user_id}
              className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-muted/30 transition"
            >
              <div>
                <p className="font-bold">{u.full_name}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={isUserCashier ? "default" : "outline"}
                  className="text-xs h-7"
                  onClick={() => toggleRole(u.user_id, "cashier", isUserCashier)}
                >
                  Cashier {isUserCashier ? "✓" : "+"}
                </Button>

                <Button
                  size="sm"
                  variant={isUserKitchen ? "default" : "outline"}
                  className="text-xs h-7"
                  onClick={() => toggleRole(u.user_id, "kitchen", isUserKitchen)}
                >
                  Kitchen {isUserKitchen ? "✓" : "+"}
                </Button>

                <Button
                  size="sm"
                  variant={isUserCourt ? "default" : "outline"}
                  className="text-xs h-7"
                  onClick={() => toggleRole(u.user_id, "court_manager", isUserCourt)}
                >
                  Court Mgr {isUserCourt ? "✓" : "+"}
                </Button>

                <Button
                  size="sm"
                  variant={isUserRider ? "secondary" : "outline"}
                  className="text-xs h-7"
                  onClick={() => toggleRole(u.user_id, "rider", isUserRider)}
                >
                  Rider {isUserRider ? "✓" : "+"}
                </Button>

                <Button
                  size="sm"
                  variant={isUserAdmin ? "destructive" : "outline"}
                  className="text-xs h-7"
                  onClick={() => toggleRole(u.user_id, "admin", isUserAdmin)}
                >
                  Admin {isUserAdmin ? "★" : "+"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* MENU TAB                                                                   */
/* ========================================================================== */

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
        <Plus className="mr-1 h-4 w-4" /> Add item
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
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => remove(m.id)} aria-label="Delete">
              <Trash2 className="h-4 w-4" />
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

/* ========================================================================== */
/* RIDERS TAB                                                                 */
/* ========================================================================== */

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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/60 p-4 border">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-bold md:text-2xl">{value}</p>
    </div>
  );
}
