/**
 * Timezone-safe local date utilities.
 *
 * CRITICAL RULE: Never use `new Date().toISOString().split('T')[0]`
 * to obtain local calendar dates, as UTC conversion can shift the date
 * backwards or forwards depending on the user's timezone offset!
 */

export interface CalendarCell {
  date: Date;
  dateStr: string; // YYYY-MM-DD in local time
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

/**
 * Formats a Date object as YYYY-MM-DD strictly in the local device timezone.
 */
export function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string into a local Date object set to 00:00:00 local time.
 */
export function parseLocalDate(dateStr: string): Date {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  return new Date(year, month, day, 0, 0, 0, 0);
}

/**
 * Checks if two local dates represent the exact same calendar day.
 */
export function isSameLocalDate(dateA: Date, dateB: Date): boolean {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

/**
 * Returns the number of days in the specified month (month is 0-indexed).
 * Correctly accounts for leap years (e.g. Feb 2024 has 29, Feb 2025 has 28).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Returns the starting day of the week for the first day of the month (0 = Sun, 6 = Sat).
 */
export function getStartingDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/**
 * Generates the full 35 or 42 grid cells for the given month, including
 * leading days from the previous month and trailing days from the next month.
 */
export function generateMonthGrid(year: number, month: number, today = new Date()): CalendarCell[] {
  const cells: CalendarCell[] = [];
  const todayStr = formatLocalDate(today);

  const startingDayOfWeek = getStartingDayOfWeek(year, month);
  const daysInCurrentMonth = getDaysInMonth(year, month);
  const daysInPrevMonth = getDaysInMonth(year, month - 1);

  // 1. Previous month leading days
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const dayNumber = daysInPrevMonth - i;
    const d = new Date(year, month - 1, dayNumber, 0, 0, 0, 0);
    const dateStr = formatLocalDate(d);
    cells.push({
      date: d,
      dateStr,
      dayNumber,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  // 2. Current month days
  for (let day = 1; day <= daysInCurrentMonth; day++) {
    const d = new Date(year, month, day, 0, 0, 0, 0);
    const dateStr = formatLocalDate(d);
    cells.push({
      date: d,
      dateStr,
      dayNumber: day,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
    });
  }

  // 3. Next month trailing days to complete grid in multiples of 7
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let day = 1; day <= remaining; day++) {
    const d = new Date(year, month + 1, day, 0, 0, 0, 0);
    const dateStr = formatLocalDate(d);
    cells.push({
      date: d,
      dateStr,
      dayNumber: day,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  return cells;
}

/**
 * Navigate to previous month.
 */
export function goToPreviousMonth(current: Date): Date {
  return new Date(current.getFullYear(), current.getMonth() - 1, 1);
}

/**
 * Navigate to next month.
 */
export function goToNextMonth(current: Date): Date {
  return new Date(current.getFullYear(), current.getMonth() + 1, 1);
}

/**
 * Navigate to current month / today.
 */
export function goToToday(): Date {
  return new Date();
}

/**
 * Formats a date string for display (e.g., "Saturday, 26 September 2026").
 */
export function formatDisplayDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
