/** Removes trailing separator dashes so user-entered prefixes cannot create doubled separators. */
export function normalizeDocumentPrefix(value: string | null | undefined, fallback: string): string {
  const normalized = (value ?? '').trim().replace(/-+$/, '');
  return normalized || fallback;
}
