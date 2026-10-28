import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Headphones, Loader2, MessageCircle, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { validateChatMessage, type ChatKind } from "@/lib/support-chat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function useThreads() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["support-threads", session?.user.id],
    enabled: Boolean(session),
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_support_conversations");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useChatRealtime(conversationId?: string) {
  const qc = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`support-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_messages",
          ...(conversationId ? { filter: `conversation_id=eq.${conversationId}` } : {}),
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["support-messages"] });
          void qc.invalidateQueries({ queryKey: ["support-threads"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_conversations" },
        () => {
          void qc.invalidateQueries({ queryKey: ["support-threads"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, userId, qc]);
}

function ChatThread({ id }: { id: string }) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [validationError, setValidationError] = useState("");
  const [older, setOlder] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const messages = useQuery({
    queryKey: ["support-messages", session?.user.id, id, older],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("conversation_id", id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(older ? 10000 : 100);
      if (error) throw error;
      return (data ?? []).reverse();
    },
  });
  useEffect(() => {
    if (!messages.data) return;
    end.current?.scrollIntoView({ block: "nearest" });
    void supabase.rpc("mark_support_read", { _conversation: id }).then(({ error }) => {
      if (!error) void qc.invalidateQueries({ queryKey: ["support-threads"] });
    });
  }, [messages.data, id, qc]);
  const send = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase
        .from("support_messages")
        .insert({ conversation_id: id, body });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      void qc.invalidateQueries({ queryKey: ["support-messages"] });
      void qc.invalidateQueries({ queryKey: ["support-threads"] });
    },
  });
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
      >
        {messages.isPending && <p className="text-sm text-muted-foreground">Loading messages…</p>}
        {messages.isError && (
          <div className="text-sm text-destructive">
            Messages could not load.{" "}
            <Button variant="link" onClick={() => messages.refetch()}>
              Retry
            </Button>
          </div>
        )}
        {!older && (messages.data?.length ?? 0) >= 100 && (
          <Button variant="ghost" size="sm" onClick={() => setOlder(true)}>
            Load earlier messages
          </Button>
        )}
        {messages.data?.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No messages yet.</p>
        )}
        {messages.data?.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender_id === session?.user.id ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${message.sender_id === session?.user.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
            >
              <p className="text-xs font-semibold">
                {message.sender_name} · <span className="capitalize">{message.sender_role}</span>
              </p>
              <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">
                {message.body}
              </p>
              <time className="mt-1 block text-[10px] opacity-75" dateTime={message.created_at}>
                {new Date(message.created_at).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        className="shrink-0 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const body = validateChatMessage(draft);
            setValidationError("");
            send.mutate(body);
          } catch (error) {
            setValidationError(error instanceof Error ? error.message : "Check your message.");
          }
        }}
      >
        {(validationError || send.isError) && (
          <p role="alert" className="mb-2 text-sm text-destructive">
            {validationError || "Message was not sent. Please try again."}
          </p>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            aria-label="Message"
            placeholder="Write a message…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            disabled={send.isPending}
            rows={2}
            className="min-h-16 resize-none"
          />
          <Button
            size="icon"
            type="submit"
            aria-label="Send message"
            disabled={send.isPending || !draft.trim()}
          >
            {send.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function SupportInbox({ admin = false }: { admin?: boolean }) {
  const { session } = useAuth();
  const threads = useThreads();
  const [deleting, setDeleting] = useState<{ id: string; display_name: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const qc = useQueryClient();
  const active = threads.data?.find((t) => t.id === selected);
  const resolve = useMutation({
    mutationFn: async () => {
      if (!active) return;
      const { error } = await supabase.rpc("resolve_support_conversation", {
        _conversation: active.id,
        _resolved: active.status !== "resolved",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["support-threads"] });
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("delete_support_conversation", { _conversation: id });
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      qc.setQueryData<typeof threads.data>(["support-threads", session?.user.id], (previous) =>
        previous?.filter((thread) => thread.id !== id),
      );
      setSelected((previous) => (previous === id ? null : previous));
      setDeleting(null);
      qc.removeQueries({ queryKey: ["support-messages", session?.user.id, id] });
      void qc.invalidateQueries({ queryKey: ["support-threads"] });
    },
  });
  const confirmDelete = (thread: { id: string; display_name: string }) => {
    remove.reset();
    setDeleting(thread);
  };
  const shown = threads.data?.filter(
    (t) =>
      (filter === "all" || t.status === filter) &&
      `${t.display_name} ${t.last_message ?? ""} ${t.order_id ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="flex h-[min(640px,75dvh)] min-h-80 flex-col overflow-hidden rounded-lg border bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <Input
          aria-label="Search conversations"
          placeholder="Search conversations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 flex-1"
        />
        {["all", "open", "resolved"].map((value) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? "default" : "ghost"}
            onClick={() => setFilter(value)}
            className="capitalize"
          >
            {value}
          </Button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1">
        <aside
          className={`${active ? "hidden md:block" : "block"} w-full shrink-0 overflow-y-auto border-r md:w-64`}
        >
          {threads.isPending && (
            <p className="p-4 text-sm text-muted-foreground">Loading conversations…</p>
          )}
          {threads.isError && (
            <div className="p-4 text-sm text-destructive">
              Inbox unavailable.{" "}
              <Button variant="link" onClick={() => threads.refetch()}>
                Retry
              </Button>
            </div>
          )}
          {shown?.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">No conversations.</p>
          )}
          {shown?.map((t) => (
            <div
              key={t.id}
              className={`flex items-center border-b ${selected === t.id ? "bg-muted" : ""}`}
            >
              <Button
                variant="ghost"
                className={`h-auto min-w-0 flex-1 justify-start rounded-none px-4 py-3 text-left ${selected === t.id ? "bg-muted" : ""}`}
                onClick={() => setSelected(t.id)}
              >
                <div className="min-w-0 w-full">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{t.display_name}</span>
                    {t.unread && (
                      <span
                        className="size-2 shrink-0 rounded-full bg-primary"
                        aria-label="Unread messages"
                      />
                    )}
                  </div>
                  <p className="text-xs font-normal text-muted-foreground">
                    {t.kind === "order_rider"
                      ? `Order #${t.order_id?.slice(0, 8)}`
                      : t.kind === "rider_admin"
                        ? "Rider support"
                        : "Customer support"}{" "}
                    · {t.status}
                  </p>
                  <p className="mt-1 truncate text-xs font-normal">
                    {t.last_message || "No messages yet"}
                  </p>
                </div>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="mr-2 shrink-0"
                aria-label={`Delete conversation with ${t.display_name}`}
                title="Delete for me"
                disabled={remove.isPending}
                onClick={() => confirmDelete(t)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </aside>
        <div className={`${active ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
          {active ? (
            <>
              <div className="flex shrink-0 items-center gap-2 border-b p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden"
                  onClick={() => setSelected(null)}
                >
                  Back
                </Button>
                <p className="min-w-0 flex-1 truncate font-semibold">{active.display_name}</p>
                {admin && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate()}
                  >
                    <CheckCheck />
                    {active.status === "resolved" ? "Reopen" : "Resolve"}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete conversation"
                  title="Delete for me"
                  disabled={remove.isPending}
                  onClick={() => confirmDelete(active)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {resolve.isError && (
                <p role="alert" className="px-3 text-sm text-destructive">
                  Could not change conversation status.
                </p>
              )}
              <ChatThread key={active.id} id={active.id} />
            </>
          ) : (
            <div className="grid flex-1 place-content-center gap-3 text-center text-muted-foreground">
              <MessageCircle className="mx-auto size-8" />
              <p className="text-sm">Select a conversation</p>
            </div>
          )}
        </div>
      </div>
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(null);
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>Delete conversation from your inbox?</DialogTitle>
            <DialogDescription>
              This removes your conversation with {deleting?.display_name} from your inbox only.
              Other participants keep their copy. A new message or opening the chat again brings it
              back.
            </DialogDescription>
          </DialogHeader>
          {remove.isError && (
            <p role="alert" className="text-sm text-destructive">
              Could not delete the conversation. Please try again.
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={remove.isPending} onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (deleting) remove.mutate(deleting.id);
              }}
            >
              {remove.isPending ? "Deleting…" : "Delete for me"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ChatButton({
  kind,
  orderId,
  label = "Contact support",
}: {
  kind: ChatKind;
  orderId?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const start = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("open_support_conversation", {
        _kind: kind,
        ...(orderId ? { _order: orderId } : {}),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["support-threads"] });
    },
  });
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true);
          start.mutate();
        }}
      >
        <MessageCircle />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[min(620px,85dvh)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b p-4 pr-12">
            <DialogTitle>
              {kind === "order_rider" ? `Order #${orderId?.slice(0, 8)} chat` : "Roadside Support"}
            </DialogTitle>
            <DialogDescription>
              {kind === "order_rider"
                ? "Customer and delivery rider"
                : kind === "rider_admin"
                  ? "Rider support desk"
                  : "Customer support desk"}
            </DialogDescription>
          </DialogHeader>
          {start.isPending && <p className="p-6 text-sm text-muted-foreground">Opening chat…</p>}
          {start.isError && (
            <div className="p-6 text-sm text-destructive">
              Chat could not open.{" "}
              <Button variant="link" onClick={() => start.mutate()}>
                Retry
              </Button>
            </div>
          )}
          {start.isSuccess && start.data && <ChatThread key={start.data} id={start.data} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function FloatingSupport() {
  const { session, roles, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const threads = useThreads();
  useChatRealtime();
  if (loading) return null;
  const unread = threads.data?.filter((t) => t.unread).length ?? 0;
  return (
    <div className="fixed bottom-4 right-4 z-40">
      {!session ? (
        <Button asChild size="sm">
          <Link to="/auth">
            <Headphones />
            Chat support
          </Link>
        </Button>
      ) : roles.includes("admin") ? (
        <>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Headphones />
            Support
            {unread > 0 && <span aria-label={`${unread} unread conversations`}>({unread})</span>}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="w-[calc(100%-2rem)] max-w-4xl">
              <DialogHeader>
                <DialogTitle>Support inbox</DialogTitle>
                <DialogDescription>Customer and rider conversations</DialogDescription>
              </DialogHeader>
              <SupportInbox admin />
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <ChatButton
            kind={roles.includes("rider") ? "rider_admin" : "customer_admin"}
            label={unread > 0 ? `Support (${unread})` : "Chat support"}
          />
        </div>
      )}
    </div>
  );
}
