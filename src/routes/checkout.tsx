import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { ShoppingBag, ArrowLeft, CheckCircle2, ArrowRight } from "lucide-react";

// --- SUPABASE CLIENT SETUP ---
const SUPABASE_URL = "https://nasfsyxtkryxkrxwftp.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY"; // Replace with your anon key if needed
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function CheckoutRoute() {
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [location, setLocation] = useState("Tago");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "counter" | "gcash">("cod");
  const [gcashRef, setGcashRef] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderTotal, setOrderTotal] = useState(0);

  // Example cart items (replace or load from your global cart state/hook if applicable)
  const cartItems = [
    { id: "1", name: "Bangus", price: 148, quantity: 1 }
  ];
  const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) return alert("Your cart is empty!");
    if (!customerName || !customerContact) return alert("Please fill in your name and contact details.");

    setLoading(true);
    let receiptUrl = "";

    // Upload receipt if GCash is selected
    if (paymentMethod === "gcash" && receiptFile) {
      const fileExt = receiptFile.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("gcash-receipts")
        .upload(fileName, receiptFile);

      if (uploadError) {
        alert("Receipt upload failed: " + uploadError.message);
        setLoading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("gcash-receipts")
        .getPublicUrl(fileName);
      receiptUrl = publicUrlData.publicUrl;
    }

    // Insert order into cafe_orders table (Triggers Semaphore SMS automatically)
    const { error: orderError } = await supabase.from("cafe_orders").insert([
      {
        customer_name: customerName,
        customer_contact: customerContact,
        items: cartItems,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        location: location,
        gcash_ref: paymentMethod === "gcash" ? gcashRef : null,
        receipt_url: receiptUrl || null,
        status: "pending",
        rider_phone: "09171234567" // Default rider phone for SMS notifications
      }
    ]);

    setLoading(false);

    if (orderError) {
      alert("Error placing order: " + orderError.message);
    } else {
      setOrderTotal(totalAmount);
      setSubmitted(true); // Show success view inline without 404 router errors
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] text-slate-800 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Order Placed Successfully!</h2>
          <p className="text-xs text-slate-500">
            Your order has been sent to our kitchen and our rider notification has been triggered via SMS.
          </p>
          <div className="bg-slate-50 p-3 rounded-xl text-left text-xs space-y-1 border border-slate-100">
            <p className="font-semibold text-slate-700">Summary:</p>
            <p className="text-slate-500">Customer: {customerName}</p>
            <p className="text-slate-500">Location: {location}</p>
            <p className="text-slate-500 font-bold text-emerald-700">Total: ₱{orderTotal}</p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => {
                window.location.href = "/orders";
              }}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2"
            >
              View Live Orders <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                window.location.href = "/food";
              }}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2.5 rounded-xl transition"
            >
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-slate-800 pb-12">
      {/* HEADER */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <a href="/food" className="text-slate-600 hover:text-slate-900">
              <ArrowLeft className="w-5 h-5" />
            </a>
            <span className="text-lg font-extrabold text-orange-700 tracking-tight">
              Checkout <span className="text-slate-800">Order</span>
            </span>
          </div>
        </div>
      </header>

      {/* CHECKOUT FORM */}
      <main className="max-w-xl mx-auto px-4 py-6">
        <form onSubmit={handlePlaceOrder} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-orange-600" /> Order Details
          </h2>

          {/* ORDER ITEMS SUMMARY */}
          <div className="bg-slate-50 p-3 rounded-xl space-y-2 text-xs">
            {cartItems.map((item, idx) => (
              <div key={idx} className="flex justify-between text-slate-700">
                <span>{item.quantity}× {item.name}</span>
                <span className="font-semibold">₱{item.price * item.quantity}</span>
              </div>
            ))}
            <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900 text-sm">
              <span>Total Amount:</span>
              <span className="text-orange-700">₱{totalAmount}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Full Name</label>
            <input
              type="text"
              required
              placeholder="Juan Dela Cruz"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full text-xs p-2.5 border rounded-xl mt-1 outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Contact Number</label>
            <input
              type="tel"
              required
              placeholder="09171234567"
              value={customerContact}
              onChange={(e) => setCustomerContact(e.target.value)}
              className="w-full text-xs p-2.5 border rounded-xl mt-1 outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Delivery Location / Sitios / Barangay</label>
            <input
              type="text"
              required
              placeholder="Tago"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full text-xs p-2.5 border rounded-xl mt-1 outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Payment Option</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as "cod" | "counter" | "gcash")}
              className="w-full text-xs p-2.5 border rounded-xl mt-1 outline-none focus:ring-2 focus:ring-orange-500 bg-white"
            >
              <option value="cod">Cash on delivery</option>
              <option value="counter">Pay at Counter</option>
              <option value="gcash">GCash Online</option>
            </select>
          </div>

          {/* GCASH FIELDS */}
          {paymentMethod === "gcash" && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">GCash Reference No.</label>
                <input
                  type="text"
                  required
                  placeholder="1002345678"
                  value={gcashRef}
                  onChange={(e) => setGcashRef(e.target.value)}
                  className="w-full text-xs p-2 border rounded-lg mt-1 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Upload Receipt Screenshot</label>
                <input
                  type="file"
                  accept="image/*"
                  required
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="w-full text-xs mt-1"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl text-xs transition shadow-md"
          >
            {loading ? "Placing Order..." : "Confirm & Send Order"}
          </button>
        </form>
      </main>
    </div>
  );
}
