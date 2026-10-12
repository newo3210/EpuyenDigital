import { redactDocumentId, redactPhone } from "@epuyen/shared";

// Redact - strip phones and document ids from log strings
export function redactForLogs(message: string): string {
  let out = message;
  out = out.replace(/\+?54\s?9?\s?\d[\d\s-]{8,}/g, (m) => {
    try {
      return redactPhone(m);
    } catch {
      return "***";
    }
  });
  out = out.replace(/\b\d{7,8}\b/g, (m) => redactDocumentId(m));
  return out;
}
