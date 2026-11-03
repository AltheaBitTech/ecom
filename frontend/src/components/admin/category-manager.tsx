'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { createCategory, deleteCategory } from '@/app/(admin)/admin/(dashboard)/products/actions';
import { RowActions } from '@/components/admin/row-actions';
import { Button } from '@/components/admin-ui/button';
import { EmptyState } from '@/components/ui/primitives';
import type { Category } from '@/lib/types';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Categories list with inline create/delete. Read-only when the staff member
 * lacks products:write (the backend enforces this regardless). Categories are a
 * flat/parented list; deleting one detaches its products (backend behaviour), it
 * does not delete them.
 */
export function CategoryManager({
  categories,
  canWrite,
}: {
  categories: Category[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [parentId, setParentId] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError('Category name must be at least 2 characters.');
      return;
    }
    if (imageUrl) {
      try {
        if (!['http:', 'https:'].includes(new URL(imageUrl).protocol)) throw new Error();
      } catch {
        setError('Enter a full http(s) category image URL.');
        return;
      }
    }
    setPending(true);
    try {
      const result = await createCategory({
        name: name.trim(),
        slug: (slug || slugify(name)).trim(),
        parent_id: parentId || undefined,
        description: description.trim() || undefined,
        image_url: imageUrl || undefined,
        is_featured: isFeatured,
      });
      if (!result.ok) {
        setError(result.error?.message ?? 'Could not create the category.');
        return;
      }
      setName('');
      setSlug('');
      setSlugTouched(false);
      setParentId('');
      setDescription('');
      setImageUrl('');
      setIsFeatured(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function onDelete(cat: Category) {
    const result = await deleteCategory(cat.id);
    if (!result.ok) {
      toast.error(result.error?.message ?? 'Could not delete the category.');
      return;
    }
    toast.success('Category deleted');
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {categories.length === 0 ? (
          <EmptyState
            icon="🗂"
            title="No categories yet"
            description="Group your products into categories so shoppers can browse them."
          />
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Slug</th>
                  {canWrite && <th className="px-5 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-paper-soft">
                    <td className="px-5 py-3 font-medium text-ink">{cat.name}{cat.is_featured && <span className="ml-2 rounded-full bg-[#c8ff4d] px-2 py-0.5 text-[9px] font-bold uppercase">Featured</span>}<p className="mt-1 max-w-sm truncate text-xs font-normal text-ink-faint">{cat.description}</p></td>
                    <td className="px-5 py-3 text-ink-faint">{cat.slug}</td>
                    {canWrite && (
                      <td className="px-5 py-3 text-right">
                        <RowActions itemLabel={cat.name} onDelete={() => onDelete(cat)} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canWrite && (
        <form onSubmit={onCreate} className="card h-fit space-y-4 p-6">
          <h2 className="text-sm font-semibold text-ink-soft">Add category</h2>
          <div>
            <label htmlFor="cat-name" className="label">
              Name
            </label>
            <input
              id="cat-name"
              className="input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              required
              maxLength={120}
            />
          </div>
          <div>
            <label htmlFor="cat-slug" className="label">
              Slug
            </label>
            <input
              id="cat-slug"
              className="input"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              title="Lowercase letters, numbers and single hyphens"
            />
          </div>
          <div>
            <label htmlFor="cat-description" className="label">Description</label>
            <textarea id="cat-description" className="input min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
          </div>
          <div>
            <label htmlFor="cat-image" className="label">Cover image URL</label>
            <input id="cat-image" type="url" className="input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-paper-soft p-3">
            <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="accent-[#ff5c35]" />
            <span className="text-sm font-medium">Feature on storefront</span>
          </label>
          <div>
            <label htmlFor="cat-parent" className="label">
              Parent
            </label>
            <select
              id="cat-parent"
              className="input"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">None (top level)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Adding…' : 'Add category'}
          </Button>
        </form>
      )}
    </div>
  );
}
