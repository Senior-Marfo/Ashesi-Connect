import { z } from 'zod';
import { GRADE_SCALE, PROGRAMMES, TRACKS } from '../domain/programmes.js';
import { COURSE_CODE, SEMESTER } from '../imports/validate.js';

/** The same rules as the CSV import (imports/validate.ts), for one record at a time. */
export const studentDetailsSchema = z.object({
  fullName: z.string().trim().min(1, 'A name is required.').max(120, 'Names are at most 120 characters.'),
  programme: z.string().trim().toUpperCase().pipe(z.enum(PROGRAMMES, { message: `Choose a programme (${PROGRAMMES.join(', ')}).` })),
  yearGroup: z.number({ message: 'The year group must be a year.' }).int().min(2000).max(2100),
  track: z.string().trim().toLowerCase().pipe(z.enum(TRACKS, { message: `Choose a track (${TRACKS.join(', ')}).` }))
});

export const studentUpdateSchema = studentDetailsSchema.partial().refine(value => Object.keys(value).length > 0, { message: 'Change at least one field.' });

export const courseCodeSchema = z.string().trim().toUpperCase().transform(code => code.replace(/\s+/g, ' ').replace(/^([A-Z]+)(\d)/, '$1 $2'))
  .pipe(z.string().regex(COURSE_CODE, 'Course codes look like “CS 111”.'));

const attemptSchema = z.object({
  credits: z.number().positive().max(4).multipleOf(0.5, 'Credits go in steps of 0.5.'),
  status: z.enum(['COMPLETED', 'ENROLLED', 'INCOMPLETE']),
  grade: z.string().trim().toUpperCase().pipe(z.enum(GRADE_SCALE, { message: `Grades are ${GRADE_SCALE.join(', ')}.` })).optional(),
  semester: z.string().trim().regex(SEMESTER, 'Terms look like “2025 Fall”.').optional()
}).superRefine((attempt, context) => {
  if (attempt.status === 'COMPLETED' && !attempt.grade) context.addIssue({ code: 'custom', message: 'A completed attempt needs a grade.', path: ['grade'] });
  if (attempt.status !== 'COMPLETED' && attempt.grade) context.addIssue({ code: 'custom', message: `An attempt that is ${attempt.status.toLowerCase()} cannot have a grade.`, path: ['grade'] });
});

/** Attempts oldest first; the last one is the latest attempt. */
export const courseRecordSchema = z.object({
  attempts: z.array(attemptSchema).min(1, 'Add at least one attempt.').max(10, 'At most 10 attempts.')
    .refine(attempts => attempts.slice(0, -1).every(attempt => attempt.status === 'COMPLETED'), { message: 'Only the latest attempt can be in progress or incomplete.' })
});

export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue?.message ?? 'The record is not valid.';
}
