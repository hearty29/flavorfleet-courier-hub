import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Minus, Plus, Banknote, Store, Bike } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCart, peso, DELIVERY_FEE } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Roadside Paddles" },
      { name: "description", content: "Review your cart and place your order." },
      { property: "og:title", content: "Checkout — Roadside Paddles" },
      { property: "og:description", content: "Review your cart and place your order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const { items, setQty, subtotal, clear } = useCart();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const [orderType, setOrderType] = useState<"delivery" | "counter">("delivery");

  const { data: profile } = useQuery({
    queryKey: ["profile", session?.user.id],
    enabled: !!session,
    queryFn: async () =>
      (await supabase.from("profiles").select("*").eq("id", session!.user.id).maybeSingle()).data,
  });

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!items.length) {
      toast.error("Your cart is empty");
      return;
    }
    if (busy) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);

    // Counter collection does not require a delivery address.
    const address =
      orderType === "counter" ? "Counter Pickup / Walk-in" : String(f.get("address") || "");

    const phone = String(f.get("phone") || "");
    const name = String(f.get("name") || "");

    try {
      const { error } = await supabase.rpc("place_order", {
        _items: items.map((i) => ({ id: i.id, quantity: i.quantity })),
        _address: address,
        _phone: phone,
        _name: name,
        _notes: String(f.get("notes") || ""),
        _payment: orderType === "counter" ? "counter" : "cod",
        _order_type: orderType,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      // Profile saving must not turn an already placed order into a failed checkout.
      if (session) {
        try {
          await supabase
            .from("profiles")
            .update({
              ...(orderType === "delivery" ? { address } : {}),
              phone,
              full_name: name,
            })
            .eq("id", session.user.id);
        } catch {
          // The order is saved; the customer can update their profile later.
        }
      }

      clear();
      toast.success(
        orderType === "counter"
          ? "Counter order placed successfully!"
          : "Delivery order placed successfully!",
      );
      navigate({ to: "/orders" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to place order. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  // Calculate actual total based on order type (No delivery fee for counter pickup)
  const currentDeliveryFee = orderType === "counter" ? 0 : DELIVERY_FEE;
  const finalTotal = subtotal + currentDeliveryFee;

  if (!items.length) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-3xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">Add some dishes from the menu to get started.</p>
        <Button asChild className="mt-6">
          <Link to="/">Browse menu</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-[1fr_380px]">
      <section>
        <h1 className="text-3xl font-bold">Your order</h1>
        <ul className="mt-4 divide-y rounded-2xl border bg-card">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 p-4">
              {i.image_url && (
                <img src={i.image_url} alt="" className="h-14 w-14 rounded-lg object-cover" />
              )}
              <div className="flex-1">
                <p className="font-medium">{i.name}</p>
                <p className="text-sm text-muted-foreground">{peso(i.price)}</p>
              </div>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => setQty(i.id, i.quantity - 1)}
                aria-label="Decrease"
              >
                <Minus />
              </Button>
              <span className="w-6 text-center font-medium">{i.quantity}</span>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => setQty(i.id, i.quantity + 1)}
                aria-label="Increase"
              >
                <Plus />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <form
        onSubmit={submit}
        className="space-y-4 rounded-2xl border bg-card p-5"
        key={profile?.id ?? "profile-form"}
      >
        <h2 className="text-xl font-bold">Order Type</h2>

        {/* Order Type Toggle Selector */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={orderType === "delivery" ? "default" : "outline"}
            className="gap-2 text-xs sm:text-sm"
            aria-pressed={orderType === "delivery"}
            disabled={busy}
            onClick={() => setOrderType("delivery")}
          >
            <Bike className="h-4 w-4" />
            Delivery
          </Button>
          <Button
            type="button"
            variant={orderType === "counter" ? "default" : "outline"}
            className="gap-2 text-xs sm:text-sm"
            aria-pressed={orderType === "counter"}
            disabled={busy}
            onClick={() => setOrderType("counter")}
          >
            <Store className="h-4 w-4" />
            Counter / Walk-in
          </Button>
        </div>

        <h2 className="text-xl font-bold pt-2">
          {orderType === "delivery" ? "Delivery details" : "Customer details"}
        </h2>
        <div>
          <Label htmlFor="n">Full Name</Label>
          <Input id="n" name="name" defaultValue={profile?.full_name ?? ""} required />
        </div>
        <div>
          <Label htmlFor="ph">Phone Number</Label>
          <Input id="ph" name="phone" defaultValue={profile?.phone ?? ""} required />
        </div>

        {/* Only show address input if it's a delivery order */}
        {orderType === "delivery" && (
          <div>
            <Label htmlFor="ad">Delivery Address</Label>
            <Textarea
              id="ad"
              name="address"
              defaultValue={profile?.address ?? ""}
              required={orderType === "delivery"}
            />
          </div>
        )}

        <div>
          <Label htmlFor="no">
            {orderType === "delivery" ? "Notes for rider (optional)" : "Pickup notes (optional)"}
          </Label>
          <Input
            id="no"
            name="notes"
            placeholder={
              orderType === "delivery" ? "Landmark, gate color..." : "Will pick up in 15 mins..."
            }
          />
        </div>

        <div>
          <Label>Payment Method</Label>
          <div className="mt-2 grid gap-2">
            <div className="flex items-center gap-2 rounded-lg border-2 border-primary p-3">
              <Banknote className="text-primary" />
              <span className="font-medium">
                {orderType === "delivery" ? "Cash on delivery" : "Pay at counter"}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-1 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{peso(subtotal)}</span>
          </div>
          {orderType === "delivery" && (
            <div className="flex justify-between">
              <span>Delivery fee</span>
              <span>{peso(DELIVERY_FEE)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>{peso(finalTotal)}</span>
          </div>
        </div>

        <Button className="w-full" size="lg" disabled={busy}>
          {busy
            ? "Placing order..."
            : orderType === "counter"
              ? "Place counter order"
              : "Place delivery order"}
        </Button>
      </form>
    </main>
  );
}
