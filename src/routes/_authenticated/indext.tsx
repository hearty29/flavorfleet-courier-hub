
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
  Check,
  Utensils,
  Settings,
  Edit2,
  Trash2,
  Sparkles,
  MapPin,
  Tag,
  DollarSign,
  ChefHat,
  Filter,
  CheckCircle2,
  ArrowRight
} from "lucide-react";

// --- Types & Interfaces ---
export interface ExtraOptionChoice {
  label: string;
  priceExtra: number;
}

export interface ExtraOptionGroup {
  name: string;
  choices: ExtraOptionChoice[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  popular?: boolean;
  options?: ExtraOptionGroup[];
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

export type OrderMode = "dine-in" | "delivery" | "takeout";

// --- Initial Sample Data ---
const INITIAL_MENU: MenuItem[] = [
  {
    id: "1",
    name: "Sizzling Pork Sisig",
    description: "Crispy chopped pork belly & ears cooked with onions, calamansi, chili, and garlic served hot.",
    price: 220,
    category: "Mains",
    image_url: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80",
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
          { label: "Poached Egg", priceExtra: 20 },
          { label: "Garlic Rice", priceExtra: 35 }
        ]
      }
    ]
  },
  {
    id: "2",
    name: "Classic Pork Adobo",
    description: "Tender pork shoulder slow-cooked in savory soy sauce, native vinegar, black pepper, and garlic.",
    price: 195,
    category: "Mains",
    image_url: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&auto=format&fit=crop&q=80",
    popular: true
  },
  {
    id: "3",
    name: "Artisan Iced Spanish Latte",
    description: "Rich dark espresso combined with fresh steamed milk and sweetened condensed milk over ice.",
    price: 135,
    category: "Drinks",
    image_url: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&auto=format&fit=crop&q=80",
    popular: true,
    options: [
      {
        name: "Milk Choice",
        choices: [
          { label: "Whole Milk", priceExtra: 0 },
          { label: "Oat Milk", priceExtra: 30 },
          { label: "Almond Milk", priceExtra: 25 }
        ]
      },
      {
        name: "Sweetness",
        choices: [
          { label: "50% Less Sweet", priceExtra: 0 },
          { label: "Standard Sweetness", priceExtra: 0 },
          { label: "Extra Sweet", priceExtra: 0 }
        ]
      }
    ]
  },
  {
    id: "4",
    name: "Special Stir-Fried Pancit",
    description: "Fresh egg noodles and vermicelli stir-fried with seasonal vegetables, chicken breast, and shrimp.",
    price: 180,
    category: "Noodles",
    image_url: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "5",
    name: "Overload Halo-Halo Special",
    description: "Finely shaved ice layered with sweet beans, nata de coco, leche flan, cheese, and ube ice cream.",
    price: 150,
    category: "Desserts",
    image_url: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&auto=format&fit=crop&q=80",
    popular: true
  },
  {
    id: "6",
    name: "Truffle Mushroom Burger",
    description: "100% Angus beef patty topped with caramelized onions, Swiss cheese, and creamy truffle sauce.",
    price: 280,
    category: "Snacks",
    image_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80"
  }
];

export default function App() {
  // --- Global App State ---
  const [menu, setMenu] = useState<MenuItem[]>(INITIAL_MENU);
  const [storeName, setStoreName] = useState<string>("Roadside Cafe & Bistro");
  const [currencySymbol, setCurrencySymbol] = useState<string>("₱");
  const [deliveryFee, setDeliveryFee] = useState<number>(49);
  
  // Filtering & Search
  const [selectedCat, setSelectedCat] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Cart & Ordering
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [orderMode, setOrderMode] = useState<OrderMode>("delivery");
  const [tableNumber, setTableNumber] = useState<string>("12");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("Block 5 Lot 12, Main Street");
  const [orderPlaced, setOrderPlaced] = useState<boolean>(false);

  // Customization Modal State
  const [activeModalItem, setActiveModalItem] = useState<MenuItem | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  // Admin / Settings Modal State
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [isAddingNewItem, setIsAddingNewItem] = useState<boolean>(false);
  
  // New Item Form State
  const [newItemName, setNewItemName] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("Mains");
  const [newItemImg, setNewItemImg] = useState("");
  const [newItemPopular, setNewItemPopular] = useState(false);

  // --- Dynamic Derived Values ---
  const categories = useMemo(() => {
    return ["All", "Popular", ...Array.from(new Set(menu.map((m) => m.category)))];
  }, [menu]);

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
  const activeDeliveryFee = orderMode === "delivery" ? deliveryFee : 0;
  const finalGrandTotal = cartSubtotal + activeDeliveryFee;

  // --- Handlers ---
  const openCustomizationModal = (item: MenuItem) => {
    // Pre-select defaults if options exist
    const initialOpts: Record<string, string> = {};
    if (item.options) {
      item.options.forEach(group => {
        if (group.choices.length > 0) {
          initialOpts[group.name] = group.choices[0].label;
        }
      });
    }
    setSelectedOptions(initialOpts);
    setActiveModalItem(item);
  };

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
  };

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

  const handleAddNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !newItemPrice) return;

    const createdItem: MenuItem = {
      id: Date.now().toString(),
      name: newItemName,
      description: newItemDesc || "Freshly prepared by our master chefs.",
      price: parseFloat(newItemPrice) || 0,
      category: newItemCategory,
      image_url: newItemImg || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80",
      popular: newItemPopular
    };

    setMenu([createdItem, ...menu]);
    
    // Reset Form
    setNewItemName("");
    setNewItemDesc("");
    setNewItemPrice("");
    setNewItemImg("");
    setNewItemPopular(false);
    setIsAddingNewItem(false);
  };

  const handleDeleteItem = (id: string) => {
    setMenu(menu.filter(item => item.id !== id));
  };

  const handleCheckout = () => {
    setOrderPlaced(true);
    setTimeout(() => {
      setCart([]);
      setOrderPlaced(false);
      setIsCartOpen(false);
    }, 2800);
  };

  return (
    <div className="min-h-screen bg-amber-50/30 text-slate-800 font-sans antialiased pb-20">
      
      {/* Dynamic Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-amber-100 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-2.5 text-white shadow-md shadow-orange-500/20">
              <ChefHat className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-slate-900 block leading-tight">
                {storeName}
              </span>
              <span className="text-xs font-semibold text-orange-600 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Kitchen Open & Ready
              </span>
            </div>
          </div>

          {/* Action Bar / Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Store Config Button */}
            <button
              onClick={() => setIsAdminOpen(true)}
              className="p-2.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition"
              title="Store Settings & Admin"
            >
              <Settings className="h-5 w-5" />
            </button>

            {/* Cart Trigger Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 font-bold shadow-md shadow-orange-600/30 transition transform active:scale-95"
            >
              <ShoppingBag className="h-5 w-5" />
              <span className="hidden sm:inline">Order Cart</span>
              <span className="bg-orange-800/40 px-2 py-0.5 rounded-full text-xs font-black">
                {currencySymbol}{cartSubtotal.toFixed(2)}
              </span>

              {cartTotalItemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] font-black text-white ring-2 ring-white">
                  {cartTotalItemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Showcase Banner */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-orange-950 to-amber-900 p-6 text-white shadow-xl sm:p-10">
          <div className="absolute right-0 top-0 -mt-10 -mr-10 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10 grid items-center gap-8 md:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold backdrop-blur-md text-amber-300 border border-white/10">
                <Sparkles className="h-3.5 w-3.5" /> Gourmet Quality Guaranteed
              </div>
              <h1 className="mt-4 text-3xl font-black leading-tight sm:text-5xl text-amber-50">
                Taste the Tradition, <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                  Savor the Moment.
                </span>
              </h1>
              <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
                Order directly from your phone or table. Pick your favorite flavors and customize your toppings in real-time.
              </p>

              {/* Order Mode Toggle Pills in Hero */}
              <div className="mt-6 inline-flex rounded-2xl bg-slate-800/80 p-1.5 border border-slate-700/60 backdrop-blur-md">
                <button
                  onClick={() => setOrderMode("delivery")}
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                    orderMode === "delivery"
                      ? "bg-orange-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Bike className="h-3.5 w-3.5" /> Delivery
                </button>
                <button
                  onClick={() => setOrderMode("dine-in")}
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                    orderMode === "dine-in"
                      ? "bg-orange-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Utensils className="h-3.5 w-3.5" /> Dine-in
                </button>
                <button
                  onClick={() => setOrderMode("takeout")}
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                    orderMode === "takeout"
                      ? "bg-orange-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" /> Takeout
                </button>
              </div>
            </div>

            {/* Featured Hero Dish Preview Card */}
            <div className="hidden md:flex justify-end">
              <div className="relative group rounded-3xl bg-white/5 p-3 backdrop-blur-md border border-white/10 shadow-2xl transition hover:scale-[1.02]">
                <img
                  src="https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80"
                  alt="Featured Sizzling Sisig"
                  className="h-64 w-72 rounded-2xl object-cover shadow-inner"
                />
                <div className="absolute bottom-6 left-6 right-6 rounded-2xl bg-slate-900/90 p-3 backdrop-blur-md text-white border border-white/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">Chef's Special</span>
                      <p className="text-sm font-bold">Sizzling Pork Sisig</p>
                    </div>
                    <span className="rounded-lg bg-orange-600 px-2.5 py-1 text-xs font-black">
                      {currencySymbol}220
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic Controls Bar: Filter & Search */}
        <section className="mt-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            
            {/* Horizontal Scrollable Categories */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCat(cat)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
                    selectedCat === cat
                      ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                      : "bg-white text-slate-600 hover:bg-amber-100/60 border border-amber-200/60"
                  }`}
                >
                  {cat === "Popular" && <Flame className="h-4 w-4 text-amber-500 fill-amber-500" />}
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative w-full md:w-72 shrink-0">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search dishes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-amber-200/80 bg-white py-2.5 pl-10 pr-4 text-sm font-medium outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200 shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Menu Items Grid */}
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMenu.map((item) => (
              <article
                key={item.id}
                className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-amber-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/5"
              >
                <div>
                  {/* Image & Badges */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80";
                      }}
                    />
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-slate-900/80 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-md">
                        {item.category}
                      </span>
                      {item.popular && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white shadow">
                          <Flame className="h-3 w-3 fill-white" /> Popular
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Info */}
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-orange-600 transition">
                      {item.name}
                    </h3>
                    <p className="mt-1.5 text-xs text-slate-500 leading-relaxed line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="flex items-center justify-between border-t border-slate-100 p-5 pt-3">
                  <div>
                    <span className="text-xs text-slate-400 block font-medium">Price</span>
                    <span className="text-xl font-black text-slate-900">
                      {currencySymbol}{item.price.toFixed(2)}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      if (item.options && item.options.length > 0) {
                        openCustomizationModal(item);
                      } else {
                        handleAddToCart(item);
                      }
                    }}
                    className="flex items-center gap-1.5 rounded-2xl bg-amber-50 px-4 py-2.5 text-xs font-bold text-orange-600 border border-orange-200 transition hover:bg-orange-600 hover:text-white hover:border-orange-600 shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    {item.options && item.options.length > 0 ? "Customize" : "Add to Order"}
                  </button>
                </div>
              </article>
            ))}
          </div>

          {/* Empty Search Result */}
          {filteredMenu.length === 0 && (
            <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-amber-200 mt-6">
              <Utensils className="h-10 w-10 text-amber-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-800">No dishes found</h3>
              <p className="text-sm text-slate-500 mt-1">Try adjusting your category or search keywords.</p>
              <button
                onClick={() => { setSelectedCat("All"); setSearchQuery(""); }}
                className="mt-4 inline-flex items-center text-xs font-bold text-orange-600 hover:underline"
              >
                Reset Filters
              </button>
            </div>
          )}
        </section>
      </main>

      {/* --- CUSTOMIZE ITEM MODAL --- */}
      {activeModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header Image */}
            <div className="relative h-48 w-full bg-slate-100">
              <img
                src={activeModalItem.image_url}
                alt={activeModalItem.name}
                className="h-full w-full object-cover"
              />
              <button
                onClick={() => setActiveModalItem(null)}
                className="absolute top-3 right-3 rounded-full bg-slate-900/60 p-2 text-white hover:bg-slate-900 transition backdrop-blur-md"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="absolute bottom-3 left-4 right-4 text-white drop-shadow">
                <span className="rounded-md bg-orange-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                  {activeModalItem.category}
                </span>
                <h2 className="text-xl font-black">{activeModalItem.name}</h2>
              </div>
            </div>

            {/* Modal Options List */}
            <div className="p-6 overflow-y-auto space-y-6">
              <p className="text-xs text-slate-500">{activeModalItem.description}</p>

              {activeModalItem.options?.map((group) => (
                <div key={group.name} className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex justify-between">
                    <span>{group.name}</span>
                    <span className="text-[10px] text-orange-600 font-semibold">Required</span>
                  </label>
                  
                  <div className="grid gap-2">
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
                          className={`flex items-center justify-between rounded-2xl border p-3.5 text-xs font-bold transition ${
                            isSelected
                              ? "border-orange-600 bg-orange-50/50 text-orange-900 ring-2 ring-orange-500/20"
                              : "border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
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
                          {choice.priceExtra > 0 ? (
                            <span className="text-orange-600 font-bold">
                              +{currencySymbol}{choice.priceExtra}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">Free</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Confirm Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => handleAddToCart(activeModalItem, selectedOptions)}
                className="w-full rounded-2xl bg-orange-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-600/30 transition hover:bg-orange-700 active:scale-98 flex items-center justify-center gap-2"
              >
                <span>Add to Order</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- CART & ORDER DRAWER --- */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
            <div className="w-screen max-w-md bg-white p-6 shadow-2xl flex flex-col justify-between">
              
              <div>
                {/* Cart Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5 text-orange-600" />
                    <h2 className="text-lg font-bold text-slate-900">Your Basket</h2>
                  </div>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Mode Selector Tabs inside Cart */}
                <div className="mt-4 rounded-2xl bg-slate-100 p-1 flex">
                  {(["delivery", "dine-in", "takeout"] as OrderMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setOrderMode(mode)}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-xl capitalize transition ${
                        orderMode === mode
                          ? "bg-white text-orange-600 shadow"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {/* Conditional Fields based on Mode */}
                <div className="mt-3 p-3 bg-amber-50/60 border border-amber-200/60 rounded-2xl text-xs space-y-2">
                  {orderMode === "dine-in" && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Table Number:</span>
                      <input
                        type="text"
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        className="w-16 rounded-lg border border-amber-300 bg-white px-2 py-1 text-center font-bold text-slate-800"
                      />
                    </div>
                  )}

                  {orderMode === "delivery" && (
                    <div>
                      <span className="text-slate-600 font-medium block mb-1">Delivery Address:</span>
                      <input
                        type="text"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className="w-full rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs text-slate-800 font-medium"
                      />
                    </div>
                  )}

                  {orderMode === "takeout" && (
                    <p className="text-slate-600 text-center font-medium">
                      Pickup counter ready in approx <span className="font-bold text-slate-900">15-20 mins</span>.
                    </p>
                  )}
                </div>

                {/* Cart Items Scroll List */}
                <div className="mt-4 space-y-3 max-h-[48vh] overflow-y-auto pr-1">
                  {cart.length === 0 ? (
                    <div className="py-12 text-center">
                      <ShoppingBag className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-500">Your basket is currently empty.</p>
                      <p className="text-xs text-slate-400 mt-1">Explore our delicious menu items!</p>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 border-b border-slate-100 pb-3"
                      >
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-14 w-14 rounded-2xl object-cover"
                        />
                        <div className="flex-1">
                          <h4 className="text-xs font-bold text-slate-900">{item.name}</h4>
                          {item.selectedOptions && item.selectedOptions.length > 0 && (
                            <p className="text-[10px] text-slate-400 leading-tight">
                              {item.selectedOptions.join(", ")}
                            </p>
                          )}
                          <p className="mt-1 text-xs font-black text-orange-600">
                            {currencySymbol}{(item.price * item.quantity).toFixed(2)}
                          </p>
                        </div>

                        {/* Quantity controls */}
                        <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-2 py-1">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="p-1 text-slate-500 hover:text-slate-900 transition"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-bold text-slate-800 w-4 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="p-1 text-slate-500 hover:text-slate-900 transition"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Cart Footer Summary */}
              {cart.length > 0 && (
                <div className="border-t border-slate-100 pt-4 space-y-2.5 bg-white">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Subtotal</span>
                    <span className="font-semibold text-slate-800">{currencySymbol}{cartSubtotal.toFixed(2)}</span>
                  </div>

                  {orderMode === "delivery" && (
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Delivery Fee</span>
                      <span className="font-semibold text-slate-800">{currencySymbol}{deliveryFee.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm font-black text-slate-900 border-t border-dashed pt-2">
                    <span>Grand Total</span>
                    <span className="text-orange-600 text-base">
                      {currencySymbol}{finalGrandTotal.toFixed(2)}
                    </span>
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={orderPlaced}
                    className="w-full rounded-2xl bg-orange-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-600/30 transition hover:bg-orange-700 active:scale-98 flex items-center justify-center gap-2"
                  >
                    {orderPlaced ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-emerald-300 animate-bounce" />
                        <span>Order Sent to Kitchen!</span>
                      </>
                    ) : (
                      <>
                        <span>Confirm & Place Order</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* --- STORE CONFIG & ADMIN MODAL --- */}
      {isAdminOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-orange-600" />
                <h2 className="text-lg font-bold text-slate-900">Store Management Settings</h2>
              </div>
              <button
                onClick={() => setIsAdminOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* General Store Settings */}
            <div className="mt-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">General Information</h3>
              
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Store Name</label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Currency Symbol</label>
                  <input
                    type="text"
                    value={currencySymbol}
                    onChange={(e) => setCurrencySymbol(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Base Delivery Fee</label>
                  <input
                    type="number"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            </div>

            {/* Menu Items Management */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Menu Catalog ({menu.length})</h3>
                <button
                  onClick={() => setIsAddingNewItem(!isAddingNewItem)}
                  className="flex items-center gap-1 rounded-xl bg-orange-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-700 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {isAddingNewItem ? "Cancel" : "Add Dish"}
                </button>
              </div>

              {/* Add New Item Form */}
              {isAddingNewItem && (
                <form onSubmit={handleAddNewItem} className="mb-6 rounded-2xl bg-amber-50/50 p-4 border border-amber-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800">New Menu Dish Form</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Dish Name"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-orange-500"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Price"
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(e.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-orange-500"
                      required
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Category (e.g. Mains, Drinks)"
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-orange-500"
                      required
                    />
                    <input
                      type="url"
                      placeholder="Image URL (optional)"
                      value={newItemImg}
                      onChange={(e) => setNewItemImg(e.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-orange-500"
                    />
                  </div>

                  <textarea
                    placeholder="Short description..."
                    value={newItemDesc}
                    onChange={(e) => setNewItemDesc(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-orange-500"
                    rows={2}
                  />

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-xs text-slate-700 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newItemPopular}
                        onChange={(e) => setNewItemPopular(e.target.checked)}
                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                      />
                      Mark as Popular / Featured
                    </label>

                    <button
                      type="submit"
                      className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 transition"
                    >
                      Save New Dish
                    </button>
                  </div>
                </form>
              )}

              {/* Menu List Table / Cards */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {menu.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-800">{item.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {item.category} • {currencySymbol}{item.price}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 transition"
                      title="Delete Item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 border-t pt-4 text-right">
              <button
                onClick={() => setIsAdminOpen(false)}
                className="rounded-xl bg-slate-100 px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
              >
                Close Settings
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
```