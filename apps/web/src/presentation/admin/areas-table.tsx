import Link from 'next/link';
import type { Area } from '@epuyen/shared';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.settings.areas;

// Areas table props - list of municipal areas for the admin page.
type AreasTableProps = {
  areas: Area[];
};

// Areas table - name, color swatch, default/inactive badges, edit link.
export function AreasTable({ areas }: AreasTableProps) {
  if (areas.length === 0) {
    return <p className="text-sm text-muted">{copy.empty}</p>;
  }

  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      {areas.map((area) => (
        <li key={area.id} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="size-4 shrink-0 rounded-full border border-line"
              style={{ backgroundColor: area.color ?? '#cccccc' }}
            />
            <div className="min-w-0">
              <p className="truncate font-medium">{area.name}</p>
              {area.description && <p className="truncate text-sm text-muted">{area.description}</p>}
            </div>
            {area.isDefault && (
              <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800">
                {copy.defaultBadge}
              </span>
            )}
            {!area.isActive && (
              <span className="rounded bg-canvas px-2 py-0.5 text-xs font-medium text-muted">
                {copy.inactiveBadge}
              </span>
            )}
          </div>
          <Link
            href={`/settings/areas/${area.id}`}
            className="shrink-0 text-sm font-medium text-brand-700 hover:underline"
          >
            {copy.edit}
          </Link>
        </li>
      ))}
    </ul>
  );
}
