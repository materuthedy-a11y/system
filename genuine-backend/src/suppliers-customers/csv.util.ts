export function csvCell(raw: unknown): string {
  let value: string;
  if (raw === null || raw === undefined) value = '';
  else if (raw instanceof Date) value = raw.toISOString();
  else value = String(raw);
  if (typeof raw !== 'number' && /^[=+@\-\t\r]/.test(value)) value = `'${value}`;
  return `"${value.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) lines.push(headers.map((header) => csvCell(row[header])).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}
