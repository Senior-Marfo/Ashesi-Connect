import { describe, expect, it } from 'vitest';
import { csvRecords, parseCsv } from './csv.js';

describe('CSV parsing', () => {
  it('handles quotes, doubled quotes, commas and newlines inside fields, CRLF and a byte order mark', () => {
    expect(parseCsv('﻿a,"b, c","d ""e"""\r\n1,"multi\nline",3\n')).toEqual([['a', 'b, c', 'd "e"'], ['1', 'multi\nline', '3']]);
  });
  it('skips blank lines and keeps empty trailing fields', () => {
    expect(parseCsv('a,b\n\n1,\n')).toEqual([['a', 'b'], ['1', '']]);
  });
  it('rejects an unterminated quote', () => {
    expect(() => parseCsv('a,"b\n')).toThrow('UNTERMINATED_QUOTE');
  });
  it('normalises headers and trims values', () => {
    expect(csvRecords('Student ID, Full_Name\n 20280001 , Ama ')).toEqual({ headers: ['studentid', 'fullname'], records: [{ studentid: '20280001', fullname: 'Ama' }] });
  });
});
