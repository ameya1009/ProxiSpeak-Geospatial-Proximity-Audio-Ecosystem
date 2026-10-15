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

// Test 6: 2D Coordinate Movement (Diagonal distance & 2D panning)
runner.start(440);
runner.setListenerPosition(100, 100);
const diagState = runner.setPeerPosition(130, 140); // dx = 30, dy = 40 => dist = 50
assert.strictEqual(diagState.distance, 50, 'Diagonal distance = 50 px');
assert.strictEqual(diagState.gain, 0.5, 'Gain at 50px = 0.5');
assert.strictEqual(diagState.pan, 0.3, 'Pan for dx=30 / 100 = 0.3');
runner.stop();
console.log('✔ 2D diagonal distance and spatial panning: OK');

// Test 7: Browser HTML UI and Paperwork Integrity
const fs = require('fs');
const path = require('path');
const htmlPath = path.join(__dirname, '../client/audio/index.html');
assert.strictEqual(fs.existsSync(htmlPath), true, 'client/audio/index.html exists');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
assert.strictEqual(htmlContent.includes('AudioMixer.js'), true, 'HTML references AudioMixer.js');
assert.strictEqual(htmlContent.includes('AudioSpikeRunner.js'), true, 'HTML references AudioSpikeRunner.js');
assert.strictEqual(htmlContent.includes('sliderDeltaX'), true, 'HTML contains sliderDeltaX');

const vivaPath = path.join(__dirname, '../docs/VIVA_PREPARATION.md');
assert.strictEqual(fs.existsSync(vivaPath), true, 'docs/VIVA_PREPARATION.md exists');
const checkinPath = path.join(__dirname, '../docs/DAILY_CHECKINS.md');
assert.strictEqual(fs.existsSync(checkinPath), true, 'docs/DAILY_CHECKINS.md exists');
console.log('✔ Browser HTML UI, viva guide, and daily check-ins verification: OK');

// --- SpatialAudioMixer Production Engine Tests (IAudioModule Contract) ---
const { SpatialAudioMixer } = require('../client/audio/src/SpatialAudioMixer');

function createMockAudioContext() {
  const connections = [];
  const disconnections = [];
  return {
    currentTime: 10,
    destination: { name: 'destination' },
    createStereoPanner() {
      const p = {
        name: 'panner',
        pan: {
          value: 0,
          setValueAtTime: (v) => { p.pan.value = v; },
          linearRampToValueAtTime: (v) => { p.pan.value = v; }
        },
        connect: (target) => { connections.push({ from: 'panner', to: target.name || 'node' }); },
        disconnect: () => { disconnections.push('panner'); }
      };
      return p;
    },
    createGain() {
      const g = {
        name: 'gain',
        gain: {
          value: 1,
          setValueAtTime: (v) => { g.gain.value = v; },
          linearRampToValueAtTime: (v) => { g.gain.value = v; }
        },
        connect: (target) => { connections.push({ from: 'gain', to: target.name || 'node' }); },
        disconnect: () => { disconnections.push('gain'); }
      };
      return g;
    },
    createMediaStreamSource(stream) {
      const s = {
        name: 'mediaSource',
        connect: (target) => { connections.push({ from: 'mediaSource', to: target.name || 'node' }); },
        disconnect: () => { disconnections.push('mediaSource'); }
      };
      return s;
    },
    connections,
    disconnections
  };
}

function createMockSourceNode() {
  const node = {
    name: 'mockSource',
    connect: (target) => {},
    disconnect: () => { node.disconnected = true; },
    stop: () => { node.stopped = true; }
  };
  return node;
}

// Test 8: SpatialAudioMixer Multi-Peer Lifecycle & IAudioModule Contract
const mockCtx2 = createMockAudioContext();
const mixer = new SpatialAudioMixer(mockCtx2, { earshotRadius: 100, rampTime: 0 });

const source1 = createMockSourceNode();
const source2 = createMockSourceNode();
const source3 = createMockSourceNode();

mixer.addPeer('peer-1', source1, { x: 0, y: 50 });  // d = 50px
mixer.addPeer('peer-2', source2, { x: 60, y: 0 });  // d = 60px
mixer.addPeer('peer-3', source3, { x: 150, y: 0 }); // d = 150px (silent)

const state1 = mixer.getPeerState('peer-1');
assert.strictEqual(state1.distance, 50, 'Peer 1 distance = 50px');
assert.strictEqual(state1.gain, 0.5, 'Peer 1 gain = 0.5');
assert.strictEqual(state1.pan, 0.0, 'Peer 1 pan = 0.0');
assert.strictEqual(state1.inEarshot, true, 'Peer 1 in earshot');

const state2 = mixer.getPeerState('peer-2');
assert.strictEqual(state2.distance, 60, 'Peer 2 distance = 60px');
assert.strictEqual(state2.gain, 0.4, 'Peer 2 gain = 0.4');
assert.strictEqual(state2.pan, 0.6, 'Peer 2 pan = 0.6 (Right)');
assert.strictEqual(state2.inEarshot, true, 'Peer 2 in earshot');

const state3 = mixer.getPeerState('peer-3');
assert.strictEqual(state3.distance, 150, 'Peer 3 distance = 150px');
assert.strictEqual(state3.gain, 0.0, 'Peer 3 gain = 0.0 (Silent beyond 100px)');
assert.strictEqual(state3.inEarshot, false, 'Peer 3 out of earshot');
console.log('✔ SpatialAudioMixer multi-peer initialization & distance gating: OK');

// Test 9: setListenerPosition & dynamic coordinate recalculation
mixer.setListenerPosition(50, 0); // Moved listener right by 50px
const updatedState1 = mixer.getPeerState('peer-1');
// Listener at (50, 0), Peer 1 at (0, 50) => dx = -50, dy = 50 => dist = sqrt(5000) ~ 70.71
assert.strictEqual(Math.round(updatedState1.distance), 71, 'Peer 1 distance updated');
assert.strictEqual(updatedState1.pan, -0.5, 'Peer 1 pan shifted left to -0.5');

// Update Peer 2 position directly onto listener (50, 0)
const state2Coincident = mixer.setPeerPosition('peer-2', 50, 0);
assert.strictEqual(state2Coincident.distance, 0, 'Coincident distance = 0');
assert.strictEqual(state2Coincident.gain, 1.0, 'Coincident gain = 1.0');
assert.strictEqual(state2Coincident.pan, 0.0, 'Coincident pan = 0.0');

// Mute toggle
assert.strictEqual(mixer.setMuted(true), true);
assert.strictEqual(mixer.setMuted(false), false);
console.log('✔ Listener movements, peer repositioning, and mute toggles: OK');

// Test 10: removePeer, node disconnect, and memory cleanup
const removed = mixer.removePeer('peer-1');
assert.strictEqual(removed, true, 'Peer 1 removed');
assert.strictEqual(mixer.getPeerState('peer-1'), null, 'Peer 1 state cleaned from Map');
assert.strictEqual(source1.disconnected, true, 'Peer 1 source disconnected');

mixer.destroy();
assert.strictEqual(mixer.peers.size, 0, 'All peers destroyed on shutdown');
console.log('✔ Node disconnect, garbage collection, and clean shutdown: OK');

console.log('\nAll 10 audio spike, SpatialAudioMixer, and multi-peer assertions passed cleanly.');
