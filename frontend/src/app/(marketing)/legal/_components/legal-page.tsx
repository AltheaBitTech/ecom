import { Badge } from '@/components/ui/badge';

const LAST_UPDATED = new Date().toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <div className="mb-10 flex flex-col gap-2">
        <Badge variant="outline" className="w-fit">
          Draft — pending review
        </Badge>
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">{title}</h1>
        <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
      </div>

      <div className="mb-10 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">This is a draft template, not final legal copy.</p>
        <p className="mt-1">
          It must be reviewed by the business owner — and ideally a lawyer — and updated with the business&apos;s
          real registered name, address, and any jurisdiction-specific requirements before it is relied on for
          real customer transactions.
        </p>
      </div>

      <div className="flex flex-col gap-8 text-sm leading-relaxed text-muted-foreground [&_h2]:pt-2 [&_h2]:text-xl [&_h2]:font-medium [&_h2]:tracking-tight [&_h2]:text-foreground [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1.5">
        {children}
      </div>
    </div>
  );
}
