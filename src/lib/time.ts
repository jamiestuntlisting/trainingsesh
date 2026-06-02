// Timezone-aware helpers for the scheduler. The cron fires in UTC; we translate
// "now" into the configured timezone to decide which weekday it is and whether
// a group's send time has arrived.

export interface ZonedNow {
  weekday: number; // 0=Sun .. 6=Sat
  minutes: number; // minutes since midnight, local to the timezone
  ymd: string; // 'YYYY-MM-DD' local date
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function zonedNow(timeZone: string, now: Date = new Date()): ZonedNow {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";

  const weekday = WEEKDAY_INDEX[get("weekday")] ?? now.getUTCDay();
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // some runtimes emit 24 for midnight
  const minute = parseInt(get("minute"), 10);

  return {
    weekday,
    minutes: hour * 60 + minute,
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

// Parse a 'HH:MM[:SS]' time string into minutes since midnight.
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":");
  return parseInt(h, 10) * 60 + parseInt(m ?? "0", 10);
}
