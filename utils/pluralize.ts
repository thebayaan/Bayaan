/** Formats a count with its noun, e.g. "1 bookmark" or "2 notes". */
export function formatCount(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
