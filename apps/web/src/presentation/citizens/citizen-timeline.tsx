import type { CitizenTimeline } from '@/contracts/citizens';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.citizens;

type TimelineRow = { id: string; at: string; kind: string; text: string };

function rows(timeline: CitizenTimeline): TimelineRow[] {
  const messages = timeline.messages.map((item) => ({
    id: `message-${item.id}`,
    at: item.at,
    kind: copy.timeline.message,
    text: item.body?.trim() || item.direction,
  }));
  const events = timeline.events.map((item) => ({
    id: `event-${item.id}`,
    at: item.at,
    kind: copy.timeline.event,
    text: item.note?.trim() || item.eventType,
  }));
  const animals = timeline.animals.map((item) => ({
    id: `animal-${item.id}`,
    at: item.at,
    kind: copy.timeline.animal,
    text: `${item.name} · ${item.species} · ${item.municipalId}`,
  }));
  const notes = (timeline.notes ?? []).map((item) => ({
    id: `note-${item.id}`,
    at: item.at,
    kind: copy.timeline.note,
    text: item.body?.trim() || item.kind || '',
  }));
  const tasks = (timeline.tasks ?? []).map((item) => ({
    id: `task-${item.id}`,
    at: item.at,
    kind: copy.timeline.task,
    text: `${item.title ?? ''} · ${item.status ?? ''}`.trim(),
  }));
  return [...messages, ...events, ...animals, ...notes, ...tasks].sort((a, b) => (a.at < b.at ? 1 : -1));
}

type CitizenTimelineViewProps = {
  timeline: CitizenTimeline;
};

// Timeline - newest first, including notes and tasks from the citizen RPC.
export function CitizenTimelineView({ timeline }: CitizenTimelineViewProps) {
  const items = rows(timeline);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{copy.timelineTitle}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{copy.timelineEmpty}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{item.kind}</p>
              <p>{item.text}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
