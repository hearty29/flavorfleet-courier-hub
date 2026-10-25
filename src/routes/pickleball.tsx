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
  Wrench
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

const TIME_SLOTS = [
  "06:00 AM - 07:00 AM",
  "07:00 AM - 08:00 AM",
  "08:00 AM - 09:00 AM",
  "09:00 AM - 10:00 AM",
  "10:00 AM - 11:00 AM",
  "02:00 PM - 03:00 PM",
  "03:00 PM - 04:00 PM",
  "04:00 PM - 05:00 PM",
  "05:00 PM - 06:00 PM",
  "06:00 PM - 07:00 PM",
  "07:00 PM - 08:00 PM",
  "08:00 PM - 09:00 PM",
  "09:00 PM - 10:00 PM",
];

function PickleballPage() {
  const [activeTab, setActiveTab] = useState<Tab>("status");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isUserAdminRole, setIsUserAdminRole] = useState<boolean>(false);

  // Check current user role from Supabase Auth safely
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

  // Fetch courts dynamically from Supabase
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
  const [submittedBooking, setSubmittedBooking] = useState<boolean>(false);

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

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !playerContact.trim()) {
      toast.error("Please enter your name and phone number");
      return;
    }
    if (bookedSlots.includes(selectedSlot)) {
      toast.error("That time slot is not available. Please pick a green slot.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("book_court", {
      _court: selectedCourt, _date: bookingDate, _slot: selectedSlot,
      _name: playerName, _contact: playerContact, _paddles: paddlesNeeded, _balls: ballsNeeded, _total: totalAmount,
    });
    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["booked-slots"] });
    if (error) {
      toast.error(error.message);
      return;
    }
    setSubmittedBooking(true);
    toast.success(`Court reserved! See you on ${bookingDate} at ${selectedSlot}.`);
  };

  // Admin action: Cancel/Free up slot
  const handleCancelBookingSlot = async (slotToCancel: string) => {
    if (!isAdmin || !isUserAdminRole) return;
    try {
      const { error } = await supabase.rpc("cancel_court_booking", {
        _court: selectedCourt,
        _date: bookingDate,
        _slot: slotToCancel,
      });

      if (error) {
        const { error: deleteErr } = await supabase
          .from("court_bookings")
          .delete()
          .match({ court_id: selectedCourt, booking_date: bookingDate, time_slot: slotToCancel });
        
        if (deleteErr) throw deleteErr;
      }

      toast.success(`Slot (${slotToCancel}) is now marked as Available!`);
      queryClient.invalidateQueries({ queryKey: ["booked-slots"] });
      refetchBookedSlots();
    } catch (err: any) {
      toast.error(err.message || "Failed to make slot available.");
    }
  };

  // Admin action: Update court status in database with immediate invalidation
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

          {/* Admin Toggle Switch */}
          {isUserAdminRole && (
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
                Operating Hours: 6:00 AM – 10:00 PM Daily
              </p>
            </div>
            <Button
              onClick={() => setActiveTab("book")}
              className="mt-2 sm:mt-0"
            >
              Reserve a Slot
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
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
                      <span className="text-muted-foreground">Night Rate (5pm-10pm):</span>
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
                    className="w-full"
                    onClick={() => {
                      setSelectedCourt(court.id);
                      setActiveTab("book");
                    }}
                  >
                    Book {court.name.split("—")[0]}
                  </Button>

                  {/* Admin Quick Status Override Controls */}
                  {isUserAdminRole && isAdmin && (
                    <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-2">
                      <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 text-center">
                        Admin Status Override
                      </p>
                      <div className="grid grid-cols-3 gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={court.status === "available" ? "default" : "outline"}
                          className="text-[10px] h-7 px-1"
                          onClick={() => handleUpdateCourtStatus(court.id, "available")}
                        >
                          <CheckCircle2 className="mr-0.5 h-3 w-3" /> Available
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={court.status === "in_use" ? "default" : "outline"}
                          className="text-[10px] h-7 px-1"
                          onClick={() => handleUpdateCourtStatus(court.id, "in_use")}
                        >
                          <PlayCircle className="mr-0.5 h-3 w-3" /> In Play
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={court.status === "maintenance" ? "default" : "outline"}
                          className="text-[10px] h-7 px-1"
                          onClick={() => handleUpdateCourtStatus(court.id, "maintenance")}
                        >
                          <Wrench className="mr-0.5 h-3 w-3" /> Maint.
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Court Amenities / Info banner */}
          <div className="grid gap-4 rounded-2xl border bg-muted/30 p-5 sm:grid-cols-3 text-sm">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">Paddle & Ball Rentals</p>
                <p className="text-xs text-muted-foreground">₱50/paddle, ₱120 fresh ball 3-pack</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">Open Play & Clinics</p>
                <p className="text-xs text-muted-foreground">Beginner-friendly community games</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">Cafe by the Court</p>
                <p className="text-xs text-muted-foreground">Enjoy your favorite drinks and snacks</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SUB-VIEW 2: BOOK A COURT */}
      {activeTab === "book" && (
        <section className="mt-8">
          {submittedBooking ? (
            <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-2xl font-bold">Booking Submitted!</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                We reserved <strong className="text-foreground">{courtObj.name}</strong> for you on{" "}
                <strong className="text-foreground">{bookingDate}</strong> ({selectedSlot}).
              </p>

              <div className="mt-6 rounded-xl bg-muted p-4 text-left text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span>Player Name:</span>
                  <span className="font-semibold">{playerName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Contact:</span>
                  <span className="font-semibold">{playerContact}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Due at Counter:</span>
                  <span className="font-semibold text-primary text-sm">₱{totalAmount}</span>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <Button onClick={() => setSubmittedBooking(false)}>
                  Book Another Slot
                </Button>
                <Button variant="outline" onClick={() => setActiveTab("status")}>
                  Return to Court Status
                </Button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleBookSubmit}
              className="grid gap-8 lg:grid-cols-3"
            >
              {/* Left Column: Form Details */}
              <div className="space-y-6 lg:col-span-2">
                {/* Step 1: Court Selection */}
                <div className="rounded-2xl border bg-card p-6 shadow-sm">
                  <h3 className="text-lg font-bold">1. Select Court</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {courts.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => setSelectedCourt(c.id)}
                        className={`rounded-xl border p-4 text-left transition ${
                          selectedCourt === c.id
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <p className="font-bold text-sm">{c.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.type}</p>
                        <p className="mt-2 text-xs font-semibold text-primary">
                          From ₱{c.rateDay}/hr
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 2: Date & Slot */}
                <div className="rounded-2xl border bg-card p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">2. Date & Time</h3>
                    {isUserAdminRole && isAdmin && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                        Admin Controls Active
                      </span>
                    )}
                  </div>

                  <div className="mt-4">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Booking Date
                    </label>
                    <input
                      type="date"
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="mt-5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Time Slot (1 hour)
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {TIME_SLOTS.map((slot) => {
                        const taken = bookedSlots.includes(slot);
                        const picked = selectedSlot === slot && !taken;
                        return (
                          <div key={slot} className="relative group">
                            <button
                              type="button"
                              disabled={taken && (!isAdmin || !isUserAdminRole)}
                              onClick={() => {
                                if (!taken) setSelectedSlot(slot);
                              }}
                              className={`w-full rounded-xl border px-3 py-2 text-xs font-medium transition ${
                                taken
                                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                                  : picked
                                    ? "border-emerald-600 bg-emerald-600 text-white font-semibold ring-2 ring-emerald-600/40"
                                    : "border-emerald-600/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 hover:bg-emerald-100"
                              }`}
                            >
                              <span className="block">{slot}</span>
                              <span className="block text-[10px] font-bold uppercase">
                                {taken ? "Not Available" : "Available"}
                              </span>
                            </button>

                            {/* Admin Remove/Free Up Button */}
                            {isUserAdminRole && isAdmin && taken && (
                              <button
                                type="button"
                                title="Admin: Cancel reservation and make available"
                                onClick={() => handleCancelBookingSlot(slot)}
                                className="mt-1 flex items-center justify-center gap-1 text-[11px] w-full rounded-md bg-destructive text-destructive-foreground py-1 font-semibold hover:bg-destructive/90 transition shadow-sm"
                              >
                                <Trash2 className="h-3 w-3" />
                                Make Available
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Step 3: Equipment Rentals & Details */}
                <div className="rounded-2xl border bg-card p-6 shadow-sm">
                  <h3 className="text-lg font-bold">3. Contact & Rentals</h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Juan Dela Cruz"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground">
                        Mobile Number *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="0917-123-4567"
                        value={playerContact}
                        onChange={(e) => setPlayerContact(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  {/* Add-ons */}
                  <div className="mt-5 space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-semibold">Paddle Rental (₱50 each)</p>
                        <p className="text-xs text-muted-foreground">Quality USAPA-approved paddles</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setPaddlesNeeded(Math.max(0, paddlesNeeded - 1))}
                        >
                          -
                        </Button>
                        <span className="w-6 text-center font-bold text-sm">{paddlesNeeded}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setPaddlesNeeded(paddlesNeeded + 1)}
                        >
                          +
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-semibold">Pickleball Can (₱120)</p>
                        <p className="text-xs text-muted-foreground">3x Franklin X-40 tournament balls</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={ballsNeeded}
                        onChange={(e) => setBallsNeeded(e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Order Summary */}
              <div className="h-fit rounded-2xl border bg-card p-6 shadow-sm">
                <h3 className="font-bold text-lg">Booking Summary</h3>

                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Court:</span>
                    <span className="font-semibold">{courtObj.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span className="font-semibold">{bookingDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time Slot:</span>
                    <span className="font-semibold">{selectedSlot}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Court Fee (1 hr):</span>
                    <span className="font-semibold">₱{courtFee}</span>
                  </div>
                  {paddlesNeeded > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paddle Rental ({paddlesNeeded}):</span>
                      <span className="font-semibold">₱{paddleFee}</span>
                    </div>
                  )}
                  {ballsNeeded && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pickleball Can:</span>
                      <span className="font-semibold">₱{ballFee}</span>
                    </div>
                  )}
                  <div className="mt-2 flex justify-between border-t pt-3 text-base font-bold">
                    <span>Total:</span>
                    <span className="text-primary">₱{totalAmount}</span>
                  </div>
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  Pay at the counter on arrival — cash or e-wallet.
                </p>

                <Button type="submit" className="mt-5 w-full" disabled={saving}>
                  Confirm Reservation
                </Button>
              </div>
            </form>
          )}
        </section>
      )}
    </main>
  );
}
