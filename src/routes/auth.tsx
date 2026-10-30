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
      { title: "Sign in or register — Roadside Paddles" },
      {
        name: "description",
        content:
          "Sign in or create your Roadside Paddles account to order food, book courts, or apply as a rider.",
      },
      { property: "og:title", content: "Sign in or register — Roadside Paddles" },
      {
        property: "og:description",
        content:
          "Sign in or create your Roadside Paddles account to order food, book courts, or apply as a rider.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) {
      navigate({ to: "/" });
    }
  }, [session, navigate]);

  const login = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(f.get("email")),
      password: String(f.get("password")),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Signed in successfully!");
      navigate({ to: "/" });
    }
  };

  const register = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: String(f.get("email")),
      password: String(f.get("password")),
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: f.get("full_name"),
          phone: f.get("phone"),
        },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Account created! Check your email to confirm your account or sign in.");
    }
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (r.error) {
      toast.error(String(r.error.message ?? r.error));
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        Welcome to <span className="text-primary">Roadside Paddles</span>
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in to order food, track deliveries, book courts, or apply as a rider.
      </p>

      <div className="mt-6 rounded-2xl border bg-card p-6 shadow-sm">
        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={login} className="mt-4 space-y-4">
              <div>
                <Label htmlFor="le">Email</Label>
                <Input
                  id="le"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <Label htmlFor="lp">Password</Label>
                <Input
                  id="lp"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button className="w-full" disabled={busy}>
                {busy ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={register} className="mt-4 space-y-4">
              <div>
                <Label htmlFor="rn">Full name</Label>
                <Input
                  id="rn"
                  name="full_name"
                  placeholder="Jessie Cabrera"
                  autoComplete="name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="rph">Phone</Label>
                <Input
                  id="rph"
                  name="phone"
                  placeholder="09XX XXX XXXX"
                  autoComplete="tel"
                  required
                />
              </div>
              <div>
                <Label htmlFor="re">Email</Label>
                <Input
                  id="re"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <Label htmlFor="rp">Password</Label>
                <Input
                  id="rp"
                  name="password"
                  type="password"
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </div>
              <Button className="w-full" disabled={busy}>
                {busy ? "Creating account..." : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="relative my-6 text-center text-xs text-muted-foreground">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <span className="relative bg-card px-2">or continue with</span>
        </div>

        <Button variant="outline" className="w-full" onClick={google} type="button">
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </Button>
      </div>
    </main>
  );
}
