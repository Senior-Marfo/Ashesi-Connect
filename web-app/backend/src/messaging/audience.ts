import { assessAll } from '../eligibility/standings.js';
import type { MessageAudience, Repositories } from '../repositories/types.js';

/** Student IDs the audience covers today; unknown IDs in an explicit list are reported, not sent to. */
export async function resolveAudience(audience: MessageAudience, repositories: Repositories, today: Date): Promise<{ recipients: string[]; unknownIds: string[] }> {
  switch (audience.kind) {
    case 'ALL_STUDENTS':
      return { recipients: (await repositories.students.list({})).map(student => student.studentId), unknownIds: [] };
    case 'PROGRAMME':
      return { recipients: (await repositories.students.list({ programme: audience.programme })).map(student => student.studentId), unknownIds: [] };
    case 'YEAR_GROUP':
      return { recipients: (await repositories.students.list({ yearGroup: audience.yearGroup })).map(student => student.studentId), unknownIds: [] };
    case 'STANDING': {
      const students = await repositories.students.list({});
      const assessed = await assessAll(students, repositories, today);
      return { recipients: students.filter(student => assessed.get(student.studentId)?.assessment.standing?.level === audience.standing).map(student => student.studentId), unknownIds: [] };
    }
    case 'STUDENTS': {
      const unique = [...new Set(audience.studentIds)];
      const found = await Promise.all(unique.map(id => repositories.students.findById(id)));
      return { recipients: unique.filter((_, index) => found[index]), unknownIds: unique.filter((_, index) => !found[index]) };
    }
  }
}
