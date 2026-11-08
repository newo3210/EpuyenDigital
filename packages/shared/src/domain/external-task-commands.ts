export type ExternalTaskCommand =
  | { kind: 'ACEPTO'; ref: string }
  | { kind: 'RECHAZO'; ref: string; detail: string }
  | { kind: 'LISTO'; ref: string; detail: string }
  | { kind: 'NO_SE_PUEDE'; ref: string; detail: string }
  | { kind: 'HELP' };

// External WhatsApp commands - case insensitive, accent-tolerant enough for panel copy.
export function parseExternalTaskCommand(text: string): ExternalTaskCommand {
  const raw = text.trim();
  const upper = raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase();

  const refMatch = upper.match(/T-\d+/);
  const ref = refMatch?.[0] ?? '';

  if (/^ACEPTO\s+T-\d+/.test(upper)) return { kind: 'ACEPTO', ref };
  if (/^RECHAZO\s+T-\d+/.test(upper)) {
    return { kind: 'RECHAZO', ref, detail: raw.replace(/^rechazo\s+T-\d+\s*/i, '').trim() };
  }
  if (/^LISTO\s+T-\d+/.test(upper)) {
    return { kind: 'LISTO', ref, detail: raw.replace(/^listo\s+T-\d+\s*/i, '').trim() };
  }
  if (/^NO SE PUEDE\s+T-\d+/.test(upper)) {
    return { kind: 'NO_SE_PUEDE', ref, detail: raw.replace(/^no se puede\s+T-\d+\s*/i, '').trim() };
  }
  return { kind: 'HELP' };
}
