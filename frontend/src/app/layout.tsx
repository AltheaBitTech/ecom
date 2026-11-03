import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';

import './globals.css';

// "Google Sans" itself is Google-proprietary — not distributed on Google
// Fonts, so next/font can't load it. Plus Jakarta Sans is the closest
// publicly-licensed match (same geometric-humanist shape Google Sans uses),
// and one family for both body and display keeps every screen consistent
// the way Google's own product UI does.
const sans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' });
const display = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '700', '800'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'StoreLab — Understand and grow your online store',
    template: '%s · StoreLab',
  },
  description:
    'Products, storefront design, payments, shipping, customers, and insights in one clear commerce workspace.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`} suppressHydrationWarning>
      <body className="font-sans">{children}</body>
    </html>
  );
}
