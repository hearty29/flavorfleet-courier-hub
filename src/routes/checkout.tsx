import { useState } from "react";
import { Check } from "lucide-react";
import { useCart, RICE_OPTIONS, type RiceAddon, peso, DELIVERY_FEE } from "@/lib/cart";
import { Button } from "@/components/ui/button";

export default function CheckoutPage() {
  const { items, subtotal } = useCart();

  // Delivery Form State
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "online">("cod");

  // Selected Rice Add-on State
  const [selectedRice, setSelectedRice] = useState<RiceAddon | null>(null);

  // Calculate Add-on Fees (Rice Price + Auto ₱20 Bowl)
  const riceAddonFee = selectedRice ? selectedRice.ricePrice + selectedRice.bowlPrice : 0;
  
  // Dynamic Total Calculation
  const finalSubtotal = subtotal + riceAddonFee;
  const grandTotal = finalSubtotal + DELIVERY_FEE;

  const handleToggleRice = (rice: RiceAddon) => {
    setSelectedRice((prev) => (prev?.id === rice.id ? null : rice));
  };

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const orderData = {
      fullName,
      phone,
      address,
      notes,
      paymentMethod,
      items,
      selectedAddon: selectedRice
        ? `${selectedRice.name} (+${peso(selectedRice.ricePrice)}) + Takeout Bowl (+${peso(selectedRice.bowlPrice)})`
        : "None",
      grandTotal,
    };
    console.log("Order Placed:", orderData);
    alert("Order submitted successfully!");
  };

  return (
    <div className="mx-auto max-w-xl p-4 font-sans text-slate-800">
      {/* Delivery details container */}
      <div className="rounded-3xl border border-slate-100 bg-[#FAF7F2] p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Delivery details</h2>

        <form onSubmit={handlePlaceOrder} className="mt-4 space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-500"
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-600">Phone Number</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-500"
            />
          </div>

          {/* Delivery Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-600">Delivery Address</label>
            <textarea
              rows={3}
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-500 resize-none"
            />
          </div>

          {/* Notes for rider */}
          <div>
            <label className="block text-xs font-semibold text-slate-600">Notes for rider (optional)</label>
            <input
              type="text"
              placeholder="Landmark, gate color, building name..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-red-500"
            />
          </div>

          {/* Payment Method */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-600 mb-2">Payment Method</label>
            
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("cod")}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-sm font-semibold transition ${
                  paymentMethod === "cod"
                    ? "border-red-600 bg-white text-slate-900"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600">
                  💵
                </div>
                Cash on delivery
              </button>

              <button
                type="button"
                disabled
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white/60 p-3 text-sm font-medium text-slate-400 cursor-not-allowed"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                  💳
                </div>
                Card / online — coming soon
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* ADD-ONS SECTION (POSITIONED DIRECTLY UNDER PAYMENT METHOD)  */}
          {/* ========================================================= */}
          <div className="pt-4 border-t border-slate-200/60">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Add-ons (Includes ₱20 Takeout Bowl)
            </label>

            <div className="space-y-2">
              {RICE_OPTIONS.map((rice) => {
                const isSelected = selectedRice?.id === rice.id;
                const totalAddonPrice = rice.ricePrice + rice.bowlPrice; // ₱20+₱20 (Garlic) or ₱30+₱20 (Yangchow)

                return (
                  <button
                    key={rice.id}
                    type="button"
                    onClick={() => handleToggleRice(rice)}
                    className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-sm transition ${
                      isSelected
                        ? "border-red-600 bg-white font-bold text-slate-900 shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
                          isSelected
                            ? "border-red-600 bg-red-600 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>
                      <div className="text-left">
                        <p>{rice.name}</p>
                        <p className="text-[11px] font-normal text-slate-400">
                          {peso(rice.ricePrice)} rice + {peso(rice.bowlPrice)} takeout bowl
                        </p>
                      </div>
                    </div>
                    <span className="font-extrabold text-slate-900">+{peso(totalAddonPrice)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="pt-4 border-t border-slate-200/80 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-800">{peso(finalSubtotal)}</span>
            </div>
            {selectedRice && (
              <div className="flex justify-between text-xs text-red-600">
                <span>Add-on ({selectedRice.name} + Bowl)</span>
                <span>+{peso(riceAddonFee)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Delivery fee</span>
              <span className="font-semibold text-slate-800">{peso(DELIVERY_FEE)}</span>
            </div>
            <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
              <span>Total</span>
              <span>{peso(grandTotal)}</span>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full rounded-2xl bg-[#D33020] py-6 text-base font-bold text-white hover:bg-[#b82719] transition"
          >
            Place order
          </Button>
        </form>
      </div>
    </div>
  );
}
