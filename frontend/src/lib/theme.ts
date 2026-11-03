import { getStoreTemplate, normalizeStoreDesign } from './store-templates';
import type { StoreTheme } from './types';

/** "#0f172a" | "15 23 42" -> "15 23 42" (Tailwind rgb-channel form). */
function toChannels(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  const hex = color.trim().replace('#', '');
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `${r} ${g} ${b}`;
  }
  if (/^\d{1,3}\s+\d{1,3}\s+\d{1,3}$/.test(color.trim())) return color.trim();
  return fallback;
}

/**
 * Build the CSS-variable style object a storefront applies at its root, from the
 * tenant's saved theme. Rendered dynamically per request — no per-tenant build.
 */
export function themeStyle(theme: StoreTheme | undefined): React.CSSProperties {
  const design = normalizeStoreDesign(theme);
  const template = getStoreTemplate(design.templateId);
  const colors = design.tokens.colors;
  return {
    // Cast: CSS custom properties aren't in the CSSProperties type.
    ['--brand' as string]: toChannels(colors.primary, toChannels(template.colors.primary, '15 23 42')),
    ['--brand-fg' as string]: toChannels(colors.primaryForeground, toChannels(template.colors.primaryForeground, '255 255 255')),
    ['--store-bg' as string]: colors.background,
    ['--store-accent' as string]: colors.accent,
    ['--store-radius' as string]: ({ none: '0px', small: '0.5rem', medium: '1rem', large: '1.75rem', pill: '9999px' })[design.tokens.radius],
  };
}
