export const CHECKIN_TIMEZONE = "Asia/Bangkok";

export function getCheckinToday(now = new Date()) {
  const [year, month, day] = now
    .toLocaleDateString("en-CA", { timeZone: CHECKIN_TIMEZONE })
    .split("-")
    .map(Number);

  return { year, month, day };
}
