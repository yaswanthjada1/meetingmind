import assert from 'node:assert';
import test from 'node:test';
import {
  formatLocalDate,
  parseLocalDate,
  isSameLocalDate,
  getDaysInMonth,
  getStartingDayOfWeek,
  generateMonthGrid,
  goToPreviousMonth,
  goToNextMonth,
} from './dateUtils';

test('formatLocalDate formats in local timezone without UTC shift', () => {
  const d = new Date(2026, 8, 26, 23, 59, 0); // 26 Sept 2026 23:59 local
  assert.strictEqual(formatLocalDate(d), '2026-09-26');
});

test('parseLocalDate creates date at midnight local time', () => {
  const d = parseLocalDate('2026-09-26');
  assert.strictEqual(d.getFullYear(), 2026);
  assert.strictEqual(d.getMonth(), 8); // 0-indexed September
  assert.strictEqual(d.getDate(), 26);
  assert.strictEqual(d.getHours(), 0);
});

test('isSameLocalDate accurately compares dates regardless of hours', () => {
  const d1 = new Date(2026, 8, 26, 8, 30);
  const d2 = new Date(2026, 8, 26, 22, 15);
  const d3 = new Date(2026, 8, 27, 1, 0);
  assert.strictEqual(isSameLocalDate(d1, d2), true);
  assert.strictEqual(isSameLocalDate(d1, d3), false);
});

test('getDaysInMonth handles 30, 31, and leap years', () => {
  assert.strictEqual(getDaysInMonth(2026, 8), 30); // Sept
  assert.strictEqual(getDaysInMonth(2026, 7), 31); // Aug
  assert.strictEqual(getDaysInMonth(2026, 1), 28); // Feb 2026 non-leap
  assert.strictEqual(getDaysInMonth(2024, 1), 29); // Feb 2024 leap year
});

test('month navigation correctly transitions across year boundaries', () => {
  const jan2026 = new Date(2026, 0, 15);
  const prev = goToPreviousMonth(jan2026);
  assert.strictEqual(prev.getFullYear(), 2025);
  assert.strictEqual(prev.getMonth(), 11); // December 2025

  const dec2025 = new Date(2025, 11, 20);
  const next = goToNextMonth(dec2025);
  assert.strictEqual(next.getFullYear(), 2026);
  assert.strictEqual(next.getMonth(), 0); // January 2026
});

test('generateMonthGrid returns full weeks (multiples of 7) with accurate day numbers', () => {
  const grid = generateMonthGrid(2026, 8, new Date(2026, 8, 26)); // Sept 2026
  assert.strictEqual(grid.length % 7, 0);
  assert.ok(grid.length >= 35);

  const currentMonthDays = grid.filter((c) => c.isCurrentMonth);
  assert.strictEqual(currentMonthDays.length, 30);

  const todayCell = grid.find((c) => c.dateStr === '2026-09-26');
  assert.ok(todayCell);
  assert.strictEqual(todayCell.isToday, true);
  assert.strictEqual(todayCell.dayNumber, 26);
});
