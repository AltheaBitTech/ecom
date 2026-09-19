import { Button } from '@/components/ui/button';
import { API_URL } from '@/lib/api';
import { GoogleIcon, MicrosoftIcon, FacebookIcon, XIcon } from '@/components/provider-icons';

const PROVIDERS = [
  { id: 'google', label: 'Google', Icon: GoogleIcon },
  { id: 'microsoft', label: 'Microsoft', Icon: MicrosoftIcon },
  { id: 'facebook', label: 'Facebook', Icon: FacebookIcon },
  { id: 'twitter', label: 'X', Icon: XIcon },
] as const;

/** One workspace's login can bounce through any provider — each button just carries the
 *  workspace slug so the backend knows which tenant to look the account up in. */
export function OAuthButtons({ tenantSlug = '', mode = 'login' }: { tenantSlug?: string; mode?: 'login' | 'register' }) {
  const register = mode === 'register';
  // X never shares an email, so it can't create an account — login-only (and even that fails closed).
  const providers = register ? PROVIDERS.filter((p) => p.id !== 'twitter') : PROVIDERS;
  return (
    <div className="grid grid-cols-2 gap-2">
      {providers.map((p) => (
        <Button
          key={p.id}
          type="button"
          variant="outline"
          disabled={!register && !tenantSlug}
          nativeButton={false}
          render={<a href={`${API_URL}/auth/oauth/${p.id}?${register ? 'mode=register' : `tenantSlug=${encodeURIComponent(tenantSlug)}`}`} />}
        >
          <p.Icon className="size-4" />
          {p.label}
        </Button>
      ))}
    </div>
  );
}
