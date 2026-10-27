import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Volume2, MessageSquare, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { peso } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — Roadside Paddles" },
      { name: "description", content: "Manage orders, menu, riders and chat support." },
    ],
  }),
  component: Admin,
});

function playNewOrderSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
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
    console.error(e);
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
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <Button size="sm" variant="outline" className="gap-2" onClick={playNewOrderSound}>
          <Volume2 className="h-4 w-4" /> Test Alert Chime
        </Button>
      </div>

      <Tabs defaultValue="orders" className="mt-6">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="support">Chats & Support</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="riders">Rider Applications</TabsTrigger>
        </TabsList>
        <TabsContent value="orders"><OrdersTab /></TabsContent>
        <TabsContent value="support"><AdminSupportTab /></TabsContent>
        <TabsContent value="menu"><MenuTab /></TabsContent>
        <TabsContent value="riders"><RidersTab /></TabsContent>
      </Tabs>
    </main>
  );
}

function AdminSupportTab() {
  const { user } = useAuth();
  const [selectedConv, setSelectedConv] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState("");

  const { data: convs = [], refetch } = useQuery({
    queryKey: ["admin-chats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_conversations")
        .select("*")
        .order("last_message_at", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!selectedConv) return;
    const fetchMsgs = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", selectedConv.id)
        .order("created_at", { ascending: true });
      if (data) setMessages(data);
    };
    fetchMsgs();

    const ch = supabase
      .channel(`admin-conv-${selectedConv.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${selectedConv.id}` }, (p) => {
        setMessages((prev) => [...prev, p.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [selectedConv]);

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || !user || !selectedConv) return;
    const text = reply.trim();
    setReply("");

    await supabase.from("chat_messages").insert({
      conversation_id: selectedConv.id,
      sender_id: user.id,
      sender_role: "admin",
      sender_name: "Support Admin",
      message: text,
    });

    await supabase.from("chat_conversations").update({
      last_message_text: text,
      last_message_at: new Date().toISOString(),
    }).eq("id", selectedConv.id);

    refetch();
  };

  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 border rounded-2xl overflow-hidden bg-card min-h-[550px]">
      <div className="border-r divide-y overflow-y-auto max-h-[600px]">
        <div className="p-3 font-semibold text-sm bg-muted/40">Active Threads ({convs.length})</div>
        {!convs.length && <p className="p-4 text-xs text-muted-foreground">No conversations yet.</p>}
        {convs.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedConv(c)}
            className={`w-full p-3 text-left hover:bg-muted/50 transition-colors flex flex-col gap-1 ${
              selectedConv?.id === c.id ? "bg-muted" : ""
            }`}
          >
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold">{c.type === "order" ? `Order #${c.order_id?.slice(0, 6)}` : "Support Ticket"}</span>
              <span className="text-[10px] text-muted-foreground">{new Date(c.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <p className="text-xs text-muted-foreground truncate">{c.last_message_text || "Started conversation"}</p>
          </button>
        ))}
      </div>

      <div className="md:col-span-2 flex flex-col justify-between">
        {selectedConv ? (
          <>
            <div className="p-3 border-b bg-muted/30 flex justify-between items-center">
              <div>
                <p className="font-semibold text-sm">{selectedConv.type === "order" ? `Order Chat #${selectedConv.order_id?.slice(0, 8)}` : "Direct Support Ticket"}</p>
                <p className="text-xs text-muted-foreground">Customer ID: {selectedConv.customer_id.slice(0, 8)}</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[440px]">
              {messages.map((m) => {
                const isMe = m.sender_role === "admin";
                return (
                  <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <span className="text-[10px] text-muted-foreground">{m.sender_name} ({m.sender_role})</span>
                    <div className={`rounded-xl px-3 py-2 text-sm max-w-[80%] ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {m.message}
                    </div>
                  </div>
                );
              })}
            </div>
            <form onSubmit={sendReply} className="p-3 border-t bg-muted/20 flex gap-2">
              <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply as Admin..." />
              <Button type="submit" disabled={!reply.trim()}><Send className="w-4 h-4" /></Button>
            </form>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Select a conversation on the left to start replying.
          </div>
        )}
      </div>
    </div>
  );
}

const statuses = ["pending", "preparing", "ready", "picked_up", "delivered", "cancelled"];

function OrdersTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("active");

  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => (await supabase.from("orders").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  const shown = filter === "active" ? orders.filter((o) => !["delivered", "cancelled"].includes(o.status)) : orders;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant={filter === "active" ? "default" : "secondary"} onClick={() => setFilter("active")}>Active</Button>
        <Button size="sm" variant={filter === "all" ? "default" : "secondary"} onClick={() => setFilter("all")}>All</Button>
      </div>
      {shown.map((o) => (
        <article key={o.id} className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border bg-card p-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold">#{o.id.slice(0, 8)}</p>
              <StatusBadge status={o.status} />
            </div>
            <p className="text-sm">{o.customer_name} · {o.phone}</p>
            <p className="text-sm text-muted-foreground">{o.address}</p>
            <p className="mt-1 text-sm font-semibold">{peso(o.total)} · {o.payment_method.toUpperCase()}</p>
          </div>
          <Select value={o.status} onValueChange={(v) => setStatus(o.id, v)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {statuses.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </article>
      ))}
    </div>
  );
}

function MenuTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const { data: items = [] } = useQuery({
    queryKey: ["admin-menu"],
    queryFn: async () => (await supabase.from("menu_items").select("*").order("category")).data ?? [],
  });

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
    if (error) toast.error(error.message);
    else {
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-menu"] });
    }
  };

  return (
    <div className="mt-4">
      <Button onClick={() => setEditing({ available: true })}><Plus /> Add item</Button>
      <div className="mt-4 divide-y rounded-2xl border bg-card">
        {items.map((m) => (
          <div key={m.id} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{m.name}</p>
              <p className="text-xs text-muted-foreground">{m.category} · {peso(m.price)}</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => setEditing(m)}><Pencil /></Button>
          </div>
        ))}
      </div>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit item" : "New item"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <Input name="name" defaultValue={editing?.name ?? ""} placeholder="Name" required />
            <Textarea name="description" defaultValue={editing?.description ?? ""} placeholder="Description" />
            <Input name="category" defaultValue={editing?.category ?? "Rice Meals"} placeholder="Category" required />
            <Input name="price" type="number" step="0.01" defaultValue={editing?.price ?? ""} placeholder="Price" required />
            <Input name="image_url" defaultValue={editing?.image_url ?? ""} placeholder="Image URL" />
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
    queryFn: async () => (await supabase.from("rider_applications").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const review = async (id: string, approve: boolean) => {
    const { error } = await supabase.rpc("review_rider_application", { _app: id, _approve: approve });
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
        <article key={a.id} className="flex items-start justify-between gap-4 rounded-2xl border bg-card p-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold">{a.full_name}</p>
              <StatusBadge status={a.status} />
            </div>
            <p className="text-sm">{a.phone} · {a.address}</p>
          </div>
          {a.status === "pending" && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => review(a.id, true)}>Approve</Button>
              <Button size="sm" variant="outline" onClick={() => review(a.id, false)}>Reject</Button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
