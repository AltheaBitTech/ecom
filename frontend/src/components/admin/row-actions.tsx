'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/admin-ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/admin-ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/admin-ui/dropdown-menu';

/** Shared "⋯" row menu: an Edit link plus a Delete action gated behind a
 *  confirm dialog. Used by every admin list (products, orders, categories,
 *  flash sales) instead of each screen re-building its own row menu. */
export function RowActions({ editHref, itemLabel, onDelete, deleting = false }: { editHref?: string; itemLabel: string; onDelete: () => void; deleting?: boolean }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Row actions" />}>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {editHref && <DropdownMenuItem render={<Link href={editHref} />}>Edit</DropdownMenuItem>}
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmOpen(true)}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {itemLabel}?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={() => { onDelete(); setConfirmOpen(false); }}>{deleting ? 'Deleting…' : 'Delete'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
