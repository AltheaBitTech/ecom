import { Check, Circle } from 'lucide-react';
import { PASSWORD_RULES } from '@/lib/form-validation';

/** Live tick-list of the password rules (same ones the backend enforces). */
export function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className="grid gap-1 text-xs" aria-live="polite">
      {PASSWORD_RULES.map((r, i) => {
        const ok = r.test(password);
        return (
          <li key={r.label} className={ok ? 'flex items-center gap-1.5 text-emerald-600' : 'flex items-center gap-1.5 text-muted-foreground'}>
            {ok ? <Check className="size-3" /> : <Circle className="size-3" />}
            {r.label}
            {i === 1 && <span className="text-muted-foreground">(any 3 of these 4)</span>}
          </li>
        );
      })}
    </ul>
  );
}
