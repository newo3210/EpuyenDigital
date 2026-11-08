import type { InboxOption } from '@/contracts/inbox';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.inbox.filters;

type QueueFiltersProps = {
  areas: InboxOption[];
  lines: InboxOption[];
  values: {
    areaId?: string;
    lineId?: string;
    owner?: string;
    awaitingMine?: boolean;
    unanswered?: boolean;
    withAttachments?: boolean;
  };
};

// Queue filters - GET form so the link stays shareable.
export function QueueFilters({ areas, lines, values }: QueueFiltersProps) {
  return (
    <form action="/inbox" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
      <label className="flex flex-col gap-1">
        {copy.area}
        <select name="areaId" defaultValue={values.areaId ?? ''} className="rounded border border-line bg-canvas px-2 py-1">
          <option value="">{copy.all}</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        {copy.line}
        <select name="lineId" defaultValue={values.lineId ?? ''} className="rounded border border-line bg-canvas px-2 py-1">
          <option value="">{copy.all}</option>
          {lines.map((line) => (
            <option key={line.id} value={line.id}>
              {line.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        {copy.owner}
        <select name="owner" defaultValue={values.owner ?? ''} className="rounded border border-line bg-canvas px-2 py-1">
          <option value="">{copy.all}</option>
          <option value="me">{copy.me}</option>
          <option value="unowned">{copy.unowned}</option>
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="awaiting" value="1" defaultChecked={values.awaitingMine} />
        {copy.awaiting}
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="unanswered" value="1" defaultChecked={values.unanswered} />
        {copy.unanswered}
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="attachments" value="1" defaultChecked={values.withAttachments} />
        {copy.attachments}
      </label>
      <button type="submit" className="rounded bg-brand-700 px-3 py-1.5 text-white">
        {copy.apply}
      </button>
    </form>
  );
}
