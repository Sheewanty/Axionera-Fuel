export function currentBusinessDate(): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
}
