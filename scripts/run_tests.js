/**
 * Audio Spike & Distance Attenuation Unit Tests
 * Verifies Ameya's 10-11 Oct (and 13-16 Oct) tasks:
 * - Distance-gain attenuation falloff from 0 px to 100 px (silent at 100 px)
 * - Stereo panner calculations (-1.0 to +1.0)
 * - Euclidean distance calculations
 */

const assert = require('assert');

function calculateDistance(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function calculateGain(distance, maxRadius = 100) {
  if (distance >= maxRadius) return 0.0;
  if (distance <= 0) return 1.0;
  return Math.max(0, 1 - (distance / maxRadius));
}

function calculatePan(dx, earshotRadius = 100) {
  const clamped = Math.max(-earshotRadius, Math.min(earshotRadius, dx));
  return clamped / earshotRadius;
}

console.log('--- Running Audio Spike Math & Distance Tests ---');

// Test 1: Distance calculation
assert.strictEqual(calculateDistance({ x: 0, y: 0 }, { x: 30, y: 40 }), 50, '3-4-5 triangle distance');
console.log('✔ Euclidean distance calculation verified (30,40 -> 50px)');

// Test 2: Distance-gain falloff (0 px full volume to 100 px silent)
assert.strictEqual(calculateGain(0), 1.0, 'Full volume at 0 px');
assert.strictEqual(calculateGain(50), 0.5, 'Half volume at 50 px');
assert.strictEqual(calculateGain(100), 0.0, 'Silent at 100 px');
assert.strictEqual(calculateGain(150), 0.0, 'Silent beyond 100 px');
console.log('✔ Distance gain curve verified (1.0 at 0px -> 0.0 at 100px)');

// Test 3: Stereo Panning
assert.strictEqual(calculatePan(-100), -1.0, 'Full left pan');
assert.strictEqual(calculatePan(0), 0.0, 'Center pan');
assert.strictEqual(calculatePan(100), 1.0, 'Full right pan');
assert.strictEqual(calculatePan(50), 0.5, 'Mid-right pan');
console.log('✔ Stereo panning values verified (-1.0 to 1.0)');

console.log('\nAll audio spike tests passed successfully without errors!');
