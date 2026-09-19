'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Product, ProductVariant } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
export function ProductEditor({ product, onSaved }: { product:Product;onSaved:()=>void }) {
  const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function save(event:React.FormEvent<HTMLFormElement>) {event.preventDefault();setBusy(true);setError('');const form=new FormData(event.currentTarget);const body={name:form.get('name'),description:form.get('description'),category:form.get('category'),featured:form.has('featured'),priceCents:Number(form.get('priceCents')),compareAtCents:form.get('compareAtCents')?Number(form.get('compareAtCents')):null,images:String(form.get('images')).split('\n').map((s)=>s.trim()).filter(Boolean),videos:String(form.get('videos')).split('\n').map((s)=>s.trim()).filter(Boolean),labels:String(form.get('labels')).split(',').map((s)=>s.trim()).filter(Boolean),gstRateBps:form.get('gstRate')?Math.round(Number(form.get('gstRate'))*100):0,hsnCode:form.get('hsnCode')||undefined,...(form.get('imageUrl')?{imageUrl:form.get('imageUrl')}: {})};try{await api(`/products/${product.id}`,{method:'PATCH',body});toast.success('Product updated');setOpen(false);onSaved();}catch(e){setError(e instanceof Error?e.message:'Could not save product');}finally{setBusy(false);}}
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button variant="ghost" size="sm" />}>Edit</DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogTitle>Edit {product.name}</DialogTitle><DialogDescription>Choose the category, feature this product, and manage its presentation.</DialogDescription><form className="grid gap-4" onSubmit={save}><label className="grid gap-2 text-sm">Name<Input name="name" defaultValue={product.name} required /></label><label className="grid gap-2 text-sm">Description<Textarea name="description" defaultValue={product.description ?? ''} rows={3} /></label><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm">Category<Input name="category" defaultValue={product.category ?? 'Other'} required maxLength={60} /></label><label className="flex items-center gap-2 text-sm"><input name="featured" type="checkbox" defaultChecked={product.featured} />Feature on homepage</label><label className="grid gap-2 text-sm">Selling price (minor units)<Input name="priceCents" type="number" defaultValue={product.priceCents} min={1} required /></label><label className="grid gap-2 text-sm">Original price (optional, minor units)<Input name="compareAtCents" type="number" defaultValue={product.compareAtCents ?? ''} min={1} /></label></div><p className="text-xs text-muted-foreground">An original price above the selling price shows a sale badge. Products with options use each option’s own prices.</p><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm">GST rate (%)<Input name="gstRate" type="number" min={0} max={28} step={0.01} defaultValue={product.gstRateBps / 100} /></label><label className="grid gap-2 text-sm">HSN code<Input name="hsnCode" defaultValue={product.hsnCode ?? ''} maxLength={8} /></label></div><label className="grid gap-2 text-sm">Main image URL<Input name="imageUrl" type="url" defaultValue={product.imageUrl ?? ''} /></label><label className="grid gap-2 text-sm">Gallery image URLs (one HTTPS URL per line, up to 8)<Textarea name="images" rows={4} defaultValue={(product.images ?? []).join('\n')} /></label><label className="grid gap-2 text-sm">Video URLs (one HTTPS URL per line, up to 4)<Textarea name="videos" rows={2} defaultValue={(product.videos ?? []).join('\n')} /></label><label className="grid gap-2 text-sm">Badges (comma-separated, e.g. New, Bestseller — up to 5)<Input name="labels" defaultValue={(product.labels ?? []).join(', ')} /></label>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={busy}>{busy?'Saving…':'Save product'}</Button></form></DialogContent></Dialog>;
}

export function VariantPriceEditor({ productId, variant, onSaved }: { productId: string; variant: ProductVariant; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await api(`/products/${productId}/variants/${variant.id}`, { method: 'PATCH', body: { priceCents: Number(data.get('price')), compareAtCents: data.get('original') ? Number(data.get('original')) : null } });
      setEditing(false); onSaved(); toast.success('Option prices saved');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save option'); }
    finally { setBusy(false); }
  }
  if (!editing) return <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit prices</Button>;
  return <form onSubmit={save} className="grid max-w-48 gap-2">
    <label className="grid gap-1 text-xs">Selling price (minor units)<Input type="number" min={1} name="price" defaultValue={variant.priceCents} required /></label>
    <label className="grid gap-1 text-xs">Original price (optional)<Input type="number" min={1} name="original" defaultValue={variant.compareAtCents ?? ''} /></label>
    <div className="flex gap-2"><Button type="submit" size="sm" disabled={busy}>Save</Button><Button size="sm" type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button></div>
  </form>;
}
