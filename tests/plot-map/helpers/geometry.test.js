import { describe, it, expect } from 'vitest';
import { shoelaceArea, centroidOf, bboxOf, pointInPolygon } from '../../../src/plot-map/helpers/geometry';

describe('shoelaceArea', () => {
  it('computes the area of an axis-aligned square', () => {
    expect(shoelaceArea([[0, 0], [4, 0], [4, 4], [0, 4]])).toBe(16);
  });

  it('computes the area of a right triangle', () => {
    expect(shoelaceArea([[0, 0], [4, 0], [0, 3]])).toBe(6);
  });

  it('is unaffected by winding direction', () => {
    const clockwise = [[0, 0], [4, 0], [4, 4], [0, 4]];
    const counterClockwise = [...clockwise].reverse();
    expect(shoelaceArea(counterClockwise)).toBe(shoelaceArea(clockwise));
  });
});

describe('centroidOf', () => {
  it('averages the vertex coordinates', () => {
    expect(centroidOf([[0, 0], [4, 0], [4, 4], [0, 4]])).toEqual([2, 2]);
  });

  it('handles a single point', () => {
    expect(centroidOf([[5, 7]])).toEqual([5, 7]);
  });
});

describe('bboxOf', () => {
  it('finds the axis-aligned bounds of a point set', () => {
    expect(bboxOf([[1, 5], [-2, 3], [4, -1], [0, 0]])).toEqual({
      minX: -2, minY: -1, maxX: 4, maxY: 5,
    });
  });

  it('collapses to a point for a single-vertex input', () => {
    expect(bboxOf([[3, 3]])).toEqual({ minX: 3, minY: 3, maxX: 3, maxY: 3 });
  });
});

describe('pointInPolygon', () => {
  const square = [[0, 0], [4, 0], [4, 4], [0, 4]];

  it('reports a point in the interior as inside', () => {
    expect(pointInPolygon(2, 2, square)).toBe(true);
  });

  it('reports a point well outside the bounds as outside', () => {
    expect(pointInPolygon(10, 10, square)).toBe(false);
  });

  // The main reason this exists rather than just checking the bbox: real
  // plots are concave (see usePlotMapEngine's own doc comment about merged
  // parcels), so a point can sit inside a shape's bounding box while being
  // outside the shape itself - hitTest relies on this to reject those.
  it('rejects a point inside the bounding box but outside a concave (L-shaped) polygon', () => {
    // an L occupying the 4x4 box [0,0]-[4,4], missing its top-right quadrant
    const lShape = [[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]];

    expect(pointInPolygon(3, 3, lShape)).toBe(false); // in the missing notch
    expect(pointInPolygon(1, 1, lShape)).toBe(true);  // bottom-left arm
    expect(pointInPolygon(3, 1, lShape)).toBe(true);  // bottom-right arm
    expect(pointInPolygon(1, 3, lShape)).toBe(true);  // top-left arm
  });

  it('is unaffected by winding direction', () => {
    const reversed = [...square].reverse();
    expect(pointInPolygon(2, 2, reversed)).toBe(true);
    expect(pointInPolygon(10, 10, reversed)).toBe(false);
  });
});
