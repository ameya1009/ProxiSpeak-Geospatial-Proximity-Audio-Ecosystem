const assert = require('assert');
const { calculateDistance, calculateGain, calculatePan, createTestTone } = require('../client/audio/src/AudioMixer');
const { AudioSpikeRunner } = require('../client/audio/src/AudioSpikeRunner');

console.log('--- Running Audio Spike Math & Attenuation Tests ---');

// Test 1: Standard & Negative Coordinates Distance Calculation
assert.strictEqual(calculateDistance({ x: 0, y: 0 }, { x: 30, y: 40 }), 50, '30-40-50 Euclidean distance');
assert.strictEqual(calculateDistance({ x: 50, y: 50 }, { x: 50, y: 50 }), 0, 'Zero distance for identical points');
assert.strictEqual(calculateDistance({ x: -10, y: -20 }, { x: 20, y: 20 }), 50, 'Negative coordinate distance');
console.log('✔ Distance calculations & coordinate edge cases: OK');

// Test 2: Distance Gain Attenuation Curve (100px earshot)
assert.strictEqual(calculateGain(0, 100), 1.0, 'Full volume at 0 px');
assert.strictEqual(calculateGain(50, 100), 0.5, '50% volume at 50 px');
assert.strictEqual(calculateGain(100, 100), 0.0, 'Silent at 100 px');
assert.strictEqual(calculateGain(120, 100), 0.0, 'Silent beyond 100 px');
assert.strictEqual(calculateGain(-5, 100), 1.0, 'Clamped max volume for negative input');
assert.strictEqual(calculateGain(9999, 100), 0.0, 'Clamped min volume for huge distance');
console.log('✔ Distance gain curve & boundary conditions: OK');

// Test 3: Stereo Panning (-1.0 to +1.0)
assert.strictEqual(calculatePan(-100, 100), -1.0, 'Hard left pan');
assert.strictEqual(calculatePan(0, 100), 0.0, 'Center pan');
assert.strictEqual(calculatePan(100, 100), 1.0, 'Hard right pan');
assert.strictEqual(calculatePan(50, 100), 0.5, 'Right pan 0.5');
assert.strictEqual(calculatePan(-500, 100), -1.0, 'Clamped hard left beyond range');
assert.strictEqual(calculatePan(500, 100), 1.0, 'Clamped hard right beyond range');
console.log('✔ Stereo panning & clamping: OK');

// Test 4: Web Audio API Node Graph Wiring (Oscillator -> StereoPanner -> Gain -> Destination)
const connectionChain = [];
let gainSetVal = null;
let panSetVal = null;

const mockContext = {
  currentTime: 10,
  destination: { name: 'destination' },
  createOscillator() {
    const osc = {
      type: '',
      frequency: { setValueAtTime: (v) => { osc.freq = v; } },
      connect: (target) => { connectionChain.push({ from: 'oscillator', to: target.name || 'node' }); },
      start: () => { osc.started = true; },
      stop: () => { osc.stopped = true; }
    };
    return osc;
  },
  createStereoPanner() {
    return {
      name: 'panner',
      pan: { setValueAtTime: (v) => { panSetVal = v; } },
      connect: (target) => { connectionChain.push({ from: 'panner', to: target.name || 'node' }); }
    };
  },
  createGain() {
    return {
      name: 'gain',
      gain: { setValueAtTime: (v) => { gainSetVal = v; } },
      connect: (target) => { connectionChain.push({ from: 'gain', to: target.name || 'node' }); }
    };
  }
};

const tone = createTestTone(mockContext, 440);
assert.strictEqual(tone.osc.started, true, 'Oscillator started');
assert.strictEqual(connectionChain.length, 3, 'Complete 3-node audio pipeline wired');
assert.deepStrictEqual(connectionChain[0], { from: 'oscillator', to: 'panner' });
assert.deepStrictEqual(connectionChain[1], { from: 'panner', to: 'gain' });
assert.deepStrictEqual(connectionChain[2], { from: 'gain', to: 'destination' });
console.log('✔ Web Audio node graph routing & test tone instantiation: OK');

// Test 5: AudioSpikeRunner driven by distance slider
const runner = new AudioSpikeRunner(mockContext);
runner.start(440);

// Move distance slider to 0 px (center)
const stateAt0 = runner.setDistanceSlider(0);
assert.strictEqual(stateAt0.distance, 0);
assert.strictEqual(stateAt0.gain, 1.0);
assert.strictEqual(stateAt0.pan, 0.0);
assert.strictEqual(gainSetVal, 1.0);
assert.strictEqual(panSetVal, 0.0);

// Move distance slider to 60 px right
const stateAt60 = runner.setDistanceSlider(60);
assert.strictEqual(stateAt60.distance, 60);
assert.strictEqual(stateAt60.gain, 0.4);
assert.strictEqual(stateAt60.pan, 0.6);
assert.strictEqual(gainSetVal, 0.4);
assert.strictEqual(panSetVal, 0.6);

// Move distance slider to 100 px left (silent, hard left)
const stateAt100 = runner.setDistanceSlider(-100);
assert.strictEqual(stateAt100.distance, 100);
assert.strictEqual(stateAt100.gain, 0.0);
assert.strictEqual(stateAt100.pan, -1.0);
assert.strictEqual(gainSetVal, 0.0);
assert.strictEqual(panSetVal, -1.0);

runner.stop();
console.log('✔ AudioSpikeRunner distance slider behavior (gain attenuation & panning): OK');

console.log('\nAll audio spike tests and edge-case assertions passed cleanly.');
