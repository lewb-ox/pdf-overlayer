import { describe, expect, it } from 'vitest';
import { emptyState, getLegend, legendLayout, nextRoomNumber, roomMarkerPosition, roomNumbers, validateProject, type Matrix, type Overlay } from '../src/model';

const info = { width: 1190, height: 842, transform: [1, 0, 0, -1, 0, 842] as Matrix };
const room = (id: string, categoryId: string, number?: number): Overlay => ({ id, page: 0, name: `Meeting room ${id}`, categoryId, number, vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] });

describe('reference-style room legend', () => {
  it('groups numbered room names by category while preserving hidden-room numbering', () => {
    const state = emptyState();
    state.overlays = [room('A', 'meeting', 7), room('B', 'teaching', 1), { ...room('C', 'meeting', 3), hidden: true }, room('D', 'circulation', 12)];
    const layout = legendLayout(info, state, 0, 'First floor');
    expect(layout.groups.map(g => g.category.label)).toEqual(['AV1', 'AV2', 'AV4']);
    expect(layout.groups.flatMap(g => g.rooms.map(r => r.number))).toEqual([1, 7, 12]);
    expect(layout.items.filter(i => i.type === 'text').map(i => i.text).join(' ')).not.toContain('Meeting room C');
    expect(nextRoomNumber(state.overlays)).toBe(13);
    state.overlays[0].categoryId = 'support';
    expect(roomNumbers(state.overlays).get('A')).toBe(7);
  });
  it('assigns numbers to older projects without colliding with existing numbers', () => {
    const overlays = [room('legacy1', 'teaching'), room('fixed', 'meeting', 1), room('legacy2', 'support')];
    expect([...roomNumbers(overlays).entries()]).toEqual([['fixed', 1], ['legacy1', 2], ['legacy2', 3]]);
  });
  it('wraps titles, labels and long room names and keeps metadata when repositioning', () => {
    const state = emptyState();
    state.categories[0].label = 'AV1 - Flagship teaching and presentation facilities';
    state.overlays = [{ ...room('A', 'teaching', 1), name: 'Seminar room with a very long descriptive name that must wrap without clipping' }];
    state.legends[0] = { visible: true, x: 9999, y: 9999, title: 'New Radcliffe House - First Floor', subtitle: 'AV category overlay', note: 'Not shown: ground floor entrance.', footer: 'Base: example plan.' };
    const layout = legendLayout(info, state, 0);
    const texts = layout.items.filter(i => i.type === 'text');
    expect(texts.filter(i => i.weight === 600).length).toBeGreaterThan(2);
    expect(texts.map(i => i.text).join(' ')).toContain(state.overlays[0].name);
    expect(texts.map(i => i.text).join(' ')).toContain('Not shown: ground floor entrance.');
    const legend = getLegend(state, 0, info);
    expect(legend.title).toBe(state.legends[0].title);
    expect(legend.x + layout.width).toBeLessThanOrEqual(info.width);
    expect(legend.y + layout.height).toBeLessThanOrEqual(info.height);
  });
  it('places default markers inside a concave room rather than in its missing corner', () => {
    const marker = roomMarkerPosition([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 20 }, { x: 20, y: 20 }, { x: 20, y: 100 }, { x: 0, y: 100 }]);
    expect(marker.x >= 0 && marker.x <= 100 && marker.y >= 0 && marker.y <= 100).toBe(true);
    expect(marker.x < 20 || marker.y < 20).toBe(true);
  });
  it('accepts old saved projects and validates new numbers, marker positions and legend text', () => {
    const state = emptyState();
    state.overlays = [room('A', 'teaching')];
    const project = { format: 'pdf-overlayer', version: 1, filename: 'test.pdf', pdf: 'AAAA', state };
    expect(validateProject(project)).toBe(project);
    state.overlays[0].number = 1;
    state.overlays[0].labelPosition = { x: 23, y: 45 };
    state.legends[0] = { visible: true, x: 0, y: 0, title: 'First floor', note: 'Not shown: ground floor.' };
    expect(validateProject(JSON.parse(JSON.stringify(project))).state).toEqual(state);
    state.overlays.push(room('B', 'meeting', 1));
    expect(() => validateProject(project)).toThrow();
    state.overlays.pop();
    state.overlays[0].labelPosition.x = Number.NaN;
    expect(() => validateProject(project)).toThrow();
  });
});
