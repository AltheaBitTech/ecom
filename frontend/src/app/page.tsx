import type { Metadata } from 'next';
import Link from 'next/link';

import { CommerceWorkspace } from '@/components/marketing/commerce-workspace';
import { Reveal } from '@/components/marketing/reveal';
import { StorePlayground } from '@/components/marketing/store-playground';

const SITE = 'StoreLab';
const PLANS = [
  { key: 'starter', name: 'Starter', price: 'Free', cadence: '', description: 'For testing an idea and making your first sale.', features: ['50 products', '2 staff accounts', 'Storefront templates', 'Payments and shipping'], cta: 'Start free', popular: false },
  { key: 'pro', name: 'Pro', price: '₹3,999', cadence: '/month', description: 'For growing brands that need insight and control.', features: ['1,000 products', '10 staff accounts', 'Analytics dashboard', 'Custom domain'], cta: 'Start Pro', popular: true },
  { key: 'enterprise', name: 'Enterprise', price: '₹24,999', cadence: '/month', description: 'For high-volume teams and complex operations.', features: ['Unlimited catalog', 'Unlimited staff', 'Dedicated infrastructure', 'Priority support'], cta: 'Contact sales', popular: false },
] as const;

const FEATURES = [
  ['Catalog', 'Flexible products', 'Model apparel, food, electronics, services, or anything else with custom product fields.'],
  ['Design', 'Brand-led storefronts', 'Choose a complete storefront direction, then apply your logo, palette, products, and copy.'],
  ['Checkout', 'Payments built in', 'Accept cards, UPI, and cash on delivery through a secure, consistent checkout.'],
  ['Shipping', 'Delivery without plugins', 'Calculate shipping, select carriers, and keep fulfillment connected to each order.'],
  ['People', 'Customers and staff', 'Keep customer accounts organized while giving each teammate only the access they need.'],
  ['Insights', 'Decisions in one view', 'See catalog health, performance, limits, and the next action from one dashboard.'],
] as const;

const WORKFLOW = [
  ['01', 'Create your workspace', 'Name your store, choose your address, and invite the people who will help run it.', 'Workspace, roles, and permissions are prepared immediately.'],
  ['02', 'Build your catalog', 'Add products and categories using fields that match what your business actually sells.', 'Images, prices, inventory, variants, and custom attributes stay together.'],
  ['03', 'Choose the experience', 'Select a complete storefront design and customize its brand colors, campaign copy, and logo.', 'The design continues through product, cart, checkout, account, and order pages.'],
  ['04', 'Sell and improve', 'Connect payments and shipping, launch, then use the dashboard to decide what happens next.', 'Orders, customers, catalog health, and plan usage remain visible in one workspace.'],
] as const;

const FAQS = [
  ['Can I sell any kind of product?', 'Yes. Custom attributes let the same catalog support sizes, expiry dates, specifications, preparation time, and other business-specific details.'],
  ['Does a selected design cover the full store?', 'Yes. The active design controls the customer home, product pages, cart, checkout, account, and order experience.'],
  ['Can I change plans later?', 'Yes. Upgrade or change plans without rebuilding your catalog, storefront, customers, or orders.'],
  ['Do I need extra checkout or shipping plugins?', 'No. Payments and shipping are part of the platform and share the same order flow.'],
  ['Can staff have different access?', 'Yes. Permissions control which dashboard sections and actions each staff member can use.'],
] as const;

export const metadata: Metadata = {
  title: 'StoreLab — Understand and grow your online store',
  description: 'Products, storefront design, payments, shipping, customers, and insights in one clear commerce workspace.',
  alternates: { canonical: '/' },
};

function DashboardPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`saas-dashboard-preview ${compact ? 'is-compact' : ''}`} aria-label="StoreLab dashboard preview">
      <div className="saas-preview-nav"><b><i>✦</i> StoreLab</b><span>Dashboard</span><span>Orders</span><span>Products</span><span>Customers</span><span>Analytics</span><em>●</em></div>
      <div className="saas-preview-metrics">
        <div><small>Store health</small><strong>92/100</strong><i className="saas-ring" /></div>
        <div><small>Revenue</small><strong>₹24,820</strong><i className="saas-bars"><b /><b /><b /></i></div>
        <div><small>Conversion</small><strong>2.9%</strong><i className="saas-funnel" /></div>
        <div><small>Orders</small><strong>1,284</strong><i className="saas-lines" /></div>
      </div>
      <div className="saas-preview-charts">
        <div className="saas-chart saas-sales"><span><small>Sales trend</small><strong>₹18,695</strong></span><svg viewBox="0 0 420 150" role="img" aria-label="Sales increasing over time"><path d="M4 122 C45 20 67 118 105 72 S168 98 205 44 S265 109 310 55 S366 52 416 15" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M4 138 C54 102 83 132 125 94 S187 120 237 86 S325 100 416 55" fill="none" stroke="currentColor" strokeWidth="2" opacity=".25" /></svg></div>
        <div className="saas-chart saas-conversion"><span><small>Conversion funnel</small><strong>2.9%</strong></span><div><i /><i /><i /><i /></div></div>
        <div className="saas-chart saas-growth"><span><small>Customer growth</small><strong>+72.9%</strong></span><div className="saas-growth-ring"><b>New<br />62%</b></div></div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="saas-site">
      <header className="saas-header">
        <Link href="/" className="saas-logo"><span>✦</span>{SITE}</Link>
        <nav aria-label="Main navigation"><Link href="#product">Product</Link><Link href="#features">Features</Link><Link href="#how">How it works</Link><Link href="#pricing">Pricing</Link></nav>
        <div><Link href="/admin" className="saas-login">Login</Link><Link href="/start" className="saas-button saas-button-dark">Get started</Link></div>
        <details className="saas-mobile-nav"><summary aria-label="Open navigation">☰</summary><nav><Link href="#product">Product</Link><Link href="#features">Features</Link><Link href="#how">How it works</Link><Link href="#pricing">Pricing</Link><Link href="/admin">Login</Link><Link href="/start">Get started</Link></nav></details>
      </header>

      <main>
        <section className="saas-hero">
          <div className="saas-hero-glow" aria-hidden />
          <Reveal className="saas-hero-copy">
            <span className="saas-proof"><b>✦</b> Commerce, made calm</span>
            <h1>Build a store<br />people <em>remember.</em></h1>
            <p>Products, design, payments, orders, and growth—one friendly workspace for launching and running your brand.</p>
            <div><Link href="/start" className="saas-button saas-button-dark">Start for free <span>↗</span></Link><Link href="/demo" className="saas-button saas-button-light">Explore a live store</Link></div>
            <ul className="saas-hero-notes" aria-label="Platform highlights"><li>No credit card</li><li>Launch in minutes</li><li>Change design anytime</li></ul>
          </Reveal>
          <Reveal className="saas-hero-scene" delay={120}><StorePlayground /></Reveal>
          <div className="saas-hero-foot" aria-hidden><span>01 — Design</span><span>02 — Sell</span><span>03 — Grow</span></div>
        </section>

        <section id="product" className="saas-section saas-product-section">
          <Reveal className="saas-section-heading"><span>One operating system</span><h2>Everything that runs your store,<br />finally in one place.</h2><p>Switch between overview, orders, products, and customers. StoreLab keeps every decision in one clear workspace.</p></Reveal>
          <Reveal className="saas-workspace-wrap" delay={100}><CommerceWorkspace /></Reveal>
        </section>

        <section id="features" className="saas-section saas-tint-section">
          <Reveal className="saas-section-heading"><span>Complete commerce toolkit</span><h2>Fewer moving parts.<br />More useful work.</h2><p>Every module shares the same store, permissions, and customer context.</p></Reveal>
          <div className="saas-feature-grid">
            {FEATURES.map(([label, title, body], index) => <Reveal key={title} className="saas-feature-card" delay={(index % 3) * 60}><i>{String(index + 1).padStart(2, '0')}</i><span>{label}</span><h3>{title}</h3><p>{body}</p><b>↗</b></Reveal>)}
          </div>
        </section>

        <section id="how" className="saas-section">
          <Reveal className="saas-section-heading"><span>How it works</span><h2>From blank workspace<br />to daily operations.</h2><p>Open any step to see what the platform prepares for you.</p></Reveal>
          <div className="saas-workflow">
            {WORKFLOW.map(([number, title, summary, detail], index) => (
              <Reveal key={number} delay={index * 50}>
                <details open={index === 0}><summary><span>{number}</span><h3>{title}</h3><p>{summary}</p><b>+</b></summary><div>{detail}</div></details>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="pricing" className="saas-section saas-tint-section">
          <Reveal className="saas-section-heading"><span>Simple pricing</span><h2>Start small.<br />Keep every path open.</h2><p>No setup fee. Change plans as your catalog, team, and traffic grow.</p></Reveal>
          <div className="saas-plan-grid">
            {PLANS.map((plan, index) => <Reveal key={plan.key} className={`saas-plan ${plan.popular ? 'is-popular' : ''}`} delay={index * 70}>{plan.popular && <em>Most popular</em>}<span>{plan.name}</span><p>{plan.description}</p><h3>{plan.price}<small>{plan.cadence}</small></h3><ul>{plan.features.map(feature => <li key={feature}>✓ {feature}</li>)}</ul><Link href={`/start?plan=${plan.key}`} className={`saas-button ${plan.popular ? 'saas-button-coral' : 'saas-button-dark'}`}>{plan.cta}</Link></Reveal>)}
          </div>
          <Reveal className="saas-comparison">
            <table><thead><tr><th>Compare plans</th><th>Starter</th><th>Pro</th><th>Enterprise</th></tr></thead><tbody>
              {[['Products', '50', '1,000', 'Unlimited'], ['Staff accounts', '2', '10', 'Unlimited'], ['Storefront designs', '✓', '✓', '✓'], ['Payments & shipping', '✓', '✓', '✓'], ['Analytics', '—', '✓', '✓'], ['Custom domain', '—', '✓', '✓'], ['Dedicated infrastructure', '—', '—', '✓'], ['Priority support', '—', '—', '✓']].map(row => <tr key={row[0]}>{row.map((cell, index) => index === 0 ? <th key={cell}>{cell}</th> : <td key={`${row[0]}-${cell}-${index}`}>{cell}</td>)}</tr>)}
            </tbody></table>
          </Reveal>
        </section>

        <section id="faq" className="saas-section saas-faq-section">
          <Reveal className="saas-section-heading"><span>Questions, answered</span><h2>Know what expands<br />with your business.</h2></Reveal>
          <div className="saas-faqs">{FAQS.map(([question, answer]) => <details key={question}><summary>{question}<b>+</b></summary><p>{answer}</p></details>)}</div>
        </section>

        <section className="saas-cta"><Reveal><span>Ready to see clearly?</span><h2>Run your whole store<br />from one calm workspace.</h2><p>Start free, build at your pace, and upgrade only when the business needs it.</p><Link href="/start" className="saas-button saas-button-dark">Build your store</Link></Reveal></section>
      </main>

      <footer className="saas-footer"><Link href="/" className="saas-logo"><span>✦</span>{SITE}</Link><p>Products, people, payments, and progress—together.</p><nav><Link href="#product">Product</Link><Link href="#pricing">Pricing</Link><Link href="/admin">Login</Link></nav></footer>
    </div>
  );
}
