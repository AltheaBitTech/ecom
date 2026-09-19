'use client';
import { useSyncExternalStore } from 'react';
import { StoreLink as Link } from '@/components/storefront/store-link';
import { CircleCheck } from 'lucide-react';
import { money } from '@/lib/storefront';
const subscribe = () => () => {};
const snapshot = () => { try { return sessionStorage.getItem('storefront_order'); } catch { return null; } };
export default function OrderConfirmedPage() {
  const saved = useSyncExternalStore(subscribe, snapshot, () => null);
  let order: {id:string;totalCents:number;currency:string;email?:string} | null = null;
  try { order = saved ? JSON.parse(saved) : null; } catch { /* Invalid local receipt. */ }
  return <div className="store-container store-empty !py-24"><CircleCheck size={48} className="text-primary" /><h1>{order?'Thank you for your order.':'Your order receipt'}</h1>{order ? <><p>Your checkout is complete. Your payment is being confirmed.</p><div className="my-3 rounded-2xl border p-5"><p className="text-xs text-muted-foreground">KEEP THIS ORDER ID FOR YOUR RECORDS</p><p className="my-2 break-all font-mono">{order.id}</p><strong>{money(order.totalCents,order.currency)}</strong></div><p>Contact the store with your order ID for delivery updates.</p><Link className="store-button" href={`/orders/${order.id}`}>Track this order</Link></> : <p>Complete checkout to see your order details here.</p>}<Link className="store-button secondary" href="/store/products">Continue exploring</Link><Link className="store-text-link" href="/store#contact">Contact the store</Link></div>;
}
