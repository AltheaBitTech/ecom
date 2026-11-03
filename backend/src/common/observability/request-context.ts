import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request ambient state, carried without threading it through every call.
 * Seeded by RequestContextMiddleware at the edge of every request and read by
 * the logger, the access log, the audit trail and the response envelope so a
 * single `request_id` (and the principal, once resolved) ties them all together.
 */
export interface PrincipalDescriptor {
  kind: 'staff' | 'customer' | 'internal';
  /** Stable id of the caller: userId | customerId | product slug. */
  id: string;
  /** The tenant the caller acted within, when tenant-bound. */
  tenant_id?: string;
}

export interface RequestStore {
  requestId: string;
  /** Resolved once the AuthenticationGuard identifies the caller. */
  principal?: PrincipalDescriptor;
}

const storage = new AsyncLocalStorage<RequestStore>();

/** Run `fn` with a fresh request store bound to the async context. */
export function runWithRequestContext<T>(store: RequestStore, fn: () => T): T {
  return storage.run(store, fn);
}

export function currentStore(): RequestStore | undefined {
  return storage.getStore();
}

export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

export function currentPrincipal(): PrincipalDescriptor | undefined {
  return storage.getStore()?.principal;
}

/** Record the resolved caller on the active request store (best-effort). */
export function setCurrentPrincipal(principal: PrincipalDescriptor): void {
  const store = storage.getStore();
  if (store) store.principal = principal;
}
