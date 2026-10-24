import React, { useState, useMemo } from "react";
import { 
  Search, 
  ShoppingBag, 
  Plus, 
  Minus, 
  X, 
  Bike, 
  Star, 
  Clock, 
  Flame, 
  ChevronRight,
  Check
} from "lucide-react";

// --- Types ---
export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  popular?: boolean;
  options?: {
    name: string;
    choices: { label: string; priceExtra: number }[];
  }[];
}

export interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  selectedOptions?: string[];
  image_url: string;
}

// --- Sample Data ---
const SAMPLE_MENU: MenuItem[] = [
  {
    id: "1",
    name: "Sizzling Pork Sisig",
    description: "Crispy chopped pork with onions, chili, and savory seasonings served on a hot skillet.",
    price: 220,
    category: "Mains",
    image_url: "/images/sisig.jpg",
    popular: true,
    options: [
      {
        name: "Spice Level",
        choices: [
          { label: "Mild", priceExtra: 0 },
          { label: "Spicy", priceExtra: 0 },
          { label: "Extra Hot", priceExtra: 10 }
        ]
      },
      {
        name: "Add-ons",
        choices: [
          { label: "Extra Egg", priceExtra: 20 },
          { label: "Garlic Rice", priceExtra: 35 }
        ]
      }
    ]
  },
  {
    id: "2",
    name: "Classic Pork Adobo",
    description: "Tender pork shoulder stewed in soy sauce, vinegar, garlic, and bay leaves.",
    price: 195,
    category: "Mains",
    image_url: "/images/adobo.jpg",
    popular: true
  },
  {
    id: "3",
    name: "Spanish Latte (Iced)",
    description: "Espresso combined with fresh milk and sweetened condensed milk.",
    price: 135,
    category: "Drinks",
    image_url: "/images/spanish-latte.jpg",
    popular: true
  },
  {
    id: "4",
    name: "Pancit Canton",
    description: "Stir-fried egg noodles with vegetables, chicken, and shrimp.",
    price: 180,
    category: "Noodles",
    image_url: "/images/pancit.jpg"
  },
  {
    id: "5",
    name: "Halo-Halo Special",
    description: "Shaved ice layered with sweet beans, jelly, leche flan, and ube ice cream.",
    price: 150,
    category: "Desserts",
    image_url: "/images/halohalo.jpg"
  }
];

export function DynamicFoodStoreTemplate({
  menu = SAMPLE_MENU,
  currencySymbol = "₱",
  deliveryFee = 49,
  storeName = "Roadside Cafe"
}: {
  menu?: MenuItem[];
  currencySymbol?: string;
  deliveryFee?: number;
  storeName?: string;
}) {
  // State
  const [selectedCat, setSelectedCat] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [activeModalItem, setActiveModalItem] = useState<MenuItem | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  // Unique Categories
  const categories = useMemo(() => {
    return ["All", "Popular", ...Array.from(new Set(menu.map((m) => m.category)))];
  }, [menu]);

  // Filtered Menu Items
  const filteredMenu = useMemo(() => {
    return menu.filter((item) => {
      const matchesCategory =
        selectedCat === "All"
          ? true
          : selectedCat === "Popular"
          ? item.popular
          : item.category === selectedCat;

      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [menu, selectedCat, searchQuery]);

  // Cart Calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartTotalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Add Item to Cart
  const handleAddToCart = (item: MenuItem, customOptions?: Record<string, string>) => {
    let finalPrice = item.price;
    const optionLabels: string[] = [];

    if (customOptions && item.options) {
      item.options.forEach((group) => {
        const selectedChoiceLabel = customOptions[group.name];
        if (selectedChoiceLabel) {
          const choice = group.choices.find((c) => c.label === selectedChoiceLabel);
          if (choice) {
            finalPrice += choice.priceExtra;
            optionLabels.push(`${group.name}: ${choice.label}`);
          }
        }
      });
    }

    const cartItemId = `${item.id}-${optionLabels.sort().join("-")}`;

    setCart((prevCart) => {
      const existing = prevCart.find((ci) => ci.id === cartItemId);
      if (existing) {
        return prevCart.map((ci) =>
          ci.id === cartItemId ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [
        ...prevCart,
        {
          id: cartItemId,
          menuItemId: item.id,
          name: item.name,
          price: finalPrice,
          quantity: 1,
          selectedOptions: optionLabels,
          image_url: item.image_url
        }
      ];
    });

    setActiveModalItem(null);
    setSelectedOptions({});
  };

  // Update Cart Quantity
  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === cartItemId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Header / Navbar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-orange-600 p-2 text-white">
              <Bike className="h-6 w-6" />
            </div>
            <span className="text-xl font-black tracking-tight">{storeName}</span>
          </div>

          <button
            onClick={() => setIsCartOpen(true)}
            className="relative flex items-center gap-2 rounded-full bg-orange-50 px-4 py-2 font-semibold text-orange-600 transition hover:bg-orange-100"
          >
            <ShoppingBag className="h-5 w-5" />
            <span>{currencySymbol}{cartSubtotal.toFixed(2)}</span>
            {cartTotalItemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white">
                {cartTotalItemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Hero Banner */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <section className="grid items-center gap-8 rounded-3xl bg-gradient-to-br from-orange-600 to-amber-500 p-8 text-white md:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-sm font-medium backdrop-blur-md">
              <Clock className="h-4 w-4" /> Delivered hot in 30 mins
            </div>
            <h1 className="mt-4 text-4xl font-black leading-tight md:text-6xl">
              Authentic Flavors, <br /> Delivered Fast.
            </h1>
            <p className="mt-3 text-orange-100 text-lg">
              Satisfy your cravings with freshly prepared meals made from local ingredients.
            </p>
          </div>
          <div className="flex justify-center">
            <img
              src="/images/sisig.jpg"
              alt="Featured Dish"
              className="h-64 w-64 rounded-2xl object-cover shadow-2xl ring-4 ring-white/30 md:h-80 md:w-80"
            />
          </div>
        </section>

        {/* Filter Controls & Search */}
        <section id="menu" className="mt-10 scroll-mt-20">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Category Pills */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCat(cat)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold transition ${
                    selectedCat === cat
                      ? "bg-orange-600 text-white shadow-md shadow-orange-600/20"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  {cat === "Popular" && <Flame className="h-4 w-4 text-amber-400" />}
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
              />
            </div>
          </div>

          {/* Food Grid */}
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMenu.map((item) => (
              <article
                key={item.id}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              >
                <div>
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop";
                      }}
                    />
                    {item.popular && (
                      <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-white shadow">
                        <Flame className="h-3 w-3" /> Popular
                      </span>
                    )}
                  </div>

                  <div className="p-5">
                    <h3 className="text-lg font-bold text-slate-900">{item.name}</h3>
                    <p className="mt-1 text-sm text-slate-500 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 p-5 pt-3">
                  <span className="text-lg font-black text-orange-600">
                    {currencySymbol}{item.price.toFixed(2)}
                  </span>
                  <button
                    onClick={() => {
                      if (item.options && item.options.length > 0) {
                        setActiveModalItem(item);
                      } else {
                        handleAddToCart(item);
                      }
                    }}
                    className="flex items-center gap-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
                  >
                    <Plus className="h-4 w-4" /> Add
                  </button>
                </div>
              </article>
            ))}
          </div>

          {filteredMenu.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-lg text-slate-500">No dishes match your criteria.</p>
            </div>
          )}
        </section>
      </main>

      {/* Customize Options Modal */}
      {activeModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-xl font-bold">{activeModalItem.name}</h2>
              <button
                onClick={() => setActiveModalItem(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {activeModalItem.options?.map((group) => (
                <div key={group.name}>
                  <p className="font-semibold text-slate-700">{group.name}</p>
                  <div className="mt-2 space-y-2">
                    {group.choices.map((choice) => {
                      const isSelected = selectedOptions[group.name] === choice.label;
                      return (
                        <button
                          key={choice.label}
                          onClick={() =>
                            setSelectedOptions((prev) => ({
                              ...prev,
                              [group.name]: choice.label
                            }))
                          }
                          className={`flex w-full items-center justify-between rounded-xl border p-3 text-sm font-medium transition ${
                            isSelected
                              ? "border-orange-600 bg-orange-50 text-orange-700"
                              : "border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                                isSelected
                                  ? "border-orange-600 bg-orange-600 text-white"
                                  : "border-slate-300"
                              }`}
                            >
                              {isSelected && <Check className="h-3 w-3" />}
                            </span>
                            {choice.label}
                          </span>
                          {choice.priceExtra > 0 && (
                            <span className="text-xs text-slate-500">
                              +{currencySymbol}{choice.priceExtra}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <button
                onClick={() => handleAddToCart(activeModalItem, selectedOptions)}
                className="w-full rounded-xl bg-orange-600 py-3 font-semibold text-white shadow-lg transition hover:bg-orange-700"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-sm">
          <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
            <div className="w-screen max-w-md bg-white p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b pb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5 text-orange-600" /> Your Order
                  </h2>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-4 space-y-4 max-h-[65vh] overflow-y-auto">
                  {cart.length === 0 ? (
                    <p className="py-8 text-center text-slate-400">Your cart is empty.</p>
                  ) : (
                    cart.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 border-b border-slate-100 pb-3"
                      >
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-800">{item.name}</h4>
                          {item.selectedOptions && (
                            <p className="text-xs text-slate-400">
                              {item.selectedOptions.join(", ")}
                            </p>
                          )}
                          <p className="mt-1 text-sm font-bold text-orange-600">
                            {currencySymbol}{(item.price * item.quantity).toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="text-slate-500 hover:text-slate-800"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-sm font-semibold">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="text-slate-500 hover:text-slate-800"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {cart.length > 0 && (
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Subtotal</span>
                    <span>{currencySymbol}{cartSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Delivery Fee</span>
                    <span>{currencySymbol}{deliveryFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-slate-900 border-t pt-2">
                    <span>Total</span>
                    <span className="text-orange-600">
                      {currencySymbol}{(cartSubtotal + deliveryFee).toFixed(2)}
                    </span>
                  </div>
                  <button className="w-full rounded-xl bg-orange-600 py-3 font-semibold text-white shadow-md transition hover:bg-orange-700">
                    Proceed to Checkout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
