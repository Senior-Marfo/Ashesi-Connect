/** RFC 4180 CSV; cells starting with spreadsheet formula characters are prefixed so they stay text. */
export function toCsv(header: string[], rows: Array<Array<string | number | null>>): string {
  const cell = (value: string | number | null) => {
    const text = value === null ? '' : String(value);
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  return `﻿${[header, ...rows].map(row => row.map(cell).join(',')).join('\r\n')}\r\n`;
}
