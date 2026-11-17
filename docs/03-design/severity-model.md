# Severity (standing) model

Students see their standing, and the Registry sees it in the register. It is **advisory**: it assumes courses in progress will be passed, and it is never an official graduation decision. The logic lives in `web-app/backend/src/domain/eligibility/standing.ts`.

## Inputs

- **The programme audit** (`evaluateProgramme`): the remaining requirements, each with a reason (`NOT_TAKEN`, `FAILED`, `IN_PROGRESS`, `INCOMPLETE`, `ELECTIVE_SLOT_OPEN`, `AFRICAN_STUDIES_MISSING`, `CREDIT_SHORTFALL`), credits earned and credits required.
- **Credits in progress:** every course whose latest attempt is under way this term.
- **Terms remaining:** whole terms after the current one, up to and including Spring of the student's year group (`terms.ts`). Fall runs August–December and Spring January–May.

**Credits outstanding** = credits required − credits earned − credits in progress. These are the credits still to start.

## Levels

| Level | Shown as | When |
|---|---|---|
| GREEN | On track / requirements met | Nothing remains, or only courses in progress remain, or the outstanding credits fit the remaining terms at the normal load, with no failed or incomplete course to resolve. |
| YELLOW | At risk | Any of: a required course failed and not yet retaken (`FAILED_COURSE_TO_RETAKE`), an incomplete course (`INCOMPLETE_TO_RESOLVE`), or finishing on time needs more than the normal load per term (`HEAVY_LOAD_NEEDED`). |
| RED | Critical | Any of: the outstanding credits exceed the maximum load for every remaining term (`CANNOT_FINISH_IN_TIME`); the expected graduation term has passed with requirements left (`PAST_EXPECTED_GRADUATION`); or at least the critical number of required courses have failed and not been retaken (`MULTIPLE_FAILED_COURSES`). |

Each standing lists every reason that applies, so the screens can explain it in plain language.

## Thresholds

| Setting | Default | Meaning |
|---|---|---|
| `normalLoad` | 5 credits per term | Above this rate the standing is YELLOW |
| `maxLoad` | 6 credits per term | Above this rate the standing is RED |
| `criticalFailedCourses` | 3 | Failed, not-yet-retaken required courses that make the standing RED |

The defaults are in `DEFAULT_STANDING_CONFIG`. The admin settings screen (planned) will make them configurable.

## Which curriculum is used

- **Real students:** only a Registry-reviewed, issue-free curriculum for their programme, track and cohort. Without one, standing is not shown.
- **Synthetic students** (`synthetic: true`): the illustrative rules in `src/seed/synthetic-curriculum.ts`, which match the synthetic course plans. Responses report `curriculumBasis: "SYNTHETIC"`, and the screens label it. Synthetic rules are never applied to real students.

## Known limits

- Course pass marks for real programmes await Registry confirmation (`requirements-discrepancies.md`).
- Standing doesn't model course prerequisites or term-specific course offerings.
