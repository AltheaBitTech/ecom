import Link from 'next/link';
import {
  ArrowRight,
  ShieldCheck,
  Building2,
  KeyRound,
  ScrollText,
  Boxes,
  Truck,
  Store,
  Users,
  Warehouse,
  Check,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Reveal } from '@/components/marketing/reveal';
import { CardScroller } from '@/components/marketing/card-scroller';
import { HeroScene } from '@/components/marketing/hero-scene';

const liveFeatures = [
  {
    icon: Building2,
    title: 'Instant store setup',
    description: 'Register your business and get a fully working storefront in seconds, no setup required.',
  },
  {
    icon: KeyRound,
    title: 'Team roles & access',
    description: 'Owner, admin, and analyst roles out of the box, or build your own from the permissions you hold.',
  },
  {
    icon: ShieldCheck,
    title: 'Live permission enforcement',
    description: 'Access is checked on every request — remove someone and it applies instantly.',
  },
  {
    icon: ScrollText,
    title: 'Immutable audit log',
    description: 'Every login, role change, and access update is recorded and cannot be edited or deleted.',
  },
];

const platformFeatures = [
  {
    icon: Boxes,
    title: 'Catalog & inventory',
    description: 'List products, publish or archive them, and adjust stock with a full audit trail per change.',
  },
  {
    icon: Truck,
    title: 'Orders & fulfillment',
    description: 'Confirm, fulfill, or cancel orders from one queue — every transition tracked end to end.',
  },
  {
    icon: Search,
    title: 'Storefront & checkout',
    description: 'A public storefront listing your live catalog, with checkout that creates the order for you.',
  },
  {
    icon: ShieldCheck,
    title: 'Payments',
    description: 'Razorpay checkout and webhook-verified payment status, tied to the order that triggered it.',
  },
];

const audiences = [
  {
    icon: Warehouse,
    tag: 'Solo sellers',
    title: 'Independent shops',
    description: 'Launch a storefront and start selling without touching infrastructure.',
    gradient: 'linear-gradient(160deg,#1e6b77 0%,#0e3a41 100%)',
  },
  {
    icon: Store,
    tag: 'Multi-store',
    title: 'Multi-brand sellers',
    description: 'Run several stores side by side, each with its own catalog, team, and permissions.',
    gradient: 'linear-gradient(160deg,#e2643c 0%,#a94f2e 100%)',
  },
  {
    icon: Users,
    tag: 'Teams',
    title: 'Growing teams',
    description: 'Add people as you grow. Roles mean finance, support, and warehouse only see what they need.',
    gradient: 'linear-gradient(160deg,#e8a34c 0%,#c9633a 100%)',
  },
];

/* Floating capability badges over the 3D stack — what the platform actually does for a seller,
   rather than invented store names. Positions are hand-placed to sit in the scene's empty corners. */
const heroBadges = [
  { icon: Store, label: 'Storefront live', tint: '#7ee0b8', top: '3%', right: '3%' },
  { icon: Boxes, label: 'Catalog synced', tint: '#ffd9a8', top: '44%', right: '-10%' },
  { icon: ShieldCheck, label: 'Payment verified', tint: '#9fd8e0', top: '80%', right: '7%' },
];

const heroStats = [
  { value: '3', label: 'roles included per store' },
  { value: '100%', label: 'tenant data isolation' },
  { value: '<60s', label: 'from signup to live store' },
];

const plans = [
  {
    name: 'Starter',
    price: 'Free',
    period: 'during early access',
    description: 'Everything you need to set up and run your store today.',
    features: ['Unlimited team members', 'Roles & custom permissions', 'Immutable audit log', 'Community support'],
    cta: 'Start selling',
    highlighted: false,
  },
  {
    name: 'Growth',
    price: 'Free',
    period: 'during early access',
    description: 'For sellers ready to sell — catalog, orders, storefront, and payments included.',
    features: ['Everything in Starter', 'Storefront & checkout', 'Inventory & fulfillment', 'Razorpay payments', 'Priority support'],
    cta: 'Start selling',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Talk to us',
    period: 'custom',
    description: 'Multiple stores, higher volume, and dedicated support.',
    features: ['Everything in Growth', 'Multi-store management', 'SSO & advanced audit', 'Dedicated support'],
    cta: 'Contact sales',
    highlighted: false,
  },
];

const faqs = [
  {
    q: 'What is Stallwart?',
    a: 'A one-stop platform for anyone who wants to sell online: register your business, get a working store, and control exactly who on your team can do what — down to a single permission.',
  },
  {
    q: 'Do I need any technical setup?',
    a: 'No. Registration provisions your store automatically. There’s no infrastructure to configure and nothing to install.',
  },
  {
    q: 'Is my store’s data kept separate from other sellers?',
    a: 'Yes. Every store’s data is fully isolated behind the scenes — verified end to end so no seller can ever see another seller’s users, roles, or data.',
  },
  {
    q: 'How do roles and permissions work?',
    a: 'Every new store gets three roles (Owner, Admin, Analyst). You can also create custom roles — but only from permissions you yourself hold, so no one can grant access they don’t have.',
  },
  {
    q: 'Can I list products and take orders today?',
    a: 'Yes. Catalog, inventory, order fulfillment, a public storefront, and Razorpay checkout are all live — built on the same account, roles, and data isolation foundation.',
  },
  {
    q: 'What does it cost?',
    a: 'Free while in early access, storefront and payments included. Paid tiers arrive for higher-volume and multi-store sellers — register now to lock in your store’s name.',
  },
  {
    q: 'How do I sign up or sign in?',
    a: 'Click "Start selling" to register your business and become its owner, or "Sign in" if your store already exists — you’ll need your store name, email, and password.',
  },
];

/** Section eyebrow for the light sand sections — a short accent rule draws in first, then the label. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-4 flex items-center gap-2.5 text-xs font-bold tracking-[0.18em] text-[#e2643c] uppercase">
      <span className="h-[2px] w-0 shrink-0 bg-current transition-all duration-500 ease-md group-data-[visible=true]/reveal:w-7" />
      {children}
    </span>
  );
}

/** Eyebrow + heading + lede, cascading in off one Reveal — ink text for the light sand sections. */
function SectionHeader({
  eyebrow,
  title,
  lede,
  center = false,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  center?: boolean;
}) {
  return (
    <div className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-xl'}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-3xl font-semibold tracking-tight text-[#1d2b2e] sm:text-4xl lg:text-5xl">{title}</h2>
      <p
        className={`mt-3 text-base text-[#5c7176] opacity-0 transition-opacity duration-700 ease-md delay-200 group-data-[visible=true]/reveal:opacity-100 sm:text-lg ${center ? 'mx-auto' : ''}`}
      >
        {lede}
      </p>
    </div>
  );
}

/** A light sand content section — the airy default between the hero and closing CTA's saturated gradients. */
function Section({
  id,
  tone = 'sand-50',
  children,
  className = '',
}: {
  id?: string;
  tone?: 'sand-50' | 'sand-100';
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-20 ${tone === 'sand-50' ? 'bg-[#faf7f2]' : 'bg-[#f4eee3]'} py-24 ${className}`}
    >
      <div className="mx-auto max-w-6xl px-6">{children}</div>
    </section>
  );
}

/** A saturated full-bleed gradient scene — reserved for the hero and closing CTA, same grammar as both. */
function Scene({
  gradient,
  glow,
  children,
  className = '',
}: {
  gradient: string;
  glow?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`grain relative overflow-hidden py-24 ${className}`}>
      <div aria-hidden className="absolute inset-0" style={{ background: gradient }} />
      {glow && <div aria-hidden className="absolute inset-0 animate-scene-drift" style={{ background: glow }} />}
      <div className="relative z-10">{children}</div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <>
      {/* ============ Hero — the one saturated gradient scene at the top ============ */}
      <section className="grain relative -mt-[76px] flex min-h-[92svh] items-center overflow-hidden pt-[76px]">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg,#0c2f38 0%,#14505c 34%,#2b7a80 55%,#c9633a 80%,#e8a34c 100%)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 70% at 50% 108%, rgba(255,196,120,.55) 0%, rgba(226,100,60,.25) 35%, transparent 65%)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(12,47,56,.55) 0%, rgba(12,47,56,.15) 34%, transparent 60%)',
          }}
        />

        <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-16 px-6 py-24 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-xs font-semibold tracking-[0.12em] text-white uppercase backdrop-blur-md">
              Now onboarding early sellers
            </span>
            <h1 className="max-w-xl font-display text-5xl leading-[1.1] font-semibold text-balance text-white drop-shadow-sm sm:text-6xl lg:text-7xl">
              Everything you need to sell online, <em className="font-display text-[#ffd9a8] italic">in one place</em>.
            </h1>
            <p className="mt-6 max-w-md text-lg text-balance text-white/85 sm:text-xl">
              Register your business, invite your team, and control exactly who can do what — down to a
              single permission. Your store is isolated and ready in seconds, whatever you’re selling.
            </p>

            <div className="mt-8 grid max-w-xl grid-cols-[1fr_auto] overflow-hidden rounded-2xl bg-white shadow-2xl sm:grid-cols-[1fr_auto_auto]">
              <div className="flex flex-col justify-center gap-0.5 border-r border-[#e9dfcd] px-5 py-3.5">
                <span className="text-[0.65rem] font-bold tracking-[0.14em] text-[#5c7176] uppercase">
                  Your store name
                </span>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-[#1d2b2e]">
                  <span className="text-[#5c7176]">stallwart.app/</span>
                  your-store
                </div>
              </div>
              <div className="hidden items-center border-r border-[#e9dfcd] px-5 text-sm font-medium text-[#5c7176] sm:flex">
                Check availability
              </div>
              <Button
                className="h-auto rounded-none bg-[#e2643c] px-6 text-white hover:bg-[#c94f2a]"
                nativeButton={false}
                render={<Link href="/register" />}
              >
                <Search className="size-4" />
                Claim it
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="h-12 rounded-full bg-[#e2643c] px-8 text-white shadow-md transition-all duration-300 ease-md hover:-translate-y-0.5 hover:bg-[#c94f2a] hover:shadow-lg active:scale-95"
                nativeButton={false}
                render={<Link href="/register" />}
              >
                Start selling
                <ArrowRight className="size-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-white/50 bg-transparent px-8 text-white transition-all duration-300 ease-md hover:-translate-y-0.5 hover:bg-white/10 active:scale-95"
                nativeButton={false}
                render={<Link href="/login" />}
              >
                Sign in
              </Button>
            </div>

            <div className="mt-12 flex flex-wrap gap-x-10 gap-y-4">
              {heroStats.map((s) => (
                <div key={s.label}>
                  <strong className="block font-display text-3xl font-semibold text-white sm:text-4xl">{s.value}</strong>
                  <span className="text-sm text-white/75">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative hidden min-h-[520px] lg:block">
            <HeroScene className="absolute -inset-x-12 -inset-y-8" />
            {/* Glass badges floating over the 3D stack, each with a slow halo pulse behind its icon. */}
            {heroBadges.map((badge, i) => (
              <div
                key={badge.label}
                className="absolute flex animate-hero-float items-center gap-3 rounded-2xl border border-white/25 bg-white/12 px-4 py-3 text-white shadow-xl backdrop-blur-md"
                style={{ top: badge.top, right: badge.right, animationDelay: `${i * 1.3}s` }}
              >
                <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-white/15">
                  <span
                    aria-hidden
                    className="absolute inset-0 animate-hero-pulse rounded-xl"
                    style={{ background: badge.tint, animationDelay: `${i * 0.9}s` }}
                  />
                  <badge.icon className="relative size-4.5" strokeWidth={1.75} style={{ color: badge.tint }} />
                </span>
                <span className="text-[0.95rem] font-medium tracking-tight whitespace-nowrap">{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Who it's for — light sand, glass gives way to plain cards ============ */}
      <Section id="about" tone="sand-50">
        <Reveal className="mb-12">
          <SectionHeader
            eyebrow="Built for every seller"
            title="A store for whatever you sell"
            lede="Boutique or multi-brand, solo founder or growing team — one platform, a store for every business on it."
          />
        </Reveal>
        <Reveal delay={1}>
          <CardScroller>
            {audiences.map((a) => (
              <div
                key={a.title}
                className="w-[min(320px,82vw)] shrink-0 overflow-hidden rounded-[22px] bg-white shadow-lg transition-all duration-300 ease-md hover:-translate-y-1.5 hover:shadow-2xl"
                style={{ scrollSnapAlign: 'start' }}
              >
                <div className="relative flex h-40 items-center justify-center" style={{ background: a.gradient }}>
                  <span className="absolute top-3.5 left-3.5 rounded-full bg-white/90 px-3 py-1 text-[0.68rem] font-bold tracking-[0.1em] text-[#1d2b2e] uppercase">
                    {a.tag}
                  </span>
                  <a.icon className="size-12 text-white/90" strokeWidth={1.5} />
                </div>
                <div className="p-6">
                  <h3 className="font-display text-lg font-semibold text-[#1d2b2e]">{a.title}</h3>
                  <p className="mt-2 text-sm text-[#5c7176]">{a.description}</p>
                </div>
              </div>
            ))}
          </CardScroller>
        </Reveal>
      </Section>

      {/* ============ Platform — light sand, solid cards with coral/teal icon chips ============ */}
      <Section id="platform" tone="sand-100">
        <Reveal className="mb-12">
          <SectionHeader
            eyebrow="The foundation"
            title="Built on a secure foundation"
            lede="No shortcuts on the parts that matter — accounts, access, and an audit trail every store depends on from day one."
          />
        </Reveal>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {liveFeatures.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) as 0 | 1 | 2}>
              <div className="h-full rounded-[22px] border border-[#e9dfcd] bg-white p-6 shadow-sm transition-all duration-300 ease-md hover:-translate-y-1 hover:shadow-lg">
                <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-[#e2643c]/10 text-[#e2643c]">
                  <f.icon className="size-5" />
                </div>
                <h3 className="font-display text-base font-semibold text-[#1d2b2e]">{f.title}</h3>
                <p className="mt-2 text-sm text-[#5c7176]">{f.description}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-16">
          <span className="text-xs font-bold tracking-[0.18em] text-[#5c7176] uppercase">Also live</span>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {platformFeatures.map((f) => (
              <div
                key={f.title}
                className="rounded-[18px] border border-[#e9dfcd] bg-white p-5 transition-colors duration-300 ease-md hover:border-[#d9c9ac]"
              >
                <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-[#14505c]/10 text-[#14505c]">
                  <f.icon className="size-4.5" />
                </div>
                <h4 className="font-display text-sm font-semibold text-[#1d2b2e]">{f.title}</h4>
                <p className="mt-1.5 text-xs text-[#5c7176]">{f.description}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </Section>

      {/* ============ Pricing — light sand, spotlit featured tier ============ */}
      <Section id="pricing" tone="sand-50">
        <Reveal className="mb-12">
          <SectionHeader
            eyebrow="Pricing"
            title="Simple, honest pricing"
            lede="No hidden tiers, no surprise limits. Free while in early access — paid plans arrive alongside the storefront."
            center
          />
        </Reveal>
        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <Reveal key={plan.name} delay={i as 0 | 1 | 2}>
              <div
                className={
                  plan.highlighted
                    ? 'flex h-full flex-col gap-6 rounded-[22px] bg-white p-7 shadow-2xl ring-2 ring-[#e2643c] transition-transform duration-300 ease-md md:-translate-y-4'
                    : 'flex h-full flex-col gap-6 rounded-[22px] border border-[#e9dfcd] bg-white p-7 shadow-sm transition-all duration-300 ease-md hover:shadow-lg'
                }
              >
                <div>
                  {plan.highlighted && (
                    <Badge className="mb-3 w-fit rounded-full bg-[#e2643c] text-white">Most popular</Badge>
                  )}
                  <h3 className="font-display text-xl font-semibold text-[#1d2b2e]">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="font-display text-3xl font-semibold tracking-tight text-[#1d2b2e]">
                      {plan.price}
                    </span>
                    <span className="text-sm text-[#5c7176]">{plan.period}</span>
                  </div>
                  <p className="mt-2 text-sm text-[#5c7176]">{plan.description}</p>
                </div>
                <ul className="grid flex-1 gap-2.5 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-[#35494e]">
                      <Check className="size-4 shrink-0 text-[#e2643c]" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className={
                    plan.highlighted
                      ? 'w-full rounded-full bg-[#0e3a41] text-white transition-all duration-300 ease-md hover:bg-[#16545e] active:scale-95'
                      : 'w-full rounded-full border-[#d9c9ac] bg-transparent text-[#1d2b2e] transition-all duration-300 ease-md hover:bg-[#f1ede1] active:scale-95'
                  }
                  variant={plan.highlighted ? undefined : 'outline'}
                  nativeButton={false}
                  render={<Link href="/register" />}
                >
                  {plan.cta}
                </Button>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ============ FAQ — light sand, plain bordered accordion ============ */}
      <Section id="faq" tone="sand-100">
        <div className="mx-auto max-w-3xl">
          <Reveal className="mb-10">
            <SectionHeader
              eyebrow="Good to know"
              title="Frequently asked questions"
              lede="Still deciding? Here's what sellers ask us before they register."
              center
            />
          </Reveal>
          <Reveal delay={1}>
            <Accordion className="w-full">
              {faqs.map((item, i) => (
                <AccordionItem
                  key={item.q}
                  value={i}
                  className="rounded-2xl border border-[#e9dfcd] bg-white px-6 [&+&]:mt-3"
                >
                  <AccordionTrigger className="text-left font-medium text-[#1d2b2e] transition-colors duration-200 hover:text-[#e2643c]">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-[#5c7176]">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </Section>

      {/* ============ Final CTA — the closing saturated gradient scene ============ */}
      <Scene gradient="linear-gradient(135deg,#0e3a41 0%,#16545e 55%,#c9633a 120%)" className="text-center">
        <div className="mx-auto flex max-w-2xl flex-col items-center px-6">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Ready to get started?
            </h2>
            <p className="mt-3 text-base text-white/80 sm:text-lg">
              Register now to lock in your store’s name before early access ends.
            </p>
            <Button
              size="lg"
              className="mt-8 h-12 rounded-full bg-white px-8 text-[#1d2b2e] shadow-lg transition-all duration-300 ease-md hover:-translate-y-0.5 hover:bg-white/90 active:scale-95"
              nativeButton={false}
              render={<Link href="/register" />}
            >
              Start selling
              <ArrowRight className="size-4" />
            </Button>
          </Reveal>
        </div>
      </Scene>
    </>
  );
}
