import type { LucideIcon } from 'lucide-react';

// Empty state props - icon, headline and one-line guidance.
type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

// Empty state - centered placeholder for sections without data yet.
export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center">
      <Icon aria-hidden="true" className="size-10 text-brand-600" />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-md text-sm text-muted">{description}</p>
    </div>
  );
}
