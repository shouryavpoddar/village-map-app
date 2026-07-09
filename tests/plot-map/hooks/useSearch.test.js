import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearch } from '../../../src/plot-map/hooks/useSearch';

const plots = [
  { id: 101, label: 'North Field' },
  { id: 102, label: 'South Field' },
  { id: 205, label: '' },
];

function setup(selectPlot = vi.fn()) {
  const plotsRef = { current: plots };
  const { result } = renderHook(() => useSearch({ plotsRef, selectPlot }));
  return { result, selectPlot };
}

describe('useSearch', () => {
  it('matches by id or by label, case-insensitively', () => {
    const { result } = setup();

    act(() => result.current.setQuery('north'));
    expect(result.current.matches.map((p) => p.id)).toEqual([101]);

    act(() => result.current.setQuery('205'));
    expect(result.current.matches.map((p) => p.id)).toEqual([205]);
  });

  it('clears matches for a blank query', () => {
    const { result } = setup();
    act(() => result.current.setQuery('field'));
    expect(result.current.matches.length).toBeGreaterThan(0);

    act(() => result.current.setQuery('   '));
    expect(result.current.matches).toEqual([]);
  });

  it('Enter selects the first match and clears the list', () => {
    const { result, selectPlot } = setup();
    act(() => result.current.setQuery('field'));

    act(() => result.current.handleSearchKeyDown({ key: 'Enter' }));

    expect(selectPlot).toHaveBeenCalledWith(plots[0]);
    expect(result.current.matches).toEqual([]);
  });

  it('picking a match selects it and fills the query with its label', () => {
    const { result, selectPlot } = setup();
    act(() => result.current.setQuery('south'));

    act(() => result.current.handlePickMatch(plots[1]));

    expect(selectPlot).toHaveBeenCalledWith(plots[1]);
    expect(result.current.query).toBe('South Field');
    // setQuery re-runs the match effect against the now-full-label query,
    // so the picked plot (which still matches its own label) reappears —
    // handlePickMatch's setMatches([]) only clears the stale list for a tick.
    expect(result.current.matches).toEqual([plots[1]]);
  });
});
