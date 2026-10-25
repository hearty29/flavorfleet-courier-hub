import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Clock, CheckCircle, Truck, Package, ChefHat } from "lucide-react";

// --- SUPABASE CLIENT SETUP ---
const SUPABASE_URL = "https://nasfsyxtkryxkrxwftp.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY"; // Replace with your anon key if not using env
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CafeOrder {
  id: string;
  customer_name: string;
  customer_contact: string;
  items: CartItem[];
  total_amount: number;
  payment_method: string;
  gcash_ref?: string;
  receipt_url?: string;
  status: string; // 'pending', 'preparing', 'ready', 'out_for_delivery', 'completed'
  rider_name?: string;
  location?: string;
  created_at: string;
}

export default function CustomerOrdersRoute() {
  const [orders, setOrders] = useState<CafeOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch orders and subscribe to real-time changes
  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel("customer_orders_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cafe_orders" },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cafe_orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setOrders(data);
    }
    setLoading(false);
  };

  // Helper to determine active step in timeline
  const getStepStatus = (currentStatus: string, step: string) => {
    const steps = ["pending", "preparing", "ready", "out_for_delivery", "completed"];
    const currentIndex = steps.indexOf(currentStatus);
    const stepIndex = steps.indexOf(step);
    return stepIndex <= currentIndex;
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-slate-800 pb-12">
      {/* HEADER */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold text-orange-700 tracking-tight">
              Roadside <span className="text-slate-800">Paddles</span>
            </span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Your Active Orders</h2>

        {loading ? (
          <p className="text-sm text-slate-500 text-center py-8">Loading your orders...</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No orders found.</p>
        ) : (
          orders.map((order) => {
            const shortId = `#${order.id.slice(0, 8)}`;
            const formattedDate = new Date(order.created_at).toLocaleString([], {
              dateStyle: "short",
              timeStyle: "short",
            });

            return (
              <div
                key={order.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4"
              >
                {/* Top Row: ID & Status Badge */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400">{shortId} · {formattedDate}</span>
                    <h3 className="text-lg font-bold text-slate-900">₱{order.total_amount.toFixed(2)}</h3>
                  </div>
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-bold capitalize ${
                      order.status === "completed"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-orange-100 text-orange-800"
                    }`}
                  >
                    {order.status === "out_for_delivery"
                      ? "Picked Up"
                      : order.status.replace(/_/g, " ")}
                  </span>
                </div>

                {/* STEPS TIMELINE */}
                <div className="grid grid-cols-5 gap-1 pt-2 pb-1 border-y border-slate-100 text-center">
                  {[
                    { key: "pending", label: "Placed" },
                    { key: "preparing", label: "Preparing" },
                    { key: "ready", label: "Ready" },
                    { key: "out_for_delivery", label: "On the Way" },
                    { key: "completed", label: "Delivered" },
                  ].map((step, idx) => {
                    const active = getStepStatus(order.status, step.key);
                    return (
                      <div key={idx} className="flex flex-col items-center space-y-1">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            active
                              ? "bg-orange-600 text-white"
                              : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium">{step.label}</span>
                      </div>
                    );
                  })}
                </div>

                {/* ORDER ITEMS */}
                <div className="text-xs space-y-1 text-slate-600">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{item.quantity}× {item.name}</span>
                      <span className="font-semibold">₱{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>

                {/* PAYMENT & LOCATION DETAILS */}
                <div className="pt-2 border-t border-slate-100 flex flex-col space-y-1">
                  <p className="text-xs text-slate-500 capitalize">
                    {order.payment_method === "cod" ? "Cash on delivery" : order.payment_method} · {order.location || "Tago"}
                  </p>

                  {/* 🛵 REGISTERED RIDER ACCOUNT NAME APPEARS HERE UPON PICKUP */}
                  {order.rider_name && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-md border border-emerald-200">
                      <span>🛵 Assigned Courier / Rider:</span>
                      <span className="underline">{order.rider_name}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
