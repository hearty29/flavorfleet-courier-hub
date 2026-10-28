import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  CalendarDays, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Sparkles, 
  Users,
  Shield,
  Trash2,
  PlayCircle,
  Wrench,
  Ban,
  QrCode,
  UploadCloud,
  Eye,
  X,
  CreditCard
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pickleball")({
  head: () => ({
    meta: [
      { title: "Pickleball Courts — Roadside Paddles" },
      { name: "description", content: "Check live court status and reserve your pickleball court at Roadside Paddles." },
      { property: "og:title", content: "Pickleball Courts — Roadside Paddles" },
      { property: "og:description", content: "Check live court status and reserve your pickleball court at Roadside Paddles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PickleballPage,
});

type Tab = "status" | "book";
type PaymentMethod = "counter" | "gcash";

interface Court {
  id: string;
  name: string;
  type: string;
  surface: string;
  rateDay: number;
  rateNight: number;
  status: "available" | "in_use" | "maintenance";
  currentSessionUntil?: string;
  nextSlot: string;
}

interface BookingRecord {
  id: string;
  court_id: string;
  booking_date: string;
  time_slot: string;
  player_name: string;
  player_contact: string;
  payment_method: string;
  gcash_ref?: string;
  receipt_url?: string;
  created_at?: string;
}

const TIME_SLOTS = [
  "06:00 AM - 07:00 AM",
  "07:00 AM - 08:00 AM",
  "08:00 AM - 09:00 AM",
  "09:00 AM - 10:00 AM",
  "10:00 AM - 11:00 AM",
  "11:00 AM - 12:00 PM",
  "12:00 PM - 01:00 PM",
  "01:00 PM - 02:00 PM",
  "02:00 PM - 03:00 PM",
  "03:00 PM - 04:00 PM",
  "04:00 PM - 05:00 PM",
  "05:00 PM - 06:00 PM",
  "06:00 PM - 07:00 PM",
  "07:00 PM - 08:00 PM",
  "08:00 PM - 09:00 PM",
  "09:00 PM - 10:00 PM",
  "10:00 PM - 11:00 PM",
  "11:00 PM - 12:00 AM",
];

function PickleballPage() {
  const [activeTab, setActiveTab] = useState<Tab>("status");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isUserAdminRole, setIsUserAdminRole] = useState<boolean>(false);
  const [showAdminBookingsModal, setShowAdminBookingsModal] = useState<boolean>(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Check current user role safely
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
      const role = appMeta?.["role"] || userMeta?.["role"];

      if (role === "admin") {
        setIsUserAdminRole(true);
      } else {
        const { data: userRoles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (userRoles) {
          setIsUserAdminRole(true);
        } else {
          setIsUserAdminRole(false);
          setIsAdmin(false);
        }
      }
    }

    checkAdminStatus();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      checkAdminStatus();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Fetch courts dynamically from database
  const queryClient = useQueryClient();
  const { data: courts = [], refetch: refetchCourts } = useQuery({
    queryKey: ["courts-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courts").select("*");
      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.id as string,
        name: c.name as string,
        type: c.type as string,
        surface: c.surface as string,
        rateDay: Number(c.rate_day),
        rateNight: Number(c.rate_night),
        status: (c.status || "available") as "available" | "in_use" | "maintenance",
        currentSessionUntil: c.current_session_until as string | undefined,
        nextSlot: (c.next_slot || "Available now") as string,
      })) as Court[];
    },
  });

  // Fetch all bookings for Admin Modal
  const { data: allBookings = [] } = useQuery({
    queryKey: ["all-admin-bookings"],
    enabled: isUserAdminRole && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("court_bookings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as BookingRecord[];
    },
  });

  // Booking form state
  const [selectedCourt, setSelectedCourt] = useState<string>("court-1");
  const [bookingDate, setBookingDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0] ?? "";
  });
  const [selectedSlot, setSelectedSlot] = useState<string>(TIME_SLOTS[4]!);
  const [playerName, setPlayerName] = useState<string>("");
  const [playerContact, setPlayerContact] = useState<string>("");
  const [paddlesNeeded, setPaddlesNeeded] = useState<number>(0);
  const [ballsNeeded, setBallsNeeded] = useState<boolean>(false);
  
  // Payment states
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("counter");
  const [gcashRef, setGcashRef] = useState<string>("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [submittedBooking, setSubmittedBooking] = useState<boolean>(false);

  // Auto-switch to first available court if currently selected court is under maintenance
  useEffect(() => {
    if (courts.length > 0) {
      const current = courts.find((c) => c.id === selectedCourt);
      if (current && current.status === "maintenance") {
        const firstAvailable = courts.find((c) => c.status !== "maintenance");
        if (firstAvailable) {
          setSelectedCourt(firstAvailable.id);
        }
      }
    }
  }, [courts, selectedCourt]);

  const courtObj = courts.find((c) => c.id === selectedCourt) || courts[0] || {
    id: "court-1",
    name: "Court 1 — Pro Arena",
    type: "Covered Championship Court",
    surface: "Cushioned Acrylic",
    rateDay: 350,
    rateNight: 500,
    status: "available",
    nextSlot: "Available now"
  };

  const isNight = selectedSlot.includes("PM") && parseInt(selectedSlot, 10) >= 6;
  const courtFee = isNight ? courtObj.rateNight : courtObj.rateDay;
  const paddleFee = paddlesNeeded * 50;
  const ballFee = ballsNeeded ? 120 : 0;
  const totalAmount = courtFee + paddleFee + ballFee;

  const { data: bookedSlots = [], refetch: refetchBookedSlots } = useQuery({
    queryKey: ["booked-slots", selectedCourt, bookingDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_booked_slots", { _court: selectedCourt, _date: bookingDate });
      if (error) throw error;
      return (data ?? []) as string[];
    },
  });
  const [saving, setSaving] = useState<boolean>(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      setReceiptPreview(URL.createObjectURL(file));
    }
  };

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (courtObj.status === "maintenance") {
      toast.error("This court is currently under maintenance. Please choose another court.");
      return;
    }

    if (!playerName.trim() || !playerContact.trim()) {
      toast.error("Please enter your name and phone number");
      return;
    }
    if (bookedSlots.includes(selectedSlot)) {
      toast.error("That time slot is not available. Please pick a green slot.");
      return;
    }

    if (paymentMethod === "gcash") {
      if (!gcashRef.trim()) {
        toast.error("Please enter your GCash Reference Number");
        return;
      }
      if (!receiptFile) {
        toast.error("Please upload your GCash payment screenshot");
        return;
      }
    }

    setSaving(true);
    let uploadedReceiptUrl = "";

    // Upload receipt to Storage if GCash is selected
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

    // Call booking RPC
    const { error } = await supabase.rpc("book_court", {
      _court: selectedCourt,
      _date: bookingDate,
      _slot: selectedSlot,
      _name: playerName,
      _contact: playerContact,
      _paddles: paddlesNeeded,
      _balls: ballsNeeded,
      _total: totalAmount,
    });

    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }

    // Update GCash details into court_bookings
    if (paymentMethod === "gcash") {
      await supabase
        .from("court_bookings")
        .update({
          payment_method: "gcash",
          gcash_ref: gcashRef,
          receipt_url: uploadedReceiptUrl,
        })
        .match({ court_id: selectedCourt, booking_date: bookingDate, time_slot: selectedSlot });
    }

    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["booked-slots"] });
    setSubmittedBooking(true);
    toast.success(`Court reserved! See you on ${bookingDate} at ${selectedSlot}.`);
  };

  // Admin action: Block slot
  const handleBlockSlot = async (slotToBlock: string) => {
    if (!isAdmin || !isUserAdminRole) return;
    try {
      const { error } = await supabase.rpc("book_court", {
        _court: selectedCourt,
        _date: bookingDate,
        _slot: slotToBlock,
        _name: "ADMIN BLOCKED",
        _contact: "N/A",
        _paddles: 0,
        _balls: false,
        _total: 0,
      });

      if (error) {
        const { error: insertErr } = await supabase.from("court_bookings").insert({
          court_id: selectedCourt,
          booking_date: bookingDate,
          time_slot: slotToBlock,
          player_name: "ADMIN BLOCKED",
          player_contact: "N/A",
        });
        if (insertErr) throw insertErr;
      }

      toast.success(`Slot (${slotToBlock}) marked as Not Available!`);
      await queryClient.invalidateQueries({ queryKey: ["booked-slots"] });
      refetchBookedSlots();
    } catch (err: any) {
      toast.error(err.message || "Failed to block slot.");
    }
  };

  // Admin action: Free up slot
  const handleCancelBookingSlot = async (slotToCancel: string) => {
    if (!isAdmin || !isUserAdminRole) return;
    try {
      const { error: deleteErr } = await supabase
        .from("court_bookings")
        .delete()
        .match({
          court_id: selectedCourt,
          booking_date: bookingDate,
          time_slot: slotToCancel,
        });

      if (deleteErr) throw deleteErr;

      toast.success(`Slot (${slotToCancel}) is now marked as Available!`);
      await queryClient.invalidateQueries({ queryKey: ["booked-slots"] });
      refetchBookedSlots();
    } catch (err: any) {
      toast.error(err.message || "Failed to make slot available.");
    }
  };

  // Admin action: Update court status
  const handleUpdateCourtStatus = async (courtId: string, newStatus: "available" | "in_use" | "maintenance") => {
    if (!isUserAdminRole || !isAdmin) return;
    
    const updatePayload = {
      status: newStatus,
      current_session_until: newStatus === "available" ? null : "5:00 PM",
      next_slot: newStatus === "available" ? "Available now" : `Status: ${newStatus}`,
    };

    const { error } = await supabase
      .from("courts")
      .update(updatePayload)
      .eq("id", courtId);

    if (error) {
      toast.error(`Error: ${error.message}`);
      return;
    }

    toast.success(`Court status updated to ${newStatus.replace("_", " ").toUpperCase()}!`);
    await queryClient.invalidateQueries({ queryKey: ["courts-list"] });
    refetchCourts();
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pb-20">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-muted p-6 md:p-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Roadside Courts & Lounge
            </span>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-5xl">
              Pickleball Hub
            </h1>
            <p className="mt-2 text-base text-muted-foreground md:text-lg">
              High-grade tournament courts, premium lighting, and refreshing coffee right by the sideline.
            </p>
          </div>

          {/* Admin Controls Area */}
          {isUserAdminRole && (
            <div className="flex flex-col gap-2">
              <div className="rounded-2xl border bg-background/80 p-3 shadow-sm backdrop-blur">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-foreground">
                  <Shield className={`h-4 w-4 ${isAdmin ? "text-amber-500" : "text-muted-foreground"}`} />
                  <span>Admin Mode</span>
                  <input
                    type="checkbox"
                    checked={isAdmin}
                    onChange={(e) => {
                      setIsAdmin(e.target.checked);
                      toast(e.target.checked ? "Admin Controls Enabled" : "Switched to Public View");
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </label>
              </div>

              {isAdmin && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-xs gap-1.5"
                  onClick={() => setShowAdminBookingsModal(true)}
                >
                  <Eye className="h-3.5 w-3.5" /> View Receipts & Bookings
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Sub-Navigation Pills */}
        <div className="mt-8 flex gap-2 border-b border-border/40 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("status")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "status"
                ? "bg-primary text-primary-foreground shadow"
                : "bg-background/80 text-foreground hover:bg-background"
            }`}
          >
            <Clock className="h-4 w-4" />
            Court Status
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("book")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "book"
                ? "bg-primary text-primary-foreground shadow"
                : "bg-background/80 text-foreground hover:bg-background"
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            Book a Court
          </button>
        </div>
      </div>

      {/* SUB-VIEW 1: COURT STATUS */}
      {activeTab === "status" && (
        <section className="mt-8 space-y-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Live Court Availability</h2>
              <p className="text-sm text-muted-foreground">
                Operating Hours: 6:00 AM – 12:00 AM Daily
              </p>
            </div>
            <Button
              onClick={() => setActiveTab("book")}
              className="mt-2 sm:mt-0"
            >
              Reserve a Slot
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {courts.map((court) => (
              <div
                key={court.id}
                className="flex flex-col justify-between rounded-2xl border bg-card p-6 shadow-sm transition hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-lg">{court.name}</h3>
                    {court.status === "available" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Available
                      </span>
                    ) : court.status === "in_use" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        <Clock className="h-3.5 w-3.5" /> In Play {court.currentSessionUntil ? `(${court.currentSessionUntil})` : ""}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                        <AlertCircle className="h-3.5 w-3.5" /> Maintenance
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">{court.type}</p>

                  <div className="mt-4 space-y-2 rounded-xl bg-muted/50 p-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Surface:</span>
                      <span className="font-medium">{court.surface}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Day Rate (6am-5pm):</span>
                      <span className="font-semibold text-foreground">₱{court.rateDay}/hr</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Night Rate (5pm-12am):</span>
                      <span className="font-semibold text-foreground">₱{court.rateNight}/hr</span>
                    </div>
                  </div>

                  <p className="mt-4 text-xs font-medium text-primary">
                    {court.nextSlot}
                  </p>
                </div>

                <div className="mt-6 flex flex-col gap-2">
                  <Button
                    variant="outline"
                    disabled={court.status === "maintenance"}
                    className={`w-full ${
                      court.status === "maintenance"
    