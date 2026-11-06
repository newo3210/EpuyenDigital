/** FormData boolean reader - when absent, returns `whenAbsent` (create defaults isActive=true). */
export function readBoolean(formData: FormData, key: string, whenAbsent = false): boolean {
  if (!formData.has(key)) return whenAbsent;
  const value = formData.get(key);
  return value === 'on' || value === 'true';
}
