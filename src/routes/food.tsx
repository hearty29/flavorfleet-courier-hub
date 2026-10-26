import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Utensils, ShoppingBag, Plus, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart, RICE_OPTIONS, type RiceAddon, peso } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/food")({
  head: () => ({
    meta: [
      { title: "Menu & Food Delivery — Roadside Paddles" },
      { name: "description", content: "Order delicious food and drinks for delivery or pickup." },
    ],
  }),
  component: FoodMenuPage,
});

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  image_url?: string | null;
  allow_rice_addon?: boolean;
}

function AddOnModal({
  item,
  isOpen,
  onClose,
  onConfirm,
}: {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (rice: RiceAddon | null) => void;
}) {
  const [selectedRice, setSelectedRice] = useState<RiceAddon | null>(null);

  if (!item) return null;

  const riceFee = selectedRice ? selectedRice.ricePrice + selectedRice.bowlPrice : 0;
  const totalPrice = item.price + riceFee;

  const handleToggleRice = (rice: RiceAddon) => {
    setSelectedRice((prev) => (prev?.id === rice.id ? null : rice));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{item.name}</DialogTitle>
        </DialogHeader>

        {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
        <p className="text-lg font-bold text-primary">{peso(item.price)}</p>

        {/* Rice & Takeout Bowl Add-On Options */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Rice Upgrade & Takeout Bowl
            </h4>
            <span className="text-[11px] font-semibold text-primary">
              Rice (+₱25) + Bowl (+₱30) = +₱55
            </span>
          </div>

          <div className="space-y-2">
            {RICE_OPTIONS.map((rice) => {
              const isSelected = selectedRice?.id === rice.id;
              const totalAddonPrice = rice.ricePrice + rice.bowlPrice; // ₱55
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
                    <span>{rice.name} + Takeout Bowl</span>
                  </div>
                  <span className="font-bold">+₱{totalAddonPrice}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 border-t pt-4">
          <Button
            onClick={() => {
              onConfirm(selectedRice);
              setSelectedRice(null);
              onClose();
            }}
            className="w-full font-bold"
          >
            Add to Cart · {peso(totalPrice)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FoodMenuPage() {
  const navigate = useNavigate();
  const { add, count, subtotal } = useCart();
  const [selectedItemForModal, setSelectedItemForModal] = useState<MenuItem | null>(null);

  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ["menu-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("menu_items").select("*");
      if (error) throw error;
      return (data || []) as MenuItem[];
    },
  });

  const handleAddItem = (item: MenuItem) => {
    // If the category is Mains or Rice Meals, open the Rice & Takeout Bowl selection modal
    const isRiceEligible = item.category?.toLowerCase().includes("main") || item.allow_rice_addon;
    if (isRiceEligible) {
      setSelectedItemForModal(item);
    } else {
      add({
        id: item.id,
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        image_url: item.image_url || null,
        selectedRice: null,
      });
    }
  };

  const handleConfirmAddOn = (selectedRice: RiceAddon | null) => {
    if (!selectedItemForModal) return;

    const addonFee = selectedRice ? selectedRice.ricePrice + selectedRice.bowlPrice : 0;
    const finalPrice = selectedItemForModal.price + addonFee;
    const lineItemId = selectedRice ? `${selectedItemForModal.id}-${selectedRice.id}` : selectedItemForModal.id;

    add({
      id: lineItemId,
      menuItemId: selectedItemForModal.id,
      name: selectedRice ? `${selectedItemForModal.name} (${selectedRice.name})` : selectedItemForModal.name,
      price: finalPrice,
      image_url: selectedItemForModal.image_url || null,
      selectedRice: selectedRice,
    });
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Utensils className="h-6 w-6 text-primary" /> Roadside Kitchen & Cafe
          </h1>
          <p className="text-sm text-muted-foreground">Order fresh food & drinks delivered to your door.</p>
        </div>

        {count > 0 && (
          <Button onClick={() => navigate({ to: "/checkout" })} className="gap-2 shadow-md">
            <ShoppingBag className="h-4 w-4" /> Cart ({count}) · {peso(subtotal)}
          </Button>
        )}
      </div>

      {/* Menu Items List */}
      {isLoading ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">Loading menu items...</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {menuItems.map((item) => (
            <div
              key={item.id}
              className="flex flex-col justify-between overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-md"
            >
              {item.image_url && (
                <img src={item.image_url} alt={item.name} className="h-40 w-full object-cover" />
              )}
              <div className="flex flex-1 flex-col justify-between p-4">
                <div>
                  <h3 className="font-bold text-base">{item.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                </div>

                <div className="mt-4 flex items-center justify-between pt-2">
                  <span className="font-extrabold text-primary text-base">{peso(item.price)}</span>
                  <Button size="sm" onClick={() => handleAddItem(item)} className="gap-1 text-xs">
                    <Plus className="h-3.5 w-3.5" /> Add
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add-On Modal */}
      <AddOnModal
        item={selectedItemForModal}
        isOpen={Boolean(selectedItemForModal)}
        onClose={() => setSelectedItemForModal(null)}
        onConfirm={handleConfirmAddOn}
      />
    </main>
  );
}
