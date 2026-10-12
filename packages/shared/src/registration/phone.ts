// Phone normalize - Argentine WhatsApp numbers to canonical 549… digits
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) {
    throw new Error("INVALID_PHONE");
  }

  // Already canonical 549…
  if (digits.startsWith("549") && digits.length >= 12) {
    return digits;
  }

  // +54 9 XXX… or 54 9 …
  if (digits.startsWith("54") && digits[2] === "9") {
    return digits;
  }

  // 54 + area without 9 (insert mobile 9)
  if (digits.startsWith("54") && digits.length >= 12 && digits[2] !== "9") {
    return `549${digits.slice(2)}`;
  }

  // Local 15… mobile prefix
  if (digits.startsWith("15") && digits.length >= 10) {
    return `549${digits.slice(2)}`;
  }

  // Bare national mobile without country code
  if (digits.length >= 10 && !digits.startsWith("54")) {
    return `549${digits.replace(/^0/, "")}`;
  }

  return digits.startsWith("549") ? digits : `549${digits}`;
}

// redactPhone - mask for logs
export function redactPhone(phone: string): string {
  const n = phone.replace(/\D/g, "");
  if (n.length < 6) return "***";
  return `${n.slice(0, 3)}***${n.slice(-3)}`;
}
