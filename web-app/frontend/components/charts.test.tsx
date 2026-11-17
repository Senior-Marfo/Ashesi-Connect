import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ColumnChart, MeterList, StandingSplit } from './charts';

describe('charts', () => {
  it('meter lists print each figure and say when there is no data', () => {
    render(<MeterList label="Rates" rows={[{ key: 'a', label: 'Class of 2025', value: 87, max: 100, display: '87%' }, { key: 'b', label: 'Class of 2026', value: null, max: 100, display: '' }]} />);
    expect(screen.getByRole('list', { name: 'Rates' })).toBeInTheDocument();
    expect(screen.getByText('87%')).toBeInTheDocument();
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('standing split names every level with icon and count, and describes the bar for screen readers', () => {
    render(<StandingSplit counts={{ RED: 2, YELLOW: 3, GREEN: 15, UNDETERMINED: 0 }} />);
    expect(screen.getByRole('img', { name: '2 critical, 3 at risk, 15 on track' })).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Not determined')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.queryByText('10%')).not.toBeInTheDocument();
  });

  it('column charts keep categories in order with values on each cap', () => {
    render(<ColumnChart label="Grades" data={[{ key: 'A', value: 4 }, { key: 'B', value: 0 }]} />);
    expect(screen.getByRole('img', { name: 'Grades: A 4, B 0' })).toBeInTheDocument();
  });
});
