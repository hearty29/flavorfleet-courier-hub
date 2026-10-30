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
  Menu as MenuIcon,
  House,
  UtensilsCrossed,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteHeader() {
  const { session, roles, isStaff, isAdmin } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const isRider = roles.includes("rider");

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-3 sm:px-4">
        <Link
          to="/"
          className="shrink-0 font-display text-xl font-extrabold text-primary sm:text-2xl"
        >
          Roadside<span className="text-foreground"> Paddles</span>
        </Link>

        <nav aria-label="Main navigation" className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon" className="relative">
            <Link to="/checkout" aria-label={`Shopping cart${count > 0 ? `, ${count} items` : ""}`}>
              <ShoppingBag />
              {count > 0 && (
                <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-xs text-primary-foreground">
                  {count}
                </span>
              )}
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open navigation menu">
                <MenuIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {isStaff && (
                <DropdownMenuItem asChild>
                  <Link to="/admin">
                    <Shield className="mr-2 h-4 w-4 text-primary" />
                    {isAdmin ? "Admin Panel" : "Staff Portal"}
                  </Link>
                </DropdownMenuItem>
              )}
              {isRider && (
                <DropdownMenuItem asChild>
                  <Link to="/rider">
                    <Bike className="mr-2 h-4 w-4" /> Rider
                  </Link>
                </DropdownMenuItem>
              )}
              {!isStaff && !isRider && (
                <DropdownMenuItem asChild>
                  <Link to="/apply-rider">
                    <Bike className="mr-2 h-4 w-4" /> Apply as Rider
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/">
                  <House className="mr-2 h-4 w-4" /> Home
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/menu">
                  <UtensilsCrossed className="mr-2 h-4 w-4" /> Menu
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/pickleball">
                  <Trophy className="mr-2 h-4 w-4" /> Pickleball
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/tournaments">
                  <Medal className="mr-2 h-4 w-4" /> Tournament
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/leaderboard">
                  <ListOrdered className="mr-2 h-4 w-4" /> Leaderboard
                </Link>
              </DropdownMenuItem>
              {session && (
                <DropdownMenuItem asChild>
                  <Link to="/orders">
                    <Receipt className="mr-2 h-4 w-4" /> Orders
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link to="/about">
                  <Info className="mr-2 h-4 w-4" /> About
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {session ? (
                <DropdownMenuItem onSelect={signOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem asChild>
                  <Link to="/auth">
                    <LogOut className="mr-2 h-4 w-4 rotate-180" /> Sign in
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>
    </header>
  );
}
