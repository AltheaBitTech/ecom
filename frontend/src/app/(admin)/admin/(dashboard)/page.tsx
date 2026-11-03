import Link from 'next/link';
import type { CSSProperties } from 'react';

import { ecomApi } from '@/lib/api';
import { getStaffSession, hasPermission } from '@/lib/session';
import type { Entitlements } from '@/lib/types';

export default async function AdminOverview() {
  const session = await getStaffSession();
  const tenantId = session!.tenantId;
  const canWriteProducts = hasPermission(session!, 'products:write');

  let entitlements: Entitlements | null = null;
  let productCount = 0;
  try {
    const [access, products] = await Promise.all([
      ecomApi.entitlements(tenantId),
      ecomApi.adminProducts(tenantId, '?limit=50'),
    ]);
    entitlements = access;
    productCount = products.data.length;
  } catch {
    /* Keep the dashboard usable during a fresh local setup. */
  }

  const productLimit = entitlements?.limits?.products ?? 0;
  const usage = productLimit > 0 ? Math.min(100, Math.round((productCount / productLimit) * 100)) : productCount ? 100 : 0;
  const steps = [
    ['01', 'Add products', 'Build the catalog customers will browse.', '/admin/products', productCount > 0],
    ['02', 'Organize categories', 'Make the catalog easy to explore.', '/admin/categories', false],
    ['03', 'Choose store design', 'Apply a complete customer-facing design.', '/admin/design', false],
    ['04', 'Review settings', 'Confirm store details and selling rules.', '/admin/settings', false],
  ] as const;

  return (
    <div className="admin-overview-v2">
      <header className="admin-page-title">
        <div><p>Dashboard</p><h1>A clear view of your store</h1><span>Monitor setup, catalog health, plan usage, and what needs attention next.</span></div>
        <div><Link href={canWriteProducts ? '/admin/products/new' : '/admin/products'} className="admin-button admin-button-coral">{canWriteProducts ? '+ Add product' : 'View products'}</Link><Link href="/admin/design" className="admin-button">Customize store</Link></div>
      </header>

      <section className="admin-v2-metrics">
        <article><span>Store health</span><strong>{productCount > 0 ? '72' : '35'}<small>/100</small></strong><i className="admin-health-ring" style={{ '--health' : `${productCount > 0 ? 72 : 35}%` } as CSSProperties} /><p>{productCount > 0 ? 'Catalog started' : 'Add your first product'}</p></article>
        <article><span>Products</span><strong>{productCount}</strong><i className="admin-mini-bars"><b /><b /><b /></i><p>{productLimit === -1 ? 'Unlimited plan' : `${productCount} of ${productLimit || '—'} used`}</p></article>
        <article><span>Plan</span><strong className="is-word">{entitlements?.planName ?? '—'}</strong><i className="admin-mini-funnel" /><p>{entitlements?.features?.analytics ? 'Analytics included' : 'Core tools included'}</p></article>
        <article><span>Catalog usage</span><strong>{usage}<small>%</small></strong><i className="admin-mini-lines" /><p>{usage < 80 ? 'Capacity available' : 'Approaching limit'}</p></article>
      </section>

      <section className="admin-v2-grid">
        <article className="admin-v2-card admin-usage-chart">
          <div className="admin-v2-card-head"><div><span>Catalog growth</span><strong>{productCount} products</strong></div><Link href="/admin/products">View catalog ↗</Link></div>
          <div className="admin-chart-legend"><span><i /> Current usage</span><span><i /> Available capacity</span></div>
          <svg viewBox="0 0 720 220" role="img" aria-label="Catalog usage chart"><defs><linearGradient id="adminArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff4b2b" stopOpacity=".2"/><stop offset="1" stopColor="#ff4b2b" stopOpacity="0"/></linearGradient></defs><path d="M0 190 C90 170 130 175 205 140 S320 158 395 105 S505 126 565 76 S650 66 720 28 L720 220 L0 220Z" fill="url(#adminArea)"/><path d="M0 190 C90 170 130 175 205 140 S320 158 395 105 S505 126 565 76 S650 66 720 28" fill="none" stroke="#ff4b2b" strokeWidth="4" strokeLinecap="round"/><path d="M0 205H720M0 150H720M0 95H720M0 40H720" stroke="#e5e7eb" strokeWidth="1"/></svg>
        </article>

        <article className="admin-v2-card admin-readiness">
          <div className="admin-v2-card-head"><div><span>Launch readiness</span><strong>{productCount > 0 ? 'In progress' : 'Getting started'}</strong></div><b>•••</b></div>
          <div className="admin-readiness-ring" style={{ '--progress': `${productCount > 0 ? 72 : 35}%` } as CSSProperties}><span><strong>{productCount > 0 ? 72 : 35}%</strong>complete</span></div>
          <p>Complete the essentials below to prepare the store for customers.</p>
        </article>

        <article className="admin-v2-card admin-checklist">
          <div className="admin-v2-card-head"><div><span>Setup checklist</span><strong>Your next actions</strong></div><b>{steps.filter(step => step[4]).length}/{steps.length}</b></div>
          <div>{steps.map(([number, title, detail, href, done]) => <Link key={number} href={href}><span className={done ? 'is-done' : ''}>{done ? '✓' : number}</span><div><strong>{title}</strong><p>{detail}</p></div><b>↗</b></Link>)}</div>
        </article>

        <article className="admin-v2-card admin-quick-actions">
          <div className="admin-v2-card-head"><div><span>Quick actions</span><strong>Keep moving</strong></div></div>
          <div><Link href="/admin/products/new"><i>＋</i><span>Add product<small>Create a new catalog item</small></span></Link><Link href="/admin/design"><i>✦</i><span>Store design<small>Choose and customize a template</small></span></Link><Link href="/admin/staff"><i>◎</i><span>Invite staff<small>Share the workload safely</small></span></Link></div>
        </article>
      </section>
    </div>
  );
}
