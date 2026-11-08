import Link from 'next/link';
import type { TaskListItem } from '@/contracts/tasks';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.tasks;

type TaskBoardProps = {
  tasks: TaskListItem[];
  status?: string;
  areaId?: string;
  areas: { id: string; label: string }[];
};

function formatWhen(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
}

// Task board - overdue first from SQL; filters stay as query params.
export function TaskBoard({ tasks, status, areaId, areas }: TaskBoardProps) {
  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-wrap gap-3 text-sm" method="get">
        <label className="flex flex-col gap-1">
          <span>{copy.filters.status}</span>
          <select name="status" defaultValue={status ?? ''} className="rounded border border-line bg-surface px-2 py-1">
            <option value="">{copy.filters.all}</option>
            {Object.entries(copy.status).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span>{copy.filters.area}</span>
          <select name="areaId" defaultValue={areaId ?? ''} className="rounded border border-line bg-surface px-2 py-1">
            <option value="">{copy.filters.all}</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="self-end rounded bg-brand-700 px-3 py-1.5 text-white">
          {copy.filters.status}
        </button>
      </form>

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-8 text-center">
          <h2 className="text-lg font-semibold">{esAR.emptyStates.tasks.title}</h2>
          <p className="mt-2 text-sm text-muted">{copy.emptyBoard}</p>
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link href={`/tasks/${task.id}`} className="flex flex-col gap-2 px-4 py-3 hover:bg-canvas">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">
                    {task.publicRef} · {task.title}
                  </span>
                  <span className="text-xs text-muted">{formatWhen(task.dueAt)}</span>
                </div>
                <div className="flex flex-wrap gap-1 text-xs">
                  <span className="rounded bg-canvas px-2 py-0.5">
                    {copy.status[task.status as keyof typeof copy.status] ?? task.status}
                  </span>
                  <span className="rounded bg-canvas px-2 py-0.5">
                    {copy.kind[task.kind as keyof typeof copy.kind] ?? task.kind}
                  </span>
                  {task.overdue ? (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-red-900">{copy.overdue}</span>
                  ) : null}
                  {task.awaitingAcceptance ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">{copy.awaiting}</span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
