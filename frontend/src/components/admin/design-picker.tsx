'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { completeMediaUpload, createDesignPreview, createMediaUpload, publishDesign, saveDesignDraft } from '@/app/(admin)/admin/(dashboard)/design/actions';
import { getStoreTemplate, type StoreDesignConfig, type StoreSectionConfig, type StoreSectionType } from '@/lib/store-templates';
import type { Category, MediaAsset, Product, StoreDesignState } from '@/lib/types';

const SECTION_LABELS: Record<StoreSectionType, string> = { hero: 'Hero', 'category-rail': 'Category rail', 'product-collection': 'Product collection', 'promotion-split': 'Promotion split', 'promotion-mosaic': 'Promotion mosaic', 'brand-story': 'Brand story', 'trust-bar': 'Trust bar', testimonials: 'Testimonials', newsletter: 'Newsletter', 'logo-strip': 'Logo strip', faq: 'FAQ', 'deal-countdown': 'Deal countdown' };
// Plain-language "what is this + what to do" notes shown above each editor.
const SECTION_HINTS: Record<StoreSectionType, string> = {
  hero: 'The big banner at the very top. Set the main headline and the coloured accent word.',
  'category-rail': 'The row of department tiles. Pick which categories show, or leave empty to show featured ones.',
  'product-collection': 'A grid of products. Choose Featured, Bestsellers, or All — or hand-pick specific items.',
  'promotion-split': 'One large promo banner with an image and a button.',
  'promotion-mosaic': 'The row of offer cards (e.g. “UP TO 25% OFF”). Edit each card’s text, offer and button below.',
  'brand-story': 'A short story block about your store with an image.',
  'trust-bar': 'The “Why shop with us” strip. Edit each icon, title and one-line description.',
  testimonials: 'A customer quote. Set the quote text and who said it.',
  newsletter: 'The email sign-up band near the footer. Set its heading and supporting line.',
  'logo-strip': 'A row of short text labels (brands or trust words).',
  faq: 'A "Frequently Asked Questions" accordion. Add as many question/answer pairs as you need.',
  'deal-countdown': 'A countdown panel for a running flash sale. Hand-pick which discounted products to show.',
};

export function DesignPicker({ initial, products, categories, initialMedia, canWrite, storeSlug }: { initial: StoreDesignState; products: Product[]; categories: Category[]; initialMedia: MediaAsset[]; canWrite: boolean; storeSlug?: string }) {
  const [design, setDesign] = useState(initial.draft);
  const [revision, setRevision] = useState(initial.draft_revision);
  const [publishedRevision, setPublishedRevision] = useState(initial.published_revision);
  const [selectedSection, setSelectedSection] = useState(design.sections[0]?.id ?? 'hero');
  const [tab, setTab] = useState<'sections' | 'brand' | 'media'>('sections');
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [media, setMedia] = useState(initialMedia);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Live preview: real storefront in an iframe. null src = mock preview.
  const [liveSrc, setLiveSrc] = useState<string | null>(null);
  const [liveNonce, setLiveNonce] = useState(0);
  const liveSlug = useRef<string | null>(null);
  // Undo/redo history: snapshot design JSON on every real change.
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const skipHistory = useRef(false);
  const lastSnapshot = useRef(JSON.stringify(initial.draft));
  const [, setHistoryTick] = useState(0);
  const template = getStoreTemplate(design.templateId);
  const selected = design.sections.find((section) => section.id === selectedSection) ?? design.sections[0];
  const dirty = revision !== publishedRevision;

  function updateSection(id: string, update: (section: StoreSectionConfig) => StoreSectionConfig) {
    setDesign((current) => ({ ...current, sections: current.sections.map((section) => section.id === id ? update(section) : section) }));
  }

  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= design.sections.length) return;
    const next = [...design.sections]; [next[index], next[target]] = [next[target], next[index]];
    setDesign({ ...design, sections: next });
  }

  function addSection(type: StoreSectionType) {
    const defaultData: Record<string, unknown> = type === 'faq' ? { items: [{ question: '', answer: '' }] } : type === 'deal-countdown' ? { productIds: [] } : {};
    const section: StoreSectionConfig = { id: `${type}-${Date.now()}`, type, enabled: true, variant: type === 'product-collection' ? 'grid' : 'split', data: defaultData };
    setDesign((current) => ({ ...current, sections: [...current.sections, section] }));
    setSelectedSection(section.id);
  }

  function save() {
    startTransition(async () => {
      const result = await saveDesignDraft(design, revision);
      setMessage(result.message);
      if (result.ok && result.revision !== undefined) setRevision(result.revision);
    });
  }

  function preview() {
    const popup = window.open('', '_blank');
    startTransition(async () => {
      const saved = await saveDesignDraft(design, revision);
      if (!saved.ok || saved.revision === undefined) { popup?.close(); setMessage(saved.message); return; }
      setRevision(saved.revision);
      const result = await createDesignPreview();
      if (!result.ok || !result.url) { popup?.close(); setMessage(result.message ?? 'Could not create a preview.'); return; }
      if (popup) popup.location.href = result.url; else window.open(result.url, '_blank', 'noopener,noreferrer');
    });
  }

  function publish() {
    startTransition(async () => {
      let currentRevision = revision;
      const saved = await saveDesignDraft(design, revision);
      if (!saved.ok || saved.revision === undefined) { setMessage(saved.message); return; }
      currentRevision = saved.revision; setRevision(currentRevision);
      const result = await publishDesign(); setMessage(result.message);
      if (result.ok && result.revision !== undefined) setPublishedRevision(result.revision);
    });
  }

  // Click a section inside the live iframe → select it here (Wix-style).
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'store-preview:select') { setTab('sections'); setSelectedSection(event.data.id); return; }
      if (event.data?.type === 'store-preview:edit') {
        const { id, field, value } = event.data;
        setTab('sections'); setSelectedSection(id);
        updateSection(id, (current) => {
          const parts = String(field).split('.'); // "title" or "cards.0.cta"
          if (parts.length === 1) return { ...current, data: { ...current.data, [field]: value } };
          const [arrayKey, indexText, key] = parts;
          const array = Array.isArray(current.data[arrayKey]) ? [...(current.data[arrayKey] as Array<Record<string, unknown>>)] : [];
          const index = Number(indexText);
          array[index] = { ...(array[index] ?? {}), [key]: value };
          return { ...current, data: { ...current.data, [arrayKey]: array } };
        });
      }
      if (event.data?.type === 'store-preview:command') {
        const { action, id } = event.data;
        setTab('sections'); setSelectedSection(id);
        if (action === 'up' || action === 'down') setDesign((current) => {
          const index = current.sections.findIndex((section) => section.id === id);
          const target = index + (action === 'up' ? -1 : 1);
          if (index < 0 || target < 0 || target >= current.sections.length) return current;
          const next = [...current.sections]; [next[index], next[target]] = [next[target], next[index]];
          return { ...current, sections: next };
        });
        if (action === 'hide') setDesign((current) => ({ ...current, sections: current.sections.map((section) => section.id === id ? { ...section, enabled: false } : section) }));
        if (action === 'delete') setDesign((current) => current.sections.length <= 1 ? current : { ...current, sections: current.sections.filter((section) => section.id !== id) });
      }
    }
    window.addEventListener('message', onMessage);
    const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); } };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('message', onMessage); window.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Record history on every real design change (skip programmatic undo/redo).
  useEffect(() => {
    const current = JSON.stringify(design);
    if (current === lastSnapshot.current) return;
    if (skipHistory.current) { skipHistory.current = false; lastSnapshot.current = current; return; }
    undoStack.current.push(lastSnapshot.current);
    redoStack.current = [];
    lastSnapshot.current = current;
    setHistoryTick((tick) => tick + 1);
  }, [design]);

  function undo() { const previous = undoStack.current.pop(); if (previous === undefined) return; redoStack.current.push(lastSnapshot.current); skipHistory.current = true; setDesign(JSON.parse(previous)); setHistoryTick((tick) => tick + 1); }
  function redo() { const next = redoStack.current.pop(); if (next === undefined) return; undoStack.current.push(lastSnapshot.current); skipHistory.current = true; setDesign(JSON.parse(next)); setHistoryTick((tick) => tick + 1); }

  // In live mode, push edits to the draft and reload the iframe after edits
  // settle. ponytail: 900ms debounce, not per-keystroke — one save per pause.
  useEffect(() => {
    if (!liveSrc || !liveSlug.current) return;
    const timer = setTimeout(async () => {
      const saved = await saveDesignDraft(design, revision);
      if (saved.ok && saved.revision !== undefined) setRevision(saved.revision);
      setLiveNonce((value) => value + 1);
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design]);

  function enterLive() {
    startTransition(async () => {
      const saved = await saveDesignDraft(design, revision);
      if (!saved.ok || saved.revision === undefined) { setMessage(saved.message); return; }
      setRevision(saved.revision);
      const result = await createDesignPreview();
      if (!result.ok || !result.url) { setMessage(result.message ?? 'Could not start live preview.'); return; }
      liveSlug.current = new URLSearchParams(result.url.split('?')[1]).get('slug');
      setLiveSrc(result.url); // first hit sets the preview cookie, then redirects to the store
    });
  }

  return <div className="design-studio-v3">
    <header className="design-studio-head"><div><span>Storefront studio</span><h1>BUILD YOUR<br /><em>STORE WORLD.</em></h1><p>Design the whole journey—from first impression to checkout—using curated modules that stay polished on every screen. Every word, image, and offer here comes from you — there&apos;s nothing hardcoded for shoppers to see.</p></div><div className="design-status"><span className={dirty ? 'is-draft' : 'is-live'}>{dirty ? '● Unpublished draft' : '● Live and synced'}</span><small>Revision {revision}</small></div></header>

    <div className="design-studio-toolbar"><nav>{(['sections', 'brand', 'media'] as const).map((item) => <button key={item} type="button" className={tab === item ? 'is-active' : ''} onClick={() => setTab(item)}>{item}</button>)}</nav><div><button type="button" onClick={undo} disabled={undoStack.current.length === 0} title="Undo (⌘Z)">↶ Undo</button><button type="button" onClick={redo} disabled={redoStack.current.length === 0} title="Redo (⇧⌘Z)">↷ Redo</button><button type="button" onClick={save} disabled={!canWrite || pending}>Save draft</button><button type="button" onClick={preview} disabled={pending}>Preview website ↗</button><button type="button" className="is-primary" onClick={publish} disabled={!canWrite || pending}>Publish</button></div></div>

    <div className="design-editor-layout"><aside className="design-editor-panel">
      {tab === 'sections' && <SectionEditor design={design} selected={selectedSection} products={products} categories={categories} media={media} onSelect={setSelectedSection} onUpdate={updateSection} onMove={moveSection} onAdd={addSection} onDelete={(id) => { const next = design.sections.filter((section) => section.id !== id); setDesign({ ...design, sections: next }); setSelectedSection(next[0]?.id ?? ''); }} />}
      {tab === 'brand' && <BrandEditor design={design} onChange={setDesign} media={media} />}
      {tab === 'media' && <MediaLibrary assets={media} setAssets={setMedia} selectedSection={selected} updateSection={updateSection} onLogo={(id) => setDesign((current) => ({ ...current, global: { ...current.global, logoMediaId: id } }))} />}
    </aside><LivePreview design={design} template={template} viewport={viewport} setViewport={setViewport} products={products} categories={categories} storeSlug={storeSlug} frameSrc={liveSrc ? (liveNonce === 0 ? liveSrc : `/${liveSlug.current}?pv=${liveNonce}`) : null} onEnterLive={enterLive} onExitLive={() => { setLiveSrc(null); liveSlug.current = null; setLiveNonce(0); }} liveBusy={pending} /></div>
    {message && <p className="design-message" role="status">{message}</p>}
  </div>;
}

function SectionEditor({ design, selected, products, categories, media, onSelect, onUpdate, onMove, onAdd, onDelete }: { design: StoreDesignConfig; selected: string; products: Product[]; categories: Category[]; media: MediaAsset[]; onSelect: (id: string) => void; onUpdate: (id: string, update: (section: StoreSectionConfig) => StoreSectionConfig) => void; onMove: (index: number, direction: -1 | 1) => void; onAdd: (type: StoreSectionType) => void; onDelete: (id: string) => void }) {
  const section = design.sections.find((item) => item.id === selected);
  return <><div className="design-panel-title"><span>Page structure</span><h2>Curated sections</h2><p>Your storefront is built from the blocks below. Click a block to edit its text, use ↑ ↓ to reorder, and the ● toggle to show or hide it. Changes preview live on the right — hit Save draft, then Publish to go live.</p></div><div className="design-section-list">{design.sections.map((item, index) => <button type="button" key={item.id} onClick={() => onSelect(item.id)} className={selected === item.id ? 'is-active' : ''}><i>{String(index + 1).padStart(2, '0')}</i><span><strong>{SECTION_LABELS[item.type]}</strong><small>{item.variant}</small></span><em>{item.enabled ? '●' : '○'}</em></button>)}</div><select className="design-add-section" defaultValue="" onChange={(event) => { if (event.target.value) onAdd(event.target.value as StoreSectionType); event.target.value = ''; }}><option value="">＋ Add a section</option>{Object.entries(SECTION_LABELS).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select>{section && <div className="design-properties"><div className="design-property-head"><strong>Edit {SECTION_LABELS[section.type]}</strong><span><button type="button" onClick={() => onMove(design.sections.indexOf(section), -1)}>↑</button><button type="button" onClick={() => onMove(design.sections.indexOf(section), 1)}>↓</button></span></div><p className="design-hint">{SECTION_HINTS[section.type]}</p><label className="design-check"><input type="checkbox" checked={section.enabled} onChange={(event) => onUpdate(section.id, (current) => ({ ...current, enabled: event.target.checked }))} /> Show this section</label><Field label="Heading" value={String(section.data.title ?? '')} onChange={(value) => onUpdate(section.id, (current) => ({ ...current, data: { ...current.data, title: value } }))} /><Field label="Supporting copy" value={String(section.data.body ?? '')} multiline onChange={(value) => onUpdate(section.id, (current) => ({ ...current, data: { ...current.data, body: value } }))} />{section.type === 'hero' && <><Field label="Accent line" value={String(section.data.accent ?? '')} onChange={(value) => onUpdate(section.id, (current) => ({ ...current, data: { ...current.data, accent: value } }))} /><label>Left panel photo<select value={String(section.data.mediaId ?? '')} onChange={(event) => onUpdate(section.id, (current) => ({ ...current, data: { ...current.data, mediaId: event.target.value } }))}><option value="">No photo</option>{media.filter((asset) => asset.status === 'READY').map((asset) => <option key={asset.id} value={asset.id}>{asset.filename}</option>)}</select><small>Upload new images in the Media tab.</small></label><p className="design-hint">Right panel — a second offer, in the brand color.</p><Field label="Right panel heading" value={String(section.data.secondaryTitle ?? '')} onChange={(value) => onUpdate(section.id, (current) => ({ ...current, data: { ...current.data, secondaryTitle: value } }))} /><Field label="Right panel copy" value={String(section.data.secondaryBody ?? '')} multiline onChange={(value) => onUpdate(section.id, (current) => ({ ...current, data: { ...current.data, secondaryBody: value } }))} /><label>Right panel photo<select value={String(section.data.secondaryMediaId ?? '')} onChange={(event) => onUpdate(section.id, (current) => ({ ...current, data: { ...current.data, secondaryMediaId: event.target.value } }))}><option value="">No photo</option>{media.filter((asset) => asset.status === 'READY').map((asset) => <option key={asset.id} value={asset.id}>{asset.filename}</option>)}</select></label><Field label="Discount badge" value={String(section.data.badge ?? '')} onChange={(value) => onUpdate(section.id, (current) => ({ ...current, data: { ...current.data, badge: value } }))} /><Field label="Badge subtext" value={String(section.data.badgeSub ?? '')} onChange={(value) => onUpdate(section.id, (current) => ({ ...current, data: { ...current.data, badgeSub: value } }))} /></>}{section.type === 'product-collection' && <><label>Product source<select value={String(section.data.source ?? 'featured')} onChange={(event) => onUpdate(section.id, (current) => ({ ...current, data: { ...current.data, source: event.target.value } }))}><option value="featured">Featured</option><option value="bestseller">Bestsellers</option><option value="all">All products</option></select></label><MultiSelect label="Hand-pick products" values={(section.data.productIds as string[]) ?? []} options={products.map((product) => ({ id: product.id, label: product.name }))} onChange={(values) => onUpdate(section.id, (current) => ({ ...current, data: { ...current.data, productIds: values } }))} /></>}{section.type === 'category-rail' && <MultiSelect label="Choose categories" values={(section.data.categoryIds as string[]) ?? []} options={categories.map((category) => ({ id: category.id, label: category.name }))} onChange={(values) => onUpdate(section.id, (current) => ({ ...current, data: { ...current.data, categoryIds: values } }))} />}{section.type === 'promotion-mosaic' && Array.isArray(section.data.cards) && <RepeaterEditor label="Offer cards" fields={[['eyebrow', 'Text'], ['title', 'Offer'], ['cta', 'Button label']]} rows={section.data.cards as Array<Record<string, unknown>>} onChange={(rows) => onUpdate(section.id, (current) => ({ ...current, data: { ...current.data, cards: rows } }))} />}{section.type === 'trust-bar' && Array.isArray(section.data.items) && <RepeaterEditor label="Why-shop items" fields={[['icon', 'Icon'], ['title', 'Title'], ['body', 'Description']]} rows={section.data.items as Array<Record<string, unknown>>} onChange={(rows) => onUpdate(section.id, (current) => ({ ...current, data: { ...current.data, items: rows } }))} />}{section.type === 'faq' && Array.isArray(section.data.items) && <RepeaterEditor label="Questions" fields={[['question', 'Question'], ['answer', 'Answer']]} rows={section.data.items as Array<Record<string, unknown>>} onChange={(rows) => onUpdate(section.id, (current) => ({ ...current, data: { ...current.data, items: rows } }))} />}{section.type === 'deal-countdown' && <MultiSelect label="Products on sale" values={(section.data.productIds as string[]) ?? []} options={products.map((product) => ({ id: product.id, label: product.name }))} onChange={(values) => onUpdate(section.id, (current) => ({ ...current, data: { ...current.data, productIds: values } }))} />}<button type="button" className="design-delete" onClick={() => onDelete(section.id)} disabled={design.sections.length === 1}>Remove section</button></div>}</>;
}

function BrandEditor({ design, onChange, media }: { design: StoreDesignConfig; onChange: (design: StoreDesignConfig) => void; media: MediaAsset[] }) {
  const setGlobal = <K extends keyof StoreDesignConfig['global']>(key: K, value: StoreDesignConfig['global'][K]) => onChange({ ...design, global: { ...design.global, [key]: value } });
  return <><div className="design-panel-title"><span>Brand system</span><h2>Make it yours</h2><p>These choices flow through home, products, cart, checkout, account, and orders.</p></div><Field label="Announcement bar" value={design.global.announcement} onChange={(value) => setGlobal('announcement', value)} /><Field label="Store tagline" value={design.global.tagline} multiline onChange={(value) => setGlobal('tagline', value)} /><Field label="Footer heading" value={design.global.footer.heading} onChange={(value) => setGlobal('footer', { ...design.global.footer, heading: value })} /><div className="design-colors">{Object.entries(design.tokens.colors).map(([key, value]) => <label key={key}>{key}<input type="color" value={value} onChange={(event) => onChange({ ...design, tokens: { ...design.tokens, colors: { ...design.tokens.colors, [key]: event.target.value } } })} /><small>{value}</small></label>)}</div><label>Corner style<select value={design.tokens.radius} onChange={(event) => onChange({ ...design, tokens: { ...design.tokens, radius: event.target.value as StoreDesignConfig['tokens']['radius'] } })}>{['none', 'small', 'medium', 'large', 'pill'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Logo image<select value={design.global.logoMediaId ?? ''} onChange={(event) => setGlobal('logoMediaId', event.target.value || null)}><option value="">Use store initial</option>{media.filter((asset) => asset.status === 'READY').map((asset) => <option key={asset.id} value={asset.id}>{asset.filename}</option>)}</select></label><NavEditor items={design.global.navigation} onChange={(items) => setGlobal('navigation', items)} /></>;
}

// Header navigation, with an optional dropdown of sub-links per item (mega-nav).
function NavEditor({ items, onChange }: { items: StoreDesignConfig['global']['navigation']; onChange: (items: StoreDesignConfig['global']['navigation']) => void }) {
  const update = (index: number, patch: Partial<StoreDesignConfig['global']['navigation'][number]>) => onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return <div className="design-repeater"><strong>Navigation menu</strong>{items.map((item, index) => <div key={index} className="design-repeater-row">
    <Field label="Label" value={item.label} onChange={(value) => update(index, { label: value })} />
    <Field label="Link" value={item.href} onChange={(value) => update(index, { href: value })} />
    <button type="button" onClick={() => onChange(items.filter((_, i) => i !== index))}>Remove</button>
    <div className="design-repeater">
      <strong>Dropdown sub-links (optional)</strong>
      {(item.children ?? []).map((child, childIndex) => <div key={childIndex} className="design-repeater-row">
        <Field label="Label" value={child.label} onChange={(value) => update(index, { children: (item.children ?? []).map((c, i) => (i === childIndex ? { ...c, label: value } : c)) })} />
        <Field label="Link" value={child.href} onChange={(value) => update(index, { children: (item.children ?? []).map((c, i) => (i === childIndex ? { ...c, href: value } : c)) })} />
        <button type="button" onClick={() => update(index, { children: (item.children ?? []).filter((_, i) => i !== childIndex) })}>Remove</button>
      </div>)}
      <button type="button" onClick={() => update(index, { children: [...(item.children ?? []), { label: '', href: '' }] })}>＋ Add sub-link</button>
    </div>
  </div>)}<button type="button" onClick={() => onChange([...items, { label: '', href: '' }])}>＋ Add menu item</button></div>;
}

function MediaLibrary({ assets, setAssets, selectedSection, updateSection, onLogo }: { assets: MediaAsset[]; setAssets: (assets: MediaAsset[]) => void; selectedSection?: StoreSectionConfig; updateSection: (id: string, update: (section: StoreSectionConfig) => StoreSectionConfig) => void; onLogo: (id: string) => void }) {
  const [uploading, setUploading] = useState(false); const [error, setError] = useState<string | null>(null);
  async function upload(file: File) { setUploading(true); setError(null); const start = await createMediaUpload({ filename: file.name, mime_type: file.type, size_bytes: file.size, alt_text: file.name.replace(/\.[^.]+$/, '') }); if (!start.ok || !start.upload_url || !start.asset) { setError(start.message ?? 'Upload failed'); setUploading(false); return; } try { const response = await fetch(start.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file }); if (!response.ok) throw new Error(); const dimensions = await imageDimensions(file); const done = await completeMediaUpload(start.asset.id, dimensions.width, dimensions.height); if (!done.ok || !done.asset) throw new Error(done.message); setAssets([done.asset, ...assets]); } catch (cause) { setError(cause instanceof Error && cause.message ? cause.message : 'Upload failed.'); } finally { setUploading(false); } }
  return <><div className="design-panel-title"><span>Media library</span><h2>Campaign imagery</h2><p>JPEG, PNG, WebP, or AVIF up to 10 MB. Files are private and tenant-scoped.</p></div><label className="design-upload"><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /><span>{uploading ? 'Uploading…' : '＋ Upload image'}</span></label>{error && <p className="design-error">{error}</p>}<div className="design-media-grid">{assets.filter((asset) => asset.status === 'READY').map((asset) => <article key={asset.id}>{asset.url && <img src={asset.url} alt={asset.alt_text ?? ''} />}<strong>{asset.filename}</strong><div>{selectedSection && <button type="button" onClick={() => updateSection(selectedSection.id, (current) => ({ ...current, data: { ...current.data, mediaId: asset.id } }))}>Use in section</button>}<button type="button" onClick={() => onLogo(asset.id)}>Use as logo</button></div></article>)}</div></>;
}

function LivePreview({ design, template, viewport, setViewport, products, categories, storeSlug, frameSrc, onEnterLive, onExitLive, liveBusy }: { design: StoreDesignConfig; template: ReturnType<typeof getStoreTemplate>; viewport: 'desktop' | 'tablet' | 'mobile'; setViewport: (viewport: 'desktop' | 'tablet' | 'mobile') => void; products: Product[]; categories: Category[]; storeSlug?: string; frameSrc: string | null; onEnterLive: () => void; onExitLive: () => void; liveBusy: boolean }) {
  const enabled = design.sections.filter((section) => section.enabled);
  return <section className="design-live-preview"><header><div><strong>{template.name}</strong><span>{frameSrc ? 'Live storefront · click a block to edit it' : `${template.industry} · quick mock`}</span></div><nav>{frameSrc ? <button type="button" onClick={onExitLive}>← Mock</button> : <button type="button" onClick={onEnterLive} disabled={liveBusy}>{liveBusy ? 'Starting…' : 'Live edit ↗'}</button>}{(['desktop', 'tablet', 'mobile'] as const).map((item) => <button key={item} type="button" className={viewport === item ? 'is-active' : ''} onClick={() => setViewport(item)}>{item}</button>)}</nav></header><div className={`design-preview-viewport is-${viewport}`}>{frameSrc
    ? <iframe className="design-preview-frame" src={frameSrc} title="Live storefront preview" />
    : <div className={`design-preview-site design-preview-${template.style}`} style={{ ['--preview-primary' as string]: design.tokens.colors.primary, ['--preview-bg' as string]: design.tokens.colors.background, ['--preview-accent' as string]: design.tokens.colors.accent }}>{design.global.announcement && <div className="preview-site-announce">{design.global.announcement}</div>}<div className="preview-site-nav"><b>{storeSlug || 'Your store'}.</b><span>Shop &nbsp; New &nbsp; Cart</span></div>{enabled.map((section) => <PreviewSection key={section.id} section={section} template={template} categories={categories} products={products} />)}{design.global.footer.heading && <div className="preview-site-footer">{design.global.footer.heading}</div>}</div>}</div></section>;
}

// Renders one section as a lightweight mock band. Order and show/hide come from
// the caller (it maps enabled sections in order); text edits appear here live.
// ponytail: a thumbnail, not the real renderer — "Preview website ↗" is exact.
function PreviewSection({ section, template, categories, products }: { section: StoreSectionConfig; template: ReturnType<typeof getStoreTemplate>; categories: Category[]; products: Product[] }) {
  const title = String(section.data.title ?? '');
  const body = String(section.data.body ?? '');
  if (section.type === 'hero') {
    return <div className="preview-site-hero"><small>{template.eyebrow}</small><h2>{title || template.heroTitle}<em>{String(section.data.accent ?? template.heroAccent)}</em></h2>{body && <p>{body}</p>}{Boolean(section.data.badge) && <b className="preview-site-badge">{String(section.data.badge)}<small>{String(section.data.badgeSub ?? '')}</small></b>}<i /></div>;
  }
  if (section.type === 'category-rail') {
    const list = categories.length ? categories : [{ id: '1', name: 'Collection one' }, { id: '2', name: 'Collection two' }, { id: '3', name: 'Collection three' }];
    return <div className="preview-site-categories">{list.slice(0, 3).map((category) => <span key={category.id}>{category.name}</span>)}</div>;
  }
  if (section.type === 'product-collection') {
    const list = products.length ? products : [{ id: '1', name: 'Product one' }, { id: '2', name: 'Product two' }, { id: '3', name: 'Product three' }];
    return <div className="preview-site-products">{list.slice(0, 3).map((product) => <span key={product.id}><i />{product.name}</span>)}</div>;
  }
  // Every other section type: a labelled band so presence, order and text edits
  // are visible without hand-building a mock for each variant.
  return <div className="preview-site-band"><small>{SECTION_LABELS[section.type]}</small>{title && <strong>{title}</strong>}{body && <p>{body}</p>}</div>;
}

function Field({ label, value, multiline = false, onChange }: { label: string; value: string; multiline?: boolean; onChange: (value: string) => void }) { return <label>{label}{multiline ? <textarea value={value} rows={3} onChange={(event) => onChange(event.target.value)} /> : <input value={value} onChange={(event) => onChange(event.target.value)} />}</label>; }
// Edits a list of same-shaped objects (offer cards, why-shop items). Unlisted
// keys (href, tint) are preserved via spread so styling/links survive edits.
function RepeaterEditor({ label, fields, rows, onChange }: { label: string; fields: Array<[string, string]>; rows: Array<Record<string, unknown>>; onChange: (rows: Array<Record<string, unknown>>) => void }) {
  const setCell = (index: number, key: string, value: string) => onChange(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  return <div className="design-repeater"><strong>{label}</strong>{rows.map((row, index) => <div key={index} className="design-repeater-row">{fields.map(([key, fieldLabel]) => <Field key={key} label={fieldLabel} value={String(row[key] ?? '')} onChange={(value) => setCell(index, key, value)} />)}<button type="button" onClick={() => onChange(rows.filter((_, i) => i !== index))} disabled={rows.length <= 1}>Remove</button></div>)}<button type="button" onClick={() => onChange([...rows, Object.fromEntries(fields.map(([key]) => [key, '']))])}>＋ Add {label.toLowerCase()}</button></div>;
}
function MultiSelect({ label, values, options, onChange }: { label: string; values: string[]; options: Array<{ id: string; label: string }>; onChange: (values: string[]) => void }) { return <label>{label}<select multiple value={values} onChange={(event) => onChange(Array.from(event.target.selectedOptions, (option) => option.value))}>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select><small>Hold Cmd/Ctrl to select several.</small></label>; }
function imageDimensions(file: File): Promise<{ width?: number; height?: number }> { return new Promise((resolve) => { const image = new Image(); const url = URL.createObjectURL(file); image.onload = () => { resolve({ width: image.naturalWidth, height: image.naturalHeight }); URL.revokeObjectURL(url); }; image.onerror = () => { resolve({}); URL.revokeObjectURL(url); }; image.src = url; }); }
