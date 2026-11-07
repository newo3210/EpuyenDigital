import { esAR } from '@/i18n/es-AR';

type DeliveryTicksProps = {
  status: string | null | undefined;
};

// DeliveryTicks - outbound ACK indicators (sent / delivered / read).
export function DeliveryTicks({ status }: DeliveryTicksProps) {
  if (!status) return null;
  const label =
    esAR.inbox.delivery[status as keyof typeof esAR.inbox.delivery] ?? status;

  let mark = '✓';
  if (status === 'delivered' || status === 'read') mark = '✓✓';
  if (status === 'failed' || status === 'blocked') mark = '!';

  const tone =
    status === 'read'
      ? 'text-sky-200'
      : status === 'failed' || status === 'blocked'
        ? 'text-red-200'
        : 'text-white/80';

  return (
    <span className={`ml-2 inline-flex items-center gap-1 text-[11px] ${tone}`} title={label}>
      <span aria-hidden>{mark}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
