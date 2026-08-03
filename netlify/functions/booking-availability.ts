import type { Config } from "@netlify/functions";
import { and, gte, lte, ne } from "drizzle-orm";
import { db } from "../../db/index.js";
import { bookings } from "../../db/schema.js";
import { WRONG_METHOD_MESSAGE } from "../lib/messages.js";

/*
 * Read-only companion to /api/booking: which arrival windows are still open.
 *
 * The booking form used to offer all three windows on every date, so the only
 * way a customer learned a window was gone was the follow-up call. This walks
 * the same calendar the form draws -- tomorrow through three weeks out, closed
 * Sundays, a different window set on Saturdays -- and marks the windows that
 * already have a booking against them.
 *
 * Capacity is one visit per arrival window, which is how the schedule has been
 * run to date. If two crews ever work the same window, WINDOW_CAPACITY is the
 * only number to move.
 */

const DAYS_AHEAD = 21;
const WINDOW_CAPACITY = 1;

// Kept byte-identical to the labels the form submits, since a booking row is
// matched to a window by its stored `booking_time` string.
const WEEKDAY_WINDOWS = [
  { value: "9:00 AM - 11:00 AM", start: "9:00 AM", end: "11:00 AM", part: "morning" },
  { value: "12:00 PM - 2:00 PM", start: "12:00 PM", end: "2:00 PM", part: "midday" },
  { value: "3:00 PM - 5:00 PM", start: "3:00 PM", end: "5:00 PM", part: "afternoon" },
];

const SATURDAY_WINDOWS = [
  { value: "10:00 AM - 12:00 PM", start: "10:00 AM", end: "12:00 PM", part: "morning" },
  { value: "12:30 PM - 2:30 PM", start: "12:30 PM", end: "2:30 PM", part: "midday" },
  { value: "3:00 PM - 5:00 PM", start: "3:00 PM", end: "5:00 PM", part: "afternoon" },
];

const json = (body: unknown, init?: ResponseInit) =>
  Response.json(body, {
    ...init,
    headers: {
      // Availability is only useful while it is current, and a booking taken a
      // minute ago has to disappear from the next visitor's grid.
      "cache-control": "no-store",
      ...(init?.headers ?? {}),
    },
  });

const getDetroitDateString = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Detroit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

/** Add `offset` days to a YYYY-MM-DD string without dragging a timezone in. */
const addDays = (isoDate: string, offset: number) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + offset, 12)).toISOString().slice(0, 10);
};

const dayOfWeek = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
};

export default async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { allow: "GET, OPTIONS" } });
  }

  if (request.method !== "GET") {
    return json({ error: WRONG_METHOD_MESSAGE }, { status: 405 });
  }

  const today = getDetroitDateString(new Date());
  const firstDate = addDays(today, 1);
  const lastDate = addDays(today, DAYS_AHEAD);

  let taken = new Map<string, number>();
  try {
    const rows = await db
      .select({ bookingDate: bookings.bookingDate, bookingTime: bookings.bookingTime })
      .from(bookings)
      .where(
        and(
          gte(bookings.bookingDate, firstDate),
          lte(bookings.bookingDate, lastDate),
          // A cancelled appointment gives its window back.
          ne(bookings.status, "cancelled"),
        ),
      );

    taken = rows.reduce((counts, row) => {
      const key = `${row.bookingDate}|${row.bookingTime}`;
      return counts.set(key, (counts.get(key) ?? 0) + 1);
    }, new Map<string, number>());
  } catch (error) {
    console.error("Failed to read booking availability:", error);
    // The form falls back to offering every window rather than showing a
    // number it cannot stand behind, so say so plainly instead of guessing --
    // and say that submitting still works, because it does.
    return json(
      {
        error:
          "We can't load open arrival windows right now. Pick a date and submit your request anyway, or call (248) 385-3432 and we'll check for you.",
      },
      { status: 503 },
    );
  }

  const days = [];
  for (let offset = 1; offset <= DAYS_AHEAD; offset += 1) {
    const date = addDays(today, offset);
    const weekday = dayOfWeek(date);
    if (weekday === 0) continue; // Closed Sundays.

    const windows = weekday === 6 ? SATURDAY_WINDOWS : WEEKDAY_WINDOWS;
    const slots = windows.map((window) => ({
      ...window,
      available: (taken.get(`${date}|${window.value}`) ?? 0) < WINDOW_CAPACITY,
    }));

    days.push({
      date,
      weekday,
      saturday: weekday === 6,
      slots,
      openCount: slots.filter((slot) => slot.available).length,
    });
  }

  return json({
    generatedAt: new Date().toISOString(),
    today,
    firstDate,
    lastDate,
    windows: { weekday: WEEKDAY_WINDOWS, saturday: SATURDAY_WINDOWS },
    days,
  });
};

export const config: Config = {
  path: "/api/booking/availability",
};
