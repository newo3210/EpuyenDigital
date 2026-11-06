import type { Area } from '@/contracts/areas';
import type { WhatsappLine } from '@/contracts/whatsapp-lines';
import { esAR } from '@/i18n/es-AR';
import { LineForm } from './line-form';

const copy = esAR.lines;

type LineListProps = {
  lines: WhatsappLine[];
  areas: Area[];
};

// Line directory - create form + editable rows for each WhatsApp line.
export function LineList({ lines, areas }: LineListProps) {
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="lines-create-heading" className="rounded-xl border border-line bg-surface p-6">
        <h2 id="lines-create-heading" className="mb-4 text-lg font-semibold">
          {copy.create}
        </h2>
        <LineForm areas={areas} />
      </section>

      <section aria-labelledby="lines-list-heading" className="flex flex-col gap-4">
        <h2 id="lines-list-heading" className="text-lg font-semibold">
          {copy.title}
        </h2>
        {lines.length === 0 ? (
          <p className="text-sm text-muted">{copy.empty}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {lines.map((line) => (
              <li key={line.id} className="rounded-xl border border-line bg-surface p-6">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <span className="font-semibold">{line.name}</span>
                  <span className="text-sm text-muted">{line.displayPhone}</span>
                  <span className="text-xs font-medium text-brand-700">{copy.status[line.status]}</span>
                </div>
                <LineForm line={line} areas={areas} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
