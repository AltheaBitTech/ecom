'use client';

import { useState } from 'react';

const VIEWS = {
  Overview: {
    title: 'Good morning, Maya',
    note: 'Here is what changed across your store today.',
    metrics: [['Revenue', '₹2,48,200', '+18.4%'], ['Orders', '1,284', '+9.2%'], ['Customers', '8,492', '+12.1%']],
    rows: [['#1842', 'Lena Ortiz', 'Paid', '₹1,840'], ['#1841', 'Noah Williams', 'Shipped', '₹965'], ['#1840', 'Ava Chen', 'Paid', '₹2,480']],
  },
  Orders: {
    title: 'Orders',
    note: 'Track payment, packing, and delivery from one queue.',
    metrics: [['New today', '42', '+14.3%'], ['To fulfill', '18', 'On time'], ['Delivered', '1,106', '98.6%']],
    rows: [['#1842', 'Lena Ortiz', 'Ready', '₹1,840'], ['#1841', 'Noah Williams', 'In transit', '₹965'], ['#1840', 'Ava Chen', 'Delivered', '₹2,480']],
  },
  Products: {
    title: 'Products',
    note: 'Keep catalog, stock, pricing, and merchandising healthy.',
    metrics: [['Active', '248', '+12 new'], ['Low stock', '8', 'Review'], ['Bestsellers', '16', '+22.8%']],
    rows: [['Cloud Runner', 'Footwear', 'Featured', '₹3,299'], ['Form Tote', 'Accessories', 'In stock', '₹1,999'], ['Everyday Tee', 'Apparel', 'Bestseller', '₹799']],
  },
  Customers: {
    title: 'Customers',
    note: 'Understand loyalty, activity, and lifetime value.',
    metrics: [['Total', '8,492', '+12.1%'], ['Returning', '64%', '+4.8%'], ['Avg. value', '₹2,140', '+8.3%']],
    rows: [['Lena Ortiz', '6 orders', 'VIP', '₹12,480'], ['Noah Williams', '3 orders', 'Active', '₹4,860'], ['Ava Chen', '8 orders', 'VIP', '₹19,040']],
  },
} as const;

type View = keyof typeof VIEWS;

export function CommerceWorkspace() {
  const [view, setView] = useState<View>('Overview');
  const content = VIEWS[view];

  return (
    <div className="commerce-workspace">
      <aside>
        <strong><i>✦</i> StoreLab</strong>
        <nav aria-label="Dashboard preview">
          {(Object.keys(VIEWS) as View[]).map(item => (
            <button key={item} type="button" aria-pressed={view === item} onClick={() => setView(item)}>
              <span>{item === 'Overview' ? '⌁' : item === 'Orders' ? '□' : item === 'Products' ? '◇' : '○'}</span>{item}
            </button>
          ))}
        </nav>
        <small>Live workspace</small>
      </aside>

      <div className="commerce-workspace-main">
        <header><div><span>{view} / Live</span><h3>{content.title}</h3><p>{content.note}</p></div><button type="button" aria-label={`Add new ${view.toLowerCase()}`}>＋</button></header>
        <div className="commerce-workspace-metrics">
          {content.metrics.map(([label, value, change]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{change}</small></article>)}
        </div>
        <div className="commerce-workspace-table">
          <div><strong>{view === 'Overview' ? 'Recent orders' : `Recent ${view.toLowerCase()}`}</strong><span>Updated now</span></div>
          {content.rows.map(([first, second, status, value]) => <div key={first}><b>{first}</b><span>{second}</span><em>{status}</em><strong>{value}</strong></div>)}
        </div>
      </div>
    </div>
  );
}
