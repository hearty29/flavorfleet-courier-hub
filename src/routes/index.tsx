import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Coffee, Trophy, UtensilsCrossed, ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

const BANNER_SLIDES = [
  {
    src: "/images/roadside-paddles-banner.png",
    alt: "Roadside Paddles — Play-Eat-Sip-Repeat. Pickleball, delicious food and fresh coffee.",
  },
  {
    src: "/images/roadside-paddles-join-us.png",
    alt: "Roadside Paddles — pickleball courts, delicious rice meals and pasta, and premium coffee. Join us today!",
  },
  {
    src: "/images/roadside-paddles-app-showcase.jpg",
    alt: "Roadside Paddles app preview: live tournament bracket, food and coffee ordering, and pickleball court booking.",
  },
];

const BANNER_INTERVAL_MS = 4500;

function BannerCarousel() {
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSelected(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  useEffect(() => {
    if (!api || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => api.scrollNext(), BANNER_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [api, paused]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Carousel setApi={setApi} opts={{ loop: true }} aria-label="Roadside Paddles highlights">
        <CarouselContent className="ml-0">
          {BANNER_SLIDES.map((slide, index) => (
            <CarouselItem key={slide.src} className="pl-0">
              <img
                src={slide.src}
                alt={slide.alt}
                width={1672}
                height={941}
                fetchPriority={index === 0 ? "high" : "auto"}
                loading={index === 0 ? "eager" : "lazy"}
                className="h-auto w-full rounded-2xl shadow-warm md:rounded-[2rem]"
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2 md:bottom-5">
        {BANNER_SLIDES.map((slide, index) => (
          <button
            key={slide.src}
            type="button"
            aria-label={`Show banner ${index + 1} of ${BANNER_SLIDES.length}`}
            aria-current={index === selected}
            onClick={() => api?.scrollTo(index)}
            className={`h-2 rounded-full transition-all ${
              index === selected ? "w-6 bg-white" : "w-2 bg-white/60 hover:bg-white/80"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Roadside Paddles — Play-Eat-Sip-Repeat" },
      {
        name: "description",
        content:
          "Welcome to Roadside Paddles: your neighborhood hub for comforting food, fresh coffee, pickleball courts and tournaments.",
      },
      { property: "og:title", content: "Roadside Paddles — Play-Eat-Sip-Repeat" },
      {
        property: "og:description",
        content: "Discover food, coffee and pickleball, all in one place.",
      },
      { property: "og:image", content: "/images/roadside-paddles-banner.png" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-20">
      <section aria-label="Welcome to Roadside Paddles" className="pt-6 md:pt-10">
        <BannerCarousel />
        <div className="mx-auto max-w-3xl py-10 text-center md:py-14">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            More than just a game
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-6xl">
            Play-Eat-Sip-Repeat
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            Welcome to Roadside Paddles, your neighborhood spot for good food, fresh coffee, and a
            great game of pickleball. Gather your friends, enjoy a meal, or meet on the court —
            there’s a place for you here.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/menu">
                Explore the menu <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/pickleball">
                Find your court <Trophy />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section aria-labelledby="discover-heading">
        <h2 id="discover-heading" className="text-center text-3xl font-bold">
          Your one-stop sports and food hub
        </h2>
        <div className="mt-7 grid gap-5 md:grid-cols-3">
          <article className="flex flex-col rounded-2xl border bg-card p-6">
            <UtensilsCrossed className="h-8 w-8 text-primary" aria-hidden="true" />
            <h3 className="mt-4 text-2xl font-bold">Comforting eats</h3>
            <p className="mt-3 flex-1 leading-relaxed text-muted-foreground">
              From Filipino favorites to a satisfying meal after a match, find something to enjoy.
              Browse the menu and choose delivery or counter pickup at checkout.
            </p>
            <Link
              to="/menu"
              className="mt-5 inline-flex items-center gap-2 font-semibold text-primary"
            >
              Order food <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
          <article className="flex flex-col rounded-2xl border bg-card p-6">
            <Coffee className="h-8 w-8 text-primary" aria-hidden="true" />
            <h3 className="mt-4 text-2xl font-bold">Coffee & connection</h3>
            <p className="mt-3 flex-1 leading-relaxed text-muted-foreground">
              Take a break with a fresh cup and good company. Whether you’re catching up with
              friends or winding down after a game, make time for your neighborhood pause.
            </p>
            <Link
              to="/menu"
              className="mt-5 inline-flex items-center gap-2 font-semibold text-primary"
            >
              Browse food & drinks <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
          <article className="flex flex-col rounded-2xl border bg-card p-6">
            <Trophy className="h-8 w-8 text-primary" aria-hidden="true" />
            <h3 className="mt-4 text-2xl font-bold">Meet on the court</h3>
            <p className="mt-3 flex-1 leading-relaxed text-muted-foreground">
              Bring your partner and enjoy pickleball at Roadside Paddles. Check court availability,
              book your next session, or follow our tournaments, teams, and live results.
            </p>
            <Link
              to="/tournaments"
              className="mt-5 inline-flex items-center gap-2 font-semibold text-primary"
            >
              Explore tournaments <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        </div>
      </section>

      <section
        aria-labelledby="intro-heading"
        className="mt-12 overflow-hidden rounded-[2rem] bg-foreground text-background md:mt-16"
      >
        <div className="p-6 md:p-10">
          <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest">
            <Play className="h-4 w-4" aria-hidden="true" /> Get to know us
          </p>
          <h2 id="intro-heading" className="mt-3 text-3xl font-bold md:text-4xl">
            A little taste of Roadside Paddles
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed opacity-80">
            Take a look around and discover a place to play, dine, and relax. Watch our
            introduction, then plan your next visit.
          </p>
        </div>
        <video
          controls
          playsInline
          preload="none"
          poster="https://i.imgur.com/e1306d9.jpg"
          aria-label="Introduction to Roadside Paddles"
          className="aspect-video w-full bg-black object-contain"
        >
          <source src="https://i.imgur.com/e1306d9.mp4" type="video/mp4" />
          Your browser does not support this video. Open the introduction on Imgur using the link
          below.
        </video>
        <div className="flex flex-wrap items-center justify-end gap-4 p-6 md:px-10">
          <Button asChild variant="secondary">
            <Link to="/about">
              More about us <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
