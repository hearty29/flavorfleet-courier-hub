import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bike,
  Briefcase,
  Code2,
  Database,
  Gamepad2,
  Globe2,
  LayoutGrid,
  MapPinned,
  Smartphone,
  Sparkles,
  Trophy,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — Roadside Paddles" },
      {
        name: "description",
        content:
          "Roadside Paddles is built and maintained by Jessie Cabrera, a software developer crafting fast, homegrown Filipino food and court-booking experiences.",
      },
      { property: "og:title", content: "About Us — Roadside Paddles" },
      {
        property: "og:description",
        content:
          "Meet Jessie Cabrera, the software developer behind Roadside Paddles — food delivery, rider dispatch, and pickleball court booking in one place.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutPage,
});

const PILLARS = [
  {
    icon: UtensilsCrossed,
    title: "The Kitchen",
    body: "A storefront that stays honest — real prices in pesos, live sold-out states, and cash on delivery so nobody has to link a card just to eat.",
  },
  {
    icon: Bike,
    title: "The Riders",
    body: "Riders apply, get verified by the store, then pick up orders from a dashboard built for one-handed use on the road. One tap to call, one tap to text.",
  },
  {
    icon: Trophy,
    title: "The Courts",
    body: "Four pickleball courts with live status, bookable hour slots, and paddle rentals — so the queue is settled before you lace up.",
  },
];

const CRAFT = [
  {
    icon: Code2,
    title: "Built end to end",
    body: "Frontend, database rules, and the delivery logic all live in one codebase — no spreadsheet babysitting in the background.",
  },
  {
    icon: MapPinned,
    title: "Rules kept in the database",
    body: "Prices, order acceptance, and who is allowed to do what are enforced by the backend, not the browser. Nothing gets quietly edited.",
  },
  {
    icon: LayoutGrid,
    title: "Small screens first",
    body: "Every screen is designed for a phone in one hand and sun on the other — big targets, short taps, no hunting.",
  },
];


const EXPERIENCE = [
  {
    icon: Gamepad2,
    tag: "Games",
    role: "Game Developer",
    body: "Builds playable experiences — game logic, levels, controls, and the feel of the thing once it's in your hands.",
  },
  {
    icon: Globe2,
    tag: "Web",
    role: "Website Developer",
    body: "Builds sites and web apps end to end: the layout that holds up on any screen, plus the forms, dashboards, and pages behind them.",
  },
  {
    icon: Database,
    tag: "Data",
    role: "Backend & Database Developer",
    body: "Designs the data model and the rules on top of it — orders, roles, and payments that can't be quietly edited from the browser.",
  },
  {
    icon: Smartphone,
    tag: "Product",
    role: "App & Interface Developer",
    body: "Turns a feature list into screens a person can actually use — one-handed, in bright sun, with a thumb.",
  },
  {
    icon: Wrench,
    tag: "And more",
    role: "Freelance & Project Work",
    body: "Fixes, integrations, and one-off builds — whatever a small business needs shipped this week, figured out as it goes.",
  },
];

function AboutPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-24">
      {/* Hero */}
      <section className="grid items-center gap-10 py-12 md:grid-cols-[1.25fr_.75fr] md:py-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">
            <Sparkles className="h-4 w-4" />
            About us
          </span>
          <h1 className="mt-5 text-5xl font-extrabold leading-[0.95] md:text-7xl">
            Jessie Cabrera
          </h1>
          <p className="mt-4 text-xl font-medium text-primary md:text-2xl">
            Software Developer
            <span className="text-muted-foreground">
              {" "}
              · Games, Web &amp; Backend
            </span>
          </p>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
            Roadside Paddles is a homegrown project — one developer, one
            codebase, built for a neighborhood kitchen that wanted its own
            delivery and court-booking system instead of renting someone
            else&apos;s. I design it, build it, and keep it running.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link to="/">Order now</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/apply-rider">
                <Bike className="mr-2 h-5 w-5" />
                Be a partner rider
              </Link>
            </Button>
          </div>
        </div>

        {/* Monogram card */}
        <div className="relative">
          <div className="relative overflow-hidden rounded-[2rem] border bg-card p-8 shadow-warm">
            <div className="grid h-40 w-40 place-items-center rounded-[1.5rem] bg-primary text-6xl font-extrabold text-primary-foreground">
              <span className="font-display">JC</span>
            </div>
            <p className="mt-6 font-display text-2xl font-bold text-foreground">
              Jessie Cabrera
            </p>
            <p className="mt-1 text-sm font-medium text-primary">
              Software Developer
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Full-stack developer behind the Roadside Paddles platform —
              storefront, rider dispatch, admin tools, and court reservations.
            </p>
            <ul className="mt-6 space-y-2 border-t pt-5 text-sm">
              <li className="flex items-center gap-2 text-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Game development
              </li>
              <li className="flex items-center gap-2 text-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Website development
              </li>
              <li className="flex items-center gap-2 text-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Backend &amp; databases
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Experience */}
      <section className="mt-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">
          <Briefcase className="h-4 w-4" />
          Experience
        </span>
        <h2 className="mt-4 text-3xl font-bold">What I do</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          A generalist builder — comfortable anywhere from the game loop down to
          the database schema.
        </p>
        <ol className="mt-8">
          {EXPERIENCE.map(({ icon: Icon, tag, role, body }, i) => (
            <li key={role} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                {i < EXPERIENCE.length - 1 && (
                  <span className="mt-1 w-0.5 flex-1 bg-border" aria-hidden />
                )}
              </div>
              <div className="max-w-xl pb-8">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {tag}
                </p>
                <h3 className="mt-1 text-xl font-bold">{role}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Pillars */}
      <section className="scroll-mt-20">
        <h2 className="text-3xl font-bold">What we run</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Three things live under one roof: the kitchen, the riders who bring it
          to you, and the courts out back.
        </p>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="rounded-2xl border bg-card p-6 transition-shadow hover:shadow-warm"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="mt-4 text-xl font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Craft */}
      <section className="mt-16 rounded-[2rem] bg-ink px-6 py-10 md:px-12 md:py-14">
        <div className="grid gap-10 md:grid-cols-[.9fr_1.1fr]">
          <div>
            <h2 className="text-3xl font-bold text-ink-foreground">
              How it&apos;s built
            </h2>
            <p className="mt-3 max-w-sm text-ink-foreground/70">
              The part most customers never see: the decisions that keep the
              app trustworthy and quick.
            </p>
            <p className="mt-6 text-sm font-medium text-ink-foreground/60">
              — Jessie Cabrera, Software Developer
            </p>
          </div>
          <div className="space-y-6">
            {CRAFT.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4">
                <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-ink-foreground">
                    {title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-foreground/70">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="mt-16 grid items-center gap-6 rounded-[2rem] border bg-card px-6 py-10 md:grid-cols-[1fr_auto] md:px-10">
        <div>
          <h2 className="text-2xl font-bold">Hungry yet?</h2>
          <p className="mt-2 max-w-md text-muted-foreground">
            Browse the menu, add what you like, and pay cash at the door. Or
            check the courts and book your hour.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" asChild>
            <Link to="/">
              <UtensilsCrossed className="mr-2 h-5 w-5" />
              See the menu
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/pickleball">
              <Trophy className="mr-2 h-5 w-5" />
              Court status
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
