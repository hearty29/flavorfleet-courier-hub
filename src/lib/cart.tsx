import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type RiceAddon = {
  id: "garlic_rice" | "yangchow_rice";
  name: string;
  ricePrice: number; // 25
  bowlPrice: number; // 30
};

export type CartItem = {
  id: string; // Unique cart line-item ID (combines item ID + selected rice)
  menuItemId: string;
  name: string;
  price: number; // Includes base price + rice (₱25) + takeout bowl (₱30)
  quantity: number;
  image_url: string | null;
  selectedRice?: RiceAddon | null;
};

type CartCtx = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">) => void;
  setQty: (id: string, q: number) => void;
  clear: () => void;
  subtotal: number;
  count: number;
};

export const TAKEOUT_BOWL_PRICE = 30;

export const RICE_OPTIONS: RiceAddon[] = [
  { id: "garlic_rice", name: "Garlic Rice", ricePrice: 25, bowlPrice: TAKEOUT_BOWL_PRICE },
  { id: "yangchow_rice", name: "Yangchow Rice", ricePrice: 25, bowlPrice: TAKEOUT_BOWL_PRICE },
];

export const DELIVERY_FEE = 49;
export const peso = (n: number) =>
  `₱${Number(n).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      setItems(JSON.parse(localStorage.getItem("cart") || "[]"));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(items));
  }, [items]);

  const add: CartCtx["add"] = (itemToAdd) =>
    setItems((prev) => {
      const existing = prev.find((p) => p.id === itemToAdd.id);
      if (existing) {
        return prev.map((p) =>
          p.id === itemToAdd.id ? { ...p, quantity: p.quantity + 1 } : p
        );
      }
      return [...prev, { ...itemToAdd, quantity: 1 }];
    });

  const setQty = (id: string, q: number) =>
    setItems((prev) =>
      q <= 0 ? prev.filter((p) => p.id !== id) : prev.map((p) => (p.id === id ? { ...p, quantity: q } : p))
    );

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <Ctx.Provider
      value={{
        items,
        add,
        setQty,
        clear: () => setItems([]),
        subtotal,
        count,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useCart = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("CartProvider missing");
  return c;
};
