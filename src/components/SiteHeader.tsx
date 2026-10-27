import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingBag, LogOut, Shield, Bike, Receipt, Trophy, Info } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { session, roles } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-1 px-3 sm:gap-2 sm:px-4">
        <Link to="/" className="mr-auto min-w-0 truncate font-display text-xl font-extrabold text-primary sm:text-2xl">
          Roadside<span className="text-foreground"> Paddles</span>
        </Link>

        {/* About Us Tab */}
        <Button asChild variant="ghost" size="sm">
          <Link to="/about" aria-label="About us">
            <Info className="h-4 w-4" />
            <span className="ml-1.5 hidden font-medium sm:inline">About</span>
          </Link>
        </Button>

        {/* Pickleball Tab */}
        <Button asChild variant="ghost" size="sm">
          <Link to="/pickleball" aria-label="Pickleball courts">
            <Trophy className="h-4 w-4" />
            <span className="ml-1.5 hidden font-medium sm:inline">Pickleball</span>
          </Link>
        </Button>

        {roles.includes("admin") && (
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin" aria-label="Admin panel">
              <Shield className="h-4 w-4" />
              <span className="ml-1.5 hidden font-medium sm:inline">Admin</span>
            </Link>
          </Button>
        )}

        {roles.includes("rider") && (
          <Button asChild variant="ghost" size="sm">
            <Link to="/rider" aria-label="Rider dashboard">
              <Bike className="h-4 w-4" />
              <span className="ml-1.5 hidden font-medium sm:inline">Rider</span>
            </Link>
          </Button>
        )}

        {session && (
          <Button asChild variant="ghost" size="sm">
            <Link to="/orders" aria-label="My orders">
              <Receipt className="h-4 w-4" />
              <span className="ml-1.5 hidden font-medium sm:inline">Orders</span>
            </Link>
          </Button>
        )}

        <Button asChild variant="outline" size="sm" className="relative">
          <Link to="/checkout" aria-label="View Cart">
            <ShoppingBag className="h-4 w-4" />
            {count > 0 && (
              <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-xs text-primary-foreground font-bold">
                {count}
              </span>
            )}
          </Link>
        </Button>

        {session ? (
          <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        ) : (
          <Button asChild size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
