import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Utensils,
  ShoppingBag,
  Clock,
  Truck,
  Plus,
  Minus,
  UserCheck,
  ChefHat,
  ArrowLeft,
  CheckCircle2,
  ArrowRight
} from "lucide-react";

// --- SUPABASE CLIENT SETUP ---
const SUPABASE_URL = "https://nasfsyxtkryxkrxwftp.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY"; // Replace with your anon key if needed
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- TYPES ---
interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
}

interface CartItem extends MenuItem {
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
  status: string;
  rider_name?: string;
  location?: string;
  created_at: string;
}

// --- MENU DATA ---
const MENU_ITEMS: MenuItem[] = [
  {
    id: "1",
    name: "Classic Burger & Fries",
    price: 180,
    category: "Mains",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400"
  },
  {
    id: "2",
    name: "Chicken Katsu Ala King",
    price: 195,
    category: "Mains",
    image: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400"
  },
  {
    id: "3",
    name: "Lechon Kawali Rice Bowl",
    price: 210,
    category: "Mains",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400"
  },
  {
    id: "4",
    name: "Iced Caramel Macchiato",
    price: 120,
    category: "Drinks",
    image: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=400"
  },
  {
    id: "5",
    name: "Spanish Latte",
    price: 130,
    category: "Drinks",
    image: "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400"
  }
];

export default function FoodOrderingApp() {
  const [view, setView] = useState<"menu" | "cart" | "success" | "dashboard">("menu");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [location, setLocation] = useState("Tago");
  const [paymentMethod, setPaymentMethod] = useState<"counter" | "gcash" | "cod">("cod");
  const [gcashRef, setGcashRef] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastOrderTotal, setLastOrderTotal] = useState(0);

  // Dashboard & Rider States
  const [orders, setOrders] = useState<CafeOrder[]>([]);
  const [activeRiderName, setActiveRiderName] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);

  // Fetch live orders
  useEffect(() => {
    fetchOrders();
    const subscription = supabase
      .channel("cafe_orders_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "cafe_orders" }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("cafe_orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setOrders(data);
    }
  };

  // Cart operations
  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Place Order Handler
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return alert("Your cart is empty!");
    if (!customerName || !customerContact) return alert("Please fill in contact details.");

    setLoading(true);
    let receiptUrl = "";

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

    const { error: orderError } = await supabase.from("cafe_orders").insert([
      {
        customer_name: customerName,
        customer_contact: customerContact,
        items: cart,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        location: location,
        gcash_ref: paymentMethod === "gcash" ? gcashRef : null,
        receipt_url: receiptUrl || null,
        status: "pending",
        rider_phone: "09171234567"
      }
    ]);

    setLoading(false);

    if (orderError) {
      alert("Error placing order: " + orderError.message);
    } else {
      setLastOrderTotal(totalAmount);
      setCart([]);
      setCustomerName("");
      setCustomerContact("");
      setGcashRef("");
      setReceiptFile(null);
      setView("success"); // Switches cleanly to success screen without router 404s
    }
  };

  // Accept Order & Assign Rider Name
  const handleAcceptOrder = async (orderId: string) => {
    if (!activeRiderName.trim()) {
      return alert("Please enter your Rider Name at the top before accepting orders!");
    }

    const { error } = await supabase
      .from("cafe_orders")
      .update({
        status: "out_for_delivery",
        rider_name: activeRiderName
      })
      .eq("id", orderId);

    if (error) {
      alert("Failed to accept order: " + error.message);
    } else {
      fetchOrders();
    }
  };

  // Update Status Progression
  const handleUpdateStatus = async (orderId: string, nextStatus: string) => {
    const { error } = await supabase
      .from("cafe_orders")
      .update({ status: nextStatus })
      .eq("id", orderId);

    if (error) alert("Error updating status: " + error.message);
    else fetchOrders();
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-slate-800 pb-12">
      {/* HEADER NAVBAR */}
      <header className="sticky top-0 z-25 bg-emerald-700 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView("menu")}>
            <ChefHat className="w-6 h-6" />
            <h1 className="text-lg font-bold tracking-wide">Roadside Paddles</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("menu")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                view === "menu" ? "bg-white text-emerald-800 shadow" : "text-emerald-100"
              }`}
            >
              Menu
            </button>
            <button
              onClick={() => setView("dashboard")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                view === "dashboard" ? "bg-white text-emerald-800 shadow" : "text-emerald-100"
              }`}
            >
              Rider Hub
            </button>
            {/* CART ICON BUTTON (No router links, zero 404 errors!) */}
            <button
              onClick={() => setView("cart")}
              className="relative p-2 bg-emerald-800 text-white rounded-full hover:bg-emerald-900 transition flex items-center justify-center"
            >
              <ShoppingBag className="w-4 h-4" />
              {totalItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {totalItemsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* VIEW 1: MENU SELECTION */}
      {view === "menu" && (
        <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Utensils className="w-5 h-5 text-emerald-600" /> Menu Selection
            </h2>
            {cart.length > 0 && (
              <button
                onClick={() => setView("cart")}
                className="bg-orange-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold shadow flex items-center gap-1.5"
              >
                <ShoppingBag className="w-3.5 h-3.5" /> View Cart ({totalItemsCount}) - ₱{totalAmount}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {MENU_ITEMS.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col justify-between"
              >
                <img src={item.image} alt={item.name} className="h-32 w-full object-cover" />
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800 text-sm">{item.name}</h3>
                    <p className="text-xs text-slate-500">{item.category}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-bold text-emerald-700 text-sm">₱{item.price}</span>
                    <button
                      onClick={() => addToCart(item)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* VIEW 2: CART & CHECKOUT FORM */}
      {view === "cart" && (
        <main className="max-w-xl mx-auto px-4 py-6 space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setView("menu")} className="text-slate-600 hover:text-slate-900">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-slate-800">Checkout Your Order</h2>
          </div>

          {cart.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3">
              <p className="text-sm text-slate-400">Your cart is empty.</p>
              <button
                onClick={() => setView("menu")}
                className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-xl"
              >
                Browse Menu
              </button>
            </div>
          ) : (
            <form onSubmit={handlePlaceOrder} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="space-y-3 divide-y divide-slate-100">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Order Items</h3>
                {cart.map((item) => (
                  <div key={item.id} className="pt-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-medium text-slate-800">{item.name}</p>
                      <p className="text-slate-500">₱{item.price} each</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                        className="p-1 text-slate-500 hover:bg-slate-100 rounded"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-semibold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        className="p-1 text-slate-500 hover:bg-slate-100 rounded"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="pt-3 flex justify-between font-bold text-slate-900 text-sm">
                  <span>Total Amount:</span>
                  <span className="text-emerald-700">₱{totalAmount}</span>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Customer Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Juan Dela Cruz"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full text-xs p-2.5 border rounded-xl mt-1 outline-none focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full text-xs p-2.5 border rounded-xl mt-1 outline-none focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full text-xs p-2.5 border rounded-xl mt-1 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600">Payment Option</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as "counter" | "gcash" | "cod")}
                    className="w-full text-xs p-2.5 border rounded-xl mt-1 outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="cod">Cash on delivery</option>
                    <option value="counter">Pay at Counter</option>
                    <option value="gcash">GCash Online</option>
                  </select>
                </div>

                {paymentMethod === "gcash" && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-600">GCash Ref No.</label>
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
                      <label className="text-xs font-semibold text-slate-600">Upload Receipt</label>
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
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl text-xs transition shadow-md"
              >
                {loading ? "Submitting Order..." : "Confirm & Send Order"}
              </button>
            </form>
          )}
        </main>
      )}

      {/* VIEW 3: SUCCESS SCREEN */}
      {view === "success" && (
        <main className="max-w-md mx-auto px-4 py-12 text-center space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Order Placed Successfully!</h2>
            <p className="text-xs text-slate-500">
              Your order has been sent to our kitchen and our rider notification has been triggered via SMS.
            </p>
            <div className="bg-slate-50 p-3 rounded-xl text-left text-xs space-y-1 border border-slate-100">
              <p className="font-semibold text-slate-700">Total Amount: <span className="text-emerald-700">₱{lastOrderTotal}</span></p>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => setView("dashboard")}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2"
              >
                Go to Rider Hub & Live Orders <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView("menu")}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2.5 rounded-xl transition"
              >
                Back to Menu
              </button>
            </div>
          </div>
        </main>
      )}

      {/* VIEW 4: RIDER DASHBOARD / LIVE ORDERS */}
      {view === "dashboard" && (
        <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-700" />
              <div>
                <h3 className="font-bold text-sm text-emerald-900">Delivery Staff Active Mode</h3>
                <p className="text-xs text-emerald-700">Set your name before accepting orders</p>
              </div>
            </div>
            <input
              type="text"
              placeholder="Enter Your Rider Name..."
              value={activeRiderName}
              onChange={(e) => setActiveRiderName(e.target.value)}
              className="text-xs p-2.5 border rounded-lg w-full sm:w-64 outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600" /> Incoming Live Orders
            </h2>

            {orders.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No live orders found.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-sm text-slate-800">{order.customer_name}</h4>
                          <p className="text-xs text-slate-500">{order.customer_contact}</p>
                        </div>
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${
                            order.status === "pending"
                              ? "bg-amber-100 text-amber-800"
                              : order.status === "out_for_delivery"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {order.status === "out_for_delivery" ? "Picked Up" : order.status.replace(/_/g, " ")}
                        </span>
                      </div>

                      {order.rider_name ? (
                        <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 p-1.5 rounded border border-emerald-100 flex items-center gap-1">
                          <Truck className="w-3.5 h-3.5" /> Assigned Rider: {order.rider_name}
                        </p>
                      ) : (
                        <p className="text-xs font-medium text-amber-600 bg-amber-50 p-1.5 rounded border border-amber-100">
                          Unassigned / Waiting for Rider
                        </p>
                      )}

                      <div className="text-xs bg-slate-50 p-2 rounded space-y-1">
                        {order.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between text-slate-600">
                            <span>{it.quantity}x {it.name}</span>
                            <span>₱{it.price * it.quantity}</span>
                          </div>
                        ))}
                        <div className="border-t border-slate-200 pt-1 flex justify-between font-bold text-slate-800">
                          <span>Total:</span>
                          <span>₱{order.total_amount}</span>
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 flex items-center justify-between pt-1">
                        <span>{order.payment_method === "cod" ? "Cash on delivery" : order.payment_method} · {order.location || "Tago"}</span>
                        {order.receipt_url && (
                          <button
                            onClick={() => setSelectedReceipt(order.receipt_url || null)}
                            className="text-emerald-600 hover:underline font-semibold"
                          >
                            View Receipt
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex gap-2">
                      {order.status === "pending" && (
                        <button
                          onClick={() => handleAcceptOrder(order.id)}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 rounded-lg transition"
                        >
                          Accept & Pick Up Order
                        </button>
                      )}

                      {order.status === "out_for_delivery" && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, "completed")}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold py-2 rounded-lg transition"
                        >
                          Complete Delivery
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {/* RECEIPT PREVIEW MODAL */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-4 rounded-xl max-w-sm w-full space-y-3">
            <h3 className="font-bold text-sm text-slate-800">Payment Receipt Preview</h3>
            <img src={selectedReceipt} alt="GCash Receipt" className="w-full h-auto rounded-lg" />
            <button
              onClick={() => setSelectedReceipt(null)}
              className="w-full bg-slate-800 text-white text-xs py-2 rounded-lg font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
