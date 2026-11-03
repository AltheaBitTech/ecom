/**
 * Guest checkout has no account, so the backend proves order ownership by the
 * email the order was placed with. We remember that email in the browser (keyed
 * per store) so the confirmation/tracking page can look the order up without
 * putting the email in the URL. Signed-in shoppers never use this — their token
 * authorises them.
 */
const keyFor = (tenant: string) => `ecom.guestOrders.${tenant}`;

function readAll(tenant: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(keyFor(tenant));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function rememberGuestOrder(tenant: string, orderId: string, email: string): void {
  try {
    const all = readAll(tenant);
    all[orderId] = email;
    window.localStorage.setItem(keyFor(tenant), JSON.stringify(all));
  } catch {
    /* storage blocked — the shopper can still re-enter their email to track */
  }
}

export function recallGuestOrderEmail(tenant: string, orderId: string): string | null {
  return readAll(tenant)[orderId] ?? null;
}
