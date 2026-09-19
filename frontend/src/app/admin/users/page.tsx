'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import type { User } from '@/lib/types';

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive'> = {
  ACTIVE: 'default',
  SUSPENDED: 'destructive',
  DEACTIVATED: 'secondary',
};

export default function UsersPage() {
  const { hasPermission, user: me } = useAuth();
  const [users, setUsers] = useState<User[] | null>(null);
  const [suspendingId, setSuspendingId] = useState<string | null>(null);

  const canSuspend = hasPermission(PERMISSIONS.USERS_SUSPEND);

  function load() {
    api<User[]>('/users')
      .then(setUsers)
      .catch(() => toast.error('Failed to load users'));
  }

  useEffect(load, []);

  async function suspend(id: string) {
    setSuspendingId(id);
    try {
      await api(`/users/${id}/suspend`, { method: 'POST' });
      toast.success('User suspended');
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to suspend user');
    } finally {
      setSuspendingId(null);
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-muted-foreground">Everyone with access to this workspace.</p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              {canSuspend && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users === null &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={canSuspend ? 4 : 3}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {users?.length === 0 && (
              <TableRow>
                <TableCell colSpan={canSuspend ? 4 : 3} className="py-10 text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            )}
            {users?.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <Badge key={r.role.id} variant="outline" className="font-normal">
                        {r.role.name}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[u.status] ?? 'secondary'}>{u.status}</Badge>
                </TableCell>
                {canSuspend && (
                  <TableCell className="text-right">
                    {u.status === 'ACTIVE' && u.id !== me?.id && (
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={<Button variant="ghost" size="sm" disabled={suspendingId === u.id} />}
                        >
                          Suspend
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Suspend {u.email}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              They will immediately lose access to this workspace. This can be reversed later.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => suspend(u.id)}>Suspend</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
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
