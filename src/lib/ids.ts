const ID_PATTERN = /^[a-z0-9-]{1,80}$/;

export function parseIds(raw: string | null, max = 5): string[] {
  if (!raw) return [];
  const ids: string[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim().toLowerCase();
    if (!ID_PATTERN.test(id) || ids.includes(id)) continue;
    ids.push(id);
    if (ids.length >= max) break;
  }
  return ids;
}
