import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Bike } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/lib/cart';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Roadside Paddles | Filipino food delivered" },
      { name: "description", content: "Order adobo, sisig..." },
      { property: "og:title", content: "Roadside Cafe Filipino food" },
      { property: "og:description", content: "Order adobo, sisig..." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
      const { data, error } = await supabase.from("menu_items").select("*");
      if (error) throw error;
      return data;
    },
  });

  const cats = ["All", ...Array.from(new Set(menu.map(m => m.category)))];
  const shown = cat === "All" ? menu : menu.filter(m => m.category === cat);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20">
      {/* Hides the Lovable badge watermark */}
      <style>{`#lovable-badge { display: none !important; }`}</style>

      <section className="grid items-center gap-8 py-10 md:grid-cols-2">
        <div>
          <span className="inline-block rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent mb-4">
            Food & Coffee, delivered fresh
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            Food & Coffee,<br /><span className="text-primary">hatid sa'yo!</span>
          </h1>
          <p className="mt-4 max-w-md text-lg text-muted-foreground">
            Your daily neighborhood pause. Savor rich espressos, comforting eats, and warm conversations in a place that feels like home.""
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <a href="#menu">Order Now</a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="/apply-rider">
                <Bike className="mr-2 h-5 w-5" /> Apply as Rider
              </a>
            </Button>
          </div>
        </div>
        <div className="relative">
          {/* Restored original widescreen aspect-video and object-cover sizing */}
          <img 
            src="/images/sisig.jpg" 
            alt="Sizzling sisig" 
            className="rounded-2xl object-cover shadow-2xl w-full aspect-video" 
          />
        </div>
      </section>

      <section id="menu" className="scroll-mt-20">
        <h2 className="text-3xl font-bold mb-6">Menu</h2>
        <div className="flex gap-2 overflow-x-auto pb-4 mb-8">
          {cats.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={cat === c ? "default" : "outline"}
              onClick={() => setCat(c)}
            >
              {c}
            </Button>
          ))}
        </div>

        {isLoading && <p className="text-muted-foreground">Loading menu...</p>}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((m) => (
            <article key={m.id} className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow">
              {m.image_url ? (
                <img src={m.image_url} alt={m.name} loading="lazy" className="h-48 w-full object-cover" />
              ) : (
                <div className="grid aspect-[4/3] place-items-center bg-muted">No Image</div>
              )}
              <div className="flex items-start p-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold">{m.name}</h3>
                  <p className="text-sm text-muted-foreground">{m.description}</p>
                  <p className="mt-2 font-bold text-primary">₱{m.peso || m.price}</p>
                </div>
                <Button size="icon" aria-label={`Add ${m.name}`} onClick={() => add(m)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
