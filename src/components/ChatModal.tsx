import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageCircle, AlertCircle, Headphones } from "lucide-react";

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  title: string;
  subtitle?: string;
  userRole: "customer" | "rider" | "admin";
  isOrderDelivered?: boolean;
  onOpenAdminSupport?: () => void;
}

export function ChatModal({
  isOpen,
  onClose,
  conversationId,
  title,
  subtitle,
  userRole,
  isOrderDelivered = false,
  onOpenAdminSupport,
}: ChatModalProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !conversationId) return;

    // Load history
    const load = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (data) setMessages(data);
    };
    load();

    // Subscribe to incoming messages
    const channel = supabase
      .channel(`chat-room-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || !user || sending || isOrderDelivered) return;

    const text = input.trim();
    setInput("");
    setSending(true);

    const displayName =
      userRole === "admin"
        ? "Support Admin"
        : userRole === "rider"
        ? "Delivery Rider"
        : user.email?.split("@")[0] || "Customer";

    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      sender_role: userRole,
      sender_name: displayName,
      message: text,
    });

    await supabase
      .from("chat_conversations")
      .update({
        last_message_text: text,
        last_message_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    setSending(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md h-[550px] flex flex-col p-0 gap-0 overflow-hidden sm:rounded-2xl">
        <DialogHeader className="p-4 border-b bg-muted/40 flex-shrink-0">
          <DialogTitle className="text-base flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </DialogHeader>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background">
          {messages.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground pt-12">
              No messages yet. Send a message to start the conversation!
            </p>
          ) : (
            messages.map((m) => {
              const isMe = m.sender_id === user?.id;
              return (
                <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {isMe ? "You" : m.sender_name}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70">
                      • {m.sender_role}
                    </span>
                  </div>
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm max-w-[80%] break-words shadow-xs ${
                      isMe
                        ? "bg-primary text-primary-foreground rounded-br-xs"
                        : "bg-muted text-foreground rounded-bl-xs"
                    }`}
                  >
                    {m.message}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Read-Only or Input Bar */}
        {isOrderDelivered ? (
          <div className="p-3 border-t bg-muted/50 text-xs text-muted-foreground flex flex-col gap-2 items-center text-center">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              This order has been delivered. Direct chat is closed.
            </p>
            {onOpenAdminSupport && (
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onOpenAdminSupport}>
                <Headphones className="w-3.5 h-3.5 text-primary" />
                Contact Admin Support
              </Button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSend} className="p-3 border-t bg-muted/20 flex gap-2 flex-shrink-0">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="text-sm bg-background"
            />
            <Button type="submit" size="icon" disabled={!input.trim() || sending}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
