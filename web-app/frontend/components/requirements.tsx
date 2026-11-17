'use client';
import { useMemo, useState } from 'react';
import type { Eligibility, RequirementGroup, RequirementState } from '../lib/api';
import { reasonLabels, stateLabels } from '../lib/labels';
import { currentTermOrdinal, termName } from '../lib/terms';

const STATE_CLASS: Record<RequirementState, string> = { COMPLETED: 'completed', IN_PROGRESS: 'enrolled', FAILED: 'incomplete', INCOMPLETE: 'incomplete', NOT_STARTED: '' };
const FILTERS: Array<RequirementState | 'ALL'> = ['ALL', 'COMPLETED', 'IN_PROGRESS', 'NOT_STARTED', 'FAILED', 'INCOMPLETE'];

function GroupMeter({ group }: { group: RequirementGroup }) {
  const done = Math.min(100, (group.creditsCompleted / Math.max(group.creditsRequired, 0.01)) * 100);
  const pending = Math.min(100 - done, (group.creditsInProgress / Math.max(group.creditsRequired, 0.01)) * 100);
  return (
    <span className="group-meter" aria-hidden="true">
      <span className="done" style={{ width: `${done}%` }} />
      <span className="pending" style={{ width: `${pending}%` }} />
    </span>
  );
}

/** US-03: the whole requirement tree, searchable and filterable by state. */
export function RequirementTree({ groups }: { groups: RequirementGroup[] }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RequirementState | 'ALL'>('ALL');
  const term = search.trim().toUpperCase();
  const visible = useMemo(() => groups.map(group => ({
    ...group,
    items: group.items.filter(item => (filter === 'ALL' || item.state === filter) && (!term || item.code.toUpperCase().includes(term)))
  })), [groups, filter, term]);
  const counts = useMemo(() => {
    const tally: Record<string, number> = { ALL: 0 };
    for (const item of groups.flatMap(group => group.items)) {
      tally.ALL += 1;
      tally[item.state] = (tally[item.state] ?? 0) + 1;
    }
    return tally;
  }, [groups]);

  return (
    <div className="tree">
      <div className="tree-tools">
        <label className="field">Find a course
          <input className="input mono" value={search} onChange={event => setSearch(event.target.value)} placeholder="e.g. CS 2" />
        </label>
        <div className="chips" role="group" aria-label="Show">
          {FILTERS.map(state => (
            <button key={state} type="button" className="filter-chip" aria-pressed={filter === state} onClick={() => setFilter(state)}>
              {state === 'ALL' ? 'All' : stateLabels[state]} <span className="muted">{counts[state] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>
      {visible.map(group => {
        const electiveSlots = group.kind === 'ELECTIVE' ? Math.max(0, group.creditsRequired - group.creditsCompleted - group.creditsInProgress) : 0;
        if (group.items.length === 0 && (filter !== 'ALL' && filter !== 'NOT_STARTED' || term || electiveSlots === 0)) return null;
        return (
          <details key={group.category} className="tree-group" open>
            <summary>
              <span className="tree-title">{group.category}{group.kind === 'ELECTIVE' && <span className="tag">Elective</span>}</span>
              <span className="tree-credits">{group.creditsCompleted} of {group.creditsRequired} credits</span>
              <GroupMeter group={group} />
            </summary>
            <ul className="tree-items">
              {group.items.map(item => (
                <li key={item.code}>
                  <span className="mono code">{item.code}</span>
                  <span className={`chip ${STATE_CLASS[item.state]}`}>{stateLabels[item.state]}</span>
                  <span className="muted">{item.grade ? `Grade ${item.grade}` : ''}{item.attempts > 1 ? ` · ${item.attempts} attempts` : ''}</span>
                  <span className="muted min">Pass mark {item.minimumGrade}</span>
                  <span className="num">{item.credits} cr</span>
                </li>
              ))}
              {electiveSlots > 0 && (filter === 'ALL' || filter === 'NOT_STARTED') && !term && (
                <li className="slot">
                  <span>{electiveSlots} credit{electiveSlots === 1 ? '' : 's'} still to choose</span>
                  <span className="muted">Options: {group.options.join(', ')}</span>
                </li>
              )}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

interface PlannedItem { code: string; label: string; credits: number; reason: keyof typeof reasonLabels; term: string }

/** US-04: everything left, in a suggested order, spread over the coming terms at a normal load. */
export function RemainingPlan({ eligibility, today = new Date(), normalLoad = 5 }: { eligibility: Eligibility; today?: Date; normalLoad?: number }) {
  const remaining = eligibility.audit?.remainingRequirements ?? [];
  const inProgress = remaining.filter(item => item.reason === 'IN_PROGRESS');
  const priority: Record<string, number> = { FAILED: 0, INCOMPLETE: 1, NOT_TAKEN: 2, ELECTIVE_SLOT_OPEN: 3, AFRICAN_STUDIES_MISSING: 4 };
  const toPlan = remaining.filter(item => item.reason in priority).sort((a, b) => priority[a.reason] - priority[b.reason]);
  const graduation = eligibility.expectedGraduation;
  let ordinal = currentTermOrdinal(today) + 1;
  let load = 0;
  const planned: PlannedItem[] = toPlan.map(item => {
    const credits = Math.max(item.credits, 0.5);
    if (load + credits > normalLoad && load > 0) { ordinal += 1; load = 0; }
    load += credits;
    return { code: item.code, label: item.reason === 'ELECTIVE_SLOT_OPEN' ? `${item.category}: ${item.credits} credit${item.credits === 1 ? '' : 's'}` : item.code, credits: item.credits, reason: item.reason, term: termName(ordinal) };
  });
  const terms = [...new Set(planned.map(item => item.term))];
  const shortfall = remaining.find(item => item.reason === 'CREDIT_SHORTFALL');

  if (remaining.length === 0) return <p className="empty">Nothing remains. Every listed requirement is met.</p>;
  return (
    <div className="plan">
      {inProgress.length > 0 && (
        <section className="plan-term">
          <h3>This term <span className="muted">in progress</span></h3>
          <ul>{inProgress.map(item => <li key={item.code}><span className="mono">{item.code}</span><span>{reasonLabels.IN_PROGRESS}</span><span className="num">{item.credits} cr</span></li>)}</ul>
        </section>
      )}
      {terms.map(term => (
        <section key={term} className="plan-term">
          <h3>{term}{graduationAfter(term, graduation) && <span className="tag late">After expected graduation</span>}</h3>
          <ul>
            {planned.filter(item => item.term === term).map(item => (
              <li key={`${item.code}-${item.reason}`}><span className={item.reason === 'ELECTIVE_SLOT_OPEN' ? undefined : 'mono'}>{item.label}</span><span>{reasonLabels[item.reason]}</span><span className="num">{item.credits} cr</span></li>
            ))}
          </ul>
        </section>
      ))}
      {shortfall && <p className="caption">Overall you are {shortfall.credits} credits short of the {eligibility.audit?.creditsRequired} required, counting only completed courses.</p>}
      <p className="caption">Suggested placement at about {normalLoad} credits a term, retakes first. Check course offerings and prerequisites with your advisor.</p>
    </div>
  );
}

function graduationAfter(term: string, graduation: string): boolean {
  const ordinal = (name: string) => { const [year, season] = name.split(' '); return Number(year) * 2 + (season === 'Fall' ? 1 : 0); };
  return ordinal(term) > ordinal(graduation);
}
