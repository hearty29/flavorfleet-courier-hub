import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Bike } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCart, peso } from "@/lib/cart";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Roadside Paddles — Filipino food delivered hot" },
      { name: "description", content: "Order adobo, sisig, pancit and more. Cash on delivery, fast riders." },
      { property: "og:title", content: "Roadside Paddles — Filipino food delivered hot" },
      { property: "og:description", content: "Order adobo, sisig, pancit and more. Cash on delivery, fast riders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { add } = useCart();
  const [cat, setCat] = useState("All");

  // Fetch all menu items so sold-out items still appear with a badge
  const { data: menu = [], isLoading } = useQuery({
    queryKey: ["menu"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .order("category");
      if (error) throw error;
      return data;
    },
  });

  const cats = ["All", ...Array.from(new Set(menu.map((m) => m.category)))];
  const shown = cat === "All" ? menu : menu.filter((m) => m.category === cat);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20">
      <section className="grid items-center gap-8 py-10 md:grid-cols-2 md:py-16">
        <div>
          <span className="inline-block rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">
            Delivered in 30 mins
          </span>
          <h1 className="mt-4 text-5xl font-extrabold leading-[0.95] md:text-7xl">
            Food x Coffee,<br />
            <span className="text-primary">hatid sa'yo!</span>
          </h1>
          <p className="mt-4 max-w-md text-lg text-muted-foreground">
            Your daily neighborhood pause. Savor rich espressos, comforting eats, and warm conversations in a place that feels like home.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <a href="#menu">Order now</a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/apply-rider">
                <Bike className="mr-2 h-5 w-5" /> Be Part of Our Team as a Store Delivery Rider
              </Link>
            </Button>
          </div>
        </div>
        <div className="relative">
          <img
            src="/images/sisig.jpg"
            alt="Sizzling sisig"
            width={816}
            height={816}
            className="aspect-square w-full rounded-[2rem] object-cover shadow-warm"
          />
        </div>
      </section>

      <section id="menu" className="scroll-mt-20">
        <h2 className="text-3xl font-bold">Menu</h2>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {cats.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={cat === c ? "default" : "secondary"}
              className="rounded-full"
              onClick={() => setCat(c)}
            >
              {c}
            </Button>
          ))}
        </div>

        {isLoading && <p className="mt-6 text-muted-foreground">Loading menu…</p>}

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((m) => {
            const isSoldOut = m.available === false;

            return (
              <article
                key={m.id}
                className={`overflow-hidden rounded-2xl border bg-card transition-all ${
                  isSoldOut ? "opacity-75" : ""
                }`}
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
                  {m.image_url ? (
                    <img
                      src={m.image_url}
                      alt={m.name}
                      loading="lazy"
                      width={816}
                      height={816}
                      className={`h-full w-full object-cover transition-transform duration-300 ${
                        isSoldOut ? "grayscale" : "hover:scale-105"
                      }`}
                    />
                  ) : (
                    <div className="grid h-full place-items-center font-display text-2xl text-muted-foreground">
                      {m.name}
                    </div>
                  )}

                  {/* Sold Out Overlay Tag */}
                  {isSoldOut && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                      <span className="rounded-full bg-destructive px-3 py-1 text-xs font-bold uppercase tracking-wider text-destructive-foreground shadow-md">
                        Sold Out
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-3 p-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold">{m.name}</h3>
                    <p className="text-sm text-muted-foreground">{m.description}</p>
                    <p className="mt-2 font-bold text-primary">{peso(m.price)}</p>
                  </div>

                  <Button
                    size="icon"
                    disabled={isSoldOut}
                    aria-label={`Add ${m.name}`}
                    onClick={() => {
                      add({
                        id: m.id,
                        name: m.name,
                        price: Number(m.price),
                        image_url: m.image_url,
                      });
                      toast.success(`${m.name} added to cart`);
                    }}
                  >
                    <Plus />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
