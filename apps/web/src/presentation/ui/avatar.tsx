import { initials } from '@epuyen/shared';

// Avatar props - display name (accessible label + initials source), optional photo URL and size.
type AvatarProps = {
  fullName: string;
  src: string | null;
  size?: 'sm' | 'md' | 'lg';
};

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-20 text-2xl',
};

// Avatar - operator photo, or initials on a brand background when there is none.
export function Avatar({ fullName, src, size = 'md' }: AvatarProps) {
  const sizeClasses = SIZE_CLASSES[size];

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- public bucket URL; next/image would need per-env remotePatterns
      <img src={src} alt={fullName} className={`${sizeClasses} shrink-0 rounded-full object-cover`} />
    );
  }

  return (
    <span
      role="img"
      aria-label={fullName}
      className={`${sizeClasses} inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800`}
    >
      {initials(fullName)}
    </span>
  );
}
