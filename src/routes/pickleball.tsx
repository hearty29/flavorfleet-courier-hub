import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { 
  CalendarDays, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Sparkles, 
  Users,
  Video,
  Play,
  XCircle,
  Tv
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pickleball")({
  head: () => ({
    meta: [
      { title: "Pickleball Courts & Live Stream — Roadside Paddles" },
      { name: "description", content: "Watch live court streams, check game status, and reserve pickleball courts." },
    ],
  }),
  component: PickleballPage,
});

type Tab = "status" | "book" | "live";

interface Booking {
  id: string;
  court_id: string;
  booking_date: string;
  time_slot: string;
  customer_name: string;
  customer_contact: string;
  status: "pending_arrival" | "active" | "completed" | "cancelled";
  timer_started_at?: string;
  duration_minutes: number;
  total_amount: number;
}

const COURTS = [
  {
    id: "court-1",
    name: "Court 1 — Pro Arena",
    type: "Covered Championship Court",
    surface: "Cushioned Acrylic 8-layer",
    rateDay: 350,
    rateNight: 500,
    streamUrl: "https://www.youtube.com/embed/5qap5aO4i9A?autoplay=1&mute=1", // Replace with HLS/YouTube Embed URL
  },
  {
    id: "court-2",
    name: "Court 2 — Baseline Court",
    type: "Covered Standard Court",
    surface: "Premium Hardcourt",
    rateDay: 300,
    rateNight: 450,
    streamUrl: "https://www.youtube.com/embed/5qap5aO4i9A?autoplay=1&mute=1",
  },
  {
    id: "court-3",
    name: "Court 3 — Open Dinker",
    type: "Outdoor Floodlit Court",
    surface: "Textured Hardcourt",
    rateDay: 250,
    rateNight: 400,
    streamUrl: "https://www.youtube.com/embed/5qap5aO4i9A?autoplay=1&mute=1",
  },
];

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

// Active Game Countdown Component
function LiveTimer({ startedAt, durationMinutes }: { startedAt: string; durationMinutes: number }) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateTime = () => {
      const startMs = new Date(startedAt).getTime();
      const endMs = startMs + durationMinutes * 60 * 1000;
      const nowMs = Date.now();
      const diff = Math.max(0, Math.floor((endMs - nowMs) / 1000));
      setTimeLeft(diff);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [startedAt, durationMinutes]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  if (timeLeft <= 0) {
    return <span className="text-destructive font-bold">SESSION FINISHED</span>;
  }

  return (
    <span className="font-mono text-lg font-extrabold text-amber-500 animate-pulse">
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")} remaining
    </span>
  );
}

function PickleballPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [activeTab, setActiveTab] = useState<Tab>("status");
  const [selectedStreamCourt, setSelectedStreamCourt] = useState(COURTS[0]!.id);

  // Form states
  const [selectedCourt, setSelectedCourt] = useState(COURTS[0]!.id);
  const [bookingDate, setBookingDate] = useState<string>(() => new Date().toISOString().split("T")[0] ?? "");
  const [selectedSlot, setSelectedSlot] = useState(TIME_SLOTS[4]!);
  const [playerName, setPlayerName] = useState("");
  const [playerContact, setPlayerContact] = useState("");
  const [paddlesNeeded, setPaddlesNeeded] = useState(0);
  const [ballsNeeded, setBallsNeeded] = useState(false);
  const [submittedBooking, setSubmittedBooking] = useState(false);
  const [saving, setSaving] = useState(false);

  const queryClient = useQueryClient();

  // Fetch today's bookings with Realtime updates
  const { data: bookings = [], refetch } = useQuery<Booking[]>({
    queryKey: ["court-bookings", bookingDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("court_bookings")
        .select("*")
        .eq("booking_date", bookingDate);
      if (error) throw error;
      return (data ?? []) as Booking[];
    },
  });

  // Subscribe to realtime database updates for live timers & statuses
  useEffect(() => {
    const channel = supabase
      .channel("court-booking-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "court_bookings" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["court-bookings"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const courtObj = COURTS.find((c) => c.id === selectedCourt) || COURTS[0]!;
  const isNight = selectedSlot.includes("PM") && parseInt(selectedSlot) >= 6;
  const courtFee = isNight ? courtObj.rateNight : courtObj.rateDay;
  const totalAmount = courtFee + paddlesNeeded * 50 + (ballsNeeded ? 120 : 0);

  // Admin Actions
  const handleStartTimer = async (bookingId: string) => {
    const { error } = await supabase
      .from("court_bookings")
      .update({
        status: "active",
        timer_started_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (error) toast.error(error.message);
    else {
      toast.success("Game started & timer initialized!");
      refetch();
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm("Are you sure you want to cancel/remove this booking?")) return;
    const { error } = await supabase
      .from("court_bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId);

    if (error) toast.error(error.message);
    else {
      toast.success("Booking cancelled.");
      refetch();
    }
  };

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !playerContact.trim()) {
      toast.error("Please enter your name and contact number");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("court_bookings").insert([
      {
        court_id: selectedCourt,
        booking_date: bookingDate,
        time_slot: selectedSlot,
        customer_name: playerName,
        customer_contact: playerContact,
        status: "pending_arrival",
        total_amount: totalAmount,
        duration_minutes: 60,
      },
    ]);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSubmittedBooking(true);
      toast.success("Court reserved successfully!");
      refetch();
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pb-20">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-muted p-6 md:p-10">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Roadside Courts & Lounge
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-5xl">
            Pickleball Hub & Live Stream
          </h1>
          <p className="mt-2 text-base text-muted-foreground md:text-lg">
            Check live court feeds, view session timers, and reserve courts in real time.
          </p>
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
            onClick={() => setActiveTab("live")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "live"
                ? "bg-primary text-primary-foreground shadow"
                : "bg-background/80 text-foreground hover:bg-background"
            }`}
          >
            <Tv className="h-4 w-4" />
            Live Streams
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
            Book Court
          </button>
        </div>
      </div>

      {/* SUB-VIEW 1: COURT STATUS & ACTIVE TIMERS */}
      {activeTab === "status" && (
        <section className="mt-8 space-y-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Live Court Overview</h2>
              <p className="text-sm text-muted-foreground">Real-time occupancy & active session countdowns</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {COURTS.map((court) => {
              const activeBooking = bookings.find(
                (b) => b.court_id === court.id && b.status === "active"
              );
              const pendingBooking = bookings.find(
                (b) => b.court_id === court.id && b.status === "pending_arrival"
              );

              return (
                <div key={court.id} className="flex flex-col justify-between rounded-2xl border bg-card p-6 shadow-sm">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-lg">{court.name}</h3>
                      {activeBooking ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          <Clock className="h-3.5 w-3.5" /> In Play
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Available
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground">{court.type}</p>

                    {/* Timer Box */}
                    <div className="mt-4 rounded-xl bg-muted/60 p-4 text-center">
                      {activeBooking && activeBooking.timer_started_at ? (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Current Match</p>
                          <LiveTimer
                            startedAt={activeBooking.timer_started_at}
                            durationMinutes={activeBooking.duration_minutes}
                          />
                          <p className="text-xs font-medium text-foreground mt-1">
                            Player: {activeBooking.customer_name}
                          </p>
                        </div>
                      ) : pendingBooking ? (
                        <div>
                          <p className="text-xs text-amber-600 font-semibold">Reserved — Awaiting Customer</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Slot: {pendingBooking.time_slot} ({pendingBooking.customer_name})
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No active match playing right now</p>
                      )}
                    </div>

                    {/* Admin Action Bar */}
                    {isAdmin && (
                      <div className="mt-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
                        <p className="text-[11px] font-bold text-primary uppercase tracking-wider">Admin Controls</p>
                        
                        {pendingBooking && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-xs"
                              onClick={() => handleStartTimer(pendingBooking.id)}
                            >
                              <Play className="h-3.5 w-3.5 mr-1" /> Start Timer
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="text-xs"
                              onClick={() => handleCancelBooking(pendingBooking.id)}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}

                        {activeBooking && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="w-full text-xs"
                            onClick={() => handleCancelBooking(activeBooking.id)}
                          >
                            Finish / Cancel Session
                          </Button>
                        )}

                        {!pendingBooking && !activeBooking && (
                          <p className="text-[11px] text-muted-foreground">No pending customer for this court.</p>
                        )}
                      </div>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    className="mt-6 w-full"
                    onClick={() => {
                      setSelectedStreamCourt(court.id);
                      setActiveTab("live");
                    }}
                  >
                    <Video className="mr-1.5 h-4 w-4" /> Watch Live Feed
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* SUB-VIEW 2: LIVE STREAMING FEEDS */}
      {activeTab === "live" && (
        <section className="mt-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Video className="h-6 w-6 text-red-500 animate-pulse" /> Live Court Stream
              </h2>
              <p className="text-sm text-muted-foreground">Watch real-time matches and court activity</p>
            </div>

            {/* Switch Stream Court */}
            <div className="flex gap-2">
              {COURTS.map((c) => (
                <Button
                  key={c.id}
                  variant={selectedStreamCourt === c.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedStreamCourt(c.id)}
                >
                  {c.name.split("—")[0]}
                </Button>
              ))}
            </div>
          </div>

          {/* Stream Player Window */}
          <div className="overflow-hidden rounded-2xl border bg-black shadow-lg">
            <div className="relative aspect-video w-full">
              <iframe
                src={COURTS.find((c) => c.id === selectedStreamCourt)?.streamUrl}
                className="h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Pickleball Live Stream"
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-card text-foreground">
              <div>
                <h3 className="font-bold">
                  {COURTS.find((c) => c.id === selectedStreamCourt)?.name}
                </h3>
                <p className="text-xs text-muted-foreground">Camera Feed #1 — Main Sideline View</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-500">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" /> LIVE
              </span>
            </div>
          </div>
        </section>
      )}

      {/* SUB-VIEW 3: BOOK COURT (Standard Booking Form) */}
      {activeTab === "book" && (
        <section className="mt-8">
          {submittedBooking ? (
            <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h3 className="mt-4 text-2xl font-bold">Booking Reserved!</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Please present your name at the front desk when arriving. The admin will start your game timer upon arrival.
              </p>
              <Button className="mt-6 w-full" onClick={() => setActiveTab("status")}>
                Return to Court Overview
              </Button>
            </div>
          ) : (
            <form onSubmit={handleBookSubmit} className="grid gap-8 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <div className="rounded-2xl border bg-card p-6">
                  <h3 className="text-lg font-bold">Select Court & Slot</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {COURTS.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => setSelectedCourt(c.id)}
                        className={`rounded-xl border p-4 text-left transition ${
                          selectedCourt === c.id ? "border-primary bg-primary/10" : "hover:bg-muted/50"
                        }`}
                      >
                        <p className="font-bold text-sm">{c.name}</p>
                        <p className="text-xs text-muted-foreground">₱{c.rateDay}/hr</p>
                      </button>
                    ))}
                  </div>

                  <div className="mt-5">
                    <label className="text-xs font-semibold">Player Name</label>
                    <input
                      type="text"
                      required
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div className="mt-4">
                    <label className="text-xs font-semibold">Contact Number</label>
                    <input
                      type="tel"
                      required
                      value={playerContact}
                      onChange={(e) => setPlayerContact(e.target.value)}
                      className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                      placeholder="0917-XXX-XXXX"
                    />
                  </div>
                </div>
              </div>

              <div className="h-fit rounded-2xl border bg-card p-6 shadow-sm">
                <h3 className="font-bold text-lg">Summary</h3>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span>Court:</span><span className="font-semibold">{courtObj.name}</span></div>
                  <div className="flex justify-between"><span>Total:</span><span className="font-semibold text-primary">₱{totalAmount}</span></div>
                </div>
                <Button type="submit" className="mt-6 w-full" disabled={saving}>
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
