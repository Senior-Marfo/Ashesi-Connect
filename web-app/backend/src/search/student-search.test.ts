import { describe, expect, it } from 'vitest';
import type { StudentSummary } from '../repositories/types.js';
import { editDistance, searchStudents } from './student-search.js';

const student = (studentId: string, fullName: string): StudentSummary => ({ studentId, fullName, programme: 'CS', yearGroup: 2028, track: 'standard' });
const students = [
  student('20280001', 'Akosua Mensah'),
  student('20280002', 'Kwame Owusu-Ansah'),
  student('20280013', 'Ama Boateng'),
  student('20270104', 'Kofi Ama-Darko'),
  student('20290001', 'Efua Adomako')
];
const ids = (query: string) => searchStudents(students, query, 10).map(match => `${match.studentId}:${match.match}`);

describe('editDistance', () => {
  it('counts insertions, deletions, substitutions and adjacent transpositions as one edit each', () => {
    expect(editDistance('20280001', '20280001')).toBe(0);
    expect(editDistance('20280001', '20280007')).toBe(1);
    expect(editDistance('20280001', '22080001')).toBe(1);
    expect(editDistance('2028001', '20280001')).toBe(1);
    expect(editDistance('mensah', 'mesnha')).toBe(2);
    expect(editDistance('', 'abc')).toBe(3);
  });
});

describe('searchStudents', () => {
  it('ranks an exact ID first, then other IDs with that prefix', () => {
    expect(ids('20280001')).toEqual(['20280001:ID']);
    expect(ids('2028')).toEqual(['20280001:ID', '20280002:ID', '20280013:ID']);
  });

  it('finds IDs with one typo once six characters are typed, and never for shorter fragments', () => {
    expect(ids('20208001')).toEqual(['20280001:CLOSE_ID']);
    expect(ids('2029001')).toEqual(['20280013:CLOSE_ID', '20290001:CLOSE_ID']);
    expect(ids('2028001')).toEqual(['20280013:ID']);
    expect(ids('20290')).toEqual(['20290001:ID']);
    expect(ids('20390')).toEqual([]);
    expect(ids('20381234')).toEqual([]);
  });

  it('matches names by word prefix, ignoring case and accents, with every word required', () => {
    expect(ids('ama')).toEqual(['20270104:NAME', '20280013:NAME']);
    expect(ids('AMA boa')).toEqual(['20280013:NAME']);
    expect(ids('owusu')).toEqual(['20280002:NAME']);
    expect(ids('Éfua')).toEqual(['20290001:NAME']);
  });

  it('tolerates small typos in longer name words, ranked after exact name matches', () => {
    expect(ids('mensha')).toEqual(['20280001:CLOSE_NAME']);
    expect(ids('adomkao')).toEqual(['20290001:CLOSE_NAME']);
    expect(ids('kwmae')).toEqual(['20280002:CLOSE_NAME']);
    expect(ids('abc')).toEqual([]);
    expect(ids('zzzzzz')).toEqual([]);
  });

  it('returns nothing for an empty query and respects the limit', () => {
    expect(ids('  ')).toEqual([]);
    expect(searchStudents(students, '20', 2)).toHaveLength(2);
  });
});
