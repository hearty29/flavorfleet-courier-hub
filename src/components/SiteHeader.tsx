import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingBag, LogOut, Shield, Bike, Receipt, UserRound } from "lucide-react";
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
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
        <Link to="/" className="mr-auto font-display text-2xl font-extrabold text-primary">
          Roadside<span className="text-foreground"> Paddles</span>
        </Link>
        {roles.includes("admin") && (
          <Button asChild variant="ghost" size="sm"><Link to="/admin"><Shield /> <span className="hidden sm:inline">Admin</span></Link></Button>
        )}
        {roles.includes("rider") && (
          <Button asChild variant="ghost" size="sm"><Link to="/rider"><Bike /> <span className="hidden sm:inline">Rider</span></Link></Button>
        )}
        {session && (
          <Button asChild variant="ghost" size="sm"><Link to="/orders"><Receipt /> <span className="hidden sm:inline">Orders</span></Link></Button>
        )}
        {session && <Button asChild variant="ghost" size="icon"><Link to="/verification" aria-label="Rider verification" title="Rider verification"><UserRound /></Link></Button>}
        <Button asChild variant="outline" size="sm" className="relative">
          <Link to="/checkout">
            <ShoppingBag />
            {count > 0 && (
              <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-xs text-primary-foreground">{count}</span>
            )}
          </Link>
        </Button>
        {session ? (
          <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out"><LogOut /></Button>
        ) : (
          <Button asChild size="sm"><Link to="/auth">Sign in</Link></Button>
        )}
      </div>
    </header>
  );
}
