import type { Metadata } from 'next';
import { Geist_Mono, Fraunces } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Editorial display serif — used only on the marketing landing page (font-display).
const fraunces = Fraunces({
  variable: '--font-fraunces',
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://altheabit.com'),
  title: {
    // Inferred from the domain altheabit.com — confirm the real store name with the business owner.
    default: 'Althea Bit',
    template: '%s · Althea Bit',
  },
  description: 'Shop online at Althea Bit — quality products, secure checkout, and fast delivery.',
  openGraph: {
    title: 'Althea Bit',
    description: 'Shop online at Althea Bit — quality products, secure checkout, and fast delivery.',
    url: 'https://altheabit.com',
    type: 'website',
  },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            {children}
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
