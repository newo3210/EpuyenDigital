// Fallback - shown when the display name is empty.
export const FALLBACK_INITIALS = '?';

// First character - code-point aware so accented letters and emoji stay intact.
function firstChar(word: string): string {
  return Array.from(word)[0] ?? '';
}

// Initials - first letter of the first and last words, uppercased (es-AR locale).
export function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (!first) return FALLBACK_INITIALS;

  const last = words.length > 1 ? words[words.length - 1] : undefined;
  const letters = firstChar(first) + (last ? firstChar(last) : '');
  return letters.toLocaleUpperCase('es-AR');
}
