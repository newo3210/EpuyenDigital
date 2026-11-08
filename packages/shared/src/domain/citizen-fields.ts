export const CITIZEN_PROFILE_KEYS = [
  'full_name',
  'document_id',
  'address_line',
  'neighborhood',
  'email',
  'latitude',
  'longitude',
  'tags',
  'observations',
  'party_kind',
] as const;

export type CitizenProfileKey = (typeof CITIZEN_PROFILE_KEYS)[number];

export type FieldSources = Partial<Record<CitizenProfileKey, 'manual' | 'bot' | 'import'>>;

// Manual source wins - mirrors citizens_guard_manual_fields for unit tests.
export function protectManualFields(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>,
  sources: FieldSources,
): Record<string, unknown> {
  const next = { ...incoming };
  for (const key of CITIZEN_PROFILE_KEYS) {
    if (sources[key] === 'manual' && key in current) {
      next[key] = current[key];
    }
  }
  return next;
}
