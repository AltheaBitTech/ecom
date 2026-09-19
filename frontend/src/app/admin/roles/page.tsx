'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Loader2, Lock } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import type { Role } from '@/lib/types';

export default function RolesPage() {
  const { hasPermission, user: me } = useAuth();
  const [roles, setRoles] = useState<Role[] | null>(null);
  const canManage = hasPermission(PERMISSIONS.ROLES_MANAGE);

  function load() {
    api<Role[]>('/roles')
      .then(setRoles)
      .catch(() => toast.error('Failed to load roles'));
  }

  useEffect(load, []);

  async function remove(id: string) {
    try {
      await api(`/roles/${id}`, { method: 'DELETE' });
      toast.success('Role deleted');
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete role');
    }
  }

  async function archive(id: string) {
    try {
      await api(`/roles/${id}/archive`, { method: 'POST' });
      toast.success('Role archived');
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to archive role');
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Roles</h1>
          <p className="text-muted-foreground">System roles are fixed. Custom roles can&apos;t exceed your own permissions.</p>
        </div>
        {canManage && me && (
          <RoleFormDialog
            mode="create"
            myPermissions={me.permissions}
            onSaved={load}
            triggerVariant="default"
            triggerIcon={<Plus className="size-4" />}
            triggerLabel="New role"
          />
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Permissions</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles === null &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={canManage ? 3 : 2}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {roles?.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {role.name}
                    {role.isSystem && <Lock className="size-3.5 text-muted-foreground" />}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex max-w-md flex-wrap gap-1">
                    {role.permissions.map((p) => (
                      <Badge key={p} variant="outline" className="font-normal">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {role.isSystem && me && (
                        <RoleFormDialog
                          mode="clone"
                          myPermissions={me.permissions}
                          sourceRole={role}
                          onSaved={load}
                          triggerLabel="Clone"
                        />
                      )}
                      {!role.isSystem && (
                        <>
                          {me && (
                            <RoleFormDialog
                              mode="edit"
                              myPermissions={me.permissions}
                              sourceRole={role}
                              onSaved={load}
                              triggerLabel="Edit"
                            />
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger render={<Button variant="ghost" size="sm" />}>Archive</AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Archive {role.name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Blocked automatically if any user still holds this role. Reassign them first.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => archive(role.id)}>Archive</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <AlertDialog>
                            <AlertDialogTrigger render={<Button variant="ghost" size="sm" />}>Delete</AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {role.name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This can&apos;t be undone. Blocked automatically if any user still holds this role.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => remove(role.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

type RoleFormMode = 'create' | 'edit' | 'clone';

const ROLE_FORM_COPY: Record<RoleFormMode, { title: string; description: string; submitLabel: string }> = {
  create: { title: 'Create custom role', description: 'Pick a subset of your own permissions to grant.', submitLabel: 'Create role' },
  edit: { title: 'Edit role', description: 'Pick a subset of your own permissions to grant.', submitLabel: 'Save changes' },
  clone: { title: 'Clone role', description: 'Copies the source role\'s permissions into a new custom role.', submitLabel: 'Clone role' },
};

function RoleFormDialog({
  mode,
  myPermissions,
  sourceRole,
  onSaved,
  triggerLabel,
  triggerVariant = 'ghost',
  triggerIcon,
}: {
  mode: RoleFormMode;
  myPermissions: string[];
  sourceRole?: Role;
  onSaved: () => void;
  triggerLabel: string;
  triggerVariant?: React.ComponentProps<typeof Button>['variant'];
  triggerIcon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(mode === 'clone' ? '' : (sourceRole?.name ?? ''));
  const [selected, setSelected] = useState<string[]>(mode === 'edit' ? (sourceRole?.permissions ?? []) : []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const copy = ROLE_FORM_COPY[mode];

  function toggle(p: string) {
    setSelected((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'create') {
        await api('/roles', { method: 'POST', body: { name, permissions: selected } });
        toast.success('Role created');
      } else if (mode === 'edit') {
        await api(`/roles/${sourceRole!.id}`, { method: 'PATCH', body: { name, permissions: selected } });
        toast.success('Role updated');
      } else {
        await api(`/roles/${sourceRole!.id}/clone`, { method: 'POST', body: { name } });
        toast.success('Role cloned');
      }
      setOpen(false);
      setName(mode === 'clone' ? '' : (sourceRole?.name ?? ''));
      setSelected(mode === 'edit' ? (sourceRole?.permissions ?? []) : []);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to ${mode === 'create' ? 'create' : mode} role`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} size="sm" />}>
        {triggerIcon}
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="roleName">Name</Label>
              <Input id="roleName" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={60} required />
            </div>
            {mode !== 'clone' && (
              <div className="grid gap-2">
                <Label>Permissions</Label>
                <div className="flex flex-wrap gap-2">
                  {myPermissions.map((p) => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => toggle(p)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        selected.includes(p)
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {mode === 'clone' && (
              <div className="flex max-w-md flex-wrap gap-1">
                {sourceRole?.permissions.map((p) => (
                  <Badge key={p} variant="outline" className="font-normal">
                    {p}
                  </Badge>
                ))}
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || (mode !== 'clone' && selected.length === 0)}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {copy.submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
