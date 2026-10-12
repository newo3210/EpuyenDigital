// Municipal ID - barrio code normalization and formatter helpers (SQL assigns final ID)

// normalizeBarrioCode - uppercase alphanumeric 3–4 letter code
export function normalizeBarrioCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (cleaned.length < 3) return null;
  return cleaned.slice(0, 4);
}

// formatMunicipalId - {BARRIO3}-{YYYY}-{SEQ5} with EPU fallback
export function formatMunicipalId(params: {
  barrioCode: string | null | undefined;
  year: number;
  sequence: number;
}): string {
  const prefix = normalizeBarrioCode(params.barrioCode) ?? "EPU";
  const seq = String(params.sequence).padStart(5, "0");
  return `${prefix}-${params.year}-${seq}`;
}

// registrationYearBuenosAires - calendar year in America/Argentina/Buenos_Aires
export function registrationYearBuenosAires(date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  return Number(year);
}
