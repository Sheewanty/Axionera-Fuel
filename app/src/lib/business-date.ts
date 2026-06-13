export function currentBusinessDate(): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

const displayDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDisplayDate(value: Date | string | null | undefined): string {
  if (!value) return "-";

  const date =
    typeof value === "string"
      ? new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value)
      : value;

  if (Number.isNaN(date.getTime())) return "-";

  return displayDateFormatter.format(date).replace(/ /g, "-");
}
