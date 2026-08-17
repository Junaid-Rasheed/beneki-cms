'use strict';

/**
 * France DPD delivery forecast — mirrors storefront Checkout / Cart / ProductDetail.
 * All calendar math uses Europe/Paris date keys (YYYY-MM-DD).
 */

const FRANCE_BASE_RANGE = '1–2 days';

/** Département prefixes with 1-day delivery (same list as storefront). */
const FRANCE_ONE_DAY_ZIP_CODES = [
  '01', '03', '21', '71', '58', '89', '39', '25', '70', '90', '08', '51', '10',
  '52', '55', '54', '57', '67', '68', '75', '77', '78', '91', '92', '93', '94',
  '95', '59', '62', '80', '60', '02', '76', '27', '14', '50', '61', '18', '45',
  '28', '41', '37', '35', '22', '29', '56', '72', '53', '49', '44', '69', '74',
  '73', '38', '26', '07', '43', '63', '15', '84', '13', '83', '34',
];

const WEEKDAY_SHORT_TO_INDEX = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function toParisDateKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function parisWeekdayIndex(date) {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    weekday: 'short',
  }).format(date);
  return WEEKDAY_SHORT_TO_INDEX[short] ?? date.getUTCDay();
}

function parisHoursMinutes(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(
    parts.find((p) => p.type === 'minute')?.value || '0',
    10
  );
  return {
    hours: Number.isNaN(hour) ? 0 : hour,
    minutes: Number.isNaN(minute) ? 0 : minute,
  };
}

function weekdayFromDateKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function addCalendarDaysToKey(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function parseCutoff(cutoffTimeStr) {
  const raw = String(cutoffTimeStr || '15:00:00');
  const [h, min] = raw.split(':');
  const hours = parseInt(h, 10);
  const minutes = parseInt(min || '0', 10);
  return {
    hours: Number.isNaN(hours) ? 15 : hours,
    minutes: Number.isNaN(minutes) ? 0 : minutes,
  };
}

function normalizeWorkingDays(workingDays) {
  if (!Array.isArray(workingDays)) return new Set();
  const normalized = workingDays
    .map((d) => (typeof d === 'number' ? d : parseInt(d, 10)))
    .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 6);
  return new Set(normalized);
}

function isWorkingDateKey(dateKey, holidaySet, workingDaysSet) {
  const isHoliday = holidaySet.has(dateKey);
  const weekday = weekdayFromDateKey(dateKey);
  const working =
    workingDaysSet?.size > 0
      ? workingDaysSet.has(weekday)
      : weekday !== 0 && weekday !== 6;
  return working && !isHoliday;
}

function addBusinessDaysFromKey(dateKey, days, holidaySet, workingDaysSet) {
  let result = dateKey;
  let added = 0;
  while (added < days) {
    result = addCalendarDaysToKey(result, 1);
    if (isWorkingDateKey(result, holidaySet, workingDaysSet)) {
      added += 1;
    }
  }
  return result;
}

function getFranceRangeForPostalCode(postalCode) {
  if (!postalCode) return FRANCE_BASE_RANGE;
  const zipPrefix = postalCode.toString().substring(0, 2).padStart(2, '0');
  if (FRANCE_ONE_DAY_ZIP_CODES.includes(zipPrefix)) {
    return '1 day';
  }
  return FRANCE_BASE_RANGE;
}

function parseRangeDays(range) {
  const dayMatches = [...String(range || '').matchAll(/\d+/g)].map((m) =>
    parseInt(m[0], 10)
  );
  const minBusinessDays = dayMatches.length > 0 ? Math.min(...dayMatches) : 2;
  const maxBusinessDays =
    dayMatches.length > 0 ? Math.max(...dayMatches) : minBusinessDays;
  return { minBusinessDays, maxBusinessDays };
}

/**
 * Expected delivery window for a France order placed at `orderDate`.
 * @returns {{ range, deliveryDateMin, deliveryDateMax, shipStartDate } | null}
 */
function computeFranceDeliveryForecast(orderDate, postalCode, config) {
  if (!orderDate) return null;

  const when = orderDate instanceof Date ? orderDate : new Date(orderDate);
  if (Number.isNaN(when.getTime())) return null;

  const holidaySet = config?.holidaySet || new Set();
  const workingDaysSet = config?.workingDaysSet || new Set();
  const cutoff = config?.cutoff || { hours: 15, minutes: 0 };

  const range = getFranceRangeForPostalCode(postalCode);
  const { minBusinessDays, maxBusinessDays } = parseRangeDays(range);

  const orderDateKey = toParisDateKey(when);
  const { hours, minutes } = parisHoursMinutes(when);
  const orderMinutes = hours * 60 + minutes;
  const cutoffMinutes = cutoff.hours * 60 + cutoff.minutes;

  // alreadyWithCarrier: parcel is already at DPD — skip checkout cutoff.
  const alreadyWithCarrier = Boolean(config?.alreadyWithCarrier);
  const canShipSameDay = alreadyWithCarrier
    ? isWorkingDateKey(orderDateKey, holidaySet, workingDaysSet)
    : isWorkingDateKey(orderDateKey, holidaySet, workingDaysSet) &&
      orderMinutes <= cutoffMinutes;

  const shipStartDate = canShipSameDay
    ? orderDateKey
    : addBusinessDaysFromKey(orderDateKey, 1, holidaySet, workingDaysSet);

  const deliveryDateMin = addBusinessDaysFromKey(
    shipStartDate,
    minBusinessDays,
    holidaySet,
    workingDaysSet
  );
  const deliveryDateMax = addBusinessDaysFromKey(
    shipStartDate,
    maxBusinessDays,
    holidaySet,
    workingDaysSet
  );

  return {
    range,
    shipStartDate,
    deliveryDateMin,
    deliveryDateMax,
  };
}

function calendarDaysBetween(fromKey, toKey) {
  const [y1, m1, d1] = fromKey.split('-').map(Number);
  const [y2, m2, d2] = toKey.split('-').map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.floor((b - a) / 86400000);
}

function isPastExpectedDelivery(deliveryDateMax, now = new Date()) {
  if (!deliveryDateMax) return false;
  const todayKey = toParisDateKey(now);
  return todayKey > deliveryDateMax;
}

module.exports = {
  FRANCE_ONE_DAY_ZIP_CODES,
  FRANCE_BASE_RANGE,
  toParisDateKey,
  parisWeekdayIndex,
  parseCutoff,
  normalizeWorkingDays,
  getFranceRangeForPostalCode,
  computeFranceDeliveryForecast,
  calendarDaysBetween,
  isPastExpectedDelivery,
};
