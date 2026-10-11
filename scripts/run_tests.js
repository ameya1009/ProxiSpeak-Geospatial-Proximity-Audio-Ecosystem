/**
 * Pure JavaScript test runner to verify Ameya's mathematical and spatial algorithms
 */

const assert = require('assert');

// 1. Distance Gain Logic
function calculateGain(distance, maxRadius = 100) {
  if (distance >= maxRadius) return 0.0;
  if (distance <= 0) return 1.0;
  return Math.max(0, 1 - (distance / maxRadius));
}

// 2. Obstacle Line-Of-Sight Occlusion Logic
function linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (denom === 0) return false;
  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

function isOccluded(p1, p2, obstacles) {
  for (const obs of obstacles) {
    const left = obs.x, right = obs.x + obs.w, top = obs.y, bottom = obs.y + obs.h;
    if (
      linesIntersect(p1.x, p1.y, p2.x, p2.y, left, top, right, top) ||
      linesIntersect(p1.x, p1.y, p2.x, p2.y, right, top, right, bottom) ||
      linesIntersect(p1.x, p1.y, p2.x, p2.y, right, bottom, left, bottom) ||
      linesIntersect(p1.x, p1.y, p2.x, p2.y, left, bottom, left, top)
    ) {
      return true;
    }
  }
  return false;
}

// 3. Stereo Panning Logic
function calculatePan(dx, earshotRadius = 100) {
  const clamped = Math.max(-earshotRadius, Math.min(earshotRadius, dx));
  return clamped / earshotRadius;
}

// 4. Connection Capper with Hysteresis
function selectActivePeers(allPeers, currentActivePeerIds, maxConnections = 6, earshotRadius = 100, hysteresis = 20) {
  const valid = allPeers.filter(p => {
    const threshold = currentActivePeerIds.has(p.peerId) ? earshotRadius + hysteresis : earshotRadius;
    return p.distance <= threshold;
  });
  valid.sort((a, b) => a.distance - b.distance);
  return valid.slice(0, maxConnections).map(p => p.peerId);
}

// Run test assertions
console.log('--- Running Audio & WebRTC Unit Tests ---');

// Test 1: Distance falloff
assert.strictEqual(calculateGain(0), 1.0, 'Full volume at 0 px');
assert.strictEqual(calculateGain(100), 0.0, 'Silent at 100 px');
assert.strictEqual(calculateGain(150), 0.0, 'Silent beyond 100 px');
assert.strictEqual(calculateGain(50), 0.5, 'Linear mid-distance volume');
console.log('✔ Distance gain tests passed');

// Test 2: Stereo Pan
assert.strictEqual(calculatePan(-100), -1.0, 'Hard left panning');
assert.strictEqual(calculatePan(100), 1.0, 'Hard right panning');
assert.strictEqual(calculatePan(0), 0.0, 'Centered panning');
console.log('✔ Stereo panning tests passed');

// Test 3: Obstacle Occlusion
const wall = [{ x: 40, y: 0, w: 20, h: 100 }];
assert.strictEqual(isOccluded({ x: 10, y: 50 }, { x: 90, y: 50 }, wall), true, 'Occluded by wall');
assert.strictEqual(isOccluded({ x: 10, y: 10 }, { x: 30, y: 10 }, wall), false, 'Not occluded');
console.log('✔ Obstacle occlusion tests passed');

// Test 4: Connection Capping & Hysteresis
const peers = [
  { peerId: 'p1', distance: 20 },
  { peerId: 'p2', distance: 110 }, // within 120 hysteresis
  { peerId: 'p3', distance: 50 }
];
const activeWithExisting = selectActivePeers(peers, new Set(['p2']), 6, 100, 20);
assert.deepStrictEqual(activeWithExisting, ['p1', 'p3', 'p2'], 'Hysteresis keeps existing peer connected');

const activeWithoutExisting = selectActivePeers(peers, new Set(), 6, 100, 20);
assert.deepStrictEqual(activeWithoutExisting, ['p1', 'p3'], 'New peer beyond 100 px is excluded');
console.log('✔ Connection capper and hysteresis tests passed');

console.log('All 4 test suites passed successfully!');
