/** Strict RFC 4180 parser: quoted fields, doubled quotes, CRLF or LF; a byte order mark is ignored. */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"' && field === '') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (quoted) throw new Error('UNTERMINATED_QUOTE');
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(cells => cells.some(cell => cell.trim() !== ''));
}

/** Rows keyed by normalised header ("Student ID" → "studentid"). */
export function csvRecords(text: string): { headers: string[]; records: Array<Record<string, string>> } {
  const [header = [], ...body] = parseCsv(text);
  const headers = header.map(name => name.trim().toLowerCase().replace(/[\s_-]+/g, ''));
  return { headers, records: body.map(cells => Object.fromEntries(headers.map((name, index) => [name, (cells[index] ?? '').trim()]))) };
}
