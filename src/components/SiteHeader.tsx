import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ShoppingBag,
  LogOut,
  Shield,
  Bike,
  Receipt,
  Trophy,
  Info,
  Medal,
  ListOrdered,
  House,
  UtensilsCrossed,
} from "lucide-react";
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
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-3 py-3 sm:px-4">
        <Link
          to="/"
          className="shrink-0 text-center font-display text-xl font-extrabold text-primary sm:text-2xl"
        >
          Roadside<span className="text-foreground"> Paddles</span>
        </Link>

        <nav
          aria-label="Main navigation"
          className="flex w-full flex-nowrap items-center justify-start gap-x-1 overflow-x-auto pb-1 [scrollbar-width:none] lg:justify-center [&::-webkit-scrollbar]:hidden [&>*]:shrink-0"
        >
          {roles.includes("admin") && (
            <Button asChild variant="ghost" size="sm" className="px-3">
              <Link to="/admin" aria-label="Admin dashboard">
                <Shield /> <span className="font-medium">Admin</span>
              </Link>
            </Button>
          )}
          {roles.includes("rider") && (
            <Button asChild variant="ghost" size="sm" className="px-3">
              <Link to="/rider" aria-label="Rider dashboard">
                <Bike /> <span className="font-medium">Rider</span>
              </Link>
            </Button>
          )}
          {!roles.includes("admin") && !roles.includes("rider") && (
            <Button asChild variant="ghost" size="sm" className="px-3">
              <Link to="/apply-rider" aria-label="Apply as Rider">
                <Bike /> <span className="font-medium">Apply as Rider</span>
              </Link>
            </Button>
          )}
          {/* Pickleball Tab */}
          <Button asChild variant="ghost" size="sm" className="px-3">
            <Link to="/pickleball" aria-label="Pickleball courts">
              <Trophy className="h-4 w-4" />
              <span className="font-medium">Pickleball</span>
            </Link>
          </Button>

          <Button asChild variant="ghost" size="sm" className="px-3">
            <Link to="/tournaments" aria-label="Pickleball tournaments">
              <Medal className="h-4 w-4" />
              <span className="font-medium">Tournament</span>
            </Link>
          </Button>

          <Button asChild variant="ghost" size="sm" className="px-3">
            <Link to="/leaderboard" aria-label="Leaderboard and open play queue">
              <ListOrdered className="h-4 w-4" />
              <span className="font-medium">Leaderboard</span>
            </Link>
          </Button>

          <Button asChild variant="ghost" size="sm" className="px-3">
            <Link to="/menu" aria-label="Food and coffee menu">
              <UtensilsCrossed className="h-4 w-4" />
              <span className="font-medium">Menu</span>
            </Link>
          </Button>

          {session && (
            <Button asChild variant="ghost" size="sm" className="px-3">
              <Link to="/orders" aria-label="My orders">
                <Receipt /> <span className="font-medium">Orders</span>
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="relative px-3">
            <Link to="/checkout" aria-label="Shopping cart">
              <ShoppingBag />
              <span>Cart</span>
              {count > 0 && (
                <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-xs text-primary-foreground">
                  {count}
                </span>
              )}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="px-3">
            <Link to="/" aria-label="Home">
              <House className="h-4 w-4" />
              <span className="font-medium">Home</span>
            </Link>
          </Button>
          {/* About Us Tab */}
          <Button asChild variant="ghost" size="sm" className="px-3">
            <Link to="/about" aria-label="About us">
              <Info className="h-4 w-4" />
              <span className="font-medium">About</span>
            </Link>
          </Button>

          {session ? (
            <Button
              variant="ghost"
              size="sm"
              className="px-3"
              onClick={signOut}
              aria-label="Sign out"
            >
              <LogOut />
              <span>Sign out</span>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
