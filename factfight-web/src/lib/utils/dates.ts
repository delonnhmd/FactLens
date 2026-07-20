const absoluteDateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function formatAbsoluteDate(value: string | null | undefined): string {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "Date unavailable" : absoluteDateFormatter.format(date);
}

export function formatRelativePastDate(
  value: string | null | undefined,
  now = Date.now(),
): string {
  if (!value) return "date unavailable";

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "date unavailable";

  const elapsedSeconds = Math.max(0, Math.floor((now - timestamp) / 1_000));
  if (elapsedSeconds < 60) return "just now";

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes} ${elapsedMinutes === 1 ? "minute" : "minutes"} ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} ${elapsedHours === 1 ? "hour" : "hours"} ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 30) return `${elapsedDays} ${elapsedDays === 1 ? "day" : "days"} ago`;

  const elapsedMonths = Math.floor(elapsedDays / 30);
  if (elapsedMonths < 12) return `${elapsedMonths} ${elapsedMonths === 1 ? "month" : "months"} ago`;

  const elapsedYears = Math.floor(elapsedDays / 365);
  return `${elapsedYears} ${elapsedYears === 1 ? "year" : "years"} ago`;
}
