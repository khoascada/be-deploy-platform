export function slugify(value: string) {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'project';
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}
