/** Shared, accessible colors and formatting for signed business changes. */
export function signedChangeClass(value: number): string {
  if (value > 0) return 'font-semibold text-emerald-700 dark:text-emerald-300';
  if (value < 0) return 'font-semibold text-rose-700 dark:text-rose-300';
  return 'font-semibold text-[#30332e] dark:text-[#e1e4dc]';
}

export function formatSignedChange(value: number, maximumFractionDigits = 4): string {
  const formatted = Math.abs(value).toLocaleString(undefined, { maximumFractionDigits });
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}
