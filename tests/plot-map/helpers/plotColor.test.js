import { describe, it, expect } from 'vitest';
import { withOpacity, effectiveColor, summarizeGroups } from '../../../src/plot-map/helpers/plotColor';

describe('withOpacity', () => {
  it('converts a 6-digit hex color to rgba', () => {
    expect(withOpacity('#AEBA97', 0.4)).toBe('rgba(174, 186, 151, 0.4)');
  });

  it('expands 3-digit shorthand hex before converting', () => {
    // #abc -> #aabbcc
    expect(withOpacity('#abc', 1)).toBe('rgba(170, 187, 204, 1)');
  });
});

describe('effectiveColor', () => {
  const basePlot = { color: '#AEBA97', hasCustomColor: false };

  it('falls back to the translucent palette color when nothing else applies', () => {
    expect(effectiveColor(basePlot, new Set())).toBe(withOpacity('#AEBA97', 0.35));
  });

  it('prefers a solid custom color over the translucent default', () => {
    const plot = { ...basePlot, color: '#112233', hasCustomColor: true };
    expect(effectiveColor(plot, new Set())).toBe('#112233');
  });

  it('prefers a visible group tint over both the custom color and the default', () => {
    const plot = {
      ...basePlot,
      color: '#112233',
      hasCustomColor: true,
      groups: [{ name: 'Road', color: '#ff0000' }],
    };
    expect(effectiveColor(plot, new Set(['Road']))).toBe(withOpacity('#ff0000', 0.4));
  });

  it('ignores a group the plot belongs to if that group is not toggled visible', () => {
    const plot = {
      ...basePlot,
      hasCustomColor: false,
      groups: [{ name: 'Road', color: '#ff0000' }],
    };
    // "Road" exists but isn't in the visible set, so this should fall through
    // to the plain default rather than tinting with the hidden group's color
    expect(effectiveColor(plot, new Set(['SomeOtherGroup']))).toBe(withOpacity('#AEBA97', 0.35));
  });

  it('picks whichever of several groups is currently visible', () => {
    const plot = {
      ...basePlot,
      groups: [{ name: 'Road', color: '#ff0000' }, { name: 'River', color: '#0000ff' }],
    };
    expect(effectiveColor(plot, new Set(['River']))).toBe(withOpacity('#0000ff', 0.4));
  });
});

describe('summarizeGroups', () => {
  it('counts how many plots belong to each group', () => {
    const plots = [
      { id: 1, groups: [{ name: 'Road', color: '#ff0000' }] },
      { id: 2, groups: [{ name: 'Road', color: '#ff0000' }] },
      { id: 3, groups: [{ name: 'River', color: '#0000ff' }] },
    ];
    expect(summarizeGroups(plots)).toEqual([
      { name: 'Road', color: '#ff0000', count: 2 },
      { name: 'River', color: '#0000ff', count: 1 },
    ]);
  });

  it('ignores plots with no groups at all', () => {
    const plots = [{ id: 1 }, { id: 2, groups: [] }];
    expect(summarizeGroups(plots)).toEqual([]);
  });

  it('lets one plot contribute to multiple group counts', () => {
    const plots = [
      { id: 1, groups: [{ name: 'Road', color: '#ff0000' }, { name: 'River', color: '#0000ff' }] },
    ];
    expect(summarizeGroups(plots)).toEqual([
      { name: 'Road', color: '#ff0000', count: 1 },
      { name: 'River', color: '#0000ff', count: 1 },
    ]);
  });
});
