import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or register — Roadside Cafe" },
      { name: "description", content: "Sign in or create your Roadside Cafe account to order food." },
      { property: "og:title", content: "Sign in or register — Roadside Cafe" },
      { property: "og:description", content: "Sign in or create your Roadside Cafe account to order food." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (session) navigate({ to: "/" }); }, [session, navigate]);

  const login = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: String(f.get("email")), password: String(f.get("password")) });
    setBusy(false);
    if (error) toast.error(error.message);
  };
  const register = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: String(f.get("email")),
      password: String(f.get("password")),
      options: { emailRedirectTo: window.location.origin, data: { full_name: f.get("full_name"), phone: f.get("phone") } },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Check your email to confirm your account.");
  };
  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error(String(r.error.message ?? r.error));
  };

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-4xl font-extrabold">Welcome to <span className="text-primary">Roadside Cafe</span></h1>
      <p className="mt-2 text-muted-foreground">Sign in to order, track deliveries, or apply as a rider.</p>
      <div className="mt-6 rounded-2xl border bg-card p-6">
        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form onSubmit={login} className="mt-4 space-y-4">
              <div><Label htmlFor="le">Email</Label><Input id="le" name="email" type="email" required /></div>
              <div><Label htmlFor="lp">Password</Label><Input id="lp" name="password" type="password" required /></div>
              <Button className="w-full" disabled={busy}>Sign in</Button>
            </form>
          </TabsContent>
          <TabsContent value="register">
            <form onSubmit={register} className="mt-4 space-y-4">
              <div><Label htmlFor="rn">Full name</Label><Input id="rn" name="full_name" required /></div>
              <div><Label htmlFor="rph">Phone</Label><Input id="rph" name="phone" placeholder="09XX XXX XXXX" required /></div>
              <div><Label htmlFor="re">Email</Label><Input id="re" name="email" type="email" required /></div>
              <div><Label htmlFor="rp">Password</Label><Input id="rp" name="password" type="password" minLength={6} required /></div>
              <Button className="w-full" disabled={busy}>Create account</Button>
            </form>
          </TabsContent>
        </Tabs>
        <div className="my-4 text-center text-xs text-muted-foreground">or</div>
        <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
      </div>
    </main>
  );
}
