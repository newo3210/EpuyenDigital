import type { Area } from '@/contracts/areas';
import { esAR } from '@/i18n/es-AR';
import { AreaForm } from './area-form';

const copy = esAR.areas;

// List props - areas already loaded by the page (server component).
type AreaListProps = {
  areas: Area[];
};

// Area directory - list plus inline create form; edit form under each row.
export function AreaList({ areas }: AreaListProps) {
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="areas-create-heading" className="rounded-xl border border-line bg-surface p-6">
        <h2 id="areas-create-heading" className="sr-only">
          {copy.create}
        </h2>
        <AreaForm />
      </section>

      <section aria-labelledby="areas-list-heading" className="flex flex-col gap-4">
        <h2 id="areas-list-heading" className="text-lg font-semibold">
          {copy.title}
        </h2>
        {areas.length === 0 ? (
          <p className="text-sm text-muted">{copy.empty}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {areas.map((area) => (
              <li key={area.id} className="rounded-xl border border-line bg-surface p-6">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="inline-block size-4 rounded-full border border-line"
                    style={{ backgroundColor: area.color }}
                  />
                  <span className="font-semibold">{area.name}</span>
                  {area.isDefault && (
                    <span className="text-xs font-medium text-brand-700">{copy.badges.default}</span>
                  )}
                  {!area.isActive && (
                    <span className="text-xs font-medium text-muted">{copy.badges.inactive}</span>
                  )}
                </div>
                <AreaForm area={area} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
