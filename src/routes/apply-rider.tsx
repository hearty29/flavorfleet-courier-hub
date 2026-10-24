import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Bike, Wallet, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/apply-rider")({
  head: () => ({
    meta: [
      { title: "Become a Roadside Paddles Rider" },
      { name: "description", content: "Apply to deliver food with Roadside Paddles. Flexible hours, weekly payouts." },
      { property: "og:title", content: "Become a Roadside Paddles rider" },
      { property: "og:description", content: "Apply to deliver food with Roadside Cafe. Flexible hours, weekly payouts." },
    ],
  }),
  component: ApplyRider,
});

function ApplyRider() {
  const { session, roles } = useAuth();
  const qc = useQueryClient();
  const [vehicle, setVehicle] = useState("motorcycle");
  const [busy, setBusy] = useState(false);
  const uid = session?.user.id;
  const { data: apps = [] } = useQuery({
    queryKey: ["my-app", uid],
    enabled: !!uid,
    queryFn: async () => (await supabase.from("rider_applications").select("*").eq("user_id", uid!).order("created_at", { ascending: false })).data ?? [],
  });
  const latest = apps[0];

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.from("rider_applications").insert({
      user_id: uid!, full_name: String(f.get("full_name")), phone: String(f.get("phone")), address: String(f.get("address")),
      vehicle_type: vehicle, plate_number: String(f.get("plate") || ""), license_number: String(f.get("license")), experience: String(f.get("experience") || ""),
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Application submitted!");
    qc.invalidateQueries({ queryKey: ["my-app"] });
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <h1 className="text-5xl font-extrabold leading-none">Ride with <span className="text-primary">Roadside Paddles</span></h1>
          <p className="mt-4 text-muted-foreground">Deliver hot meals around your neighborhood and earn on your own schedule.</p>
          {session && <Button asChild variant="outline" className="mt-4"><Link to="/verification">Profile picture &amp; ID verification</Link></Button>}
          <ul className="mt-6 space-y-3">
            <li className="flex gap-3"><Clock className="text-primary" /> Choose your own hours</li>
            <li className="flex gap-3"><Wallet className="text-primary" /> Earn per delivery</li>
            <li className="flex gap-3"><Bike className="text-primary" /> Motorcycle or bicycle welcome</li>
          </ul>
        </div>
        <div className="rounded-2xl border bg-card p-6">
          {!session ? (
            <div className="text-center">
              <p className="mb-4">Sign in first to submit your rider application.</p>
              <Button asChild><Link to="/auth">Sign in to apply</Link></Button>
            </div>
          ) : roles.includes("rider") ? (
            <div className="text-center">
              <p className="mb-4 font-medium">You're an approved rider! 🎉</p>
              <Button asChild><Link to="/rider">Open rider dashboard</Link></Button>
            </div>
          ) : latest && latest.status === "pending" ? (
            <div className="text-center"><p className="mb-2">Your application is under review.</p><StatusBadge status="pending" /></div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {latest?.status === "rejected" && <p className="text-sm text-destructive">Your previous application was not approved. You may apply again.</p>}
              <h2 className="text-xl font-bold">Rider application</h2>
              <div><Label htmlFor="fn">Full name</Label><Input id="fn" name="full_name" required /></div>
              <div><Label htmlFor="ph">Phone</Label><Input id="ph" name="phone" required /></div>
              <div><Label htmlFor="ad">Home address</Label><Input id="ad" name="address" required /></div>
              <div>
                <Label>Vehicle</Label>
                <Select value={vehicle} onValueChange={setVehicle}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="motorcycle">Motorcycle</SelectItem>
                    <SelectItem value="bicycle">Bicycle</SelectItem>
                    <SelectItem value="car">Car</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="pl">Plate number</Label><Input id="pl" name="plate" /></div>
                <div><Label htmlFor="li">Driver's license no.</Label><Input id="li" name="license" required /></div>
              </div>
              <div><Label htmlFor="ex">Experience (optional)</Label><Textarea id="ex" name="experience" /></div>
              <Button className="w-full" disabled={busy}>Submit application</Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
