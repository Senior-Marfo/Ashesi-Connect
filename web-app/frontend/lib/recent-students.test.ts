import { describe, expect, it } from 'vitest';
import { forgetRecentStudents, loadRecentStudents, rememberStudent } from './recent-students';

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value); },
    removeItem: (key: string) => { items.delete(key); }
  };
}

describe('recent students', () => {
  it('keeps the six most recently opened records, newest first and without duplicates', () => {
    const storage = memoryStorage();
    for (let i = 1; i <= 7; i++) rememberStudent({ studentId: `2028000${i}`, fullName: `Student ${i}` }, storage);
    rememberStudent({ studentId: '20280004', fullName: 'Student 4' }, storage);
    expect(loadRecentStudents(storage).map(entry => entry.studentId)).toEqual(['20280004', '20280007', '20280006', '20280005', '20280003', '20280002']);
  });

  it('stores only the ID and name', () => {
    const storage = memoryStorage();
    rememberStudent({ studentId: '20280001', fullName: 'Ama', programme: 'CS' } as never, storage);
    expect(JSON.parse(storage.getItem('agt.recent-students')!)).toEqual([{ studentId: '20280001', fullName: 'Ama' }]);
  });

  it('ignores corrupt or foreign data and survives storage that refuses writes', () => {
    expect(loadRecentStudents(memoryStorage({ 'agt.recent-students': '{oops' }))).toEqual([]);
    expect(loadRecentStudents(memoryStorage({ 'agt.recent-students': '[{"studentId":1},{"studentId":"2028","fullName":"Ok"}]' }))).toEqual([{ studentId: '2028', fullName: 'Ok' }]);
    const refusing = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); } };
    expect(rememberStudent({ studentId: '20280001', fullName: 'Ama' }, refusing)).toEqual([{ studentId: '20280001', fullName: 'Ama' }]);
    expect(loadRecentStudents(undefined)).toEqual([]);
  });

  it('clears the list', () => {
    const storage = memoryStorage();
    rememberStudent({ studentId: '20280001', fullName: 'Ama' }, storage);
    forgetRecentStudents(storage);
    expect(loadRecentStudents(storage)).toEqual([]);
  });
});
