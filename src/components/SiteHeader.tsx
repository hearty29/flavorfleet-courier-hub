import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingBag, LogOut, Shield, Bike, Receipt, Trophy, Info, Medal } from "lucide-react";
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
        <Link
          to="/"
          className="mr-auto min-w-0 truncate font-display text-xl font-extrabold text-primary sm:text-2xl"
        >
          Roadside<span className="text-foreground"> Paddles</span>
        </Link>

        {/* About Us Tab */}
        <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
          <Link to="/about" aria-label="About us">
            <Info className="h-4 w-4" />
            <span className="ml-1.5 hidden font-medium lg:inline">About</span>
          </Link>
        </Button>

        {/* Pickleball Tab */}
        <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
          <Link to="/pickleball" aria-label="Pickleball courts">
            <Trophy className="h-4 w-4" />
            <span className="ml-1.5 hidden font-medium lg:inline">Pickleball</span>
          </Link>
        </Button>

        <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
          <Link to="/tournaments" aria-label="Pickleball tournaments">
            <Medal className="h-4 w-4" />
            <span className="ml-1.5 hidden font-medium lg:inline">Tournaments</span>
          </Link>
        </Button>

        {roles.includes("admin") && (
          <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
            <Link to="/admin" aria-label="Admin dashboard">
              <Shield /> <span className="hidden lg:inline">Admin</span>
            </Link>
          </Button>
        )}
        {roles.includes("rider") && (
          <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
            <Link to="/rider" aria-label="Rider dashboard">
              <Bike /> <span className="hidden lg:inline">Rider</span>
            </Link>
          </Button>
        )}
        {session && (
          <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
            <Link to="/orders" aria-label="My orders">
              <Receipt /> <span className="hidden lg:inline">Orders</span>
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" size="sm" className="relative px-2 sm:px-3">
          <Link to="/checkout" aria-label="Shopping cart">
            <ShoppingBag />
            {count > 0 && (
              <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-xs text-primary-foreground">
                {count}
              </span>
            )}
          </Link>
        </Button>
        {session ? (
          <Button
            variant="ghost"
            size="sm"
            className="px-2 sm:px-3"
            onClick={signOut}
            aria-label="Sign out"
          >
            <LogOut />
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
