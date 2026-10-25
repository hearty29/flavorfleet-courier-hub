import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Utensils, 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  Shield, 
  Eye, 
  X, 
  UploadCloud, 
  QrCode, 
  CreditCard, 
  Bell, 
  Truck, 
  Plus, 
  Minus, 
  Sparkles 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/food")({
  head: () => ({
    meta: [
      { title: "Cafe & Menu — Roadside Paddles" },
      { name: "description", content: "Order fresh food, snacks, and drinks directly from Roadside Cafe." },
    ],
  }),
  component: FoodPage,
});

type Tab = "menu" | "orders";
type PaymentMethod = "counter" | "gcash";

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
}

interface CartItem extends MenuItem {
  quantity: number;
}

interface FoodOrder {
  id: string;
  customer_name: string;
  customer_contact: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  total_amount: number;
  payment_method: string;
  gcash_ref?: string;
  receipt_url?: string;
  status: "pending" | "preparing" | "out_for_delivery" | "completed";
  created_at: string;
}

const MENU_ITEMS: MenuItem[] = [
  { id: "m1", name: "Iced Americano", category: "Drinks", price: 110, description: "Double shot espresso over ice" },
  { id: "m2", name: "Spanish Latte", category: "Drinks", price: 135, description: "Espresso with condensed milk and steamed milk" },
  { id: "m3", name: "Chicken Katsu Ala King", category: "Mains", price: 185, description: "Crispy chicken cutlet with cream sauce & rice" },
  { id: "m4", name: "Lechon Kawali Rice Bowl", category: "Mains", price: 195, description: "Crispy pork belly with liver sauce and java rice" },
  { id: "m5", name: "Clubhouse Sandwich", category: "Snacks", price: 150, description: "Triple-decker chicken, egg, bacon, and fries" },
  { id: "m6", name: "Iced Caramel Macchiato", category: "Drinks", price: 140, description: "Rich espresso with vanilla and drizzle" },
];

function FoodPage() {
  const [activeTab, setActiveTab] = useState<Tab>("menu");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isUserAdminRole, setIsUserAdminRole] = useState<boolean>(false);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("counter");
  const [gcashRef, setGcashRef] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState(false);

  // Modal receipt viewer
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Check admin access
  useEffect(() => {
    async function checkAdminStatus() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsUserAdminRole(false);
        setIsAdmin(false);
        return;
      }
      const user = session.user;
      const userMeta = user.user_metadata as Record<string, any> | undefined;
      const appMeta = user.app_metadata as Record<string, any> | undefined;
      const role = appMeta?.role || userMeta?.role;

      if (role === "admin") {
        setIsUserAdminRole(true);
      } else {
        const { data: userRoles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (userRoles) setIsUserAdminRole(true);
      }
    }
    checkAdminStatus();
  }, []);

  // Fetch orders for Admin / Rider Dashboard
  const { data: orders = [], refetch: refetchOrders } = useQuery({
    queryKey: ["cafe-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cafe_orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as FoodOrder[];
    },
  });

  // Cart controls
  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    toast.success(`Added ${item.name} to order`);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      setReceiptPreview(URL.createObjectURL(file));
    }
  };

  // Submit Food Order
  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      toast.error("Your order is empty!");
      return;
    }
    if (!customerName.trim() || !customerContact.trim()) {
      toast.error("Please fill in your name and mobile number.");
      return;
    }

    if (paymentMethod === "gcash") {
      if (!gcashRef.trim()) {
        toast.error("Please enter your GCash Reference Number.");
        return;
      }
      if (!receiptFile) {
        toast.error("Please upload your GCash payment screenshot.");
        return;
      }
    }

    setSaving(true);
    let uploadedReceiptUrl = "";

    // Upload receipt screenshot if GCash
    if (paymentMethod === "gcash" && receiptFile) {
      const fileExt = receiptFile.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from("gcash-receipts")
        .upload(filePath, receiptFile);

      if (uploadErr) {
        setSaving(false);
        toast.error(`Receipt upload failed: ${uploadErr.message}`);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("gcash-receipts")
        .getPublicUrl(filePath);

      uploadedReceiptUrl = publicUrlData.publicUrl;
    }

    // Insert into cafe_orders
    const orderItems = cart.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price }));

    const { error } = await supabase.from("cafe_orders").insert({
      customer_name: customerName,
      customer_contact: customerContact,
      items: orderItems,
      total_amount: cartTotal,
      payment_method: paymentMethod,
      gcash_ref: paymentMethod === "gcash" ? gcashRef : null,
      receipt_url: uploadedReceiptUrl || null,
      status: "pending",
    });

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    setSubmittedOrder(true);
    setCart([]);
    queryClient.invalidateQueries({ queryKey: ["cafe-orders"] });
    toast.success("Food order placed successfully!");
  };

  // Rider/Admin Order Status Update
  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from("cafe_orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      toast.error("Failed to update status.");
      return;
    }

    toast.success(`Order marked as ${newStatus.replace("_", " ").toUpperCase()}`);
    queryClient.invalidateQueries({ queryKey: ["cafe-orders"] });
    refetchOrders();
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pb-20">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/15 via-primary/5 to-muted p-6 md:p-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
              <Sparkles className="h-3.5 w-3.5" /> Roadside Cafe & Lounge
            </span>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-5xl">
              Fresh Food & Drinks
            </h1>
            <p className="mt-2 text-base text-muted-foreground md:text-lg">
              Order court-side meals, artisanal coffees, and quick snacks delivered straight to your bench.
            </p>
          </div>

          {/* Admin Mode Toggle */}
          {isUserAdminRole && (
            <div className="rounded-2xl border bg-background/80 p-3 shadow-sm backdrop-blur">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-foreground">
                <Shield className={`h-4 w-4 ${isAdmin ? "text-amber-500" : "text-muted-foreground"}`} />
                <span>Admin / Rider Mode</span>
                <input
                  type="checkbox"
                  checked={isAdmin}
                  onChange={(e) => {
                    setIsAdmin(e.target.checked);
                    if (e.target.checked) setActiveTab("orders");
                    toast(e.target.checked ? "Rider Dashboard Active" : "Customer View Active");
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
              </label>
            </div>
          )}
        </div>

        {/* Sub Navigation */}
        <div className="mt-8 flex gap-2 border-b border-border/40 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("menu")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "menu"
                ? "bg-primary text-primary-foreground shadow"
                : "bg-background/80 text-foreground hover:bg-background"
            }`}
          >
            <Utensils className="h-4 w-4" />
            Menu & Order
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "orders"
                ? "bg-primary text-primary-foreground shadow"
                : "bg-background/80 text-foreground hover:bg-background"
            }`}
          >
            <Bell className="h-4 w-4" />
            Live Orders {isAdmin && `(${orders.length})`}
          </button>
        </div>
      </div>

      {/* VIEW 1: MENU & ORDER FORM */}
      {activeTab === "menu" && (
        <section className="mt-8">
          {submittedOrder ? (
            <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-2xl font-bold">Order Sent to Rider!</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Your food order is being prepared and will be delivered shortly.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <Button onClick={() => setSubmittedOrder(false)}>Order More Items</Button>
                <Button variant="outline" onClick={() => setActiveTab("orders")}>Track Order Status</Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-3">
              {/* Left Column: Menu Items */}
              <div className="lg:col-span-2 space-y-4">
                <h2 className="text-xl font-bold">Select Food & Beverages</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {MENU_ITEMS.map((item) => (
                    <div key={item.id} className="flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-sm transition hover:shadow-md">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary uppercase">
                            {item.category}
                          </span>
                          <span className="font-bold text-base text-primary">₱{item.price}</span>
                        </div>
                        <h3 className="mt-2 font-bold text-base">{item.name}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                      </div>

                      <Button size="sm" className="mt-4 w-full gap-1.5" onClick={() => addToCart(item)}>
                        <Plus className="h-4 w-4" /> Add to Order
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Checkout Panel */}
              <div className="rounded-2xl border bg-card p-6 shadow-sm h-fit space-y-6">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-primary" /> Order Summary
                </h3>

                {cart.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Your cart is empty. Tap items to add.</p>
                ) : (
                  <div className="space-y-3">
                    {cart.map((i) => (
                      <div key={i.id} className="flex items-center justify-between text-xs border-b pb-2">
                        <div>
                          <p className="font-bold">{i.name}</p>
                          <p className="text-muted-foreground">₱{i.price} each</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQuantity(i.id, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="font-bold text-xs">{i.quantity}</span>
                          <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQuantity(i.id, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    <div className="flex justify-between font-bold text-base border-t pt-2">
                      <span>Total Due:</span>
                      <span className="text-primary">₱{cartTotal}</span>
                    </div>
                  </div>
                )}

                {cart.length > 0 && (
                  <form onSubmit={handleOrderSubmit} className="space-y-4 pt-4 border-t">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground">Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Juan Dela Cruz"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground">Mobile / Court # *</label>
                      <input
                        type="text"
                        required
                        placeholder="0917-123-4567 or Court 2"
                        value={customerContact}
                        onChange={(e) => setCustomerContact(e.target.value)}
                        className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    {/* Payment Selector */}
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Payment Method</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("counter")}
                          className={`rounded-xl border p-2.5 text-center text-xs font-semibold transition ${
                            paymentMethod === "counter"
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          <CreditCard className="mx-auto h-4 w-4 mb-1" />
                          Counter / COD
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod("gcash")}
                          className={`rounded-xl border p-2.5 text-center text-xs font-semibold transition ${
                            paymentMethod === "gcash"
                              ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          <QrCode className="mx-auto h-4 w-4 mb-1 text-blue-600" />
                          GCash Online
                        </button>
                      </div>
                    </div>

                    {/* GCash Inputs */}
                    {paymentMethod === "gcash" && (
                      <div className="rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 p-3 text-xs space-y-3">
                        <p className="font-bold text-blue-800 dark:text-blue-300">GCash: 0917-123-4567</p>

                        <div>
                          <label className="block font-semibold mb-1">Reference Number *</label>
                          <input
                            type="text"
                            required
                            placeholder="1002 8765 4321"
                            value={gcashRef}
                            onChange={(e) => setGcashRef(e.target.value)}
                            className="w-full rounded-xl border bg-background px-3 py-1.5 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold mb-1">Upload Receipt Screenshot *</label>
                          <div className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-300 p-3 bg-background cursor-pointer">
                            <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                            <UploadCloud className="h-5 w-5 text-blue-500 mb-1" />
                            <span className="text-[11px]">Choose File</span>
          