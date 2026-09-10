// Shared camera/navigation math, independent of the renderer.
export const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * t * (t * (t * 6 - 15) + 10); };
export const shortestAngle = (from, to) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from));

export function findPath(nodes, from, to) {
  const byId = Object.fromEntries(nodes.map(node => [node.id, node]));
  if (!byId[from] || !byId[to]) return [];
  const previous = new Map([[from, null]]), queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (id === to) break;
    for (const link of byId[id].links) if (!previous.has(link.to)) {
      previous.set(link.to, {from: id, link});
      queue.push(link.to);
    }
  }
  if (!previous.has(to)) return [];
  const path = [];
  for (let id = to; previous.get(id); id = previous.get(id).from) path.unshift(previous.get(id).link);
  return path;
}

export const TOUR_STOPS = ['hall', 'living', 'dining', 'kitchenEntry', 'kitchen', 'kitchenSink', 'kitchenWork', 'rear', 'landing', 'basement', 'basementRear', 'hall2', 'bedFrontR', 'bedFrontL', 'bedBack', 'walkin', 'bath', 'loft'];

export function renderQuality(mode, dpr = 1, compact = false) {
  const quality = mode === 'auto' ? (compact ? 'balanced' : 'high') : mode;
  const profiles = {
    high: {pixelRatio: Math.min(dpr, 2), samples: 4, aoScale: .75, shadowSize: 4096},
    balanced: {pixelRatio: Math.min(dpr, 1.5), samples: 2, aoScale: .5, shadowSize: 2048},
    light: {pixelRatio: 1, samples: 0, aoScale: .35, shadowSize: 1024},
  };
  return {...(profiles[quality] || profiles.balanced), name: quality};
}
