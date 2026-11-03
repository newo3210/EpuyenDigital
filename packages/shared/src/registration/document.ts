// Document validation - DNI / passport patterns for Argentina MVP

const DNI_RE = /^\d{7,8}$/;
const PASSPORT_RE = /^[A-Za-z0-9]{6,12}$/;

// validateDocumentId - returns normalized document or null if invalid
export function validateDocumentId(raw: string): string | null {
  const trimmed = raw.trim().replace(/[.\s-]/g, "");
  if (!trimmed) return null;
  if (DNI_RE.test(trimmed)) return trimmed;
  if (PASSPORT_RE.test(trimmed) && /[A-Za-z]/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return null;
}

// redactDocumentId - mask for logs
export function redactDocumentId(documentId: string): string {
  const d = documentId.trim();
  if (d.length <= 3) return "***";
  return `${d.slice(0, 2)}***${d.slice(-2)}`;
}
