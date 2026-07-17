export const FEED_PAGE_SIZE = 20;
export const MAX_FEED_PAGE = 100;

export function parseFeedPage(value: string | string[] | undefined): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = candidate && /^\d+$/.test(candidate) ? Number.parseInt(candidate, 10) : 1;

  if (!Number.isSafeInteger(parsed)) {
    return 1;
  }

  return Math.min(MAX_FEED_PAGE, Math.max(1, parsed));
}
