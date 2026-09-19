'use client';
import { useRef, useState } from 'react';
import { StoreLink as Link, useStoreHref } from '@/components/storefront/store-link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { clearCart, useCartLines } from '@/lib/cart';
import { money } from '@/lib/storefront';
import { useStore, StoreLoading } from '@/components/storefront/store-provider';
import { QuoteSummary, setCoupon, useQuote } from '@/components/storefront/cart-content';

interface PaymentResponse { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
interface CheckoutResponse { order: { id:string; totalCents:number; currency:string }; razorpayOrderId:string; razorpayKeyId:string }
declare global { interface Window { Razorpay?: new (options: { key:string; amount:number; currency:string; order_id:string; name:string; prefill:{name:string;email:string;contact:string}; handler:(response:PaymentResponse)=>void; modal:{ondismiss:()=>void} }) => {open:()=>void} } }
let scriptPromise: Promise<void> | null = null;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise) scriptPromise = new Promise<void>((resolve,reject) => { const script = document.createElement('script'); script.src = 'https://checkout.razorpay.com/v1/checkout.js'; script.onload=()=>resolve(); script.onerror=()=>{script.remove();scriptPromise=null;reject(new Error('Could not load the payment window. Please try again.'));};document.body.appendChild(script); });
  return scriptPromise;
}
export default function CheckoutPage() {
  const { store, preview } = useStore(); const storeHref = useStoreHref(); const lines = useCartLines(); const router = useRouter();
  const [fulfillment,setFulfillment]=useState('delivery'); const quote = useQuote(fulfillment);
  const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const cached=useRef<{key:string;result:CheckoutResponse} | null>(null);
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (preview || busy || !quote.quote || !store) return;
    const fields=new FormData(event.currentTarget);
    const body={ items:lines, couponCode:quote.coupon || undefined, fulfillment, customerName:String(fields.get('name')), customerEmail:String(fields.get('email')), customerPhone:String(fields.get('phone')), marketingOptIn:fields.has('marketingOptIn'), ...(fulfillment === 'delivery' ? {address:{line:String(fields.get('line')),city:String(fields.get('city')),state:String(fields.get('state')),postalCode:String(fields.get('postalCode'))}} : {}) };
    const key=JSON.stringify(body); setBusy(true);setError('');
    try {
      await loadRazorpay();
      const result=cached.current?.key===key ? cached.current.result : await api<CheckoutResponse>('/storefront/checkout',{method:'POST',body});
      cached.current={key,result};
      if (!window.Razorpay) throw new Error('The payment window is unavailable. Please retry.');
      const widget=new window.Razorpay({ key:result.razorpayKeyId, amount:result.order.totalCents,currency:result.order.currency,order_id:result.razorpayOrderId,name:store.name,prefill:{name:body.customerName,email:body.customerEmail,contact:body.customerPhone},handler:async(response)=>{
        try { await api('/storefront/verify-payment',{method:'POST',body:{orderId:result.order.id,...response}}); sessionStorage.setItem('storefront_order',JSON.stringify({id:result.order.id,totalCents:result.order.totalCents,currency:result.order.currency,email:body.customerEmail}));clearCart();setCoupon('');router.push(storeHref('/order-confirmed')); }
        catch(e) { setError(`${e instanceof Error ? e.message : 'Verification failed'}. If your account was charged, contact the store with order ${result.order.id} before paying again.`); }
        finally {setBusy(false);}
      },modal:{ondismiss:()=>{setBusy(false);setError('Payment wasn’t completed. Your bag is saved; you can try again.');}} });widget.open();
    } catch(e) {setError(e instanceof Error ? e.message : 'Could not start checkout');setBusy(false);}
  }
  if (!store) return <StoreLoading />;
  if (!lines.length) return <div className="store-container store-empty"><h1>Your bag is empty.</h1><Link href="/store/products" className="store-button">Explore the collection</Link></div>;
  return <div className="store-container store-section"><Link href="/cart" className="store-text-link mb-7"><ArrowLeft size={16} />Back to your bag</Link><p className="store-eyebrow">One step closer to a good thing</p><h1 className="store-page-title">Make it yours.</h1><div className="mt-10 grid gap-10 lg:grid-cols-[1fr_370px]"><form onSubmit={submit} className="checkout-form"><fieldset disabled={busy}><legend className="mb-5 text-xl font-semibold">01 — Your details</legend><div className="grid gap-4 sm:grid-cols-2">{[{name:'name',label:'Full name',type:'text',auto:'name'}, {name:'email',label:'Email address',type:'email',auto:'email'}, {name:'phone',label:'Phone number',type:'tel',auto:'tel'}].map((f)=><label className="grid gap-2 text-sm" key={f.name}>{f.label}<input className="store-input" name={f.name} type={f.type} autoComplete={f.auto} required maxLength={f.name==='phone'?40:100} /></label>)}</div><h2 className="mb-5 mt-9 text-xl">02 — Delivery</h2>{store.settings.pickupEnabled && <div className="mb-5 flex gap-5">{['delivery','pickup'].map((option)=><label key={option} className="flex min-h-11 items-center gap-2 capitalize"><input type="radio" name="fulfillment" value={option} checked={fulfillment===option} onChange={()=>setFulfillment(option)} />{option}</label>)}</div>}{fulfillment==='delivery' ? <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm sm:col-span-2">Street address<input className="store-input" name="line" autoComplete="street-address" minLength={3} maxLength={200} required /></label><label className="grid gap-2 text-sm">City<input className="store-input" name="city" autoComplete="address-level2" maxLength={80} required /></label><label className="grid gap-2 text-sm">State<input className="store-input" name="state" autoComplete="address-level1" maxLength={80} required /></label><label className="grid gap-2 text-sm">Postal code<input className="store-input" name="postalCode" autoComplete="postal-code" minLength={3} maxLength={20} required /></label></div> : <p className="rounded-xl bg-muted p-4 text-sm">Pickup from {store.settings.address || store.name}. Contact the store to arrange a pickup time.</p>}<p className="mt-4 text-sm text-muted-foreground">{store.settings.deliveryNote}</p><h2 className="mb-4 mt-9 text-xl">03 — Secure payment</h2><p className="text-sm text-muted-foreground">Pay by UPI, card, or another method available in Razorpay.</p><label className="mt-5 flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" required /><span>I agree to the <Link className="underline" href="/legal/terms">terms</Link> and <Link className="underline" href="/legal/refund-policy">refund policy</Link>.</span></label><label className="mt-3 flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" name="marketingOptIn" /><span>Send me offers and new arrivals. Optional, and you can unsubscribe from any message.</span></label>{error && <p className="mt-5 text-sm text-destructive" role="alert">{error}</p>}<button className="store-button mt-6 w-full" disabled={preview || busy || !quote.quote || quote.loading}><ShieldCheck size={18} />{preview?'Checkout disabled in preview':busy?'Opening secure payment…':quote.quote ? `Pay ${money(quote.quote.totalCents,quote.quote.currency)}` : 'Waiting for order total'}</button></fieldset></form><aside className="cart-summary"><QuoteSummary {...quote} /><Link href="/cart" className="store-text-link mt-6 text-sm">Edit items in your bag</Link><p className="mt-5 text-xs text-muted-foreground">Prices and offers are checked again before payment. Delivery is calculated after discounts.</p></aside></div></div>;
}
