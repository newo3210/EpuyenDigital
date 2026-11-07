import { esAR } from '@/i18n/es-AR';
import {
  openstreetMapEmbedUrl,
  openstreetMapLink,
} from '@/features/inbox/inquiry-coords';

type InquiryMapProps = {
  latitude: number;
  longitude: number;
};

// InquiryMap - mesa consultation pin (never pet GPS from citizens).
export function InquiryMap({ latitude, longitude }: InquiryMapProps) {
  const copy = esAR.inbox;
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{copy.mapTitle}</p>
        <a
          href={openstreetMapLink(latitude, longitude)}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-brand-700 hover:underline"
        >
          {copy.mapOpen}
        </a>
      </div>
      <iframe
        title={copy.mapTitle}
        src={openstreetMapEmbedUrl(latitude, longitude)}
        className="h-40 w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
