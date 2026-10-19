const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/;
const DISPLAY_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function validDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function dateForDisplay(value: string): string {
  const match = ISO_DATE.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return validDate(Number(year), Number(month), Number(day)) ? `${day}/${month}/${year}` : value;
}

export function dateForStorage(value: string): string | null {
  const match = DISPLAY_DATE.exec(value);
  if (!match) return null;
  const [, day, month, year] = match;
  return validDate(Number(year), Number(month), Number(day)) ? `${year}-${month}-${day}` : null;
}

export function maskDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/");
}
