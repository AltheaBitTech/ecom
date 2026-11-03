import { CardGridSkeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <div className="store-subpage">
      <div className="mb-6 h-6 w-32 animate-pulse rounded bg-paper-sunken" />
      <CardGridSkeleton count={8} />
    </div>
  );
}
