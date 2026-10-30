import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "rider" | "customer" | "cashier" | "kitchen" | "court_manager";

type AuthCtx = {
  session: Session | null;
  roles: Role[];
  loading: boolean;
  isAdmin: boolean;
  isCashier: boolean;
  isKitchen: boolean;
  isCourtManager: boolean;
  isStaff: boolean;
  refreshRoles: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  session: null,
  roles: [],
  loading: true,
  isAdmin: false,
  isCashier: false,
  isKitchen: false,
  isCourtManager: false,
  isStaff: false,
  refreshRoles: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoles = async (uid?: string) => {
    if (!uid) {
      setRoles([]);
      return;
    }
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const list = (data ?? []).map((r) => r.role as Role);

    // Admins implicitly inherit all operational capabilities
    if (list.includes("admin") && !list.includes("rider")) {
      list.push("rider");
    }
    setRoles(list);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setTimeout(() => loadRoles(s?.user.id), 0);
    });

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadRoles(data.session?.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const isAdmin = roles.includes("admin");
  const isCashier = isAdmin || roles.includes("cashier");
  const isKitchen = isAdmin || roles.includes("kitchen");
  const isCourtManager = isAdmin || roles.includes("court_manager");
  const isStaff = isAdmin || roles.some((r) => ["cashier", "kitchen", "court_manager"].includes(r));

  return (
    <Ctx.Provider
      value={{
        session,
        roles,
        loading,
        isAdmin,
        isCashier,
        isKitchen,
        isCourtManager,
        isStaff,
        refreshRoles: () => loadRoles(session?.user.id),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
