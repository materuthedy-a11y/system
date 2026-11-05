const SETTINGS_KEY = 'mizania.business-settings';

type DateSettings = { dateFormat?: string; timeFormat?: string; timezone?: string; language?: string; financialYear?: string; weekStartsOn?: string };

export function cacheBusinessDateSettings(settings: DateSettings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event('mizania-business-settings-updated'));
  } catch { /* Storage may be disabled. */ }
}

export function getBusinessLanguage() {
  const language = readSettings().language?.toLowerCase();
  return language === 'sw' || language === 'kiswahili' ? 'sw' : 'en';
}

export function getBusinessFinancialYear() {
  return readSettings().financialYear || 'CALENDAR';
}

export function getBusinessWeekStart() {
  return readSettings().weekStartsOn === 'SUNDAY' ? 'SUNDAY' : 'MONDAY';
}

function readSettings(): DateSettings {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}') as DateSettings; } catch { return {}; }
}

function safeTimeZone(value?: string) {
  if (!value) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value }).format(new Date(0));
    return value;
  } catch {
    return 'UTC';
  }
}

function getParts(value: string | Date, timezone?: string) {
  if (typeof value === 'string') {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) return { year: dateOnly[1], month: dateOnly[2], day: dateOnly[3] };
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: safeTimeZone(timezone), year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return { day: get('day'), month: get('month'), year: get('year') };
}

export function formatBusinessDate(value?: string | Date | null) {
  if (!value) return '—';
  const settings = readSettings();
  const parts = getParts(value, settings.timezone);
  if (!parts) return '—';
  const format = settings.dateFormat || 'DD/MM/YYYY';
  if (format === 'MM/DD/YYYY') return `${parts.month}/${parts.day}/${parts.year}`;
  if (format === 'YYYY-MM-DD') return `${parts.year}-${parts.month}-${parts.day}`;
  return `${parts.day}/${parts.month}/${parts.year}`;
}

export function formatBusinessDateTime(value?: string | Date | null) {
  if (!value) return '—';
  const settings = readSettings();
  const parts = getParts(value, settings.timezone);
  const date = value instanceof Date ? value : new Date(value);
  if (!parts || Number.isNaN(date.getTime())) return '—';
  const format = settings.timeFormat || '24';
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: safeTimeZone(settings.timezone), hour: '2-digit', minute: '2-digit', hourCycle: format === '12' ? 'h12' : 'h23',
  }).format(date);
  return `${formatBusinessDate(value)} ${time}`;
}
