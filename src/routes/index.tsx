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
      { title: "Roadside Cafe — Filipino food delivered hot" },
      { name: "description", content: "Order adobo, sisig, pancit and more. Cash on delivery, fast riders." },
      { property: "og:title", content: "Roadside Cafe — Filipino food delivered hot" },
      { property: "og:description", content: "Order adobo, sisig, pancit and more. Cash on delivery, fast riders." },
    ],
  }),
  component: Index,
});

function Index() {
  const { add } = useCart();
  const [cat, setCat] = useState("All");
  const { data: menu = [], isLoading } = useQuery({
    queryKey: ["menu"],
    queryFn: async () => {
      const { data, error } = await supabase.from("menu_items").select("*").eq("available", true).order("category");
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
          <span className="inline-block rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">Delivered in ~30 mins</span>
          <h1 className="mt-4 text-5xl font-extrabold leading-[0.95] md:text-7xl">
            Food & Coffee,<br /><span className="text-primary">hatid sa'yo!</span>
          </h1>
          <p className="mt-4 max-w-md text-lg text-muted-foreground">Experience rich, home-style Filipino comfort food paired with specialty brews, freshly prepared and delivered hot right to your doorstep.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" asChild><a href="#menu">Order now</a></Button>
            <Button size="lg" variant="outline" asChild><Link to="/apply-rider"><Bike /> Become a rider</Link></Button>
          </div>
        </div>
        <div className="relative">
          <img src="/images/sisig.jpg" alt="Sizzling sisig" width={816} height={816} className="aspect-square w-full rounded-[2rem] object-cover shadow-warm" />
        </div>
      </section>

      <section id="menu" className="scroll-mt-20">
        <h2 className="text-3xl font-bold">Menu</h2>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {cats.map((c) => (
            <Button key={c} size="sm" variant={cat === c ? "default" : "secondary"} className="rounded-full" onClick={() => setCat(c)}>{c}</Button>
          ))}
        </div>
        {isLoading && <p className="mt-6 text-muted-foreground">Loading menu…</p>}
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((m) => (
            <article key={m.id} className="overflow-hidden rounded-2xl border bg-card">
              {m.image_url ? (
                <img src={m.image_url} alt={m.name} loading="lazy" width={816} height={816} className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="grid aspect-[4/3] place-items-center bg-secondary font-display text-2xl text-muted-foreground">{m.name}</div>
              )}
              <div className="flex items-start gap-3 p-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold">{m.name}</h3>
                  <p className="text-sm text-muted-foreground">{m.description}</p>
                  <p className="mt-2 font-bold text-primary">{peso(m.price)}</p>
                </div>
                <Button size="icon" aria-label={`Add ${m.name}`} onClick={() => { add({ id: m.id, name: m.name, price: Number(m.price), image_url: m.image_url }); toast.success(`${m.name} added`); }}>
                  <Plus />
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
