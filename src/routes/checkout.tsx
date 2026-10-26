import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Minus, Plus, Banknote, CreditCard, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCart, peso, DELIVERY_FEE, RICE_OPTIONS, type RiceAddon } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Roadside Paddles" },
      { name: "description", content: "Review your cart and place your order." },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const { items, setQty, subtotal, clear } = useCart();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  // Selected Rice Add-on State
  const [selectedRice, setSelectedRice] = useState<RiceAddon | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile", session?.user.id],
    enabled: !!session,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", session!.user.id).maybeSingle()).data,
  });

  // Calculate Add-on Costs (Rice Price + Auto ₱20 Takeout Bowl)
  const riceAddonFee = selectedRice ? selectedRice.ricePrice + selectedRice.bowlPrice : 0;
  const finalSubtotal = subtotal + riceAddonFee;
  const grandTotal = finalSubtotal + DELIVERY_FEE;

  const handleToggleRice = (rice: RiceAddon) => {
    setSelectedRice((prev) => (prev?.id === rice.id ? null : rice));
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!items.length) {
      toast.error("Your cart is empty");
      return;
    }
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const address = String(f.get("address") || "");
    const phone = String(f.get("phone") || "");
    const name = String(f.get("name") || "");
    const notesInput = String(f.get("notes") || "");

    // If an add-on is selected, we distribute the add-on fee onto the item prices 
    // so the database's automated total calculation matches your frontend total!
    const orderItems = items.map((i) => {
      const adjustedPrice = selectedRice ? i.price + riceAddonFee : i.price;
      return {
        id: i.id,
        quantity: i.quantity,
        price: adjustedPrice, // Passes the updated total price to the backend
      };
    });

    const addonNotesText = selectedRice
      ? ` [ADD-ON: ${selectedRice.name} (+₱${selectedRice.ricePrice}) + Takeout Bowl (+₱${selectedRice.bowlPrice}) = +₱${riceAddonFee}]`
      : "";

    const finalNotes = notesInput ? notesInput + addonNotesText : addonNotesText.trim();

    const { data, error } = await supabase.rpc("place_order", {
      _items: orderItems,
      _address: address,
      _phone: phone,
      _name: name,
      _notes: finalNotes,
      _payment: "cod",
    });

    if (!error && session) {
      await supabase.from("profiles").update({ address, phone, full_name: name }).eq("id", session.user.id);
    }

    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    clear();
    toast.success("Order placed successfully!");
    void data;
    navigate({ to: "/orders" });
  };

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
              {i.image_url && <img src={i.image_url} alt="" className="h-14 w-14 rounded-lg object-cover" />}
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

      <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-5" key={profile?.id ?? "profile-form"}>
        <h2 className="text-xl font-bold">Delivery details</h2>
        <div>
          <Label htmlFor="n">Full Name</Label>
          <Input id="n" name="name" defaultValue={profile?.full_name ?? ""} required />
        </div>
        <div>
          <Label htmlFor="ph">Phone Number</Label>
          <Input id="ph" name="phone" defaultValue={profile?.phone ?? ""} required />
        </div>
        <div>
          <Label htmlFor="ad">Delivery Address</Label>
          <Textarea id="ad" name="address" defaultValue={profile?.address ?? ""} required />
        </div>
        <div>
          <Label htmlFor="no">Notes for rider (optional)</Label>
          <Input id="no" name="notes" placeholder="Landmark, gate color, building name..." />
        </div>

        <div>
          <Label>Payment Method</Label>
          <div className="mt-2 grid gap-2">
            <div className="flex items-center gap-2 rounded-lg border-2 border-primary p-3">
              <Banknote className="text-primary" />
              <span className="font-medium">Cash on delivery</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border p-3 text-muted-foreground">
              <CreditCard />
              <span>Card / online — coming soon</span>
            </div>
          </div>
        </div>

        {/* ADD-ONS SECTION PLACED DIRECTLY UNDER PAYMENT METHOD */}
        <div className="border-t pt-4">
          <Label className="mb-2 block font-bold uppercase tracking-wider text-xs text-muted-foreground">
            Add-ons (Includes Takeout Bowl +₱20)
          </Label>
          <div className="space-y-2">
            {RICE_OPTIONS.map((rice) => {
              const isSelected = selectedRice?.id === rice.id;
              const totalAddonPrice = rice.ricePrice + rice.bowlPrice;

              return (
                <button
                  key={rice.id}
                  type="button"
                  onClick={() => handleToggleRice(rice)}
                  className={`flex w-full items-center justify-between rounded-xl border p-3 text-sm transition ${
                    isSelected
                      ? "border-primary bg-primary/10 font-semibold text-foreground shadow-sm"
                      : "border-border hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                      }`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5" />}
                    </div>
                    <div className="text-left">
                      <span>{rice.name}</span>
                      <p className="text-[11px] font-normal text-muted-foreground">
                        {peso(rice.ricePrice)} rice + {peso(rice.bowlPrice)} bowl
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-foreground">+{peso(totalAddonPrice)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{peso(finalSubtotal)}</span>
          </div>
          {selectedRice && (
            <div className="flex justify-between text-xs text-primary">
              <span>Add-on ({selectedRice.name} + Bowl)</span>
              <span>+{peso(riceAddonFee)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Delivery fee</span>
            <span>{peso(DELIVERY_FEE)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>{peso(grandTotal)}</span>
          </div>
        </div>

        <Button className="w-full" size="lg" disabled={busy}>
          {busy ? "Placing order..." : "Place order"}
        </Button>
      </form>
    </main>
  );
}
