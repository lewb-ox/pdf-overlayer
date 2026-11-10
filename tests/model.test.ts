import { describe, expect, it } from 'vitest';
import { emptyState, getLegend, inverseMatrix, legendLayout, moveVertex, pageCategories, pathData, transformPoint, validShape, validateProject, wrapLabel, type Matrix, type Vertex } from '../src/model';

describe('closed room paths', () => {
  it('always closes a complex polygon and preserves quadratic curves, including its closing edge', () => {
    const points: Vertex[] = [{ x: 10, y: 10, control: { x: 0, y: 50 } }, { x: 100, y: 10 }, { x: 100, y: 100, control: { x: 140, y: 50 } }, { x: 50, y: 60 }];
    expect(pathData(points)).toBe('M 10 10 L 100 10 Q 140 50 100 100 L 50 60 Q 0 50 10 10 Z');
    expect(validShape(points)).toBe(true);
    expect(pathData(points, false)).not.toContain(' Z');
  });
  it('rejects incomplete, duplicate and collinear straight shapes', () => {
    expect(validShape([{ x: 0, y: 0 }, { x: 2, y: 2 }])).toBe(false);
    expect(validShape([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }])).toBe(false);
    expect(validShape([{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 0 }])).toBe(false);
  });
  it('moves adjacent curve controls by half the vertex displacement', () => {
    const moved = moveVertex([{ x: 0, y: 0 }, { x: 100, y: 0, control: { x: 50, y: -20 } }, { x: 100, y: 100 }], 0, { x: 10, y: 20 });
    expect(moved[0]).toEqual({ x: 10, y: 20 });
    expect(moved[1].control).toEqual({ x: 55, y: -10 });
  });
});

describe('original-scale PDF coordinates', () => {
  it.each<Matrix>([
    [1, 0, 0, -1, -30, 730],
    [0, 1, 1, 0, -40, -30],
    [-1, 0, 0, 1, 630, -40],
    [0, -1, -1, 0, 730, 630],
    [2, 0, 0, -2, -60, 1460],
  ])('round-trips points for cropped/rotated pages and UserUnit scaling: %j', (...matrix: number[]) => {
    const transform = matrix as Matrix;
    const original = { x: 142.5, y: 316.75 };
    const mapped = transformPoint(transformPoint(original, transform), inverseMatrix(transform));
    expect(mapped.x).toBeCloseTo(original.x, 8);
    expect(mapped.y).toBeCloseTo(original.y, 8);
  });
});

describe('legends and saved projects', () => {
  it('includes only visible categories on the current page and clamps the legend to the page', () => {
    const state = emptyState();
    state.overlays = [
      { id: '1', page: 0, categoryId: 'teaching', name: 'A', vertices: [] },
      { id: '2', page: 0, categoryId: 'meeting', name: 'B', vertices: [], hidden: true },
      { id: '3', page: 1, categoryId: 'support', name: 'C', vertices: [] },
    ];
    expect(pageCategories(state, 0).map(c => c.id)).toEqual(['teaching']);
    state.legends[0] = { x: 9999, y: -20, visible: true };
    const info = { width: 800, height: 600, transform: [1, 0, 0, -1, 0, 600] as Matrix };
    const legend = getLegend(state, 0, info);
    expect(legend.x + legendLayout(info, pageCategories(state, 0)).width).toBeLessThanOrEqual(info.width);
    expect(legend.y).toBe(0);
  });
  it('wraps long labels, including a single unbroken word', () => {
    expect(wrapLabel('Teaching and collaborative learning spaces', 24)).toEqual(['Teaching and', 'collaborative learning', 'spaces']);
    expect(wrapLabel('X'.repeat(55), 24).map(l => l.length)).toEqual([24, 24, 7]);
  });
  it('rejects malformed and non-finite project data', () => {
    const project = { format: 'pdf-overlayer', version: 1, filename: 'test.pdf', pdf: 'AAAA', state: emptyState() };
    expect(validateProject(project)).toEqual(project);
    expect(() => validateProject({ ...project, version: 5 })).toThrow();
    const invalid = structuredClone(project);
    invalid.state.categories[0].opacity = Number.NaN;
    expect(() => validateProject(invalid)).toThrow();
    const duplicate = structuredClone(project);
    duplicate.state.categories.push(duplicate.state.categories[0]);
    expect(() => validateProject(duplicate)).toThrow();
  });
});
