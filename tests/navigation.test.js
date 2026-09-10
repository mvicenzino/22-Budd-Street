import test from 'node:test';
import assert from 'node:assert/strict';
import {NODES, ROOMS, LEVELS} from '../plan.js';
import {findPath, smooth, shortestAngle, renderQuality, TOUR_STOPS} from '../navigation.js';

test('every room is reachable from the entry and has a return route outside', () => {
  for (const node of NODES) {
    if (node.id !== 'hall') assert.ok(findPath(NODES, 'hall', node.id).length, node.id);
    if (node.id !== 'porch') assert.ok(findPath(NODES, node.id, 'porch').length, node.id);
  }
});
test('tour spans every interior level and preserves door and stair waypoints', () => {
  const levels = new Set(TOUR_STOPS.map(id => ROOMS.find(r => r.id === NODES.find(n => n.id === id).room).level));
  assert.deepEqual([...levels].sort(), Object.keys(LEVELS).sort());
  for (let i = 1; i < TOUR_STOPS.length; i++) {
    let current = TOUR_STOPS[i - 1];
    const route = findPath(NODES, current, TOUR_STOPS[i]);
    assert.ok(route.length);
    for (const link of route) {
      assert.ok(NODES.find(n => n.id === current).links.includes(link));
      current = link.to;
    }
    assert.equal(current, TOUR_STOPS[i]);
  }
  const loft = findPath(NODES, 'hall', 'loft');
  assert.ok(loft.some(link => link.door === 'loft' && link.via?.length));
  assert.deepEqual(findPath(NODES, 'missing', 'loft'), []);
});
test('camera easing has exact endpoints and never overshoots', () => {
  assert.equal(smooth(-1), 0); assert.equal(smooth(2), 1);
  let last = 0;
  for (let i = 0; i <= 100; i++) { const value = smooth(i / 100); assert.ok(value >= last && value <= 1); last = value; }
  assert.ok(smooth(.001) < .000001);
  const from = Math.PI - .1, to = -Math.PI + .1;
  assert.ok(Math.abs(shortestAngle(from, to) - from - .2) < 1e-10);
});
test('render profiles respect native pixel density and constrain phone GPU cost', () => {
  assert.equal(renderQuality('high', 1).pixelRatio, 1);
  assert.equal(renderQuality('high', 3).pixelRatio, 2);
  assert.equal(renderQuality('auto', 3, true).name, 'balanced');
  assert.equal(renderQuality('light', 3).pixelRatio, 1);
  assert.ok(renderQuality('light').aoScale < renderQuality('high').aoScale);
});
