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
