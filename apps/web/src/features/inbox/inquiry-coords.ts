// Dual inquiry coords - prefer conversation denorm, else latest location message.
// Never writes citizens.latitude/longitude (pet GPS).

export type InquiryCoordSource = {
  inquiryLatitude?: number | null;
  inquiryLongitude?: number | null;
};

export type LocationMessage = {
  kind?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type ResolvedInquiryCoords = {
  latitude: number;
  longitude: number;
  source: 'conversation' | 'message';
} | null;

export function resolveInquiryCoords(
  conversation: InquiryCoordSource,
  messages: LocationMessage[] = [],
): ResolvedInquiryCoords {
  if (
    conversation.inquiryLatitude != null &&
    conversation.inquiryLongitude != null &&
    Number.isFinite(conversation.inquiryLatitude) &&
    Number.isFinite(conversation.inquiryLongitude)
  ) {
    return {
      latitude: conversation.inquiryLatitude,
      longitude: conversation.inquiryLongitude,
      source: 'conversation',
    };
  }

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (!m) continue;
    if (m.kind && m.kind !== 'location') continue;
    if (m.latitude == null || m.longitude == null) continue;
    if (!Number.isFinite(m.latitude) || !Number.isFinite(m.longitude)) continue;
    return { latitude: m.latitude, longitude: m.longitude, source: 'message' };
  }

  return null;
}

export function openstreetMapEmbedUrl(lat: number, lng: number, zoom = 15): string {
  const delta = 0.01;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export function openstreetMapLink(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}
